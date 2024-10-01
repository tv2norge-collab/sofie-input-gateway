import net from 'net'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { FeedbackStore } from '../../devices/feedbackStore'
import { DEFAULT_ANALOG_RATE_LIMIT, Symbols } from '../../lib'
import { ClassNames, Label, SomeFeedback, Tally } from '../../feedback/feedback'
import { SkaarhojPanelOptions } from '../../generated'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'
import ASCIIFolder from 'fold-to-ascii'

const SEND_TIMEOUT = 1000
const CONNECTION_TIMEOUT = 5000

import DEVICE_OPTIONS from './$schemas/options.json'

export class SkaarhojDevice extends Device {
	private socket: net.Socket | undefined
	private isClosing = false
	private config: SkaarhojPanelOptions
	private feedbacks = new FeedbackStore()

	constructor(config: SkaarhojPanelOptions, logger: Logger) {
		super(logger)
		this.config = config
	}

	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			let isOpen = false
			const socket = net.createConnection(
				{
					host: this.config.host,
					port: this.config.port,
					timeout: CONNECTION_TIMEOUT,
				},
				() => {
					;(async () => {
						isOpen = true
						await this.sendToDevice(`ActivePanel=1`)
						await sleep(50)
						await this.sendToDevice('Clear')
						await sleep(50) // Skaarhoj needs a bit of time after the clear command to start doing something
						for (const keyStr of Object.keys(this.feedbacks)) {
							await this.updateFeedback(keyStr)
						}
						resolve()
					})().catch(reject)
				}
			)
			socket.setEncoding('utf-8')
			socket.on('data', this.onData)
			socket.on('error', (err) => {
				if (!isOpen) reject(err)
				this.emit('error', {
					error: err,
				})
				socket.end()
				this.socket = undefined
			})
			socket.on('close', () => {
				if (this.isClosing) return
				this.emit('error', {
					error: new Error('Unexpected connection close'),
				})
				this.socket = undefined
			})
			this.socket = socket
		})
	}

	private onData = (data: string) => {
		// TODO: Respond to BSY, RDY & flow control in sendToDevice()
		let match: RegExpMatchArray | null = null
		if ((match = data.match(InboundMessages.Trigger)) === null) {
			this.logger.debug(`Uknown message from device: ${data}`)
			return
		}

		let triggerId = match[1]
		const mask = match[2]
		const state = match[3]
		if (mask) {
			triggerId += mask
		}
		if (state === 'Down') {
			triggerId += ` ${Symbols.DOWN}`

			this.addTriggerEvent({ triggerId })
		} else if (state === 'Up') {
			triggerId += ` ${Symbols.UP}`

			this.addTriggerEvent({ triggerId })
		} else {
			const stateMatch = state.match(AnalogStateChange.StateChange)
			if (stateMatch) {
				const value = parseFloat(stateMatch[2])
				const key = stateMatch[1]

				let direction = 0
				if (value < 0) direction = -1
				if (value > 0) direction = 1

				this.updateTriggerAnalog({ triggerId, rateLimit: DEFAULT_ANALOG_RATE_LIMIT }, () => {
					return {
						[key]: value,
						direction,
					}
				})
			} else {
				// TODO: what should happen here?

				this.addTriggerEvent({ triggerId })
			}
		}
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.socket) return
		this.isClosing = true
		const socket = this.socket
		return new Promise((resolve) => socket.end(resolve))
	}

	private static parseTriggerId(triggerId: string): { buttonId: string; action: string } {
		const triggerElements = triggerId.match(/^(\d+)(.\d+)?\s(\S+)$/)
		if (!triggerElements) {
			return { buttonId: '0', action: '' }
		}
		const buttonId = triggerElements[1] ?? '0'
		const action = triggerElements[3] ?? ''
		return { buttonId, action }
	}

	private async sendClearFeedback(key: string): Promise<void> {
		await this.sendToDevice(`HWC#${key}=0`)
		await this.sendToDevice(`HWCt#${key}=|7`)
	}

	private static normalizeString(input: string): string {
		// Skaarhoj only accepts ASCII characters, this deconstructs accent characters into ASCII
		// and accent character modifiers and then strips the accents
		return ASCIIFolder.foldReplacing(input, '?')
	}

	private static getShortishLabel(label: Label | undefined, makeUppercase?: boolean): string | undefined {
		if (label === undefined) return undefined
		let result = label.long
		if (result.length > 10 && label.short) {
			result = label.short
		}
		if (makeUppercase) return result.toUpperCase()
		return result
	}

	private async updateFeedback(feedbackId: string): Promise<void> {
		const feedback = this.feedbacks.get(feedbackId, ACTION_PRIORITIES)
		if (!feedback) {
			await this.sendClearFeedback(feedbackId)
			return
		}

		let tallyColor = 0
		let isAdlib = false
		let isPresent = false
		if (feedback?.classNames?.includes(ClassNames.AD_LIB)) {
			isAdlib = true
			if (((feedback.tally ?? 0) & Tally.PRESENT) !== 0) {
				tallyColor = 5
				isPresent = true
			}
			if (((feedback.tally ?? 0) & Tally.NEXT) !== 0) {
				tallyColor = 3
			}
			if (((feedback.tally ?? 0) & Tally.CURRENT) !== 0) {
				tallyColor = 2
			}
		} else {
			tallyColor = 4
			isPresent = true
		}

		let title = SkaarhojDevice.getShortishLabel(feedback.contentClass, true)
		let line1 = feedback.userLabel?.long ?? feedback.content?.long ?? SkaarhojDevice.getShortishLabel(feedback.action)
		let line2 = ''

		if (line1 !== undefined && line1.length > 10) {
			line2 = line1.substring(10, 20)
			line1 = line1.substring(0, 10)
		}

		let hasFilledTitle = true
		if (isAdlib && !isPresent) {
			hasFilledTitle = false

			if (!feedback.content) {
				await this.sendClearFeedback(feedbackId)
				return
			}
		}

		if (title) title = SkaarhojDevice.normalizeString(title).trim()
		if (line1) line1 = SkaarhojDevice.normalizeString(line1).trim()
		if (line2) line2 = SkaarhojDevice.normalizeString(line2).trim()

		await this.sendToDevice(`HWC#${feedbackId}=${tallyColor}`)
		await this.sendToDevice(
			`HWCt#${feedbackId}=|||${title ?? ''}|${hasFilledTitle ? '' : '1'}|${line1 ?? 'UNKNOWN'}|${line2}|`
		)
	}

	async setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void> {
		if (!this.socket) return
		const { buttonId, action } = SkaarhojDevice.parseTriggerId(triggerId)
		this.feedbacks.set(buttonId, action, feedback)
		await this.updateFeedback(buttonId)
	}

	async clearFeedbackAll(): Promise<void> {
		this.feedbacks.clear()
		if (!this.socket) return
		await this.sendToDevice('Clear')
	}

	private async sendToDevice(buf: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const socket = this.socket
			if (!socket) {
				reject(new Error('Socket not connected'))
				return
			}
			const timeout = setTimeout(() => reject('Send timeout'), SEND_TIMEOUT)
			socket.write(`${buf}\n`, (err) => {
				clearTimeout(timeout)
				if (err) {
					reject(err)
					return
				}
				resolve()
			})
		})
	}

	static getOptionsManifest(): object {
		return DEVICE_OPTIONS
	}
}

const InboundMessages = {
	Trigger: /^HWC#(\d+)(\.\d+)?=(\S+)/,
}

const AnalogStateChange = {
	StateChange: /^(\w+):([\d-.]+)$/,
}

const ACTION_PRIORITIES = [Symbols.DOWN, Symbols.UP, Symbols.JOG, Symbols.MOVE, Symbols.SHUTTLE, Symbols.T_BAR]

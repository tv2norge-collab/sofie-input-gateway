import net from 'net'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { DeviceConfigManifest, Symbols } from '../../lib'
import { ClassNames, Label, SomeFeedback, Tally } from '../../feedback/feedback'
import { ConfigManifestEntryType } from '@sofie-automation/server-core-integration'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'
import ASCIIFolder from 'fold-to-ascii'

const SEND_TIMEOUT = 1000
const CONNECTION_TIMEOUT = 5000

export interface SkaarhojDeviceConfig {
	host: string
	port: number
}

export const DEVICE_CONFIG: DeviceConfigManifest<SkaarhojDeviceConfig> = [
	{
		id: 'host',
		type: ConfigManifestEntryType.STRING,
		name: 'Address',
	},
	{
		id: 'port',
		type: ConfigManifestEntryType.INT,
		name: 'Port',
	},
]

export class SkaarhojDevice extends Device {
	#socket: net.Socket | undefined
	#closing = false
	#config: SkaarhojDeviceConfig
	#feedbacks: Record<string, SomeFeedback> = {}

	constructor(config: SkaarhojDeviceConfig, logger: Logger) {
		super(logger)
		this.#config = config
	}

	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			let isOpen = false
			const socket = net.createConnection(
				{
					host: this.#config.host,
					port: this.#config.port,
					timeout: CONNECTION_TIMEOUT,
				},
				() => {
					;(async () => {
						isOpen = true
						await this.sendToDevice(`ActivePanel=1`)
						await sleep(50)
						await this.sendToDevice('Clear')
						await sleep(50) // Skaarhoj needs a bit of time after the clear command to start doing something
						for (const keyStr of Object.keys(this.#feedbacks)) {
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
				this.#socket = undefined
			})
			socket.on('close', () => {
				if (this.#closing) return
				this.emit('error', {
					error: new Error('Unexpected connection close'),
				})
				this.#socket = undefined
			})
			this.#socket = socket
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

			this.triggerKeys.push({ triggerId })
			this.emit('trigger')
		} else if (state === 'Up') {
			triggerId += ` ${Symbols.UP}`

			this.triggerKeys.push({ triggerId })
			this.emit('trigger')
		} else {
			const stateMatch = state.match(AnalogStateChange.StateChange)
			if (stateMatch) {
				this.triggerAnalogs.set(triggerId, {
					[stateMatch[1]]: parseFloat(stateMatch[2]),
				})
				this.emit('trigger')
			} else {
				// TODO: what should happen here?

				this.triggerKeys.push({ triggerId })
				this.emit('trigger')
			}
		}
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.#socket) return
		this.#closing = true
		const socket = this.#socket
		return new Promise((resolve) => socket.end(resolve))
	}

	private static parseTriggerId(triggerId: string): [string, boolean] {
		const triggerElements = triggerId.match(/^(\d+)(.\d+)?\s(\S+)$/)
		if (!triggerElements) {
			return ['0', false]
		}
		const buttonId = triggerElements[1] ?? '0'
		const isUp = triggerElements[3] === Symbols.UP
		return [buttonId, isUp]
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

	private async updateFeedback(key: string): Promise<void> {
		const feedback = this.#feedbacks[key]
		if (!feedback) {
			await this.sendClearFeedback(key)
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
				await this.sendClearFeedback(key)
				return
			}
		}

		if (title) title = SkaarhojDevice.normalizeString(title).trim()
		if (line1) line1 = SkaarhojDevice.normalizeString(line1).trim()
		if (line2) line2 = SkaarhojDevice.normalizeString(line2).trim()

		await this.sendToDevice(`HWC#${key}=${tallyColor}`)
		await this.sendToDevice(
			`HWCt#${key}=|||${title ?? ''}|${hasFilledTitle ? '' : '1'}|${line1 ?? 'UNKNOWN'}|${line2}|`
		)
	}

	async setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void> {
		if (!this.#socket) return
		const [button] = SkaarhojDevice.parseTriggerId(triggerId)
		this.#feedbacks[button] = feedback
		await this.updateFeedback(button)
	}

	async clearFeedbackAll(): Promise<void> {
		for (const keyStr of Object.keys(this.#feedbacks)) {
			this.#feedbacks[keyStr] = null
			await this.updateFeedback(keyStr)
		}
		if (!this.#socket) return
		await this.sendToDevice('Clear')
	}

	private async sendToDevice(buf: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const socket = this.#socket
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
}

const InboundMessages = {
	Trigger: /^HWC#(\d+)(\.\d+)?=(\S+)/,
}

const AnalogStateChange = {
	StateChange: /^(\w+):([\d-.]+)$/,
}

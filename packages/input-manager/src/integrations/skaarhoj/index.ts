import net from 'net'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { DeviceConfigManifest, Symbols } from '../../lib'
import { ClassNames, SomeFeedback, Tally } from '../../feedback/feedback'
import { ConfigManifestEntryType } from '@sofie-automation/server-core-integration'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'

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
		const socket = net.createConnection(
			{
				host: this.#config.host,
				port: this.#config.port,
			},
			() => {
				;(async () => {
					await this.sendToDevice(`ActivePanel=1`)
					await sleep(50)
					await this.sendToDevice('Clear')
					for (const keyStr of Object.keys(this.#feedbacks)) {
						await this.updateFeedback(keyStr)
					}
				})().catch(this.logger.error)
			}
		)
		socket.setEncoding('utf-8')
		socket.on('data', this.onData)
		socket.on('error', () => {
			this.emit('error', {
				error: new Error('Socket error'),
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
	}

	private onData = (data: string) => {
		// TODO: Respond to BSY, RDY & flow control in sendToDevice()
		let match: RegExpMatchArray | null = null
		if ((match = data.match(InboundMessages.Trigger)) === null) {
			this.logger.debug(`Uknown message from device: ${data}`)
			return
		}
		let trigger = match[1]
		const mask = match[2]
		const state = match[3]
		if (mask) {
			trigger += mask
		}
		if (state === 'Down') {
			trigger += ` ${Symbols.DOWN}`
		} else if (state === 'Up') {
			trigger += ` ${Symbols.UP}`
		}

		this.emit('trigger', {
			triggerId: trigger,
		})
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.#socket) return
		this.#closing = true
		const socket = this.#socket
		return new Promise((resolve) => socket.end(resolve))
	}

	private static parseTriggerId(triggerId: string): [string, boolean] {
		const triggerElements = triggerId.match(/(\d+)(.\d+)?\s(\S+)/)
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
		return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

		let title = feedback.contentClass?.long.toUpperCase()
		let line1 = feedback.userLabel?.long ?? feedback.content?.long ?? feedback.action?.long
		let line2 = ''

		if (line1 !== undefined && line1.length > 10) {
			line2 = line1.substring(10, 20)
			line1 = line1.substring(0, 10)
		}

		if (isAdlib && !isPresent) {
			await this.sendClearFeedback(key)
			return
		}

		if (title) title = SkaarhojDevice.normalizeString(title)
		if (line1) line1 = SkaarhojDevice.normalizeString(line1)
		if (line2) line2 = SkaarhojDevice.normalizeString(line2)

		await this.sendToDevice(`HWC#${key}=${tallyColor}`)
		await this.sendToDevice(`HWCt#${key}=|||${title ?? ''}|${title ? '' : ''}|${line1 ?? 'UNKNOWN'}|${line2}|`)
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
			socket.write(`${buf}\n`, (err) => {
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

import { listStreamDecks, openStreamDeck, StreamDeck } from '@elgato-stream-deck/node'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'

export interface StreamDeckDeviceConfig {
	device: StreamDeckDeviceIdentifier
}

export interface StreamDeckDeviceIdentifier {
	path?: string
	serialNumber?: string
	index?: number
}

export class StreamDeckDevice extends Device {
	#streamDeck: StreamDeck | undefined
	#config: StreamDeckDeviceConfig

	constructor(config: StreamDeckDeviceConfig, logger: Logger) {
		super(logger)
		this.#config = config
	}

	async init(): Promise<void> {
		const allDevices = listStreamDecks()
		const deviceInfo = allDevices.find((thisDevice, index) => {
			let match = true
			if (this.#config.device.path && thisDevice.path !== this.#config.device.path) match = false
			if (this.#config.device.serialNumber && thisDevice.serialNumber !== this.#config.device.serialNumber)
				match = false
			if (this.#config.device.index && index !== this.#config.device.index) match = false

			return match
		})
		if (!deviceInfo) throw new Error('Matching device not found')
		const device = openStreamDeck(deviceInfo.path, {
			resetToLogoOnClose: true,
		})
		if (!device) throw new Error(`Could not open device: "${deviceInfo.path}"`)
		this.#streamDeck = device

		this.#streamDeck.addListener('down', (key) => {
			const triggerId = `down ${key}`
			this.emit('trigger', {
				triggerId,
			})
		})
		this.#streamDeck.addListener('up', (key) => {
			const triggerId = `up ${key}`
			this.emit('trigger', {
				triggerId,
			})
		})
		this.#streamDeck.addListener('error', (err) => {
			this.logger.error(String(err))
		})
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.#streamDeck) return
		await this.#streamDeck.close()
	}

	setFeedback(): void {
		void ''
	}
}

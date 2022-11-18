import { listStreamDecks, openStreamDeck, StreamDeck } from '@elgato-stream-deck/node'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { Symbols } from '../../lib'
import { SomeFeedback } from '../../feedback/feedback'
import { getBitmap } from '../../feedback/bitmap'

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
	#feedbacks: Record<number, SomeFeedback> = {}
	private BTN_SIZE: number | undefined = undefined

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
		this.BTN_SIZE = this.#streamDeck.ICON_SIZE

		this.#streamDeck.addListener('down', (key) => {
			const triggerId = `${key} ${Symbols.DOWN}`
			this.emit('trigger', {
				triggerId,
			})

			this.updateFeedback(key, true).catch(console.error)
		})
		this.#streamDeck.addListener('up', (key) => {
			const triggerId = `${key} ${Symbols.UP}`
			this.emit('trigger', {
				triggerId,
			})

			this.updateFeedback(key, false).catch(console.error)
		})
		this.#streamDeck.addListener('error', (err) => {
			this.logger.error(String(err))
		})
		await this.#streamDeck.clearPanel()
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.#streamDeck) return
		await this.#streamDeck.close()
	}

	private static parseTriggerId(triggerId: string): [number, boolean] {
		const triggerElements = triggerId.split(/\s+/)
		const buttonId = Number.parseInt(triggerElements[0] ?? '0')
		const isUp = triggerElements[1] === Symbols.UP
		return [buttonId, isUp]
	}

	private async updateFeedback(key: number, isDown: boolean): Promise<void> {
		const streamdeck = this.#streamDeck
		if (!streamdeck || this.BTN_SIZE === undefined) return
		const feedback = this.#feedbacks[key]
		if (!feedback) {
			await streamdeck.clearKey(key)
			return
		}

		const imgBuffer = await getBitmap(feedback, this.BTN_SIZE, this.BTN_SIZE, isDown)
		await this.#streamDeck?.fillKeyBuffer(key, imgBuffer, {
			format: 'rgba',
		})
	}

	async setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void> {
		if (!this.#streamDeck) return

		const [button] = StreamDeckDevice.parseTriggerId(triggerId)

		this.#feedbacks[button] = feedback

		await this.updateFeedback(button, false)
	}
}

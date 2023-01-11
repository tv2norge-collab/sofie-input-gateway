import { listStreamDecks, openStreamDeck, StreamDeck } from '@elgato-stream-deck/node'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { DeviceConfigManifest, Symbols } from '../../lib'
import { SomeFeedback } from '../../feedback/feedback'
import { getBitmap } from '../../feedback/bitmap'
import { ConfigManifestEntryType } from '@sofie-automation/server-core-integration'

export interface StreamDeckDeviceConfig {
	path?: string
	serialNumber?: string
	index?: number
}

export const DEVICE_CONFIG: DeviceConfigManifest<StreamDeckDeviceConfig> = [
	{
		id: 'path',
		type: ConfigManifestEntryType.STRING,
		name: 'Device Path',
	},
	{
		id: 'serialNumber',
		type: ConfigManifestEntryType.STRING,
		name: 'Serial Number',
	},
	{
		id: 'index',
		type: ConfigManifestEntryType.INT,
		name: 'Device Index',
	},
]

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
			if (this.#config.path && thisDevice.path !== this.#config.path) match = false
			if (this.#config.serialNumber && thisDevice.serialNumber !== this.#config.serialNumber) match = false
			if (this.#config.index && index !== this.#config.index) match = false

			return match
		})
		if (!deviceInfo) throw new Error('Matching device not found')

		this.logger.debug(
			`Stream Deck: path: ${deviceInfo.path}, serialNumber: ${deviceInfo.serialNumber}, index: ${allDevices.indexOf(
				deviceInfo
			)}`
		)

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

			this.updateFeedback(key, true).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('up', (key) => {
			const triggerId = `${key} ${Symbols.UP}`
			this.emit('trigger', {
				triggerId,
			})

			this.updateFeedback(key, false).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('error', (err) => {
			this.logger.error(String(err))
			this.emit('error', { error: err instanceof Error ? err : new Error(String(err)) })
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

	async clearFeedbackAll(): Promise<void> {
		for (const keyStr of Object.keys(this.#feedbacks)) {
			const key = Number(keyStr)
			this.#feedbacks[key] = null
			await this.updateFeedback(key, false)
		}
	}
}

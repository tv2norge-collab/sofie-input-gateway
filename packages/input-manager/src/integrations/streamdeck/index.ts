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
	#feedbacks: Record<string, SomeFeedback> = {}
	private BTN_SIZE: number | undefined = undefined
	private ENC_SIZE_WIDTH: number | undefined = undefined
	private ENC_SIZE_HEIGHT: number | undefined = undefined

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
		this.ENC_SIZE_HEIGHT = this.#streamDeck.LCD_ENCODER_SIZE?.height
		this.ENC_SIZE_WIDTH = this.#streamDeck.LCD_ENCODER_SIZE?.width

		this.#streamDeck.addListener('down', (key) => {
			const id = `${key}`
			const triggerId = `${id} ${Symbols.DOWN}`
			this.emit('trigger', {
				triggerId,
			})

			this.updateFeedback(id, true).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('up', (key) => {
			const id = `${key}`
			const triggerId = `${id} ${Symbols.UP}`
			this.emit('trigger', {
				triggerId,
			})

			this.updateFeedback(id, false).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('encoderDown', (encoder) => {
			const id = `Enc${encoder}`
			const triggerId = `${id} ${Symbols.DOWN}`
			this.emit('trigger', {
				triggerId,
			})

			this.updateFeedback(id, true).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('encoderUp', (encoder) => {
			const id = `Enc${encoder}`
			const triggerId = `${id} ${Symbols.UP}`
			this.emit('trigger', {
				triggerId,
			})

			this.updateFeedback(id, false).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('rotateLeft', (encoder) => {
			const id = `Enc${encoder}`
			const triggerId = `${id} ${Symbols.JOG}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					value: -1,
				},
			})

			this.updateFeedback(id, false).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('rotateRight', (encoder) => {
			const id = `Enc${encoder}`
			const triggerId = `${id} ${Symbols.JOG}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					value: 1,
				},
			})

			this.updateFeedback(id, false).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('lcdShortPress', (encoder, position) => {
			const id = `Enc${encoder}`
			const triggerId = `${id} Tap`
			this.emit('trigger', {
				triggerId,
				arguments: {
					x: position.x,
					y: position.y,
				},
			})

			this.updateFeedback(id, false).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('lcdLongPress', (encoder, position) => {
			const id = `Enc${encoder}`
			const triggerId = `${id} Press`
			this.emit('trigger', {
				triggerId,
				arguments: {
					x: position.x,
					y: position.y,
				},
			})

			this.updateFeedback(id, false).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
		})
		this.#streamDeck.addListener('lcdSwipe', (fromEncoder, toEncoder, from, to) => {
			const id = `Enc${fromEncoder}`
			const triggerId = `${id} Swipe`
			this.emit('trigger', {
				triggerId,
				arguments: {
					toEncoder,
					fromX: from.x,
					fromY: from.y,
					toX: to.x,
					toY: to.y,
				},
			})

			this.updateFeedback(id, false).catch((err) => this.logger.error(`Stream Deck: Error updating feedback: ${err}`))
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

	private static parseTriggerId(triggerId: string): {
		id: string
		key: number | undefined
		encoder: number | undefined
		isUp: boolean
		isUpDown: boolean
	} {
		const triggerElements = triggerId.split(/\s+/)
		const id = triggerElements[0] ?? '0'
		const isUp = triggerElements[1] === Symbols.UP
		const isUpDown = triggerElements[1] === Symbols.UP || triggerElements[1] === Symbols.DOWN
		let key: number | undefined = undefined
		let encoder: number | undefined = undefined
		let result = null
		if ((result = id.match(/^Enc(\d+)$/))) {
			encoder = Number(result[1]) ?? 0
			return { id, key, encoder, isUp, isUpDown }
		}
		key = Number(id) ?? 0
		return { id, key, encoder, isUp, isUpDown }
	}

	private async updateFeedback(trigger: string, isDown: boolean): Promise<void> {
		const streamdeck = this.#streamDeck
		if (!streamdeck) return
		const feedback = this.#feedbacks[trigger]

		const { key, encoder } = StreamDeckDevice.parseTriggerId(trigger)

		try {
			if (!feedback) {
				if (key !== undefined) await streamdeck.clearKey(key)
				if (encoder !== undefined && this.ENC_SIZE_HEIGHT && this.ENC_SIZE_WIDTH) {
					const imgBuffer = await getBitmap(null, this.ENC_SIZE_WIDTH, this.ENC_SIZE_HEIGHT, false)
					await streamdeck.fillEncoderLcd(encoder, imgBuffer, {
						format: 'rgba',
					})
				}
				return
			}

			if (key !== undefined && this.BTN_SIZE) {
				this.#streamDeck?.checkValidKeyIndex(key)
				const imgBuffer = await getBitmap(feedback, this.BTN_SIZE, this.BTN_SIZE, isDown)
				await this.#streamDeck?.fillKeyBuffer(key, imgBuffer, {
					format: 'rgba',
				})
			} else if (encoder !== undefined && this.ENC_SIZE_HEIGHT && this.ENC_SIZE_WIDTH) {
				const imgBuffer = await getBitmap(feedback, this.ENC_SIZE_WIDTH, this.ENC_SIZE_HEIGHT, isDown)
				await streamdeck.fillEncoderLcd(encoder, imgBuffer, {
					format: 'rgba',
				})
			}
		} catch (e) {
			this.emit('debug', `Exception thrown in updateFeedback()`, e)
		}
	}

	async setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void> {
		if (!this.#streamDeck) return

		const { id: trigger, isUpDown } = StreamDeckDevice.parseTriggerId(triggerId)

		if (!isUpDown) return

		this.#feedbacks[trigger] = feedback

		await this.updateFeedback(trigger, false)
	}

	async clearFeedbackAll(): Promise<void> {
		for (const keyStr of Object.keys(this.#feedbacks)) {
			const key = keyStr
			this.#feedbacks[key] = null
			await this.updateFeedback(key, false)
		}
	}
}

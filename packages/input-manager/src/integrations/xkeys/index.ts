import { listAllConnectedPanels, setupXkeysPanel, XKeys } from 'xkeys'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { DEFAULT_ANALOG_RATE_LIMIT, DeviceConfigManifest, Symbols } from '../../lib'
import { ClassNames, SomeFeedback, Tally } from '../../feedback/feedback'
import { ConfigManifestEntryType } from '@sofie-automation/server-core-integration'

enum Colors {
	RED = '#ff0000',
	GREEN = '#00ff00',
	BLUE = '#0000ff',
	WHITE = '#ffffff',
	YELLOW = '#ffff00',
	ORANGE = '#ff8000',
}

export interface XKeysDeviceConfig {
	unitId?: number
	path?: string
	productId?: number
	serialNumber?: string
}

export const DEVICE_CONFIG: DeviceConfigManifest<XKeysDeviceConfig> = [
	{
		id: 'unitId',
		type: ConfigManifestEntryType.INT,
		name: 'Unit ID',
		hint: 'This is a user-configurable ID that is supposed to identify the set of physical labels on the buttons',
	},
	{
		id: 'path',
		type: ConfigManifestEntryType.STRING,
		name: 'Device Path',
	},
	{
		id: 'productId',
		type: ConfigManifestEntryType.INT,
		name: 'Product ID',
	},
	{
		id: 'serialNumber',
		type: ConfigManifestEntryType.INT,
		name: 'Serial Number',
	},
]

export class XKeysDevice extends Device {
	#config: XKeysDeviceConfig
	#feedbacks: Record<number, SomeFeedback> = {}
	#device: XKeys | undefined

	constructor(config: XKeysDeviceConfig, logger: Logger) {
		super(logger)
		this.#config = config
	}

	async init(): Promise<void> {
		const allDevices = listAllConnectedPanels()
		const useDevices = (
			await Promise.allSettled(
				allDevices.map(async (thisDevice): Promise<XKeys | null> => {
					const config = this.#config
					if (config.productId && thisDevice.productId !== config.productId) return null

					const xkeysDevice = await setupXkeysPanel(thisDevice)

					let match = true

					// Try matching the unitId (unitId === 0 means that it hasn't been set)
					if (
						config.unitId !== undefined &&
						config.unitId !== 0 &&
						xkeysDevice.unitId !== 0 &&
						config.unitId !== xkeysDevice.unitId
					)
						match = false
					if (config.path && thisDevice.path !== config.path) match = false
					if (config.serialNumber && thisDevice.serialNumber !== config.serialNumber) match = false

					if (match === false) {
						// nothing matched..
						await xkeysDevice.close()
						return null
					}

					return xkeysDevice
				})
			)
		)
			.map((promiseResult) => {
				if (promiseResult.status === 'rejected') {
					this.logger.error(`X-Keys: Error when snooping on device: ${promiseResult.reason}`) // TODO: Stringify error
					return null
				}
				return promiseResult.value
			})
			.filter(Boolean) as XKeys[]

		const device = useDevices[0]
		for (let i = 1; i < useDevices.length; i++) {
			const otherDevice = useDevices[i]
			await otherDevice.close()
		}

		if (!device) throw new Error('Matching device not found')

		this.logger.debug(
			`X-Keys: productId: ${device.info.productId}, unitId: ${device.unitId}, path: ${device.devicePath}`
		)

		this.#device = device

		this.#device.on('down', (keyIndex) => {
			const triggerId = `${keyIndex} ${Symbols.DOWN}`
			this.addTriggerEvent({ triggerId })
		})

		this.#device.on('up', (keyIndex) => {
			const triggerId = `${keyIndex} ${Symbols.UP}`
			this.addTriggerEvent({ triggerId })
		})

		this.#device.on('jog', (index, deltaValue) => {
			const triggerId = `${index} ${Symbols.JOG}`

			this.updateTriggerAnalog({ triggerId, rateLimit: DEFAULT_ANALOG_RATE_LIMIT }, (prev?: { deltaValue: number }) => {
				if (!prev) prev = { deltaValue: 0 }
				return {
					deltaValue: prev.deltaValue + deltaValue,
				}
			})
		})

		this.#device.on('shuttle', (index, position) => {
			const triggerId = `${index} ${Symbols.SHUTTLE}`

			this.updateTriggerAnalog({ triggerId, rateLimit: DEFAULT_ANALOG_RATE_LIMIT }, (prev?: { position: number }) => {
				if (!prev) prev = { position: 0 }
				return {
					position: prev.position + position,
				}
			})
		})

		this.#device.on('tbar', (index, position) => {
			const triggerId = `${index} ${Symbols.T_BAR}`

			this.updateTriggerAnalog({ triggerId, rateLimit: DEFAULT_ANALOG_RATE_LIMIT }, (prev?: { position: number }) => {
				if (!prev) prev = { position: 0 }
				return {
					position: prev.position + position,
				}
			})
		})

		this.#device.on('joystick', (index, positions) => {
			const triggerId = `${index} ${Symbols.MOVE}`

			this.updateTriggerAnalog(
				{ triggerId, rateLimit: DEFAULT_ANALOG_RATE_LIMIT },
				(prev?: { yPosition: number; xPosition: number; zPosition: number; zDelta: number }) => {
					if (!prev) prev = { yPosition: 0, xPosition: 0, zPosition: 0, zDelta: 0 }
					return {
						xPosition: positions.x,
						yPosition: positions.y,
						zPosition: positions.z,
						zDelta: prev.zDelta + positions.deltaZ,
					}
				}
			)
		})

		this.#device.on('disconnected', () => {
			this.logger.warn(`X-Keys: Disconnected`)
			this.emit('error', { error: new Error('X-Keys: Disconnected') })
		})

		this.#device.on('error', (err) => {
			this.logger.error(`X-Keys: Received Error: ${err}`)
			this.emit('error', { error: err instanceof Error ? err : new Error(String(err)) })
		})
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.#device) return
		this.#device.removeAllListeners()
		await this.#device.close()
	}

	private static parseTriggerId(triggerId: string): { keyIndex: number; isButton: boolean; isUp: boolean } {
		const triggerElements = triggerId.split(/\s+/)
		const keyIndex = Number.parseInt(triggerElements[0] ?? '0')
		const isButton = triggerElements[1] === Symbols.UP || triggerElements[1] === Symbols.DOWN
		const isUp = triggerElements[1] === Symbols.UP
		return { keyIndex, isButton, isUp }
	}

	private static selectKeyBacklight(tally: Tally | undefined, classNames: string[] | undefined): string | null {
		if (classNames === undefined) return null
		if (tally !== undefined && (tally & Tally.CURRENT) === Tally.CURRENT) return Colors.RED
		if (tally !== undefined && (tally & Tally.NEXT) === Tally.CURRENT) return Colors.GREEN
		if (classNames.includes(ClassNames.AD_LIB)) return Colors.ORANGE
		return null
	}

	private async updateFeedback(key: number): Promise<void> {
		const device = this.#device
		if (!device) return
		const feedback = this.#feedbacks[key]
		if (!feedback) {
			device.setBacklight(key, null)
			return
		}

		device.setBacklight(key, XKeysDevice.selectKeyBacklight(feedback.tally, feedback.classNames))
	}

	async setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void> {
		if (!this.#device) return

		const { keyIndex, isButton } = XKeysDevice.parseTriggerId(triggerId)

		if (!isButton) return

		this.#feedbacks[keyIndex] = feedback

		await this.updateFeedback(keyIndex)
	}

	async clearFeedbackAll(): Promise<void> {
		for (const keyStr of Object.keys(this.#feedbacks)) {
			const key = Number(keyStr)
			this.#feedbacks[key] = null
			await this.updateFeedback(key)
		}
	}
}

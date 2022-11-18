import { listAllConnectedPanels, setupXkeysPanel, XKeys } from 'xkeys'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { Symbols } from '../../lib'
import { ClassNames, SomeFeedback, Tally } from '../../feedback/feedback'

enum Colors {
	RED = '#ff0000',
	GREEN = '#00ff00',
	BLUE = '#0000ff',
	WHITE = '#ffffff',
	YELLOW = '#ffff00',
	ORANGE = '#ff8000',
}

export interface XKeysDeviceConfig {
	device: XKeysDeviceIdentifier
}

export interface XKeysDeviceIdentifier {
	path?: string
	serialNumber?: string
	productId?: number
	index?: number
}

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
		const deviceInfo = allDevices.find((thisDevice, index) => {
			let match = true
			if (this.#config.device.path && thisDevice.path !== this.#config.device.path) match = false
			if (this.#config.device.serialNumber && thisDevice.serialNumber !== this.#config.device.serialNumber)
				match = false
			if (this.#config.device.productId && thisDevice.productId !== this.#config.device.productId) match = false
			if (this.#config.device.index && index !== this.#config.device.index) match = false

			return match
		})
		if (!deviceInfo) throw new Error('Matching device not found')

		const device = await setupXkeysPanel(deviceInfo)
		this.#device = device

		this.#device.on('down', (keyIndex) => {
			const triggerId = `${keyIndex} ${Symbols.DOWN}`
			this.emit('trigger', {
				triggerId,
			})
		})

		this.#device.on('up', (keyIndex) => {
			const triggerId = `${keyIndex} ${Symbols.UP}`
			this.emit('trigger', {
				triggerId,
			})
		})

		this.#device.on('jog', (index, value) => {
			const triggerId = `${index} ${Symbols.JOG}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					value,
				},
			})
		})

		this.#device.on('shuttle', (index, value) => {
			const triggerId = `${index} ${Symbols.SHUTTLE}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					value,
				},
				replacesPrevious: true,
			})
		})

		this.#device.on('tbar', (index, value) => {
			const triggerId = `${index} ${Symbols.T_BAR}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					value,
				},
				replacesPrevious: true,
			})
		})

		this.#device.on('joystick', (index, value) => {
			const triggerId = `${index} ${Symbols.MOVE}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					x: value.x,
					y: value.y,
					z: value.z,
					deltaZ: value.deltaZ,
				},
				replacesPrevious: true,
			})
		})

		this.#device.addListener('error', (err) => {
			this.logger.error(String(err))
		})
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.#device) return
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
}

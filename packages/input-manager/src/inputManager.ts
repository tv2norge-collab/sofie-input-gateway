import EventEmitter from 'eventemitter3'
import { Device, TriggerEventArgs as DeviceTriggerEventArgs } from './devices/device'
import { SomeFeedback } from './feedback/feedback'
import { HTTPDevice, HTTPDeviceConfig, DEVICE_CONFIG as HTTP_CONFIG } from './integrations/http'
import { MIDIDevice, MIDIDeviceConfig, DEVICE_CONFIG as MIDI_CONFIG } from './integrations/midi'
import {
	StreamDeckDevice,
	StreamDeckDeviceConfig,
	DEVICE_CONFIG as STREAM_DECK_CONFIG,
} from './integrations/streamdeck'
import { XKeysDevice, XKeysDeviceConfig, DEVICE_CONFIG as XKEYS_CONFIG } from './integrations/xkeys'
import { SkaarhojDevice, SkaarhojDeviceConfig, DEVICE_CONFIG as SKAARHOJ_CONFIG } from './integrations/skaarhoj'
import { DeviceConfigManifest, throwNever } from './lib'
import { Logger } from './logger'
import { init as initBitmapFeedback } from './feedback/bitmap'
import { DeviceType } from './integrations/deviceType'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'

interface Config {
	devices: Record<string, SomeDeviceConfig>
}

type DeviceConfig<Type extends string, T> = {
	type: Type
} & T

type SomeDeviceConfig =
	| DeviceConfig<DeviceType.MIDI, MIDIDeviceConfig>
	| DeviceConfig<DeviceType.HTTP, HTTPDeviceConfig>
	| DeviceConfig<DeviceType.STREAM_DECK, StreamDeckDeviceConfig>
	| DeviceConfig<DeviceType.X_KEYS, XKeysDeviceConfig>
	| DeviceConfig<DeviceType.SKAARHOJ, SkaarhojDeviceConfig>

interface TriggerEventArgs extends DeviceTriggerEventArgs {
	/** The ID of the device that issued this event */
	deviceId: string
	/** Should this event replace whatever unsent events there are */
	replacesPrevious?: boolean
}

interface StatusChangeEventArgs {
	deviceId: string
	status: StatusCode
}

type DeviceEvents = {
	trigger: [e: TriggerEventArgs]
	statusChange: [e: StatusChangeEventArgs]
}

const REFRESH_INTERVAL = 5000

class InputManager extends EventEmitter<DeviceEvents> {
	#devices: Record<string, Device> = {}
	#logger: Logger
	#refreshRunning = false
	#refreshInterval: NodeJS.Timeout | undefined
	#feedback: Record<string, Record<string, SomeFeedback>> = {}

	constructor(private config: Config, logger: Logger) {
		super()
		this.#logger = logger
	}

	async init(): Promise<void> {
		this.#devices = {}

		await initBitmapFeedback()

		await Promise.all(
			Object.entries(this.config.devices).map(async ([deviceId, deviceConfig]) =>
				this.createDevice(deviceId, deviceConfig)
			)
		)

		this.#refreshInterval = setInterval(this.refreshDevicesInterval, REFRESH_INTERVAL)
	}

	private refreshDevicesInterval = (): void => {
		if (this.#refreshRunning === true) return

		this.#refreshRunning = true
		this.refreshDevices()
			.catch((e) => {
				this.#logger.error(`Could not refresh devices: ${e}`)
			})
			.finally(() => {
				this.#refreshRunning = false
			})
	}

	private async refreshDevices(): Promise<void> {
		await Promise.allSettled(
			Object.entries(this.config.devices).map(async ([deviceId, deviceConfig]) => {
				if (this.#devices[deviceId] !== undefined) return

				await this.createDevice(deviceId, deviceConfig)
				return this.refreshFeedback(deviceId)
			})
		)
	}

	private async createDevice(deviceId: string, deviceConfig: SomeDeviceConfig): Promise<void> {
		let device
		try {
			device = createNewDevice(deviceConfig, this.#logger)
			device.on('trigger', (eventArgs) => {
				this.emit('trigger', {
					...eventArgs,
					deviceId,
				})
			})
			const erroredDevice = device
			device.on('error', (errorArgs) => {
				this.#logger.error(`Error in "${deviceId}": ${errorArgs.error}`)
				this.emit('statusChange', {
					deviceId,
					status: StatusCode.BAD,
				})
				erroredDevice
					.destroy()
					.catch((e) => {
						this.#logger.error(`Error when trying to destroy "${deviceId}": ${e}`)
					})
					.finally(() => {
						// this allows the device to be re-initialized in refreshDevices()
						delete this.#devices[deviceId]
					})
			})
			device.on('statusChange', (statusChangeArgs) => {
				this.emit('statusChange', {
					deviceId,
					status: statusChangeArgs.status,
				})
			})
			this.#devices[deviceId] = device

			await device.init()
			this.emit('statusChange', {
				deviceId,
				status: StatusCode.GOOD,
			})
		} catch (e) {
			if (device) await device.destroy()
			delete this.#devices[deviceId]
			this.emit('statusChange', {
				deviceId,
				status: StatusCode.BAD,
			})
		}
	}

	async destroy(): Promise<void> {
		this.removeAllListeners()

		if (this.#refreshInterval) clearInterval(this.#refreshInterval)

		await Promise.all(Object.values(this.#devices).map(async (device) => device.destroy()))
		this.#devices = {}
	}

	private cacheFeedback(deviceId: string, triggerId: string, feedback: SomeFeedback) {
		if (this.#feedback[deviceId] === undefined) {
			this.#feedback[deviceId] = {}
		}

		const deviceFeedback = this.#feedback[deviceId]
		deviceFeedback[triggerId] = feedback
	}

	async setFeedback(deviceId: string, triggerId: string, feedback: SomeFeedback): Promise<void> {
		const device = this.#devices[deviceId]
		if (!device) throw new Error(`Could not find device "${deviceId}"`)

		this.cacheFeedback(deviceId, triggerId, feedback)
		await device.setFeedback(triggerId, feedback)
	}

	async clearFeedbackAll(): Promise<void> {
		for (const [deviceId, device] of Object.entries(this.#devices)) {
			this.#feedback[deviceId] = {}
			await device.clearFeedbackAll()
		}
	}

	private async refreshFeedback(deviceId: string): Promise<void> {
		const device = this.#devices[deviceId]
		if (!device) throw new Error(`Could not find device "${deviceId}"`)

		const cachedFeedback = this.#feedback[deviceId] ?? {}
		for (const [triggerId, feedback] of Object.entries(cachedFeedback)) {
			await device.setFeedback(triggerId, feedback)
		}
	}
}

function createNewDevice(deviceConfig: SomeDeviceConfig, logger: Logger) {
	switch (deviceConfig.type) {
		case DeviceType.HTTP:
			return new HTTPDevice(deviceConfig, logger)
		case DeviceType.MIDI:
			return new MIDIDevice(deviceConfig, logger)
		case DeviceType.STREAM_DECK:
			return new StreamDeckDevice(deviceConfig, logger)
		case DeviceType.X_KEYS:
			return new XKeysDevice(deviceConfig, logger)
		case DeviceType.SKAARHOJ:
			return new SkaarhojDevice(deviceConfig, logger)
		default:
			throwNever(deviceConfig)
	}
}

function getIntegrationsConfigManifest(): Record<string, DeviceConfigManifest<any>> {
	return {
		[DeviceType.HTTP]: HTTP_CONFIG,
		[DeviceType.MIDI]: MIDI_CONFIG,
		[DeviceType.STREAM_DECK]: STREAM_DECK_CONFIG,
		[DeviceType.X_KEYS]: XKEYS_CONFIG,
		[DeviceType.SKAARHOJ]: SKAARHOJ_CONFIG,
	}
}

export { InputManager, SomeDeviceConfig, TriggerEventArgs, getIntegrationsConfigManifest }

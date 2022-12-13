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
import { DeviceConfigManifest, throwNever } from './lib'
import { Logger } from './logger'
import { init as initBitmapFeedback } from './feedback/bitmap'
import { DeviceType } from './integrations/deviceType'

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

interface TriggerEventArgs extends DeviceTriggerEventArgs {
	/** The ID of the device that issued this event */
	deviceId: string
	/** Should this event replace whatever unsent events there are */
	replacesPrevious?: boolean
}

type DeviceEvents = {
	trigger: [e: TriggerEventArgs]
}

class InputManager extends EventEmitter<DeviceEvents> {
	#devices: Record<string, Device> = {}
	#logger: Logger

	constructor(private config: Config, logger: Logger) {
		super()
		this.#logger = logger
	}

	async init(): Promise<void> {
		this.#devices = {}
		for (const [deviceId, deviceConfig] of Object.entries(this.config.devices)) {
			const device = createNewDevice(deviceConfig, this.#logger)
			device.on('trigger', (eventArgs) => {
				this.emit('trigger', {
					...eventArgs,
					deviceId,
				})
			})
			this.#devices[deviceId] = device
		}

		await initBitmapFeedback()

		// TODO: switch to allSettled when device statuses are forwarded to Core
		await Promise.allSettled(Object.values(this.#devices).map(async (device) => device.init()))
	}

	async destroy(): Promise<void> {
		this.removeAllListeners()
		await Promise.all(Object.values(this.#devices).map(async (device) => device.destroy()))
		this.#devices = {}
	}

	async setFeedback(deviceId: string, triggerId: string, feedback: SomeFeedback): Promise<void> {
		const device = this.#devices[deviceId]
		if (!device) throw new Error(`Could not find device "${deviceId}"`)

		await device.setFeedback(triggerId, feedback)
	}

	async clearFeedbackAll(): Promise<void> {
		for (const device of Object.values(this.#devices)) {
			await device.clearFeedbackAll()
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
	}
}

export { InputManager, SomeDeviceConfig, TriggerEventArgs, getIntegrationsConfigManifest }

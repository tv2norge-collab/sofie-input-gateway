import EventEmitter from 'events'
import { Device, TriggerEventArgs as DeviceTriggerEventArgs } from './devices/device'
import { SomeFeedback } from './feedback/feedback'
import { HTTPDevice, HTTPDeviceConfig } from './integrations/http'
import { MIDIDevice, MIDIDeviceConfig } from './integrations/midi'
import { StreamDeckDevice, StreamDeckDeviceConfig } from './integrations/streamdeck'
import { throwNever } from './lib'
import { Logger } from './logger'
import { init as initBitmapFeedback } from './feedback/bitmap'
import { XKeysDevice, XKeysDeviceConfig } from './integrations/xkeys'

interface Config {
	devices: Record<string, SomeDeviceConfig>
}

interface DeviceConfig<Type extends string, T> {
	type: Type
	options: T
}

enum DeviceType {
	MIDI = 'midi',
	HTTP = 'http',
	STREAM_DECK = 'streamDeck',
	X_KEYS = 'XKeys',
}

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

class InputManager extends EventEmitter {
	#devices: Record<string, Device> = {}
	#logger: Logger

	constructor(private config: Config, logger: Logger) {
		super()
		this.#logger = logger
	}

	on(event: 'trigger', listener: (e: TriggerEventArgs) => void): this
	on(event: string | symbol, listener: (...args: any[]) => void): this {
		return super.on(event, listener)
	}

	emit(event: 'trigger', e: TriggerEventArgs): boolean
	emit(event: string | symbol, ...args: any[]): boolean {
		return super.emit(event, ...args)
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
}

function createNewDevice(deviceConfig: SomeDeviceConfig, logger: Logger) {
	switch (deviceConfig.type) {
		case DeviceType.HTTP:
			return new HTTPDevice(deviceConfig.options, logger)
		case DeviceType.MIDI:
			return new MIDIDevice(deviceConfig.options, logger)
		case DeviceType.STREAM_DECK:
			return new StreamDeckDevice(deviceConfig.options, logger)
		case DeviceType.X_KEYS:
			return new XKeysDevice(deviceConfig.options, logger)
		default:
			throwNever(deviceConfig)
	}
}

export { InputManager, DeviceType, TriggerEventArgs }

import EventEmitter from 'eventemitter3'
import { Device, TriggerEvent } from './devices/device'
import { SomeFeedback } from './feedback/feedback'
import { HTTPServer } from './integrations/http'
import { MIDIDevice } from './integrations/midi'
import { StreamDeckDevice } from './integrations/streamdeck'
import { XKeysDevice } from './integrations/xkeys'
import { SkaarhojDevice } from './integrations/skaarhoj'
import { OSCServer } from './integrations/osc'
import { throwNever } from './lib'
import { Logger } from './logger'
import { init as initBitmapFeedback } from './feedback/bitmap'
import { DeviceType } from './integrations/deviceType'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import {
	HTTPServerOptions,
	MIDIControllerOptions,
	OSCServerOptions,
	SkaarhojPanelOptions,
	StreamDeckDeviceOptions,
	XKeysDeviceOptions,
} from './generated'
import { JSONBlob, JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'

interface Config {
	devices: Record<string, SomeDeviceConfig>
}

type DeviceConfig<Type extends string, ConfigInterface extends Record<string, any>> = {
	type: Type
	options: ConfigInterface
}

type SomeDeviceConfig =
	| DeviceConfig<DeviceType.MIDI, MIDIControllerOptions>
	| DeviceConfig<DeviceType.HTTP, HTTPServerOptions>
	| DeviceConfig<DeviceType.STREAM_DECK, StreamDeckDeviceOptions>
	| DeviceConfig<DeviceType.X_KEYS, XKeysDeviceOptions>
	| DeviceConfig<DeviceType.SKAARHOJ, SkaarhojPanelOptions>
	| DeviceConfig<DeviceType.OSC, OSCServerOptions>

export interface ManagerTriggerEventArgs {
	/** The ID of the device that issued this event */
	deviceId: string
}

interface StatusChangeEventArgs {
	deviceId: string
	status: StatusCode
}

type DeviceEvents = {
	trigger: [e: ManagerTriggerEventArgs]
	statusChange: [e: StatusChangeEventArgs]
}

const REFRESH_INTERVAL = 5000

class InputManager extends EventEmitter<DeviceEvents> {
	#devices: Record<string, Device | undefined> = {}
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

		await Promise.allSettled(
			Object.entries<SomeDeviceConfig>(this.config.devices).map(async ([deviceId, deviceConfig]) =>
				this.createDevice(deviceId, deviceConfig)
			)
		)

		this.#refreshInterval = setInterval(this.refreshDevicesInterval, REFRESH_INTERVAL)
	}

	/**
	 * Returns the next trigger to send to Core, for a given device.
	 * If there are no more triggers to send, return undefined
	 * (This is used after the 'trigger' event has been emitted.)
	 */
	getNextTrigger(deviceId: string): TriggerEvent | undefined {
		const device = this.#devices[deviceId]
		if (device) {
			return device.getNextTrigger()
		}
		return undefined
	}

	private refreshDevicesInterval = (): void => {
		this.#logger.debug(`Refreshing devices... ${this.#refreshRunning}`)
		if (this.#refreshRunning === true) return

		this.#refreshRunning = true
		this.refreshDevices()
			.catch((e) => {
				this.#logger.error(`Could not refresh devices: ${e}`)
			})
			.finally(() => {
				this.#logger.debug(`Refreshing devices done.`)
				this.#refreshRunning = false
			})
	}

	private async refreshDevices(): Promise<void> {
		await Promise.allSettled(
			Object.entries<SomeDeviceConfig>(this.config.devices).map(async ([deviceId, deviceConfig]) => {
				if (this.#devices[deviceId] !== undefined) return

				try {
					await this.createDevice(deviceId, deviceConfig)
					await this.refreshFeedback(deviceId)
				} catch (e) {
					this.#logger.error(`Error while restarting device "${deviceId}: ${e}"`)
				}
			})
		)
	}

	private async createDevice(deviceId: string, deviceConfig: SomeDeviceConfig): Promise<void> {
		let createdDevice: Device | undefined = undefined
		try {
			this.#logger.debug(`Creating new device "${deviceId}"...`)
			const device = createNewDevice(deviceConfig, this.#logger.child({ deviceId }))
			createdDevice = device
			device.on('trigger', () => {
				// Device notifies us that a trigger has changed.

				// Notify that that a trigger on a certain device has changed.
				// The event listener should call this.getNextTrigger() to get the next trigger event.
				this.emit('trigger', { deviceId })
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
						this.#logger.debug(`Removing device from device list "${deviceId}"`)
						this.#devices[deviceId] = undefined
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
			if (createdDevice) await createdDevice.destroy()
			delete this.#devices[deviceId]
			this.emit('statusChange', {
				deviceId,
				status: StatusCode.BAD,
			})
			throw e
		}
	}

	async destroy(): Promise<void> {
		this.removeAllListeners()

		if (this.#refreshInterval) clearInterval(this.#refreshInterval)

		await Promise.all(Object.values<Device | undefined>(this.#devices).map(async (device) => device?.destroy()))
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
		// Check if we know of the device
		if (!this.config.devices[deviceId]) throw new Error(`Unknown device "${deviceId}"`)
		// Cache this feedback, in case we need to restore it later, after a device driver restart
		this.cacheFeedback(deviceId, triggerId, feedback)

		const device = this.#devices[deviceId]
		// The device can be configured, but a device driver may have failed to initialize
		if (!device) throw new Error(`Could not find device "${deviceId}"`)

		await device.setFeedback(triggerId, feedback)
	}

	async clearFeedbackAll(): Promise<void> {
		const p = Object.entries<Device | undefined>(this.#devices).map(async ([deviceId, device]) => {
			this.#feedback[deviceId] = {}
			await device?.clearFeedbackAll()
		})
		await Promise.allSettled(p)
	}

	beginFeedbackReplaceTransaction(): () => Promise<void> {
		const oldFeedback = this.#feedback
		this.#feedback = {}

		return async () => {
			// set null feedback on all triggers that are not in the new feedback cache
			const p = Object.entries<Record<string, SomeFeedback>>(oldFeedback).map(async ([deviceId, deviceTriggersObj]) => {
				for (const [triggerId, feedback] of Object.entries<SomeFeedback>(deviceTriggersObj)) {
					if (this.#feedback[deviceId]?.[triggerId] === undefined && feedback !== undefined) {
						this.#logger.debug(`Clearing ${deviceId} "${triggerId}"...`)
						await this.setFeedback(deviceId, triggerId, null)
					}
				}
			})
			await Promise.allSettled(p)
		}
	}

	private async refreshFeedback(deviceId: string): Promise<void> {
		this.#logger.debug(`Refreshing feedback on "${deviceId}"`)
		const device = this.#devices[deviceId]
		if (!device) throw new Error(`Could not find device "${deviceId}"`)

		const cachedFeedback = this.#feedback[deviceId] ?? {}
		for (const [triggerId, feedback] of Object.entries<SomeFeedback>(cachedFeedback)) {
			await device.setFeedback(triggerId, feedback)
		}
	}
}

function createNewDevice(deviceConfig: SomeDeviceConfig, logger: Logger): Device {
	switch (deviceConfig.type) {
		case DeviceType.HTTP:
			return new HTTPServer(deviceConfig.options, logger)
		case DeviceType.MIDI:
			return new MIDIDevice(deviceConfig.options, logger)
		case DeviceType.STREAM_DECK:
			return new StreamDeckDevice(deviceConfig.options, logger)
		case DeviceType.X_KEYS:
			return new XKeysDevice(deviceConfig.options, logger)
		case DeviceType.SKAARHOJ:
			return new SkaarhojDevice(deviceConfig.options, logger)
		case DeviceType.OSC:
			return new OSCServer(deviceConfig.options, logger)
		default:
			throwNever(deviceConfig)
	}
}

function getIntegrationsConfigManifest(): Record<string, SubdeviceManifest> {
	return {
		[DeviceType.HTTP]: {
			displayName: 'HTTP Server',
			configSchema: JSONBlobStringify(HTTPServer.getOptionsManifest()),
		},
		[DeviceType.MIDI]: {
			displayName: 'MIDI Controller',
			configSchema: JSONBlobStringify(MIDIDevice.getOptionsManifest()),
		},
		[DeviceType.STREAM_DECK]: {
			displayName: 'Stream Deck',
			configSchema: JSONBlobStringify(StreamDeckDevice.getOptionsManifest()),
		},
		[DeviceType.X_KEYS]: {
			displayName: 'X-Keys',
			configSchema: JSONBlobStringify(XKeysDevice.getOptionsManifest()),
		},
		[DeviceType.SKAARHOJ]: {
			displayName: 'Skaarhoj',
			configSchema: JSONBlobStringify(SkaarhojDevice.getOptionsManifest()),
		},
		[DeviceType.OSC]: {
			displayName: 'OSC Server',
			configSchema: JSONBlobStringify(OSCServer.getOptionsManifest()),
		},
	}
}

interface SubdeviceManifest {
	displayName: string
	configSchema: JSONBlob<JSONSchema>
}

export {
	InputManager,
	SomeDeviceConfig,
	ManagerTriggerEventArgs as TriggerEventArgs,
	getIntegrationsConfigManifest,
	SubdeviceManifest,
}

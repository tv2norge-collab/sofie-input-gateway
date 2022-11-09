import EventEmitter from 'events'
import { Device } from './devices/device'
import { HTTPDevice } from './integrations/http'
import { MIDIDevice } from './integrations/midi'

interface Config {
	devices: Record<string, DeviceConfig<any>>
}

interface DeviceConfig<T> {
	type: 'midi' | 'http'
	options: T
}

interface TriggerEventArgs {
	deviceId: string
	triggerId: string
	arguments?: Record<string, string | number | boolean>
}

class InputManager extends EventEmitter {
	devices: Record<string, Device> = {}

	constructor(private config: Config, private logger: Logger) {
		super()
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
		this.devices = {}
		for (const [deviceId, deviceConfig] of Object.entries(this.config.devices)) {
			const device = createNewDevice(deviceConfig)
			device.on('trigger', (eventArgs) => {
				this.emit('trigger', {
					...eventArgs,
					deviceId,
				})
			})
			this.devices[deviceId] = device
		}

		console.log(JSON.stringify(this.devices))
		this.logger.debug('aaa')

		// TODO: switch to allSettled when device statuses are forwarded to Core
		await Promise.all(Object.values(this.devices).map(async (device) => device.init()))
	}

	async destroy(): Promise<void> {
		await Promise.all(Object.values(this.devices).map(async (device) => device.destroy()))
	}
}

function createNewDevice(deviceConfig: DeviceConfig<any>) {
	switch (deviceConfig.type) {
		case 'http':
			return new HTTPDevice()
		case 'midi':
			return new MIDIDevice()
		default:
			throw new Error(`Unknown device: ${deviceConfig.type}`)
	}
}

interface Logger {
	info(s: string): void
	debug(s: string): void
}

export { InputManager }

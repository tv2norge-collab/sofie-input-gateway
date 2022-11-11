import * as Winston from 'winston'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { CoreHandler } from './coreHandler'
import { DeviceSettings } from './interfaces'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { Process } from './process'
import { Config } from './connector'
import { InputManager, TriggerEventArgs, DeviceType } from '@sofie-automation/input-manager'
import { SendQueue } from './sendQueue'

export type SetProcessState = (processName: string, comments: string[], status: StatusCode) => void

export interface ProcessConfig {
	/** Will cause the Node applocation to blindly accept all certificates. Not recommenced unless in local, controlled networks. */
	unsafeSSL: boolean
	/** Paths to certificates to load, for SSL-connections */
	certificates: string[]
}
export interface DeviceConfig {
	deviceId: PeripheralDeviceId
	deviceToken: string
}
export class InputManagerHandler {
	#coreHandler!: CoreHandler
	#config!: Config
	#logger: Winston.Logger
	#process!: Process

	#inputManager: InputManager | undefined
	#queue: SendQueue

	constructor(logger: Winston.Logger) {
		this.#logger = logger
		this.#queue = new SendQueue()
	}

	async init(config: Config): Promise<void> {
		this.#config = config

		try {
			this.#logger.info('Initializing Process...')
			this.initProcess()
			this.#logger.info('Process initialized')

			this.#logger.info('Initializing Core...')
			await this.initCore()
			this.#logger.info('Core initialized')

			const peripheralDevice = await this.#coreHandler.core.getPeripheralDevice()

			// Stop here if studioId not set
			if (!peripheralDevice.studioId) {
				this.#logger.warn('------------------------------------------------------')
				this.#logger.warn('Not setup yet, exiting process!')
				this.#logger.warn('To setup, go into Core and add this device to a Studio')
				this.#logger.warn('------------------------------------------------------')
				// eslint-disable-next-line no-process-exit
				process.exit(1)
				return
			}
			this.#logger.info('Initializing InputManager...')

			await this.initInputManager(peripheralDevice.settings || {})
			this.#logger.info('InputManager initialized')

			this.#logger.info('Initialization done')
			return
		} catch (e) {
			this.#logger.error('Error during initialization:')
			this.#logger.error(e)
			if (e instanceof Error) this.#logger.error(e.stack)
			try {
				if (this.#coreHandler) {
					this.#coreHandler.destroy().catch(this.#logger.error)
				}
			} catch (e1) {
				this.#logger.error(e1)
			}
			this.#logger.info('Shutting down in 10 seconds!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 10 * 1000)
			return
		}
	}
	initProcess(): void {
		this.#process = new Process(this.#logger)
		this.#process.init(this.#config.process)
	}
	async initCore(): Promise<void> {
		this.#coreHandler = new CoreHandler(this.#logger, this.#config.device)
		await this.#coreHandler.init(this.#config.core, this.#process)
	}

	async initInputManager(settings: DeviceSettings): Promise<void> {
		this.#logger.info('Initializing Input Manager with the following settings:')

		this.#logger.info(JSON.stringify(settings))

		// TODO: Initialize input Manager

		this.#inputManager = new InputManager(
			{
				devices: {
					midi0: {
						type: DeviceType.MIDI,
						options: {
							inputName: 'X-TOUCH MINI',
						},
					},
					http0: {
						type: DeviceType.HTTP,
						options: {
							port: 9090,
						},
					},
				},
			},
			this.#logger
		)
		this.#inputManager.on('trigger', (e: TriggerEventArgs) => {
			this.#throttleSendTrigger(e.deviceId, e.triggerId, e.arguments, e.replacesPrevious ?? false)
		})
		await this.#inputManager.init()

		// Monitor for changes in settings:
		// this.coreHandler.onChanged(() => {
		// 	this.coreHandler.core
		// 		.getPeripheralDevice()
		// 		.then(device => {
		// 			if (device) {
		// 				// const settings = device.settings
		// 				// if (!_.isEqual(settings, this._monitorManager.settings)) {
		// 				// 	this._monitorManager.onNewSettings(settings).catch(e => this._logger.error(e))
		// 				// }
		// 			}
		// 		})
		// 		.catch(() => {
		// 			this._logger.error(`coreHandler.onChanged: Could not get peripheral device`)
		// 		})
		// })
	}

	#throttleSendTrigger(
		deviceId: string,
		triggerId: string,
		args: Record<string, string | number | boolean> | undefined,
		replacesUnsent: boolean
	) {
		const className = `${deviceId}_${triggerId}`
		if (replacesUnsent) this.#queue.remove(className)
		this.#queue
			.add(
				async () =>
					this.#coreHandler.core.callMethod('peripheralDevice.input.trigger', [
						deviceId,
						triggerId,
						args ?? null,
					]),
				{
					className,
				}
			)
			.catch(() => {
				this.#logger.error(`peripheralDevice.input.trigger failed`)
			})
	}
}

import * as Winston from 'winston'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { CoreHandler } from './coreHandler'
import { DeviceSettings } from './interfaces'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { Process } from './process'
import { Config } from './connector'

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
	private coreHandler!: CoreHandler
	private _config!: Config
	private _logger: Winston.Logger
	private _process: Process

	private _devices: { [deviceId: string]: InputGenerator } = {} // test input

	constructor(logger: Winston.Logger) {
		this._logger = logger
	}

	async init(config: Config): Promise<void> {
		this._config = config

		try {
			this._logger.info('Initializing Process...')
			this.initProcess()
			this._logger.info('Process initialized')

			this._logger.info('Initializing Core...')
			await this.initCore()
			this._logger.info('Core initialized')

			const peripheralDevice = await this.coreHandler.core.getPeripheralDevice()

			// Stop here if studioId not set
			if (!peripheralDevice.studioId) {
				this._logger.warn('------------------------------------------------------')
				this._logger.warn('Not setup yet, exiting process!')
				this._logger.warn('To setup, go into Core and add this device to a Studio')
				this._logger.warn('------------------------------------------------------')
				// eslint-disable-next-line no-process-exit
				process.exit(1)
				return
			}
			this._logger.info('Initializing InputManager...')

			await this.initInputManager(peripheralDevice.settings || {})
			this._logger.info('InputManager initialized')

			this._logger.info('Initialization done')
			return
		} catch (e) {
			this._logger.error('Error during initialization:')
			this._logger.error(e)
			if (e instanceof Error) this._logger.error(e.stack)
			try {
				if (this.coreHandler) {
					this.coreHandler.destroy().catch(this._logger.error)
				}
			} catch (e1) {
				this._logger.error(e1)
			}
			this._logger.info('Shutting down in 10 seconds!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 10 * 1000)
			return
		}
	}
	initProcess(): void {
		this._process = new Process(this._logger)
		this._process.init(this._config.process)
	}
	async initCore(): Promise<void> {
		this.coreHandler = new CoreHandler(this._logger, this._config.device)
		await this.coreHandler.init(this._config.core, this._process)
	}

	async initInputManager(settings: DeviceSettings): Promise<void> {
		// console.log(this.coreHandler.deviceSettings)
		this._logger.debug('Initializing Media Manager with the following settings:')
		this._logger.debug(JSON.stringify(settings))

		// TODO: Initialize input Manager

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
}

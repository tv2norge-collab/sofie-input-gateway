import * as Winston from 'winston'
import * as _ from 'underscore'
import { PeripheralDeviceAPI as P } from 'tv-automation-server-core-integration'
import { CoreHandler, CoreConfig } from './coreHandler'
import { Process } from './process'
import { DeviceSettings } from './interfaces'
import { InputGenerator } from './sources.ts/testGenerator'

export type SetProcessState = (processName: string, comments: string[], status: P.StatusCode) => void

export interface Config {
	process: ProcessConfig
	device: DeviceConfig
	core: CoreConfig
}
export interface ProcessConfig {
	/** Will cause the Node applocation to blindly accept all certificates. Not recommenced unless in local, controlled networks. */
	unsafeSSL: boolean
	/** Paths to certificates to load, for SSL-connections */
	certificates: string[]
}
export interface DeviceConfig {
	deviceId: string
	deviceToken: string
}
export class InputManager {
	private coreHandler: CoreHandler
	private _config: Config
	private _logger: Winston.LoggerInstance

	private _process: Process

	private _devices: { [deviceId: string]: InputGenerator } = {} // test input

	constructor(logger: Winston.LoggerInstance) {
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
			this._logger.error(e.stack)
			try {
				if (this.coreHandler) {
					this.coreHandler.destroy().catch(this._logger.error)
				}
			} catch (e1) {
				this._logger.error(e1)
			}
			this._logger.info('Shutting down in 10 seconds!')
			setTimeout(() => {
				process.exit(0)
			}, 10 * 1000)
			return
		}
	}
	initProcess() {
		this._process = new Process(this._logger)
		this._process.init(this._config.process)
	}
	async initCore() {
		this.coreHandler = new CoreHandler(this._logger, this._config.device)
		return this.coreHandler.init(this._config.core, this._process)
	}

	async initInputManager(settings: DeviceSettings): Promise<void> {
		// console.log(this.coreHandler.deviceSettings)
		this._logger.debug('Initializing Media Manager with the following settings:')
		this._logger.debug(JSON.stringify(settings))

		// TODO: Initialize input Manager

		// set up a test device:
		this._devices['test'] = new InputGenerator('test')

		this._devices['test'].on('inputEvent', (e: any) => {
			this._logger.info('inputEvent', e) // @todo: report to core
			this.coreHandler.core.callMethod('userInputEvent', e)
		})

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

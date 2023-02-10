import { CoreConnection, CoreOptions, DDPConnectorOptions } from '@sofie-automation/server-core-integration'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import _ from 'underscore'
import * as Winston from 'winston'
import { DeviceConfig } from './inputManagerHandler'
import fs from 'fs'
import { INPUT_DEVICE_CONFIG } from './configManifest'
import { PeripheralDeviceCommandId, PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { PeripheralDevicePublic } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceSubType,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PeripheralDeviceCommand } from '@sofie-automation/shared-lib/dist/core/model/PeripheralDeviceCommand'
import { Process } from './process'
import { stringifyError } from './lib/lib'
import path from 'path'

export interface CoreConfig {
	host: string
	port: number
	ssl?: boolean
	watchdog: boolean
}

/**
 * Represents a connection between the Core and the media-manager
 */
export class CoreHandler {
	core!: CoreConnection
	logger: Winston.Logger

	public _observers: Array<any> = []
	public deviceSettings: { [key: string]: any } = {}

	public deviceStatus: StatusCode = StatusCode.GOOD
	public deviceMessages: Array<string> = []

	private _deviceOptions: DeviceConfig
	private _onConnected?: () => any
	private _onChanged?: () => any
	private _executedFunctions: { [id: string]: boolean } = {}
	private _coreConfig?: CoreConfig
	private _process?: Process

	private _statusInitialized = false
	private _statusDestroyed = false

	private _processState: {
		[key: string]: {
			comments: string[]
			status: StatusCode
		}
	}

	constructor(logger: Winston.Logger, deviceOptions: DeviceConfig) {
		this.logger = logger
		this._deviceOptions = deviceOptions
		this._processState = {}
	}

	async init(config: CoreConfig, process: Process): Promise<void> {
		// this.logger.info('========')
		this._statusInitialized = false
		this._coreConfig = config
		this._process = process

		this.core = new CoreConnection(
			this.getCoreConnectionOptions('Input Gateway', 'InputGateway', PERIPHERAL_SUBTYPE_PROCESS)
		)

		this.core.onConnected(() => {
			this.logger.info('Core Connected!')
			this.setupObserversAndSubscriptions().catch((e) => {
				this.logger.error('Core Error:', e)
			})
			if (this._onConnected) this._onConnected()
		})
		this.core.onDisconnected(() => {
			this.logger.warn('Core Disconnected!')
		})
		this.core.onError((err) => {
			if (err instanceof Error) {
				this.logger.error('Core Error: ' + (err.message || err.toString() || err))
			}
			this.logger.error('Core Error: ' + (err.toString() || err))
		})

		const ddpConfig: DDPConnectorOptions = {
			host: config.host,
			port: config.port,
			ssl: config.ssl,
		}
		if (this._process && this._process.certificates.length) {
			ddpConfig.tlsOpts = {
				ca: this._process.certificates,
			}
		}
		await this.core.init(ddpConfig)
		this.logger.info('Core id: ' + this.core.deviceId)
		await this.setupObserversAndSubscriptions()
		this._statusInitialized = true
		await this.updateCoreStatus()
		return
	}
	async setupObserversAndSubscriptions(): Promise<void> {
		this.logger.info('Core: Setting up subscriptions..')
		this.logger.info('DeviceId: ' + this.core.deviceId)
		await Promise.all([
			this.core.autoSubscribe('peripheralDevices', {
				_id: this.core.deviceId,
			}),
			this.core.autoSubscribe('studioOfDevice', this.core.deviceId),
			this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId),
			// @todo: subscribe to userInput
		])
		this.logger.info('Core: Subscriptions are set up!')
		if (this._observers.length) {
			this.logger.info('Core: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		// setup observers
		const observer = this.core.observe('peripheralDevices')
		observer.added = (id: string) => {
			this.onDeviceChanged(protectString(id))
		}
		observer.changed = (id1: string) => {
			this.onDeviceChanged(protectString(id1))
		}
		this.setupObserverForPeripheralDeviceCommands(this)
		return
	}
	async destroy(): Promise<void> {
		this._statusDestroyed = true
		await this.updateCoreStatus()
		if (this.core) {
			await this.core.destroy()
		}
	}
	getCoreConnectionOptions(name: string, subDeviceId: string, subDeviceType?: PeripheralDeviceSubType): CoreOptions {
		if (!this._deviceOptions.deviceId) {
			// this.logger.warn('DeviceId not set, using a temporary random id!')
			throw new Error('DeviceId is not set!')
		}

		const options: CoreOptions = {
			deviceId: protectString(this._deviceOptions.deviceId + subDeviceId),
			deviceToken: this._deviceOptions.deviceToken,

			deviceCategory: PeripheralDeviceCategory.TRIGGER_INPUT,
			deviceType: PeripheralDeviceType.INPUT,
			deviceSubType: subDeviceType,

			deviceName: name,
			watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

			configManifest: {
				...INPUT_DEVICE_CONFIG,
			},
		}

		if (!options.deviceToken) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			options.deviceToken = 'unsecureToken'
		}

		if (subDeviceType === PERIPHERAL_SUBTYPE_PROCESS) options.versions = this._getVersions()
		return options

		// let credentials: {
		// 	deviceId: PeripheralDeviceId
		// 	deviceToken: string
		// }

		// if (this._deviceOptions.deviceId && this._deviceOptions.deviceToken) {
		// 	credentials = {
		// 		deviceId: protectString(this._deviceOptions.deviceId + subDeviceId),
		// 		deviceToken: this._deviceOptions.deviceToken,
		// 	}
		// } else if (this._deviceOptions.deviceId) {
		// 	this.logger.warn('Token not set, only id! This might be unsecure!')
		// 	credentials = {
		// 		deviceId: protectString(this._deviceOptions.deviceId + subDeviceId),
		// 		deviceToken: 'unsecureToken',
		// 	}
		// } else {
		// 	credentials = CoreConnection.getCredentials(subDeviceId)
		// }
		// const options: CoreOptions = {
		// 	...credentials,

		// 	deviceCategory: PeripheralDeviceCategory.TRIGGER_INPUT,
		// 	deviceType: PeripheralDeviceType.INPUT,
		// 	deviceSubType: subType || PERIPHERAL_SUBTYPE_PROCESS,

		// 	deviceName: name,
		// 	watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

		// 	configManifest: INPUT_DEVICE_CONFIG,

		// 	versions: this._getVersions(),
		// }
		// return options
	}
	onConnected(fcn: () => any): void {
		this._onConnected = fcn
	}
	onChanged(fcn: () => any): void {
		this._onChanged = fcn
	}
	onDeviceChanged(id: PeripheralDeviceId): void {
		if (id === this.core.deviceId) {
			const col = this.core.getCollection<PeripheralDevicePublic>('peripheralDevices')
			if (!col) throw new Error('collection "peripheralDevices" not found!')

			const device = col.findOne(id)
			if (device) {
				if (!_.isEqual(this.deviceSettings, device.settings)) {
					this.deviceSettings = device.settings || {}
				}
			} else {
				this.deviceSettings = {}
			}

			const logLevel = this.deviceSettings['debugLogging'] ? 'debug' : 'info'
			if (logLevel !== this.logger.level) {
				this.logger.level = logLevel

				this.logger.info('Loglevel: ' + this.logger.level)
			}

			if (this._onChanged) this._onChanged()
		}
	}
	get logDebug(): boolean {
		return !!this.deviceSettings['debugLogging']
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	executeFunction(cmd: PeripheralDeviceCommand, fcnObject: any): void {
		if (cmd) {
			if (this._executedFunctions[unprotectString(cmd._id)]) return // prevent it from running multiple times
			this.logger.info(cmd.functionName ?? '(undefined)', cmd.args)
			this._executedFunctions[unprotectString(cmd._id)] = true
			// console.log('executeFunction', cmd)
			const cb = (err: any, res?: any) => {
				// console.log('cb', err, res)
				if (err) {
					this.logger.error('executeFunction error', err, err.stack)
				}
				this.core.coreMethods
					.functionReply(cmd._id, err, res)
					.then(() => {
						// console.log('cb done')
					})
					.catch((e) => {
						this.logger.error(e)
					})
			}

			if (cmd.functionName === undefined) {
				this.logger.error(`No function name provided in command "${cmd._id}", aborting`)
				cb('No function name provided')
				return
			}

			const fcn = fcnObject[cmd.functionName]
			try {
				if (!fcn) throw Error('Function "' + cmd.functionName + '" not found!')

				Promise.resolve(fcn.apply(fcnObject, cmd.args))
					.then((result) => {
						cb(null, result)
					})
					.catch((e) => {
						cb(e.toString(), null)
					})
			} catch (e) {
				if (e instanceof Error) {
					cb(e.toString(), null)
				} else {
					cb(`Unknown error: ${e}`, null)
				}
			}
		}
	}
	retireExecuteFunction(cmdId: string): void {
		delete this._executedFunctions[cmdId]
	}
	setupObserverForPeripheralDeviceCommands(functionObject: CoreHandler): void {
		const observer = functionObject.core.observe('peripheralDeviceCommands')
		functionObject.killProcess(0)
		functionObject._observers.push(observer)
		const addedChangedCommand = (id: PeripheralDeviceCommandId) => {
			const cmds = functionObject.core.getCollection<PeripheralDeviceCommand>('peripheralDeviceCommands')
			if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
			const cmd = cmds.findOne(id)
			if (!cmd) throw Error('PeripheralCommand "' + id + '" not found!')
			// console.log('addedChangedCommand', id)
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			} else {
				// console.log('not mine', cmd.deviceId, this.core.deviceId)
			}
		}
		observer.added = (id: string) => {
			addedChangedCommand(protectString(id))
		}
		observer.changed = (id: string) => {
			addedChangedCommand(protectString(id))
		}
		observer.removed = (id: string) => {
			this.retireExecuteFunction(id)
		}
		const cmds = functionObject.core.getCollection('peripheralDeviceCommands')
		if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
		;(cmds.find({}) as PeripheralDeviceCommand[]).forEach((cmd: PeripheralDeviceCommand) => {
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			}
		})
	}
	killProcess(actually: number): boolean {
		if (actually === 1) {
			this.logger.info('KillProcess command received, shutting down in 1000ms!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 1000)
			return true
		}
		return false
	}
	/* devicesMakeReady (okToDestroyStuff?: boolean): Promise<any> {
		// TODO: perhaps do something here?
		return Promise.resolve()
	}
	devicesStandDown (okToDestroyStuff?: boolean): Promise<any> {
		// TODO: perhaps do something here?
		return Promise.resolve()
	} */
	pingResponse(message: string): boolean {
		this.core.setPingResponse(message)
		return true
	}
	getSnapshot(): any {
		this.logger.info('getSnapshot')

		// TODO: collect some proper data here to send to Core, so it can create a nice debug report
		return {
			// mediaFiles: myMediaFiles,
			// transferStatus: myTransferStatus,
		}
	}
	async updateCoreStatus(): Promise<any> {
		let statusCode = StatusCode.GOOD
		const messages: Array<string> = []

		if (this.deviceStatus !== StatusCode.GOOD) {
			statusCode = this.deviceStatus
			if (this.deviceMessages) {
				_.each(this.deviceMessages, (msg) => {
					messages.push(msg)
				})
			}
		}
		if (!this._statusInitialized) {
			statusCode = StatusCode.BAD
			messages.push('Starting up...')
		}
		if (this._statusDestroyed) {
			statusCode = StatusCode.BAD
			messages.push('Shut down')
		}

		if (this.core) {
			await this.core.setStatus({
				statusCode: statusCode,
				messages: messages,
			})
		}
	}
	setProcessState = (processName: string, comments: string[], status: StatusCode): void => {
		this._processState[processName] = {
			comments,
			status,
		}

		const deviceState = _.reduce(
			this._processState,
			(memo, value) => {
				let status = memo.status
				let comments = memo.comments
				if (value.status > status) {
					status = value.status
				}
				if (value.comments) {
					comments = comments.concat(value.comments)
				}

				return {
					status,
					comments,
				}
			},
			{
				status: StatusCode.GOOD,
				comments: [] as string[],
			}
		)

		this.deviceStatus = deviceState.status
		this.deviceMessages = deviceState.comments
		this.updateCoreStatus().catch(() => {
			this.logger.error('Could not update Media Manager status in Core')
		})
	}
	private _getVersions() {
		const versions: { [packageName: string]: string } = {}

		if (process.env.npm_package_version) {
			versions['_process'] = process.env.npm_package_version
		}

		const dirNames = ['@sofie-automation/server-core-integration']
		try {
			const nodeModulesDirectories = fs.readdirSync(path.join(__dirname, '../../../', 'node_modules'))
			for (const dir of nodeModulesDirectories) {
				try {
					if (dirNames.indexOf(dir) !== -1) {
						let file = path.join(__dirname, 'node_modules', dir, 'package.json')
						file = fs.readFileSync(file, 'utf8')
						const json = JSON.parse(file)
						versions[dir] = json.version || 'N/A'
					}
				} catch (e) {
					this.logger.error(`Error in _getVersions, dir "${dir}": ${stringifyError(e)}`)
				}
			}
		} catch (e) {
			this.logger.error(`Error in _getVersions: ${stringifyError(e)}`)
		}
		return versions
	}
}

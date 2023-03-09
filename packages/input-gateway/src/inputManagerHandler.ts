import _ from 'underscore'
import * as Winston from 'winston'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { CoreHandler } from './coreHandler'
import { DeviceSettings } from './interfaces'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import {
	DeviceTriggerMountedAction,
	DeviceTriggerMountedActionId,
	PreviewWrappedAdLib,
} from '@sofie-automation/shared-lib/dist/input-gateway/deviceTriggerPreviews'
import { SourceLayerType } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import { Process } from './process'
import { Config } from './connector'
import {
	InputManager,
	ClassNames,
	ManagerTriggerEventArgs,
	Tally,
	SomeFeedback,
	SomeDeviceConfig,
	TriggerEvent,
} from '@sofie-automation/input-manager'
import { interpollateTranslation, translateMessage } from './lib/translatableMessage'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { ITranslatableMessage } from '@sofie-automation/shared-lib/dist/lib/translations'
import { Observer } from '@sofie-automation/server-core-integration'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'
import PQueue from 'p-queue'

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
	#deviceSettings: DeviceSettings | undefined
	#triggersSubscriptionId: string | undefined
	#logger: Winston.Logger
	#process!: Process

	#inputManager: InputManager | undefined

	#queue: PQueue

	#observers: Observer[] = []
	/** Set of deviceIds to check for triggers to send  */
	#devicesWithTriggersToSend = new Set<string>()

	constructor(logger: Winston.Logger) {
		this.#logger = logger
		this.#queue = new PQueue({ concurrency: 1 })
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

			await this.initInputManager((peripheralDevice.settings || {}) as DeviceSettings)
			this.#logger.info('InputManager initialized')

			this.#logger.info('Initialization done')
			return
		} catch (e) {
			this.#logger.error('Error during initialization:')
			this.#logger.error(e)
			if (e instanceof Error) this.#logger.error(e.stack)
			try {
				if (this.#coreHandler) {
					this.#coreHandler
						.destroy()
						.catch((err) => this.#logger.error(`Error when trying to destroy CoreHandler: ${err}`))
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

		this.#deviceSettings = settings

		const devices = settings.devices ?? {}

		this.#inputManager = await this.#createInputManager(devices)

		this.#triggersSubscriptionId = await this.#coreHandler.core.autoSubscribe(
			'mountedTriggersForDevice',
			this.#coreHandler.core.deviceId,
			InputManagerHandler.getDeviceIds(devices)
		)
		await this.#coreHandler.core.autoSubscribe('mountedTriggersForDevicePreview', this.#coreHandler.core.deviceId)

		this.#logger.info(`Subscribed to mountedTriggersForDevice: ${this.#triggersSubscriptionId}`)

		this.#refreshMountedTriggers()

		this.#coreHandler.onConnected(() => {
			this.#logger.info(`Core reconnected`)
			this.#handleClearAllMountedTriggers()
				.then(() => {
					this.#refreshMountedTriggers()
				})
				.catch((err) => this.#logger.error(`Error in refreshMountedTriggers() on coreHandler.onConnected: ${err}`))
		})

		const mountedTriggersObserver = this.#coreHandler.core.observe('mountedTriggers')
		mountedTriggersObserver.added = (id, _obj) => {
			this.#handleChangedMountedTrigger(protectString(id)).catch((err) =>
				this.#logger.error(`Error in handleChangedMountedTrigger() on mountedTriggersObserver.added: ${err}`)
			)
		}
		mountedTriggersObserver.changed = (
			id,
			oldFields: Partial<DeviceTriggerMountedAction>,
			cleared: string[],
			newFields: Partial<DeviceTriggerMountedAction>
		) => {
			const obj = this.#coreHandler.core
				.getCollection<DeviceTriggerMountedAction>('mountedTriggers')
				.findOne(protectString(id))
			if (
				newFields['deviceId'] ||
				newFields['deviceTriggerId'] ||
				cleared.includes('deviceId') ||
				cleared.includes('deviceTriggerId')
			) {
				this.#handleRemovedMountedTrigger(
					oldFields.deviceId ?? obj.deviceId,
					oldFields.deviceTriggerId ?? obj.deviceTriggerId
				)
					.then(async () => this.#handleChangedMountedTrigger(protectString(id)))
					.catch((err) => {
						this.#logger.error(`Error in handleRemovedMountedTrigger() on mountedTriggersObserver.changed: ${err}`)
					})
				return
			}
			this.#handleChangedMountedTrigger(protectString(id)).catch((err) => {
				this.#logger.error(`Error in handleChangedMountedTrigger() on mountedTriggersObserver.changed: ${err}`)
			})
		}
		mountedTriggersObserver.removed = (_id, obj) => {
			const obj0 = obj as any as DeviceTriggerMountedAction
			this.#handleRemovedMountedTrigger(obj0.deviceId, obj0.deviceTriggerId).catch((err) => {
				this.#logger.error(`Error in handleRemovedMountedTrigger() on mountedTriggersObserver.removed: ${err}`)
			})
		}
		const triggersPreviewsObserver = this.#coreHandler.core.observe('mountedTriggersPreviews')
		triggersPreviewsObserver.added = (id, obj) => {
			const changedPreview = obj as PreviewWrappedAdLib
			const mountedActions = this.#coreHandler.core.getCollection<DeviceTriggerMountedAction>('mountedTriggers').find({
				actionId: changedPreview.actionId,
			})
			if (mountedActions.length === 0) {
				this.#logger.error(`Could not find mounted action for PreviewAdlib: "${id}"`)
				return
			}
			for (const action of mountedActions) {
				this.#handleChangedMountedTrigger(action._id).catch((err) => {
					this.#logger.error(`Error in handleChangedMountedTrigger() on triggersPreviewsObserver.added: ${err}`)
				})
			}
		}
		triggersPreviewsObserver.changed = (id, _old, _cleared, _new) => {
			const changedPreview = this.#coreHandler.core
				.getCollection<PreviewWrappedAdLib>('mountedTriggersPreviews')
				.findOne(protectString(id))
			if (!changedPreview) {
				this.#logger.error(`Could not find PreviewAdlib: "${id}"`)
				return
			}
			const mountedActions = this.#coreHandler.core.getCollection('mountedTriggers').find({
				actionId: changedPreview.actionId,
			}) as DeviceTriggerMountedAction[]
			if (mountedActions.length === 0) {
				this.#logger.error(`Could not find mounted action for PreviewAdlib: "${changedPreview._id}"`)
				return
			}
			for (const action of mountedActions) {
				this.#handleChangedMountedTrigger(action._id).catch((err) => {
					this.#logger.error(`Error in handleChangedMountedTrigger() on triggersPreviewsObserver.changed: ${err}`)
				})
			}
		}
		triggersPreviewsObserver.removed = (_id, obj) => {
			const changedPreview = obj as PreviewWrappedAdLib
			const mountedActions = this.#coreHandler.core.getCollection('mountedTriggers').find({
				actionId: changedPreview.actionId,
			}) as DeviceTriggerMountedAction[]
			if (mountedActions.length === 0) {
				this.#logger.error(`Could not find mounted action for PreviewAdlib: "${changedPreview._id}"`)
				return
			}
			for (const action of mountedActions) {
				this.#handleChangedMountedTrigger(action._id).catch((err) => {
					this.#logger.error(`Error in handleChangedMountedTrigger() on triggersPreviewsObserver.removed: ${err}`)
				})
			}
		}
		this.#observers.push(triggersPreviewsObserver, mountedTriggersObserver)

		// Monitor for changes in settings:
		this.#coreHandler.onChanged(() => this.#onCoreHandlerChanged())
	}

	async destroy(): Promise<void> {
		for (const obs of this.#observers) {
			obs.stop()
		}
		if (this.#inputManager) await this.#inputManager.destroy()
		if (this.#coreHandler) await this.#coreHandler.destroy()
	}

	#onCoreHandlerChanged() {
		this.#coreHandler.core
			.getPeripheralDevice()
			.then(async (device) => {
				if (!device) return
				if (_.isEqual(device.settings, this.#deviceSettings)) return

				const settings: DeviceSettings = device.settings as DeviceSettings

				this.#logger.debug(`Device configuration changed`)

				if (this.#inputManager) {
					await this.#inputManager.destroy()
					this.#inputManager = undefined
				}

				if (this.#triggersSubscriptionId) {
					this.#coreHandler.core.unsubscribe(this.#triggersSubscriptionId)
					this.#triggersSubscriptionId = undefined
				}

				this.#deviceSettings = settings

				const devices = settings.devices ?? {}

				this.#inputManager = await this.#createInputManager(devices)

				this.#triggersSubscriptionId = await this.#coreHandler.core.autoSubscribe(
					'mountedTriggersForDevice',
					this.#coreHandler.core.deviceId,
					InputManagerHandler.getDeviceIds(devices)
				)

				this.#refreshMountedTriggers()
			})
			.catch(() => {
				this.#logger.error(`coreHandler.onChanged: Could not get peripheral device`)
			})
	}

	#refreshMountedTriggers() {
		this.#coreHandler.core
			.getCollection('mountedTriggers')
			.find({})
			.forEach((obj) => {
				const mountedTrigger = obj as DeviceTriggerMountedAction
				this.#handleChangedMountedTrigger(mountedTrigger._id).catch((err) =>
					this.#logger.error(`Error in #handleChangedMountedTrigger in #refreshMountedTriggers: ${err}`)
				)
			})
	}

	#triggerSendTrigger() {
		// const queueClassName = `${deviceId}_${triggerId}`

		this.#queue
			.add(async (): Promise<void> => {
				try {
					// Send the trigger to Core, if there is any:

					// Find next trigger among devices:
					let triggerToSend: TriggerEvent | undefined = undefined
					let deviceId: string | undefined = undefined
					for (const checkDeviceId of this.#devicesWithTriggersToSend.values()) {
						triggerToSend = this.#inputManager?.getNextTrigger(checkDeviceId)
						if (triggerToSend) {
							deviceId = checkDeviceId
							break
						} else {
							// Remove the device from devices to check:
							this.#devicesWithTriggersToSend.delete(checkDeviceId)
						}
					}

					if (triggerToSend && deviceId) {
						this.#logger.verbose(`Trigger send...`)
						this.#logger.verbose(triggerToSend.triggerId)
						this.#logger.verbose(triggerToSend.arguments)

						if (this.#coreHandler.core.connected) {
							await this.#coreHandler.core.coreMethods.inputDeviceTrigger(
								deviceId,
								triggerToSend.triggerId,
								triggerToSend.arguments ?? null
							)
							this.#logger.verbose(`Trigger send done!`)

							if (triggerToSend.rateLimit) {
								// Wait a bit, to rate-limit sending of the triggers:
								await sleep(triggerToSend.rateLimit)
							}
						} else {
							// If we're not connected, discard the input
							this.#logger.warn('Skipping SendTrigger, not connected to Core')
						}

						// Queue another sendTrigger, to send any triggers that might have come in
						// while we where busy handling this one:
						this.#triggerSendTrigger()
					} else {
						// Nothing left to send.
					}
				} catch (e) {
					this.#logger.error(`peripheralDevice.input.inputDeviceTrigger failed: ${e}`)
					this.#logger.error(e)
				}
			})
			.catch((e) => {
				this.#logger.error(`#queue.add() error: ${e}`)
				this.#logger.error(e)
			})
	}

	async #createInputManager(settings: Record<string, SomeDeviceConfig>): Promise<InputManager> {
		const manager = new InputManager(
			{
				devices: settings,
			},
			this.#logger.child({ source: 'InputManager' })
		)
		manager.on('trigger', (e: ManagerTriggerEventArgs) => {
			this.#devicesWithTriggersToSend.add(e.deviceId)
			this.#triggerSendTrigger()
		})

		await manager.init()
		return manager
	}

	async #handleChangedMountedTrigger(id: DeviceTriggerMountedActionId): Promise<void> {
		const mountedTrigger = this.#coreHandler.core
			.getCollection<DeviceTriggerMountedAction>('mountedTriggers')
			.findOne(id)
		if (!this.#inputManager) return

		const feedbackDeviceId = mountedTrigger?.deviceId
		const feedbackTriggerId = mountedTrigger?.deviceTriggerId
		this.#logger.debug(`Setting feedback for "${feedbackDeviceId}", "${feedbackTriggerId}"`)
		if (!feedbackDeviceId || !feedbackTriggerId) return

		await this.#inputManager.setFeedback(
			feedbackDeviceId,
			feedbackTriggerId,
			await this.#getFeedbackForMountedTrigger(mountedTrigger)
		)
	}

	async #handleRemovedMountedTrigger(deviceId: string, triggerId: string): Promise<void> {
		if (!this.#inputManager) return

		const feedbackDeviceId = deviceId
		const feedbackTriggerId = triggerId
		this.#logger.debug(`Removing feedback for "${feedbackDeviceId}", "${feedbackTriggerId}"`)
		if (!feedbackDeviceId || !feedbackTriggerId) return

		await this.#inputManager.setFeedback(feedbackDeviceId, feedbackTriggerId, null)
	}

	async #handleClearAllMountedTriggers(): Promise<void> {
		if (!this.#inputManager) return

		await this.#inputManager.clearFeedbackAll()
	}

	private static getDeviceIds(settings: Record<string, SomeDeviceConfig>) {
		return Object.keys(settings)
	}

	private static buildFeedbackClassNames(
		mountedTrigger: DeviceTriggerMountedAction,
		contentTypes: SourceLayerType[] | undefined
	): string[] {
		const classNames: string[] = []
		if (mountedTrigger.actionType === 'adlib') {
			classNames.push(ClassNames.AD_LIB)
		}

		if (contentTypes) {
			if (contentTypes.includes(SourceLayerType.AUDIO)) classNames.push(ClassNames.AUDIO)
			if (contentTypes.includes(SourceLayerType.CAMERA)) classNames.push(ClassNames.CAMERA)
			if (contentTypes.includes(SourceLayerType.GRAPHICS)) classNames.push(ClassNames.GRAPHICS)
			if (contentTypes.includes(SourceLayerType.LIVE_SPEAK)) classNames.push(ClassNames.LIVE_SPEAK)
			if (contentTypes.includes(SourceLayerType.LOCAL)) classNames.push(ClassNames.LOCAL)
			if (contentTypes.includes(SourceLayerType.LOWER_THIRD)) classNames.push(ClassNames.LOWER_THIRD)
			if (contentTypes.includes(SourceLayerType.REMOTE)) classNames.push(ClassNames.REMOTE)
			if (contentTypes.includes(SourceLayerType.SCRIPT)) classNames.push(ClassNames.SCRIPT)
			if (contentTypes.includes(SourceLayerType.SPLITS)) classNames.push(ClassNames.SPLITS)
			if (contentTypes.includes(SourceLayerType.TRANSITION)) classNames.push(ClassNames.TRANSITION)
			if (contentTypes.includes(SourceLayerType.UNKNOWN)) classNames.push(ClassNames.UNKNOWN)
			if (contentTypes.includes(SourceLayerType.VT)) classNames.push(ClassNames.VT)
		}

		return classNames
	}

	private static getStringLabel(label: string | ITranslatableMessage | undefined): string | undefined {
		if (label === undefined) return undefined
		if (typeof label === 'string') return label
		return translateMessage(label, interpollateTranslation)
	}

	async #getFeedbackForMountedTrigger(mountedTrigger: DeviceTriggerMountedAction): Promise<SomeFeedback> {
		const actionId = mountedTrigger?.actionId

		let contentLabel: string | undefined
		let contentTypes: SourceLayerType[] | undefined
		let contentLayerLongName: string | undefined
		let contentLayerShortName: string | undefined
		let tally: Tally = Tally.NONE

		if (actionId) {
			const previewedAdlibs = this.#coreHandler.core
				.getCollection('mountedTriggersPreviews')
				.find({
					actionId: mountedTrigger?.actionId,
				})
				.reverse() as PreviewWrappedAdLib[]

			if (previewedAdlibs.length > 0) {
				tally = tally | Tally.PRESENT
				contentLayerLongName = previewedAdlibs[0].sourceLayerName?.name
				contentLayerShortName = previewedAdlibs[0].sourceLayerName?.abbreviation
				contentLabel = previewedAdlibs.map((adlib) => InputManagerHandler.getStringLabel(adlib.label)).join(', ')
				contentTypes = previewedAdlibs
					.map((adlib) => adlib.sourceLayerType)
					.filter((a) => a !== undefined) as SourceLayerType[]
			}
		}

		this.#logger.debug(`${contentLabel}, ${contentTypes}`)

		const userLabel = InputManagerHandler.getStringLabel(mountedTrigger?.name)

		const actionName = mountedTrigger.actionType

		return {
			userLabel: userLabel ? { long: userLabel } : undefined,
			action: mountedTrigger ? { long: actionName } : undefined,
			contentClass: contentLayerLongName ? { long: contentLayerLongName, short: contentLayerShortName } : undefined,
			content: contentLabel ? { long: contentLabel } : undefined,
			classNames: InputManagerHandler.buildFeedbackClassNames(mountedTrigger, contentTypes),
			tally,
		}
	}
}

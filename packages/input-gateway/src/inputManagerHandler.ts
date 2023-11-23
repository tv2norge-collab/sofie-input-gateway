import _ from 'underscore'
import * as Winston from 'winston'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { CoreHandler } from './coreHandler'
import { DeviceSettings } from './interfaces'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import {
	DeviceActionArguments,
	DeviceTriggerMountedAction,
	DeviceTriggerMountedActionId,
	PreviewWrappedAdLib,
	ShiftRegisterActionArguments,
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
import { ITranslatableMessage } from '@sofie-automation/shared-lib/dist/lib/translations'
import {
	Observer,
	SubscriptionId,
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/server-core-integration'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'
import PQueue from 'p-queue'
import { InputGatewaySettings } from './generated/options'

export type SetProcessState = (processName: string, comments: string[], status: StatusCode) => void

const DEFAULT_LOG_LEVEL = 'info'

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
	#triggersSubscriptionId: SubscriptionId | undefined
	#logger: Winston.Logger
	#process!: Process

	#inputManager: InputManager | undefined

	#queue: PQueue

	#shiftRegisters: number[] = []
	#deviceTriggerActions: Record<string, Record<string, DeviceActionArguments>> = {}

	#observers: Observer<any>[] = []
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

			const gatewaySettings = peripheralDevice.deviceSettings as InputGatewaySettings

			this.#logger.level = gatewaySettings?.logLevel ?? DEFAULT_LOG_LEVEL

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

			await this.initInputManager((peripheralDevice.inputDevices || {}) as DeviceSettings)
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

		this.#inputManager = await this.#createInputManager(settings)

		this.#triggersSubscriptionId = await this.#coreHandler.core.autoSubscribe(
			PeripheralDevicePubSub.mountedTriggersForDevice,
			this.#coreHandler.core.deviceId,
			InputManagerHandler.getDeviceIds(settings),
			this.#config.device.deviceToken
		)
		await this.#coreHandler.core.autoSubscribe(
			PeripheralDevicePubSub.mountedTriggersForDevicePreview,
			this.#coreHandler.core.deviceId,
			this.#config.device.deviceToken
		)

		this.#logger.info(`Subscribed to mountedTriggersForDevice: ${this.#triggersSubscriptionId}`)

		await this.#refreshMountedTriggers()

		this.#coreHandler.onConnected(() => {
			this.#logger.info(`Core reconnected`)
			this.#handleClearAllMountedTriggers()
				.then(async () => {
					await this.#refreshMountedTriggers()
				})
				.catch((err) => this.#logger.error(`Error in refreshMountedTriggers() on coreHandler.onConnected: ${err}`))
		})

		const mountedTriggersObserver = this.#coreHandler.core.observe(
			PeripheralDevicePubSubCollectionsNames.mountedTriggers
		)
		mountedTriggersObserver.added = (id, _obj) => {
			this.#handleChangedMountedTrigger(id).catch((err) =>
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
				.getCollection(PeripheralDevicePubSubCollectionsNames.mountedTriggers)
				.findOne(id)
			if (!obj) return
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
					.then(async () => this.#handleChangedMountedTrigger(id))
					.catch((err) => {
						this.#logger.error(`Error in handleRemovedMountedTrigger() on mountedTriggersObserver.changed: ${err}`)
					})
				return
			}
			this.#handleChangedMountedTrigger(id).catch((err) => {
				this.#logger.error(`Error in handleChangedMountedTrigger() on mountedTriggersObserver.changed: ${err}`)
			})
		}
		mountedTriggersObserver.removed = (_id, obj) => {
			const obj0 = obj as any as DeviceTriggerMountedAction
			this.#handleRemovedMountedTrigger(obj0.deviceId, obj0.deviceTriggerId).catch((err) => {
				this.#logger.error(`Error in handleRemovedMountedTrigger() on mountedTriggersObserver.removed: ${err}`)
			})
		}
		const triggersPreviewsObserver = this.#coreHandler.core.observe(
			PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews
		)
		triggersPreviewsObserver.added = (id, obj) => {
			const changedPreview = obj as PreviewWrappedAdLib
			const mountedActions = this.#coreHandler.core
				.getCollection(PeripheralDevicePubSubCollectionsNames.mountedTriggers)
				.find({
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
				.getCollection(PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews)
				.findOne(id)
			if (!changedPreview) {
				this.#logger.error(`Could not find PreviewAdlib: "${id}"`)
				return
			}
			const mountedActions = this.#coreHandler.core
				.getCollection(PeripheralDevicePubSubCollectionsNames.mountedTriggers)
				.find({
					actionId: changedPreview.actionId,
				})
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
			const mountedActions = this.#coreHandler.core
				.getCollection(PeripheralDevicePubSubCollectionsNames.mountedTriggers)
				.find({
					actionId: changedPreview.actionId,
				})
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
				if (_.isEqual(device.inputDevices, this.#deviceSettings)) return

				const settings: DeviceSettings = device.inputDevices as DeviceSettings
				const gatewaySettings: InputGatewaySettings = device.deviceSettings as InputGatewaySettings

				this.#logger.level = gatewaySettings?.logLevel ?? DEFAULT_LOG_LEVEL

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

				this.#inputManager = await this.#createInputManager(settings)

				this.#triggersSubscriptionId = await this.#coreHandler.core.autoSubscribe(
					PeripheralDevicePubSub.mountedTriggersForDevice,
					this.#coreHandler.core.deviceId,
					InputManagerHandler.getDeviceIds(settings),
					this.#config.device.deviceToken
				)

				await this.#refreshMountedTriggers()
			})
			.catch(() => {
				this.#logger.error(`coreHandler.onChanged: Could not get peripheral device`)
			})
	}

	async #refreshMountedTriggers() {
		this.#deviceTriggerActions = {}

		if (!this.#inputManager) return

		const endReplaceTransaction = this.#inputManager.beginFeedbackReplaceTransaction()

		const mountedActions = this.#coreHandler.core
			.getCollection(PeripheralDevicePubSubCollectionsNames.mountedTriggers)
			.find({})

		await Promise.allSettled(
			mountedActions.map(async (mountedTrigger) => this.#handleChangedMountedTrigger(mountedTrigger._id))
		)

		await endReplaceTransaction()
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

					if (!triggerToSend || !deviceId) {
						// Nothing left to send.
						return
					}
					triggerToSend.triggerId = this.#shiftPrefixTriggerId(triggerToSend.triggerId)

					this.#executeDeviceAction(deviceId, triggerToSend)

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

	#executeDeviceAction(deviceId: string, trigger: TriggerEvent): void {
		const deviceAction: DeviceActionArguments | undefined = this.#deviceTriggerActions[deviceId]?.[trigger.triggerId]
		if (!deviceAction) return

		this.#logger.debug(`Executing Device Action: ${deviceAction.type}: ${JSON.stringify(deviceAction)}`)

		if (deviceAction.type === 'modifyRegister') this.#executeModifyShiftRegister(deviceAction)
	}

	#executeModifyShiftRegister(action: ShiftRegisterActionArguments): void {
		const registerIndex = Number(action.register)

		if (registerIndex < 0 || !Number.isInteger(registerIndex)) {
			this.#logger.error(`Register index needs to be a non-negative integer: received "${action.register}" in action"`)
			return
		}

		const value = Number(action.value)
		const min = Number(action.limitMin)
		const max = Number(action.limitMax)

		const originalValue = this.#shiftRegisters[registerIndex] ?? 0
		let newValue = originalValue
		switch (action.operation) {
			case '=':
				newValue = value
				break
			case '+':
				newValue += value
				break
			case '-':
				newValue -= value
				break
		}

		newValue = Math.max(Math.min(newValue, max), min)

		this.#shiftRegisters[registerIndex] = newValue

		this.#refreshMountedTriggers().catch(this.#logger.error)
	}

	#SHIFT_PREFIX_REGEX = /^\[([\d:]+)\]\s+(.+)$/

	#shiftPrefixTriggerId(triggerId: string): string {
		const shiftPrefix = this.#serializeShiftRegisters()
		if (shiftPrefix === '') {
			return triggerId
		}
		return `${shiftPrefix} ${triggerId}`
	}

	#shiftUnprefixTriggerId(prefixedTriggerId: string): [number[], string] {
		const match = this.#SHIFT_PREFIX_REGEX.exec(prefixedTriggerId)
		if (!match) return [[], prefixedTriggerId]

		const shiftStates = match[1].split(':').map((shiftRegister) => Number(shiftRegister))
		const triggerId = match[2]
		return [shiftStates, triggerId]
	}

	#matchesCurrentShiftState(shiftState: number[]): boolean {
		const maxLength = Math.max(shiftState.length, this.#shiftRegisters.length)
		for (let i = 0; i < maxLength; i++) {
			if ((shiftState[i] ?? 0) !== (this.#shiftRegisters[i] ?? 0)) return false
		}
		return true
	}

	#serializeShiftRegisters(): string {
		const output: string[] = []
		const buffer: string[] = []
		const maxRegister = this.#shiftRegisters.length
		for (let i = 0; i < maxRegister; i++) {
			const curValue = this.#shiftRegisters[i] ?? 0
			if (curValue !== 0) {
				output.push(...buffer)
				output.push(String(curValue))
				buffer.length = 0
			} else {
				buffer.push(String(curValue))
			}
		}

		if (output.length === 0) return ''

		return `[${output.join(':')}]`
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
			.getCollection(PeripheralDevicePubSubCollectionsNames.mountedTriggers)
			.findOne(id)
		if (!this.#inputManager) return

		const feedbackDeviceId = mountedTrigger?.deviceId
		const feedbackTriggerId = mountedTrigger?.deviceTriggerId
		this.#logger.debug(`Setting feedback for "${feedbackDeviceId}", "${feedbackTriggerId}"`)
		if (!feedbackDeviceId || !feedbackTriggerId) return

		if (mountedTrigger.deviceActionArguments) {
			this.#deviceTriggerActions[feedbackDeviceId] = this.#deviceTriggerActions[feedbackDeviceId] ?? {}
			this.#deviceTriggerActions[feedbackDeviceId][feedbackTriggerId] = mountedTrigger.deviceActionArguments
		}

		const [shiftState, unshiftedTriggerId] = this.#shiftUnprefixTriggerId(feedbackTriggerId)

		if (!this.#matchesCurrentShiftState(shiftState)) return

		await this.#inputManager.setFeedback(
			feedbackDeviceId,
			unshiftedTriggerId,
			await this.#getFeedbackForMountedTrigger(mountedTrigger)
		)
	}

	async #handleRemovedMountedTrigger(deviceId: string, triggerId: string): Promise<void> {
		if (!this.#inputManager) return

		const feedbackDeviceId = deviceId
		const feedbackTriggerId = triggerId
		this.#logger.debug(`Removing feedback for "${feedbackDeviceId}", "${feedbackTriggerId}"`)
		if (!feedbackDeviceId || !feedbackTriggerId) return

		if (
			this.#deviceTriggerActions[feedbackDeviceId] &&
			this.#deviceTriggerActions[feedbackDeviceId][feedbackTriggerId]
		) {
			delete this.#deviceTriggerActions[feedbackDeviceId][feedbackTriggerId]
		}

		const [shiftState, unshiftedTriggerId] = this.#shiftUnprefixTriggerId(feedbackTriggerId)

		if (!this.#matchesCurrentShiftState(shiftState)) return

		await this.#inputManager.setFeedback(feedbackDeviceId, unshiftedTriggerId, null)
	}

	async #handleClearAllMountedTriggers(): Promise<void> {
		if (!this.#inputManager) return

		this.#deviceTriggerActions = {}
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
				.getCollection(PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews)
				.find({
					actionId: mountedTrigger?.actionId,
				})
				.reverse()

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

import EventEmitter from 'eventemitter3'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { SomeFeedback } from '../feedback/feedback'
import { Logger } from '../logger'

/**
 * Description of a "trigger got triggered" event
 */
export interface TriggerEvent {
	/**
	 * ID of the trigger, individually identifies the source of the trigger:
	 * ie: "key X pressed down", "key X pressed up", "knob Y rotated", "slider Z moved" etc..
	 */
	triggerId: string
	/**
	 * A set of custom values describing the data received with the input event itself:
	 * pressure, voltage, value, etc.
	 */
	arguments?: TriggerEventArguments

	/**
	 * If set, how often to wait for unti sending another Trigger event
	 */
	rateLimit?: number
}

export type TriggerEventArguments = Record<string, string | number | boolean>

export interface ErrorArgs {
	error: Error
}

export interface StatusChangeEventArgs {
	status: StatusCode
}

type DeviceEvents = {
	/** A notification that a trigger was triggered, call this.getNextTrigger() to get it when it's time to send it to Core. */
	trigger: []
	statusChange: [e: StatusChangeEventArgs]
	error: [e: ErrorArgs]
}

export abstract class Device extends EventEmitter<DeviceEvents> {
	protected logger: Logger

	/** A list of triggers, in the order that they where triggered / updated */
	#triggerEvents: TriggerEvent[] = []

	constructor(logger: Logger) {
		super()
		this.logger = logger
	}

	abstract setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void>
	abstract clearFeedbackAll(): Promise<void>

	abstract init(): Promise<void>
	async destroy(): Promise<void> {
		this.removeAllListeners()
	}

	protected addTriggerEvent(triggerEvent: TriggerEvent): void {
		this.#triggerEvents.push(triggerEvent)
		this.emit('trigger')
	}
	protected updateTriggerAnalog<T extends TriggerEventArguments>(
		triggerEvent: Omit<TriggerEvent, 'arguments'>,
		updateArgumnets: (triggerAnalog: T | undefined) => T
	): void {
		const existingIndex = this.#triggerEvents.findIndex((t) => t.triggerId === triggerEvent.triggerId)
		const trigger: TriggerEvent = existingIndex !== -1 ? this.#triggerEvents[existingIndex] : triggerEvent

		// Update the analog value:
		trigger.arguments = updateArgumnets(trigger.arguments as T | undefined)

		// Move the trigger to end:
		this.#triggerEvents.splice(existingIndex, 1)
		this.#triggerEvents.push(trigger)

		this.emit('trigger')
	}

	/**
	 * Returns the next trigger to send to Core.
	 * If there are no more triggers to send, return undefined
	 */
	getNextTrigger(): TriggerEvent | undefined {
		return this.#triggerEvents.shift()
	}
}

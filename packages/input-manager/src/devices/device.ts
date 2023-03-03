import EventEmitter from 'eventemitter3'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { SomeFeedback } from '../feedback/feedback'
import { Logger } from '../logger'
import { shiftMapFirstEntry } from '../lib'

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

	/** A list of triggered keys, in the order that they where triggered */
	protected triggerKeys: {
		triggerId: string
		arguments?: any
	}[] = []
	/**
	 * A map of trigger-analog values.
	 * Keys are triggerIds
	 * Values are the trigger Arguments
	 */
	protected triggerAnalogs = new Map<string, TriggerEventArguments>()

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

	/**
	 * Returns the next trigger to send to Core.
	 * If there are no more triggers to send, return undefined
	 */
	getNextTrigger(): TriggerEvent | undefined {
		{
			const e = this.triggerKeys.shift()
			if (e) return { triggerId: e.triggerId, arguments: e.arguments }
		}
		{
			const e = shiftMapFirstEntry(this.triggerAnalogs)
			if (e) return { triggerId: e.key, arguments: e.value }
		}

		return undefined
	}
}

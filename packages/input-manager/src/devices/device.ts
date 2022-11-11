import EventEmitter from 'events'
import { Logger } from '../logger'

type Feedback = Record<string, never>

/**
 * Description of a the "trigger got triggered" event
 *
 * @interface TriggerEventArgs
 */
export interface TriggerEventArgs {
	/** ID of the triggered trigger, needs to individually identify a single source of events: an individual button, key, input, etc. */
	triggerId: string
	/** A set of custom values describind the data received with the input event itself: pressure, voltage, value, etc. */
	arguments?: Record<string, string | number | boolean>
	/** Should this event replace whatever unsent events there are */
	replacesPrevious?: boolean
}

export abstract class Device extends EventEmitter {
	// @ts-expect-error this is an abstract class, we use logger elsewhere
	#logger: Logger

	on(event: 'trigger', listener: (e: TriggerEventArgs) => void): this
	on(event: string | symbol, listener: (...args: any[]) => void): this {
		return super.on(event, listener)
	}

	emit(event: 'trigger', e: TriggerEventArgs): boolean
	emit(event: string | symbol, ...args: any[]): boolean {
		return super.emit(event, ...args)
	}

	constructor(logger: Logger) {
		super()
		this.#logger = logger
	}

	abstract setFeedback(triggerId: string, feedback: Feedback): void

	abstract init(): Promise<void>
	async destroy(): Promise<void> {
		this.removeAllListeners()
	}
}

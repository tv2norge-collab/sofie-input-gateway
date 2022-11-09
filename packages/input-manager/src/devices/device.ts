import EventEmitter from 'events'

interface TriggerEventArgs {
	triggerId: string
	arguments?: Record<string, string | number | boolean>
}

export abstract class Device extends EventEmitter {
	on(event: 'trigger', listener: (e: TriggerEventArgs) => void): this
	on(event: string | symbol, listener: (...args: any[]) => void): this {
		return super.on(event, listener)
	}

	emit(event: 'trigger', e: TriggerEventArgs): boolean
	emit(event: string | symbol, ...args: any[]): boolean {
		return super.emit(event, ...args)
	}

	abstract init(): Promise<void>
	abstract destroy(): Promise<void>
}

import { EventEmitter } from 'events'

export class InputGenerator extends EventEmitter {
	constructor (deviceId: string) {
		super()

		this.emit('inputEvent', {
			deviceId,
			eventName: 'test',
			args: [ Math.random() ]
		})
	}
}

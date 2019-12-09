import { EventEmitter } from 'events'

export class InputGenerator extends EventEmitter {
	constructor (deviceId: string) {
		super()

		setInterval(() => {
			this.emit('inputEvent', {
				deviceId,
				eventName: 'test',
				args: [ Math.random() ]
			})}, 3000)
	}
}

import { Input } from 'easymidi'
import { Device } from '../../devices/device'

export class MIDIDevice extends Device {
	private input: Input | undefined

	constructor() {
		super()
	}

	async init(): Promise<void> {
		this.input = new Input('Input Name')
		this.input.on('noteon', (msg) => {
			const triggerId = `${msg.channel}:${msg.note}`
			this.emit('trigger', {
				triggerId,
			})
		})
	}

	async destroy(): Promise<void> {
		if (!this.input) return
		this.input.close()
	}
}

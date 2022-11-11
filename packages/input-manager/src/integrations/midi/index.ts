import { Input } from 'easymidi'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'

export interface MIDIDeviceConfig {
	inputName: string
}

export class MIDIDevice extends Device {
	#input: Input | undefined
	#config: MIDIDeviceConfig

	constructor(config: MIDIDeviceConfig, logger: Logger) {
		super(logger)
		this.#config = config
	}

	async init(): Promise<void> {
		this.#input = new Input(this.#config.inputName)
		this.#input.on('noteon', (msg) => {
			const triggerId = `noteOn ${msg.channel}_${msg.note}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					velocity: msg.velocity,
				},
			})
		})
		this.#input.on('noteoff', (msg) => {
			const triggerId = `noteOff ${msg.channel}_${msg.note}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					velocity: msg.velocity,
				},
			})
		})
		this.#input.on('cc', (msg) => {
			const triggerId = `cc ${msg.channel}_${msg.controller}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					value: msg.value,
				},
				replacesPrevious: true,
			})
		})
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.#input) return
		this.#input.close()
	}

	setFeedback(): void {
		void ''
	}
}

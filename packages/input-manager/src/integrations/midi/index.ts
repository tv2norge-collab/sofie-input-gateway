import { Input, Output } from 'easymidi'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { Symbols } from '../../lib'
import { SomeFeedback } from '../../feedback/feedback'

export interface MIDIDeviceConfig {
	inputName: string
	outputName?: string
}

export class MIDIDevice extends Device {
	#input: Input | undefined
	#output: Output | undefined
	#config: MIDIDeviceConfig
	#feedbacks: Record<number, SomeFeedback> = {}

	constructor(config: MIDIDeviceConfig, logger: Logger) {
		super(logger)
		this.#config = config
	}

	async init(): Promise<void> {
		this.#input = new Input(this.#config.inputName)
		if (this.#config.outputName) this.#output = new Output(this.#config.outputName)
		this.#input.on('noteon', (msg) => {
			const triggerId = `${msg.channel}_${msg.note} ${Symbols.DOWN}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					velocity: msg.velocity,
				},
			})
			this.updateFeedback(msg.note).catch(console.error)
		})
		this.#input.on('noteoff', (msg) => {
			const triggerId = `${msg.channel}_${msg.note} ${Symbols.UP}`
			this.emit('trigger', {
				triggerId,
				arguments: {
					velocity: msg.velocity,
				},
			})
			this.updateFeedback(msg.note).catch(console.error)
		})
		this.#input.on('cc', (msg) => {
			const triggerId = `${msg.channel}_${msg.controller} cc`
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
		if (this.#input) this.#input.close()
		if (this.#output) this.#output.close()
	}

	private static parseTriggerId(triggerId: string): { note: number; isNote: boolean; isCC: boolean; isUp: boolean } {
		const triggerElements = triggerId.match(/(\d+)_(\d+)\s+(\S+)/)
		if (!triggerElements) return { note: 0, isNote: false, isCC: false, isUp: false }
		const note = Number.parseInt(triggerElements[2] ?? '0')
		const isNote = triggerElements[3] === Symbols.UP || triggerElements[3] === Symbols.DOWN
		const isCC = triggerElements[3] === 'cc'
		const isUp = triggerElements[3] === Symbols.UP
		return { note, isNote, isCC, isUp }
	}

	private selectOutputNote(note: number): number {
		if (note >= 8 && note <= 23) {
			return note - 8
		}
		return 128
	}

	private async updateFeedback(note: number): Promise<void> {
		const output = this.#output
		if (!output) return
		const feedback = this.#feedbacks[note]
		const channel = 0

		let velocity = 1
		if (!feedback) {
			velocity = 0
		}

		const outputNote = this.selectOutputNote(note)

		this.logger.debug(`isOpen: ${output.isPortOpen()}`)
		this.logger.debug(`${note} Sending NoteOn: ${channel}_${outputNote} ${velocity}`)

		output.send('noteon', {
			channel,
			note: outputNote,
			velocity,
		})
	}

	async setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void> {
		if (!this.#input) return

		const { note, isNote } = MIDIDevice.parseTriggerId(triggerId)

		this.logger.debug(`Note: ${note} ${isNote}`)

		if (!isNote) return

		this.#feedbacks[note] = feedback

		await this.updateFeedback(note)
	}
}

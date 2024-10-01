import { Channel, Input, Output, getInputs, getOutputs } from 'easymidi'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { DEFAULT_ANALOG_RATE_LIMIT, Symbols } from '../../lib'
import { SomeFeedback, Tally } from '../../feedback/feedback'
import { MIDICCFeedback, MIDIControllerOptions, MIDINoteOnFeedback } from '../../generated/midi'

import DEVICE_OPTIONS from './$schemas/options.json'

enum MIDISymbols {
	CC = 'cc',
}

const MIDI_RECHECK_INTERVAL = 5000

export class MIDIDevice extends Device {
	private input: Input | undefined
	private output: Output | undefined
	private config: MIDIControllerOptions
	private feedbacks: Record<string, SomeFeedback> = {}
	private checkInterval: NodeJS.Timeout | undefined = undefined

	constructor(config: MIDIControllerOptions, logger: Logger) {
		super(logger)
		this.config = config
	}

	async init(): Promise<void> {
		try {
			this.input = new Input(this.config.inputName)
			if (this.config.outputName) this.output = new Output(this.config.outputName)
			this.input.on('noteon', (msg) => {
				const triggerId = `${msg.channel}_${msg.note} ${Symbols.DOWN}`

				this.addTriggerEvent({ triggerId, arguments: { velocity: msg.velocity } })

				// Some MIDI Devices clear backlight state when pressing a button, this will attempt
				// to restore the correct state
				this.updateFeedback(`${msg.channel}_${msg.note}`).catch((err) =>
					this.logger.error(`MIDI: Error updating feedback: ${err}`)
				)
			})
			this.input.on('noteoff', (msg) => {
				const triggerId = `${msg.channel}_${msg.note} ${Symbols.UP}`

				this.addTriggerEvent({ triggerId, arguments: { velocity: msg.velocity } })

				this.updateFeedback(`${msg.channel}_${msg.note}`).catch((err) =>
					this.logger.error(`MIDI: Error updating feedback: ${err}`)
				)
			})
			this.input.on('cc', (msg) => {
				const triggerId = `${msg.channel}_${msg.controller} ${MIDISymbols.CC}`

				this.updateTriggerAnalog({ triggerId, rateLimit: DEFAULT_ANALOG_RATE_LIMIT }, () => {
					return {
						value: msg.value,
					}
				})
			})

			this.checkInterval = setInterval(() => this.midiPortDetection(), MIDI_RECHECK_INTERVAL)
		} catch (e) {
			this.emit('error', {
				error: new Error('MIDI init error'),
			})
		}
	}

	private midiPortDetection(): void {
		const inputs = getInputs()
		if (!inputs.includes(this.config.inputName)) {
			this.emit('error', {
				error: new Error(`MIDI Input Device "${this.config.inputName}" disconnected!`),
			})
			return
		}

		if (!this.config.outputName) return
		const outputs = getOutputs()
		if (!outputs.includes(this.config.outputName)) {
			this.emit('error', {
				error: new Error(`MIDI Output Device "${this.config.outputName}" disconnected!`),
			})
			return
		}
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (this.checkInterval) clearInterval(this.checkInterval)
		if (this.input) this.input.close()
		if (this.output) this.output.close()
	}

	private static parseTriggerId(triggerId: string): {
		channel: number
		noteOrController: number
		isNote: boolean
		isCC: boolean
		isUp: boolean
	} {
		const triggerElements = triggerId.match(/(\d+)_(\d+)\s+(\S+)/)
		if (!triggerElements) return { channel: 0, noteOrController: 0, isNote: false, isCC: false, isUp: false }
		const channel = Number.parseInt(triggerElements[1] ?? '0')
		const noteOrController = Number.parseInt(triggerElements[2] ?? '0')
		const isNote = triggerElements[3] === Symbols.UP || triggerElements[3] === Symbols.DOWN
		const isCC = triggerElements[3] === MIDISymbols.CC
		const isUp = triggerElements[3] === Symbols.UP
		return { channel, noteOrController, isNote, isCC, isUp }
	}

	// private selectOutputNote(note: number): number {
	// 	if (note >= 8 && note <= 23) {
	// 		return note - 8
	// 	}
	// 	return 128
	// }

	private static definedAndGTE0(num: number | undefined): number | undefined {
		if (num === undefined) return undefined
		if (num < 0) return undefined
		return num
	}

	private async updateNoteFeedback(
		triggerId: string,
		feedback: SomeFeedback,
		config: MIDINoteOnFeedback,
		output: Output
	): Promise<void> {
		const { channel, note } = config
		let velocity = config.velocity ?? 0
		this.logger.debug(`${triggerId} Sending NoteOn: ${channel}_${note} ${velocity}`)

		if ((feedback?.tally ?? 0 & Tally.PRESENT) !== 0) {
			velocity = MIDIDevice.definedAndGTE0(config.velocityPresent) ?? velocity
		}
		if ((feedback?.tally ?? 0 & Tally.NEXT) !== 0) {
			velocity = MIDIDevice.definedAndGTE0(config.velocityNext) ?? velocity
		}
		if ((feedback?.tally ?? 0 & Tally.CURRENT) !== 0) {
			velocity = MIDIDevice.definedAndGTE0(config.velocityOnAir) ?? velocity
		}

		output.send('noteon', {
			channel: channel as Channel,
			note: note,
			velocity: velocity,
		})
	}

	private async updateCCFeedback(
		triggerId: string,
		feedback: SomeFeedback,
		config: MIDICCFeedback,
		output: Output
	): Promise<void> {
		const { channel, cc } = config
		let value = config.value ?? 0
		this.logger.debug(`${triggerId} Sending CC: ${channel}_${cc} ${value}`)

		if ((feedback?.tally ?? 0 & Tally.PRESENT) !== 0) {
			value = MIDIDevice.definedAndGTE0(config.valuePresent) ?? value
		}
		if ((feedback?.tally ?? 0 & Tally.NEXT) !== 0) {
			value = MIDIDevice.definedAndGTE0(config.valueNext) ?? value
		}
		if ((feedback?.tally ?? 0 & Tally.CURRENT) !== 0) {
			value = MIDIDevice.definedAndGTE0(config.valueOnAir) ?? value
		}

		output.send('cc', {
			channel: channel as Channel,
			controller: cc,
			value,
		})
	}

	private async updateFeedback(triggerId: string): Promise<void> {
		if (!this.config.feedbackSettings) return

		const output = this.output
		if (!output) return

		const feedback = this.feedbacks[triggerId]

		if (this.config.feedbackSettings.cc) {
			for (const configEntry of this.config.feedbackSettings.cc) {
				if (configEntry.trigger !== triggerId) break

				await this.updateCCFeedback(triggerId, feedback, configEntry, output)
			}
		}

		if (this.config.feedbackSettings.note) {
			for (const configEntry of this.config.feedbackSettings.note) {
				if (configEntry.trigger !== triggerId) break

				await this.updateNoteFeedback(triggerId, feedback, configEntry, output)
			}
		}
	}

	async setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void> {
		if (!this.input) return

		const { channel, noteOrController, isNote } = MIDIDevice.parseTriggerId(triggerId)

		this.logger.debug(`Note: ${noteOrController} ${isNote}`)

		if (isNote) {
			triggerId = `${channel}_${noteOrController}`
		}

		this.feedbacks[triggerId] = feedback

		await this.updateFeedback(triggerId)
	}

	async clearFeedbackAll(): Promise<void> {
		for (const keyStr of Object.keys(this.feedbacks)) {
			this.feedbacks[keyStr] = null
			await this.updateFeedback(keyStr)
		}
	}

	static getOptionsManifest(): object {
		return DEVICE_OPTIONS
	}
}

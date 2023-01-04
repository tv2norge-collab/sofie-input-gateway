import { Channel, Input, Output, getInputs, getOutputs } from 'easymidi'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { assertNever, DeviceConfigManifest, Symbols } from '../../lib'
import { SomeFeedback, Tally } from '../../feedback/feedback'
import { ConfigManifestEntryType, TableConfigManifestEntry } from '@sofie-automation/server-core-integration'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'

enum MIDISymbols {
	CC = 'cc',
}

interface MIDIFeedback {
	trigger: string
}

interface NoteFeedback extends MIDIFeedback {
	type: 'note'
	channel: number
	note: number
	velocity: number
	velocityPresent?: number
	velocityNext?: number
	velocityOnAir?: number
}

interface ControllerFeedback extends MIDIFeedback {
	type: 'cc'
	channel: number
	cc: number
	value: number
	valuePresent?: number
	valueNext?: number
	valueOnAir?: number
}

interface SysExFeedback extends MIDIFeedback {
	type: 'sysex'
	data: string
}

type FeedbackSetting = NoteFeedback | ControllerFeedback | SysExFeedback

const MIDI_RECHECK_INTERVAL = 5000

export interface MIDIDeviceConfig {
	inputName: string
	outputName?: string
	feedbackSettings?: Array<FeedbackSetting>
}

export const DEVICE_CONFIG: DeviceConfigManifest<MIDIDeviceConfig> = [
	{
		id: 'inputName',
		type: ConfigManifestEntryType.STRING,
		name: 'Input Name',
	},
	{
		id: 'outputName',
		type: ConfigManifestEntryType.STRING,
		name: 'Output Name',
	},
	literal<Omit<TableConfigManifestEntry, 'id'> & { id: keyof MIDIDeviceConfig }>({
		id: 'feedbackSettings',
		type: ConfigManifestEntryType.TABLE,
		name: 'Feedback',
		defaultType: 'note',
		typeField: 'type',
		config: {
			note: [
				{
					id: 'trigger',
					type: ConfigManifestEntryType.STRING,
					columnName: 'Trigger',
					name: 'Trigger',
				},
				{
					id: 'channel',
					type: ConfigManifestEntryType.INT,
					name: 'Channel',
					columnName: 'Channel',
				},
				{
					id: 'note',
					type: ConfigManifestEntryType.INT,
					name: 'Note',
					columnName: 'Note / CC',
				},
				{
					id: 'velocity',
					type: ConfigManifestEntryType.INT,
					name: 'Velocity - Default',
					hint: 'Use `-1` to not emit anything when condition met',
				},
				{
					id: 'velocityPresent',
					type: ConfigManifestEntryType.INT,
					name: 'Velocity - Present',
					hint: 'Use `-1` to not emit anything when condition met',
				},
				{
					id: 'velocityNext',
					type: ConfigManifestEntryType.INT,
					name: 'Velocity - Next',
					hint: 'Use `-1` to not emit anything when condition met',
				},
				{
					id: 'velocityOnAir',
					type: ConfigManifestEntryType.INT,
					name: 'Velocity - OnAir',
					hint: 'Use `-1` to not emit anything when condition met',
				},
			],
			cc: [
				{
					id: 'trigger',
					type: ConfigManifestEntryType.STRING,
					columnName: 'Trigger',
					name: 'Trigger',
				},
				{
					id: 'channel',
					type: ConfigManifestEntryType.INT,
					name: 'Channel',
					columnName: 'Channel',
				},
				{
					id: 'cc',
					type: ConfigManifestEntryType.INT,
					name: 'Controller',
					columnName: 'Note / CC',
				},
				{
					id: 'value',
					type: ConfigManifestEntryType.INT,
					name: 'Value - Default',
					hint: 'Use `-1` to not emit anything when condition met',
				},
				{
					id: 'valuePresent',
					type: ConfigManifestEntryType.INT,
					name: 'Value - Present',
					hint: 'Use `-1` to not emit anything when condition met',
				},
				{
					id: 'valueNext',
					type: ConfigManifestEntryType.INT,
					name: 'Value - Next',
					hint: 'Use `-1` to not emit anything when condition met',
				},
				{
					id: 'valueOnAir',
					type: ConfigManifestEntryType.INT,
					name: 'Value - OnAir',
					hint: 'Use `-1` to not emit anything when condition met',
				},
			],
		},
	}),
]

export class MIDIDevice extends Device {
	#input: Input | undefined
	#output: Output | undefined
	#config: MIDIDeviceConfig
	#feedbacks: Record<string, SomeFeedback> = {}
	#checkInterval: NodeJS.Timer | undefined = undefined

	constructor(config: MIDIDeviceConfig, logger: Logger) {
		super(logger)
		this.#config = config
	}

	async init(): Promise<void> {
		try {
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
				// Some MIDI Devices clear backlight state when pressing a button, this will attempt
				// to restore the correct state
				this.updateFeedback(`${msg.channel}_${msg.note}`).catch(console.error)
			})
			this.#input.on('noteoff', (msg) => {
				const triggerId = `${msg.channel}_${msg.note} ${Symbols.UP}`
				this.emit('trigger', {
					triggerId,
					arguments: {
						velocity: msg.velocity,
					},
				})
				this.updateFeedback(`${msg.channel}_${msg.note}`).catch(console.error)
			})
			this.#input.on('cc', (msg) => {
				const triggerId = `${msg.channel}_${msg.controller} ${MIDISymbols.CC}`
				this.emit('trigger', {
					triggerId,
					arguments: {
						value: msg.value,
					},
					replacesPrevious: true,
				})
			})

			this.#checkInterval = setInterval(() => this.midiPortDetection(), MIDI_RECHECK_INTERVAL)
		} catch (e) {
			this.emit('error', {
				error: new Error('MIDI init error'),
			})
		}
	}

	private midiPortDetection(): void {
		const inputs = getInputs()
		if (!inputs.includes(this.#config.inputName)) {
			this.emit('error', {
				error: new Error(`MIDI Input Device "${this.#config.inputName}" disconnected!`),
			})
			return
		}

		if (!this.#config.outputName) return
		const outputs = getOutputs()
		if (!outputs.includes(this.#config.outputName)) {
			this.emit('error', {
				error: new Error(`MIDI Output Device "${this.#config.outputName}" disconnected!`),
			})
			return
		}
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (this.#checkInterval) clearInterval(this.#checkInterval)
		if (this.#input) this.#input.close()
		if (this.#output) this.#output.close()
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
		config: NoteFeedback,
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
		config: ControllerFeedback,
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

	private async updateSysExFeedback(
		_triggerId: string,
		_feedback: SomeFeedback,
		_config: SysExFeedback,
		_output: Output
	): Promise<void> {
		void 0
	}

	private async updateFeedback(triggerId: string): Promise<void> {
		if (!this.#config.feedbackSettings) return

		const output = this.#output
		if (!output) return

		const feedback = this.#feedbacks[triggerId]

		for (const configEntry of this.#config.feedbackSettings) {
			if (configEntry.trigger !== triggerId) break

			switch (configEntry.type) {
				case 'note':
					await this.updateNoteFeedback(triggerId, feedback, configEntry, output)
					break
				case 'cc':
					await this.updateCCFeedback(triggerId, feedback, configEntry, output)
					break
				case 'sysex':
					await this.updateSysExFeedback(triggerId, feedback, configEntry, output)
					break
				default:
					assertNever(configEntry)
					this.logger.error(`Unknown feedback type: ${JSON.stringify(configEntry)}`)
			}
		}
	}

	async setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void> {
		if (!this.#input) return

		const { channel, noteOrController, isNote } = MIDIDevice.parseTriggerId(triggerId)

		this.logger.debug(`Note: ${noteOrController} ${isNote}`)

		if (isNote) {
			triggerId = `${channel}_${noteOrController}`
		}

		this.#feedbacks[triggerId] = feedback

		await this.updateFeedback(triggerId)
	}

	async clearFeedbackAll(): Promise<void> {
		for (const keyStr of Object.keys(this.#feedbacks)) {
			this.#feedbacks[keyStr] = null
			await this.updateFeedback(keyStr)
		}
	}
}

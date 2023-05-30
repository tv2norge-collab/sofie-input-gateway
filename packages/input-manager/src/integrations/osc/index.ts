import * as osc from 'osc'
import { Logger } from '../../logger'
import { Device, TriggerEventArguments } from '../../devices/device'
import { SomeFeedback, Tally } from '../../feedback/feedback'
import { clearInterval } from 'timers'
import { OSCServerOptions } from '../../generated'

import DEVICE_OPTIONS from './$schemas/options.json'

const PING_MESSAGE_ADDRESS = '/ping'
const KNOWN_SENDER_EXPIRATION = 30 * 1000

const REFRESH_KNOWN_SENDERS = 5000

const DEFAULT_PORT = 57121

interface KnownSender {
	address: string
	port: number
	lastSeen: number
}

export class OSCServer extends Device {
	#port: osc.UDPPort | undefined
	#knownSenders: KnownSender[] = []
	#config: OSCServerOptions
	#feedbacks: Record<string, SomeFeedback> = {}
	#refreshInterval: NodeJS.Timer | undefined

	constructor(config: OSCServerOptions, logger: Logger) {
		super(logger)
		this.#config = config
	}

	async init(): Promise<void> {
		this.#port = new osc.UDPPort({
			localPort: this.#config.port || DEFAULT_PORT,
			localAddress: this.#config.host || undefined,
		})
		this.#port.on('bundle', (_bundle, _timeTag, info) => {
			this.#updateKnownSenderLastSeen(info.address, info.port)
		})
		this.#port.on('message', (message) => {
			if (message.address === PING_MESSAGE_ADDRESS) return

			const triggerId = message.address

			const messageArguments: TriggerEventArguments = {}
			const args =
				message.args instanceof Uint8Array
					? [message.args]
					: Array.isArray(message.args)
					? message.args
					: [message.args]

			for (let i = 0; i < args.length; i++) {
				messageArguments[`${i}`] = JSON.stringify(args[i])
			}

			this.addTriggerEvent({ triggerId, arguments: messageArguments })
		})
		this.#refreshInterval = setInterval(() => this.#refreshKnownSenders(), REFRESH_KNOWN_SENDERS)
	}

	#updateKnownSenderLastSeen(address: string, port: number) {
		const lastSeen = Date.now()
		const sender = this.#knownSenders.find((entry) => entry.address === address && entry.port === port)
		if (!sender) {
			this.#knownSenders.push({
				address,
				port,
				lastSeen,
			})
			return
		}
		sender.lastSeen = lastSeen
	}

	#refreshKnownSenders() {
		const expiresNow = Date.now() - KNOWN_SENDER_EXPIRATION
		this.#knownSenders = this.#knownSenders.filter((entry) => entry.lastSeen < expiresNow)

		if (!this.#port) return
		for (const [triggerId, feedback] of Object.entries<SomeFeedback>(this.#feedbacks)) {
			for (const sender of this.#knownSenders) {
				this.#port.send(OSCServer.makeMessageFromFeedback(triggerId, feedback), sender.address, sender.port)
			}
		}
	}

	async destroy(): Promise<void> {
		await super.destroy()
		clearInterval(this.#refreshInterval)
		this.#knownSenders.length = 0
		if (!this.#port) return
		const server = this.#port
		server.close()
	}

	private static makeMessageFromFeedback(address: string, feedback: SomeFeedback): osc.OscMessage {
		if (feedback === null) {
			return {
				address,
				args: [
					{
						type: 'F',
						value: undefined,
					},
				],
			}
		}

		return {
			address,
			args: [
				{
					type: 'T',
					value: undefined,
				},
				{
					type: 'i',
					value: feedback.tally ?? Tally.NONE,
				},
				{
					type: 's',
					value: feedback.action?.long ?? 'UNKNOWN',
				},
				{
					type: 's',
					value: feedback.contentClass?.long ?? '',
				},
				{
					type: 's',
					value: feedback.content?.long ?? '',
				},
				{
					type: 's',
					value: feedback.userLabel?.long ?? '',
				},
			],
		}
	}

	async setFeedback(triggerId: string, feedback: SomeFeedback): Promise<void> {
		this.#feedbacks[triggerId] = feedback
		if (!this.#port) return

		for (const sender of this.#knownSenders) {
			this.#port.send(OSCServer.makeMessageFromFeedback(triggerId, feedback), sender.address, sender.port)
		}
	}

	async clearFeedbackAll(): Promise<void> {
		for (const triggerId of Object.keys(this.#feedbacks)) {
			await this.setFeedback(triggerId, null)
		}
	}

	static getOptionsManifest(): object {
		return DEVICE_OPTIONS
	}
}

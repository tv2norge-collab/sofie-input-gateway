import { Server } from 'http'
import { Logger } from '../../logger'
import { Device, TriggerEventArguments } from '../../devices/device'
import { HTTPServerOptions } from '../../generated'

import DEVICE_OPTIONS from './$schemas/options.json'

const DEFAULT_PORT = 8080

export class HTTPServer extends Device {
	private server: Server | undefined
	private config: HTTPServerOptions

	constructor(config: HTTPServerOptions, logger: Logger) {
		super(logger)
		this.config = config
	}

	async init(): Promise<void> {
		this.server = new Server((req, res) => {
			if (!req.url) {
				this.logger.error(`HTTP: Request has no URL`)
				res.end()
				return
			}

			// Example: "https://localhost:8000/my/trigger/path?param0=hey#myHash"

			try {
				this.logger.silly(
					`HTTP: ${req.method} "${req.url}" ${req.httpVersion} ${req.socket.remoteAddress}:${req.socket.remotePort}`
				)
				const triggerArguments: TriggerEventArguments = {}
				const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`) // req.headers.host can be undefined when using HTTP/1.0
				const searchParams: Record<string, any> = {}
				for (const [key, value] of url.searchParams.entries()) {
					searchParams[key] = value
				}
				triggerArguments.searchParams = JSON.stringify(searchParams) // {"param0": "hey"}
				triggerArguments.hash = url.hash // "#myHash"

				const pathname = url.pathname // "/my/trigger/path"

				const triggerId = `${req.method ?? 'GET'} ${pathname}`

				this.addTriggerEvent({ triggerId, arguments: triggerArguments })
			} catch (err) {
				this.logger.error(`HTTP: Unknown error when processing request: ${err}`)
			}

			res.end()
			return
		})
		this.server.listen(this.config.port ?? DEFAULT_PORT)
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.server) return
		const server = this.server
		return new Promise((resolve, reject) => {
			server.close((err) => {
				if (err) {
					reject(err)
					return
				}

				resolve()
			})
		})
	}

	async setFeedback(): Promise<void> {
		void ''
	}

	async clearFeedbackAll(): Promise<void> {
		void ''
	}

	static getOptionsManifest(): object {
		return DEVICE_OPTIONS
	}
}

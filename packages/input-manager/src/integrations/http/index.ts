import { Server } from 'http'
import { Logger } from '../../logger'
import { Device } from '../../devices/device'
import { DeviceConfigManifest } from '../../lib'
import { ConfigManifestEntryType } from '@sofie-automation/server-core-integration'

export interface HTTPDeviceConfig {
	port: number
}

export const DEVICE_CONFIG: DeviceConfigManifest<HTTPDeviceConfig> = [
	{
		id: 'port',
		type: ConfigManifestEntryType.INT,
		name: 'Port number',
	},
]

export class HTTPDevice extends Device {
	#server: Server | undefined
	#config: HTTPDeviceConfig

	constructor(config: HTTPDeviceConfig, logger: Logger) {
		super(logger)
		this.#config = config
	}

	async init(): Promise<void> {
		this.#server = new Server((req, res) => {
			const triggerId = `${req.method ?? 'GET'} ${req.url}`
			this.emit('trigger', {
				triggerId,
			})
			res.end()
		})
		this.#server.listen(this.#config.port)
	}

	async destroy(): Promise<void> {
		await super.destroy()
		if (!this.#server) return
		const server = this.#server
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
}

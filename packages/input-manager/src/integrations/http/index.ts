import { Server } from 'http'
import { Device } from '../../devices/device'

export class HTTPDevice extends Device {
	private server: Server | undefined

	constructor() {
		super()
	}

	async init(): Promise<void> {
		console.log('Initialized HTTP')
		this.server = new Server((req, res) => {
			const triggerId = `${req.method ?? 'GET'} ${req.url}`
			this.emit('trigger', {
				triggerId,
			})
			res.end()
		})
		this.server.listen(9090)
	}

	async destroy(): Promise<void> {
		if (!this.server) return
		this.server.close()
	}
}

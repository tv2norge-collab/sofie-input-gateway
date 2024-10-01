import { HTTPServer } from '../index'
import { IncomingMessage, ServerResponse } from 'http'
import { MockLogger } from '../../../__mocks__/logger'

type DeepPartial<T> = T extends object
	? {
			[P in keyof T]?: DeepPartial<T[P]>
	  }
	: T

let mockRequestClb: (req: DeepPartial<IncomingMessage>, res: DeepPartial<ServerResponse>) => void
let mockServerPort: number

jest.mock('http', () => ({
	Server: class Server {
		constructor(clb: (req: IncomingMessage, res: ServerResponse) => void) {
			mockRequestClb = clb as any
		}

		listen(port = 80): void {
			mockServerPort = port
		}
	},
}))

describe('HTTP Server', () => {
	it('Creates an HTTP server on initialization', async () => {
		const device = new HTTPServer(
			{
				port: 9090,
			},
			MockLogger
		)
		await device.init()

		expect(mockServerPort).toBe(9090)
	})
	it('Emits a trigger event when it receives a request', async () => {
		const device = new HTTPServer(
			{
				port: 9090,
			},
			MockLogger
		)
		const triggerHandler = jest.fn()
		device.on('trigger', triggerHandler)
		await device.init()

		const responseEnd = jest.fn()

		const method = 'POST'
		const url = '/mock/0'
		const headers = {
			'accept-encoding': 'gzip, deflate, br',
			accept: '*/*',
			'user-agent': 'Unit test',
			host: 'localhost:8000',
		}

		mockRequestClb(
			{
				method,
				url,
				headers,
				socket: {
					remoteAddress: '127.0.0.1',
					remotePort: 1234,
				},
				httpVersion: '1.0',
			},
			{
				end: responseEnd,
			}
		)

		expect(triggerHandler).toHaveBeenCalledTimes(1)
		expect(device.getNextTrigger()).toMatchObject({
			triggerId: `${method} ${url}`,
		})
		expect(device.getNextTrigger()).toBeUndefined() // No more triggers to send

		expect(responseEnd).toHaveBeenCalledTimes(1)
	})
})

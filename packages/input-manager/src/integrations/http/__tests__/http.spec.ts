import { HTTPDevice } from '../index'
import { IncomingMessage, ServerResponse } from 'http'
import { MockLogger } from '../../../__mocks__/logger'

let requestClb: (req: Partial<IncomingMessage>, res: Partial<ServerResponse>) => void
let serverPort: number

jest.mock('http', () => ({
	Server: class Server {
		constructor(clb: (req: IncomingMessage, res: ServerResponse) => void) {
			requestClb = clb as any
		}

		listen(port = 80): void {
			serverPort = port
		}
	},
}))

describe('HTTP Server', () => {
	it('Creates an HTTP server on initialization', async () => {
		const device = new HTTPDevice(
			{
				port: 9090,
			},
			MockLogger
		)
		await device.init()

		expect(serverPort).toBe(9090)
	})
	it('Emits a trigger event when it receives a request', async () => {
		const device = new HTTPDevice(
			{
				port: 9090,
			},
			MockLogger
		)
		const triggerHandler = jest.fn()
		device.on('trigger', triggerHandler)
		await device.init()

		const responseEnd = jest.fn()

		requestClb(
			{
				method: 'POST',
				url: '/mock/0',
			},
			{
				end: responseEnd,
			}
		)

		expect(triggerHandler).toBeCalledTimes(1)
		expect(triggerHandler.mock.calls[0][0]).toMatchObject({
			triggerId: 'POST /mock/0',
		})
		expect(responseEnd).toBeCalledTimes(1)
	})
})

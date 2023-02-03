import { HTTPDevice } from '../index'
import { IncomingMessage, ServerResponse } from 'http'
import { MockLogger } from '../../../__mocks__/logger'

let mockRequestClb: (req: Partial<IncomingMessage>, res: Partial<ServerResponse>) => void
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
		const device = new HTTPDevice(
			{
				port: 9090,
			},
			MockLogger
		)
		await device.init()

		expect(mockServerPort).toBe(9090)
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

		const method = 'POST'
		const url = '/mock/0'

		mockRequestClb(
			{
				method,
				url,
			},
			{
				end: responseEnd,
			}
		)

		expect(triggerHandler).toHaveBeenCalledTimes(1)
		expect(triggerHandler.mock.calls[0][0]).toMatchObject({
			triggerId: `${method} ${url}`,
		})
		expect(responseEnd).toHaveBeenCalledTimes(1)
	})
})

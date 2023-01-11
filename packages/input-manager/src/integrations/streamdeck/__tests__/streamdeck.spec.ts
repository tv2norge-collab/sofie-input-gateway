const mockBitmapFeedbackFactory = {
	init: jest.fn(),
	getBitmap: jest.fn((feedback: any, _width: number, _height: number, isDown: boolean) => {
		return (isDown ? 'isDown: true' : 'isDown: false') + JSON.stringify(feedback)
	}),
}

jest.mock('../../../feedback/bitmap/index', () => mockBitmapFeedbackFactory)

const MOCK_SERIAL = 'MOCKSERIAL'

const mockStreamDeckList = [
	{
		model: 0,
		path: 'mockPath',
		serialNumber: MOCK_SERIAL,
	},
]

let mockListeners: Record<string, (key: number) => void> = {}

const mockStreamDeck = {
	ICON_SIZE: 96,
	addListener: jest.fn((event: string, listener: (key: number) => void) => {
		mockListeners[event] = listener
	}),
	clearKey: jest.fn(),
	fillKeyBuffer: jest.fn(),
	clearPanel: jest.fn(),
	close: jest.fn(),
}

jest.mock('@elgato-stream-deck/node', () => ({
	listStreamDecks: () => {
		return mockStreamDeckList
	},
	openStreamDeck: (path: string) => {
		const device = mockStreamDeckList.find((device) => device.path === path)
		mockListeners = {}
		if (!device) {
			throw new Error('Device not found')
		}

		return mockStreamDeck
	},
}))

import { StreamDeckDevice } from '../index'
import { MockLogger } from '../../../__mocks__/logger'
import { Symbols } from '../../../lib'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'

describe('Stream Deck', () => {
	async function connectToMockStreamDeck() {
		const device = new StreamDeckDevice(
			{
				serialNumber: MOCK_SERIAL,
			},
			MockLogger
		)
		await device.init()

		return device
	}

	it('Connects to a specified Stream Deck on initialization', async () => {
		await connectToMockStreamDeck()

		expect(mockStreamDeck.addListener).toBeCalled()
		expect(mockStreamDeck.addListener).toHaveBeenCalledWith('down', expect.any(Function))
		expect(mockStreamDeck.addListener).toHaveBeenCalledWith('up', expect.any(Function))
		expect(mockStreamDeck.clearPanel).toBeCalled()
	})
	it('Emits a trigger event when it receives a button press', async () => {
		const device = await connectToMockStreamDeck()

		const triggerHandler = jest.fn()
		device.on('trigger', triggerHandler)

		mockListeners['down'](1)

		expect(triggerHandler).toBeCalledTimes(1)
		expect(triggerHandler.mock.calls[0][0]).toMatchObject({
			triggerId: `1 ${Symbols.DOWN}`,
		})

		mockListeners['up'](1)

		expect(triggerHandler).toBeCalledTimes(2)
		expect(triggerHandler.mock.calls[1][0]).toMatchObject({
			triggerId: `1 ${Symbols.UP}`,
		})
	})
	it('Changes the display on the button to match the Feedback', async () => {
		const device = await connectToMockStreamDeck()

		const feedback = {
			action: {
				long: 'Mock Action',
			},
		}

		await device.setFeedback(`1 ${Symbols.DOWN}`, feedback)

		expect(mockBitmapFeedbackFactory.getBitmap).toHaveBeenCalled()
		expect(mockBitmapFeedbackFactory.getBitmap.mock.calls[0][0]).toMatchObject(feedback)
		expect(mockBitmapFeedbackFactory.getBitmap.mock.calls[0][3]).toBe(false)

		expect(mockStreamDeck.fillKeyBuffer).toHaveBeenCalledTimes(1)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[0][0]).toBe(1)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[0][1]).toMatch(/Mock Action/)
	})
	it('Changes the display when the button is pressed', async () => {
		const device = await connectToMockStreamDeck()

		const feedback = {
			action: {
				long: 'Mock Action',
			},
		}

		const triggerHandler = jest.fn()
		device.on('trigger', triggerHandler)

		await device.setFeedback(`1 ${Symbols.DOWN}`, feedback)

		expect(mockStreamDeck.fillKeyBuffer).toHaveBeenCalledTimes(2)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[1][0]).toBe(1)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[1][1]).toMatch(/Mock Action/)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[1][1]).toMatch(/isDown: false/)

		mockListeners['down'](1)
		await sleep(2) // the streamdeck needs some time to update

		expect(mockStreamDeck.fillKeyBuffer).toHaveBeenCalledTimes(3)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[2][0]).toBe(1)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[2][1]).toMatch(/Mock Action/)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[2][1]).toMatch(/isDown: true/)

		mockListeners['up'](1)
		await sleep(2)

		expect(mockStreamDeck.fillKeyBuffer).toHaveBeenCalledTimes(4)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[3][0]).toBe(1)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[3][1]).toMatch(/Mock Action/)
		expect(mockStreamDeck.fillKeyBuffer.mock.calls[3][1]).toMatch(/isDown: false/)
	})
})

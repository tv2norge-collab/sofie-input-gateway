export const MockLogger: any = {
	data: jest.fn(),
	debug: jest.fn(),
	error: jest.fn(),
	help: jest.fn(),
	http: jest.fn(),
	info: jest.fn(),
	input: jest.fn(),
	prompt: jest.fn(),
	silly: jest.fn(),
	verbose: jest.fn(),
	warn: jest.fn(),
	child: (): typeof MockLogger => {
		return MockLogger
	},
}

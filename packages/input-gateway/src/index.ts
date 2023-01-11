import { InputManagerHandler } from './inputManagerHandler'
import { config, logPath, disableWatchdog } from './config'
import Winston from 'winston'
import process from 'process'

export interface LoggerInstance extends Winston.Logger {
	warning: never // logger.warning is not a function
}
console.log('process started') // This is a message all Sofie processes log upon startup

// Setup logging --------------------------------------
const logger = Winston.createLogger({})

if (logPath) {
	// Log json to file, human-readable to console
	logger.add(
		new Winston.transports.Console({
			level: 'verbose',
			handleExceptions: true,
		})
	)
	logger.add(
		new Winston.transports.File({
			level: 'debug',
			handleExceptions: true,
			format: Winston.format.json(),
			filename: logPath,
		})
	)
	logger.info('Logging to', logPath)
	// Hijack console.log:
	const orgConsoleLog = console.log
	console.log = function (...args: any[]) {
		// orgConsoleLog('a')
		if (args.length >= 1) {
			// @ts-expect-error one or more arguments
			logger.debug(...args)
			orgConsoleLog(...args)
		}
	}
} else {
	// Log json to console
	logger.add(
		new Winston.transports.Console({
			handleExceptions: true,
			format: Winston.format.printf((obj) => {
				obj.localTimestamp = getCurrentTime()
				obj.randomId = Math.round(Math.random() * 10000)
				return JSON.stringify(obj) // make single line
			}),
		})
	)
	logger.info('Logging to Console')
	// Hijack console.log:

	console.log = function (...args: any[]) {
		// orgConsoleLog('a')
		if (args.length >= 1) {
			// @ts-expect-error one or more arguments
			logger.debug(...args)
		}
	}
}
function getCurrentTime() {
	const v = Date.now()
	// if (c && c.coreHandler && c.coreHandler.core) {
	// 	v = c.coreHandler.core.getCurrentTime()
	// }
	return new Date(v).toISOString()
}

// Because the default NodeJS-handler sucks and wont display error properly
process.on('unhandledRejection', (reason: any, p: any) => {
	logger.error('Unhandled Promise rejection, see below')
	logger.error('reason:', reason)
	logger.error('promise:', p)
	// logger.error('c:', c)
})
process.on('warning', (e: any) => {
	logger.warn('Unhandled warning, see below')
	logger.error('error', e)
	logger.error('error.reason', e.reason || e.message)
	logger.error('error.stack', e.stack)
})

logger.info('------------------------------------------------------------------')
logger.info('Starting Input Gateway')
if (disableWatchdog) logger.info('Watchdog is disabled!')
const inputHandler = new InputManagerHandler(logger)

logger.info('Core:          ' + config.core.host + ':' + config.core.port)
logger.info('------------------------------------------------------------------')
inputHandler.init(config).catch((e) => {
	logger.error(e)
})

process.on('SIGINT', () => {
	logger.warn('Received SIGINT, shutting down...')
	inputHandler
		.destroy()
		.catch((error) => {
			logger.error(`Error when shutting down: ${error}`)
		})
		.finally(() => {
			// eslint-disable-next-line no-process-exit
			process.exit(0)
		})
})

/* eslint-disable node/no-unpublished-import, node/no-extraneous-import, no-console */

import childProcess from 'child_process'
import path from 'path'
import process from 'process'
import { promisify } from 'util'

const exec = promisify(childProcess.exec)

const expectedOutput = ['Starting Input Gateway', 'Initializing Core...']

;(async () => {
	const { stdout, stderr } = await exec(path.join(process.cwd(), './deploy/input-gateway.exe'))

	if (!expectedOutput.map((text) => stdout.includes(text)).reduce((memo, current) => memo && current, true)) {
		console.error('stdout')
		console.error(stdout)
		console.error('stderr')
		console.error(stderr)

		console.error('')
		console.error(
			JSON.stringify(
				expectedOutput.map((text) => [text, stdout.includes(text)]),
				undefined,
				2
			)
		)

		throw new Error('💣 Built executable does not seem to initialize correctly!')
	}

	console.log('🎉 Built executable seems to run fine')
})()

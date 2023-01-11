const zipAFolder = require('zip-a-folder')
const process = require('process')
const fs = require('fs/promises')

const packageName = 'input-gateway'

;(async () => {
	const packageJson = await fs.readFile('./packages/input-gateway/package.json')
	const package = JSON.parse(packageJson)
	const version = package.version

	const zipFileName = `${packageName}-v${version}.zip`

	const err = await zipAFolder.zip('./deploy', `./${zipFileName}`)
	if (err) {
		throw new Error(err)
	}

	await fs.rename(`./${zipFileName}`, `./deploy/${zipFileName}`)
})().catch((err) => {
	console.error(err)
	process.exit(1)
})

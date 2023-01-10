const promisify = require('util').promisify
const fs = require('fs/promises')
const glob = promisify(require('glob'))
const path = require('path')

const assetsSource = './packages/input-gateway/assets/**/*'
const target = './deploy/assets'

;(async function () {
	const assets = await glob(assetsSource)
	await fs.mkdir(target)
	for (const asset of assets) {
		await fs.copyFile(asset, path.join(target, path.basename(asset)))
	}
})()
	.then(() => {
		process.exit(0)
	})
	.catch((e) => {
		console.error(e)
		process.exit(1)
	})

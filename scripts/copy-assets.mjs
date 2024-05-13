// @ts-check
import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'

const assetsSource = './packages/input-gateway/assets/**/*'
const target = './deploy/assets'

try {
	const assets = await glob(assetsSource)
	await fs.mkdir(target)
	for (const asset of assets) {
		await fs.copyFile(asset, path.join(target, path.basename(asset)))
	}

	process.exit(0)
} catch (e) {
	console.error(e)
	process.exit(1)
}

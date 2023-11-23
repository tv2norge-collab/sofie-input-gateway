import { Canvas, FontLibrary } from 'skia-canvas'
import { SomeFeedback } from '../feedback'
import { rendererFactory } from './typeRenderers/factory'
import path from 'path'
import fs from 'fs/promises'
import { constants as fsConstants } from 'fs'
import process from 'process'

async function makeBitmapFromFeedback(
	feedback: SomeFeedback,
	width: number,
	height: number,
	isPressed: boolean
): Promise<Buffer> {
	const canvas = new Canvas(width, height)
	const ctx = canvas.getContext('2d')

	ctx.fillStyle = 'black'
	ctx.fillRect(0, 0, width, height)

	if (isPressed) {
		ctx.translate(width * 0.05, height * 0.05)
		ctx.scale(0.9, 0.9)
	}

	const scaleFactor = height / 72

	if (feedback !== null) {
		const renderer = rendererFactory(feedback, ctx, width, height, scaleFactor)
		renderer.render(feedback)
	}

	return Buffer.from(
		ctx.getImageData(0, 0, width, height, {
			colorSpace: 'srgb',
		}).data
	)
}

export async function getBitmap(
	feedback: SomeFeedback,
	width: number,
	height: number,
	isPressed?: boolean
): Promise<Buffer> {
	const bitmap = await makeBitmapFromFeedback(feedback, width, height, isPressed ?? false)
	return bitmap
}

export async function init(): Promise<void> {
	// Create a canvas, just to boot up Skia, load the fonts, etc.
	const canvas = new Canvas()
	const ctx = canvas.getContext('2d')

	const fonts = ['roboto-condensed-regular.ttf', 'roboto-condensed-700.ttf']

	const searchPaths = [
		path.join(path.dirname(process.execPath), './assets'),
		path.join(process.cwd(), './assets'),
		process.cwd(),
	]

	const foundFiles = await findFiles(fonts, searchPaths)

	FontLibrary.use('RobotoCnd', foundFiles)

	void canvas, ctx
}

async function findFiles(files: string[], paths: string[]): Promise<string[]> {
	const result: string[] = []
	for (const file of files) {
		for (const pathOption of paths) {
			try {
				const pathToTest = path.join(pathOption, file)
				await fs.access(pathToTest, fsConstants.O_RDONLY)
				// File exists, we can add it to result
				result.push(pathToTest)
				break
			} catch (e) {
				// Doesn't exist or can't read
			}
		}
	}

	return result
}

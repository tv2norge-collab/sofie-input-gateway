import { Canvas, FontLibrary } from 'skia-canvas'
import { SomeFeedback } from '../feedback'
import { rendererFactory } from './typeRenderers/factory'

async function makeBitmapFromFeedback(feedback: SomeFeedback, width: number, height: number): Promise<Buffer> {
	const canvas = new Canvas(width, height)
	const ctx = canvas.getContext('2d')

	ctx.fillStyle = 'black'
	ctx.fillRect(0, 0, width, height)

	if (feedback !== null) {
		const renderer = rendererFactory(feedback, ctx, width, height)
		renderer.render(feedback)
	}

	return Buffer.from(
		ctx.getImageData(0, 0, width, height, {
			colorSpace: 'srgb',
		}).data
	)
}

export async function getBitmap(feedback: SomeFeedback, width: number, height: number): Promise<Buffer> {
	const bitmap = await makeBitmapFromFeedback(feedback, width, height)
	return bitmap
}

export async function init(): Promise<void> {
	// Create a canvas, just to boot up Skia, load the fonts, etc.
	const canvas = new Canvas()
	const ctx = canvas.getContext('2d')

	FontLibrary.use('RobotoCnd', ['./assets/roboto-condensed-regular.ttf', './assets/roboto-condensed-700.ttf'])

	void canvas, ctx
}

import { Canvas } from 'skia-canvas'
import { Feedback } from './feedback'

const MARGIN_X = 5
const MARGIN_Y = 5
const FONT_SIZE = 14

async function makeBitmapFromFeedback(feedback: Feedback, width: number, height: number): Promise<Buffer> {
	const canvas = new Canvas(width, height)
	const ctx = canvas.getContext('2d')
	ctx.imageSmoothingEnabled = false
	ctx.imageSmoothingQuality = 'low' as const
	ctx.textWrap = true
	ctx.fillStyle = '#000'
	ctx.fillRect(0, 0, width, height)
	ctx.fillStyle = '#fff'
	ctx.font = `${FONT_SIZE}px "Roboto Condensed", Tahoma, Verdana, Arial`
	// const metrics = ctx.measureText(feedback.content?.long ?? feedback.action?.long ?? 'unknown', width)
	// console.log(`Text will be ${metrics.width}`)
	// const lastLineHeight = metrics.lines[metrics.lines.length - 1].height
	// ctx.fillStyle = 'green'
	// ctx.fillRect(0, 0, metrics.width, lastLineHeight)
	ctx.fillStyle = '#fff'
	ctx.fillText(
		feedback.content?.long ?? feedback.action?.long ?? '',
		MARGIN_X,
		MARGIN_Y + (height - MARGIN_Y * 2 + FONT_SIZE / 2) / 2,
		width - MARGIN_X * 2
	)

	return Buffer.from(
		ctx.getImageData(0, 0, width, height, {
			colorSpace: 'srgb',
		}).data
	)
}

export async function getBitmap(feedback: Feedback, width: number, height: number): Promise<Buffer> {
	const bitmap = await makeBitmapFromFeedback(feedback, width, height)
	return bitmap
}

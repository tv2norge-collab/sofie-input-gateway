import { Canvas } from 'skia-canvas'
import { ClassNames, SomeFeedback } from '../feedback'
import { TextContext } from './TextContext'

async function makeBitmapFromFeedback(feedback: SomeFeedback, width: number, height: number): Promise<Buffer> {
	const canvas = new Canvas(width, height)
	const ctx = canvas.getContext('2d')

	ctx.fillStyle = 'black'
	ctx.fillRect(0, 0, width, height)

	if (feedback !== null) {
		const text = new TextContext(ctx, width, height)
		text.setPadding(2, 5, 0)
		if (feedback.content) {
			text.p({ children: feedback?.action?.long ?? 'unknown', align: 'center', lineClamp: 1 })
			text.hr({})
			text.p({
				children: feedback?.content?.long ?? 'unknown',
				align: 'center',
				spring: true,
				background: 'red',
			})
		} else {
			if (!feedback.classNames?.includes(ClassNames.AD_LIB)) {
				text.p({
					children: feedback?.action?.long ?? 'unknown',
					align: 'center',
					fontSize: '20px',
					spring: true,
					background: 'green',
				})
			}
		}
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
	void canvas, ctx
}

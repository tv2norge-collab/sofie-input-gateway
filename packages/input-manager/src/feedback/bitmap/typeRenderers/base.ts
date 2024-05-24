import { CanvasRenderingContext2D, Image } from 'skia-canvas'
import { Feedback } from '../../feedback'
import { TextContext } from '../lib/TextContext'

export abstract class BaseRenderer {
	protected text: TextContext
	protected baseFontSize = 14

	constructor(
		protected ctx: CanvasRenderingContext2D,
		protected width: number,
		protected height: number,
		protected scaleFactor: number
	) {
		this.text = new TextContext(ctx, width, height)
	}

	protected percentToPixels(fontSize: number): string {
		return `${Math.floor(fontSize * this.baseFontSize * this.scaleFactor)}px`
	}

	abstract render(feedback: Feedback): void

	protected drawBackgroundImage(backgroundImage: string): void {
		const myImage = new Image()
		myImage.src = backgroundImage
		this.ctx.drawImage(myImage, 0, 0, this.width, this.height)
	}
}

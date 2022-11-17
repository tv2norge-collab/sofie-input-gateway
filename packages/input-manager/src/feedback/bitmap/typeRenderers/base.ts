import { CanvasRenderingContext2D } from 'skia-canvas'
import { Feedback } from '../../feedback'
import { TextContext } from '../lib/TextContext'

export abstract class BaseRenderer {
	protected text: TextContext

	constructor(protected ctx: CanvasRenderingContext2D, protected width: number, protected height: number) {
		this.text = new TextContext(ctx, width, height)
	}

	abstract render(feedback: Feedback): void
}

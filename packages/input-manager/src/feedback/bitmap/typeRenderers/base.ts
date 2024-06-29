import { CanvasRenderingContext2D } from 'skia-canvas'
import { BitmapStyleProps, Feedback } from '../../feedback'
import { TextContext } from '../lib/TextContext'
import { GlobalImageCache } from '../lib/ImageCache'

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

	private getLineClamp(inputValue: number | undefined): number | undefined {
		if (inputValue === undefined || inputValue <= 0) return 4
		if (inputValue < 1) return 1
		return inputValue
	}

	protected renderStyled(label: string, style: BitmapStyleProps): void {
		if (style.backgroundImage) {
			this.drawBackgroundImage(style.backgroundImage)
		}

		if (style.displayLabel !== true) return

		const positionAndAlignment = style.textPosition?.split(' ')

		const text = this.text

		if (style.textTransform === 'uppercase') {
			label = label.toUpperCase()
		} else if (style.textTransform === 'lowercase') {
			label = label.toLowerCase()
		} else if (style.textTransform === 'capitalize') {
			label = label.toLowerCase().replace(/\w{3,}/g, (match) => match.replace(/\w/, (m) => m.toUpperCase()))
		}

		if (style.margin) {
			text.setMargin(style.margin)
		}

		if (style.padding) {
			text.setPadding(style.padding)
		}

		text.p({
			children: label,
			align: (positionAndAlignment?.[0] ?? 'center') as CanvasTextAlign,
			vAlign: (positionAndAlignment?.[1] ?? 'center') as 'top' | 'center' | 'bottom',
			fontSize: this.percentToPixels(style.fontSize ?? 1),
			fontWeight: style.fontWeight || undefined,
			fontWidth: style.fontWidth || undefined,
			fontStyle: style.fontStyle || undefined,
			textStrokeColor: style.textStrokeColor || undefined,
			color: style.color || undefined,
			inlineBackground: style.inlineBackground,
			inlineBackgroundPadding: style.inlineBackgroundPadding,
			textShadowColor: style.textShadowColor,
			textShadowOffset: style.textShadowOffset,
			spring: true,
			background: !style.backgroundImage ? style.background ?? '#000' : undefined,
			lineClamp: this.getLineClamp(style.lineClamp),
		})
	}

	protected drawBackgroundImage(backgroundImage: string): void {
		const image = GlobalImageCache.get(backgroundImage)
		this.ctx.drawImage(image, 0, 0, this.width, this.height)
	}
}

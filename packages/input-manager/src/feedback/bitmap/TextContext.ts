import { CanvasRenderingContext2D } from 'skia-canvas'

enum TRBLPositions {
	TOP = 0,
	RIGHT = 1,
	BOTTOM = 2,
	LEFT = 3,
}

export class TextContext {
	#ctx: CanvasRenderingContext2D
	#blockPosition = 0
	#inlinePosition = 0
	#margin: [number, number, number, number] = [0, 0, 0, 0]
	#padding: [number, number, number, number] = [0, 0, 0, 0]
	#fontFamily = 'Tahoma, Verdana, Arial, "Noto Sans", "DejaVu Sans"'
	#fontSize = 14
	#color = '#fff'
	#width = 0
	#height = 0

	constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
		this.#ctx = ctx
		this.#width = width
		this.#height = height
		void this.#height
	}

	private static populateTRBL(
		number0: number,
		number1?: number,
		number2?: number,
		number3?: number
	): [number, number, number, number] {
		let right,
			bottom,
			left = 0

		const top = number0
		right = number0
		left = number0
		bottom = number0
		if (number1 !== undefined) {
			left = number1
			right = number1
		}
		if (number2 !== undefined) {
			bottom = number2
		}
		if (number3 !== undefined) left = number3

		return [top, right, bottom, left]
	}

	setMargin(margin: number): void
	setMargin(marginBlock: number, marginInline: number): void
	setMargin(marginTop: number, marginInline: number, marginBottom: number): void
	setMargin(marginTop: number, marginRight: number, marginBottom: number, marginLeft: number): void
	setMargin(margin0: number, margin1?: number, margin2?: number, margin3?: number): void {
		this.#margin = TextContext.populateTRBL(margin0, margin1, margin2, margin3)
	}

	setPadding(padding: number): void
	setPadding(paddingBlock: number, paddingInline: number): void
	setPadding(paddingTop: number, paddingInline: number, paddingBottom: number): void
	setPadding(paddingTop: number, paddingRight: number, paddingBottom: number, paddingLeft: number): void
	setPadding(padding0: number, padding1?: number, padding2?: number, padding3?: number): void {
		this.#padding = TextContext.populateTRBL(padding0, padding1, padding2, padding3)
	}

	p({
		children,
		align,
		color,
		background,
		fontSize,
		lineClamp,
		spring,
	}: {
		children?: string
		align?: CanvasTextAlign
		color?: string
		background?: string
		fontSize?: number
		lineClamp?: number
		spring?: boolean
	}): void {
		const ctx = this.#ctx
		const maxWidth =
			this.#width -
			this.#margin[TRBLPositions.LEFT] -
			this.#margin[TRBLPositions.RIGHT] -
			this.#padding[TRBLPositions.LEFT] -
			this.#padding[TRBLPositions.RIGHT]
		align = align ?? 'left'
		color = color ?? this.#color ?? '#fff'
		ctx.textAlign = align
		ctx.font = `${fontSize ?? this.#fontSize}px ${this.#fontFamily}`
		ctx.fillStyle = color ?? this.#color
		ctx.textBaseline = 'top'
		ctx.textWrap = true

		this.#inlinePosition = 0

		const blockBegin = this.#blockPosition
		const inlineBegin = this.#inlinePosition

		let nonNullishChildren = children || '\0x200D'

		const metrics = ctx.measureText(nonNullishChildren, maxWidth)

		let linesCount = metrics.lines.length
		let clampedLines = metrics.lines

		if (lineClamp !== undefined) {
			if (metrics.lines.length > lineClamp) {
				linesCount = lineClamp
				clampedLines = metrics.lines.slice(0, linesCount)
				const endOfLastLine = clampedLines[clampedLines.length - 1].endIndex
				nonNullishChildren = nonNullishChildren.substring(0, endOfLastLine)
			}
		}

		const textHeight = clampedLines.slice(0, linesCount).reduce((memo, line) => memo + line.height, 0)

		let x = this.#inlinePosition + this.#margin[TRBLPositions.LEFT] + this.#padding[TRBLPositions.LEFT]

		if (align === 'center') {
			x = x + this.#inlinePosition + maxWidth / 2
		} else if (align === 'right') {
			x = this.#width - this.#margin[TRBLPositions.RIGHT] - this.#padding[TRBLPositions.RIGHT]
		}

		let y = this.#blockPosition + this.#padding[TRBLPositions.TOP]
		if (spring) {
			y =
				y +
				Math.max(
					0,
					(this.#height - y - this.#padding[TRBLPositions.BOTTOM] - this.#margin[TRBLPositions.BOTTOM] - textHeight) / 2
				)
		}

		this.#blockPosition = y + textHeight + this.#padding[TRBLPositions.BOTTOM]

		let blockEnd = this.#blockPosition
		if (spring) {
			blockEnd = this.#height - this.#margin[TRBLPositions.BOTTOM]
		}

		const inlineEnd = this.#width - this.#margin[TRBLPositions.RIGHT]

		if (background) {
			ctx.fillStyle = background
			ctx.fillRect(inlineBegin, blockBegin, inlineEnd - inlineBegin, blockEnd - blockBegin)
		}

		ctx.fillStyle = color
		ctx.fillText(nonNullishChildren, x, y, maxWidth)

		if (align === 'left') {
			this.#inlinePosition = clampedLines[clampedLines.length - 1].width
		} else {
			this.#inlinePosition = 0
		}
	}

	hr({ color }: { color?: string }): void {
		const ctx = this.#ctx
		const height = 1

		ctx.strokeStyle = color ?? this.#color
		ctx.lineWidth = height

		this.#inlinePosition = 0

		const x = this.#inlinePosition + this.#margin[TRBLPositions.LEFT]
		const y = this.#blockPosition
		const width = this.#width - this.#margin[TRBLPositions.RIGHT]

		ctx.beginPath()
		ctx.moveTo(x, y)
		ctx.lineTo(x + width, y)
		ctx.stroke()

		this.#inlinePosition = x + width
		this.#blockPosition = this.#blockPosition + height
	}
}

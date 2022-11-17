import { CanvasGradient, CanvasRenderingContext2D } from 'skia-canvas'

const LINEAR_GRADIENT = /linear-gradient\(([\w\d\s,()#%.]+)\)/
const LINEAR_GRADIENT_DIRECTION = /^(to top|to bottom|to left|to right)\s*,?\s*/
const LINEAR_GRADIENT_STEP = /([\w\d#]+)(?:\s+([\d.]+%?))?\s*,?\s*/

function parsePercentageExpression(exp: string): number {
	if (exp.endsWith('%')) {
		return Number.parseFloat(exp) / 100
	}
	return Number.parseFloat(exp)
}

export function createFill(
	ctx: CanvasRenderingContext2D,
	fill: string,
	x: number,
	y: number,
	width: number,
	height: number
): string | CanvasGradient {
	fill = fill.trim()
	const gradientMatch = fill.match(LINEAR_GRADIENT)
	if (gradientMatch) {
		// default direction is "to right"
		let x0 = x
		let y0 = y + height / 2
		let x1 = x + width
		let y1 = y0

		const inside = gradientMatch[1]

		const directionRegExp = new RegExp(LINEAR_GRADIENT_DIRECTION)
		const directionMatch = directionRegExp.exec(inside)
		let stepsBegin = 0

		if (directionMatch) {
			switch (directionMatch[1]) {
				case 'to bottom':
					x0 = x + width / 2
					y0 = y
					x1 = x0
					y1 = y + height
					break
				case 'to left':
					x0 = x + width
					y0 = y + height / 2
					x1 = x
					y1 = y0
					break
				case 'to top':
					x0 = x + width / 2
					y0 = y + height
					x1 = x0
					y1 = y
					break
			}
			stepsBegin = directionMatch[1].length
		}

		const stepsRegExp = new RegExp(LINEAR_GRADIENT_STEP, 'g')
		stepsRegExp.lastIndex = stepsBegin

		const steps = []
		let nextMatch
		do {
			nextMatch = stepsRegExp.exec(inside)
			if (!nextMatch) continue

			steps.push({
				color: nextMatch[1],
				stop: nextMatch[2] !== undefined ? parsePercentageExpression(nextMatch[2]) : undefined,
			})
		} while (nextMatch)

		const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
		let currentStop = 0

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i]
			currentStop = step.stop ?? currentStop
			gradient.addColorStop(currentStop, step.color)
			// this is the penultimate step of the gradient
			if (i >= steps.length - 2) {
				currentStop = 1
			} else {
				currentStop = currentStop + (1 - currentStop) / 2
			}
		}

		return gradient
	}
	return fill
}

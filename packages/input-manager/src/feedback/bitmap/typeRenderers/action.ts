import { BitmapFeedback } from '../../feedback'
import { BaseRenderer } from './base'

export class ActionRenderer extends BaseRenderer {
	render(feedback: BitmapFeedback): void {
		if (feedback.backgroundImage) {
			this.drawBackgroundImage(feedback.backgroundImage)
		}

		if (!feedback.hideText) {
			const text = this.text
			const label = feedback?.userLabel?.long ?? feedback?.action?.long
			text.p({
				children: label ?? 'unknown',
				align: 'center',
				fontSize: this.percentToPixels(1.5),
				spring: true,
				background: !feedback.backgroundImage ? 'linear-gradient(to bottom, #333, #000)' : undefined,
				lineClamp: 4,
			})
		}
	}
}

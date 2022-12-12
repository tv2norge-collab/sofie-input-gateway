import { Feedback } from '../../feedback'
import { BaseRenderer } from './base'

export class ActionRenderer extends BaseRenderer {
	render(feedback: Feedback): void {
		const text = this.text
		const label = feedback?.userLabel?.long ?? feedback?.action?.long
		text.p({
			children: label ?? 'unknown',
			align: 'center',
			fontSize: this.percentToPixels(1.5),
			spring: true,
			background: 'linear-gradient(to bottom, #333, #000)',
			lineClamp: 4,
		})
	}
}

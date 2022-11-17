import { Feedback } from '../../feedback'
import { BaseRenderer } from './base'

export class ActionRenderer extends BaseRenderer {
	render(feedback: Feedback): void {
		const text = this.text
		const label = feedback?.userLabel?.long ?? feedback?.action?.long
		text.p({
			children: label ?? 'unknown',
			align: 'center',
			fontSize: '20px',
			spring: true,
			background: 'linear-gradient(to bottom, #333, #000)',
			lineClamp: 4,
		})
	}
}

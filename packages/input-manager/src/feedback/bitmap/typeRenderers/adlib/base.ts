import { ClassNames, BitmapFeedback, Tally } from '../../../feedback'
import { BaseRenderer } from '../base'

/**

$segment-layer-border-unknown: darken(#4b4b4b, 10%);
$segment-layer-background-unknown: #4b4b4b;
$segment-layer-background-camera: #18791c;
$segment-layer-background-camera--second: darken($segment-layer-background-camera, 10%);
$segment-layer-background-lower-third: #ed7200;
$segment-layer-background-lower-third--second: darken($segment-layer-background-lower-third, 10%);
$segment-layer-background-graphics: #dc5c00;
$segment-layer-background-graphics--second: darken($segment-layer-background-graphics, 10%);
$segment-layer-border-live-speak: #2f74ff;
$segment-layer-background-live-speak-1: #2f74ff;
$segment-layer-background-live-speak-2: #39762b;
$segment-layer-background-live-speak: linear-gradient(
	to bottom,
	$segment-layer-background-live-speak-1 50%,
	$segment-layer-background-live-speak-2 50%
);
$segment-layer-background-live-speak--second-1: darken(#2f74ff, 10%);
$segment-layer-background-live-speak--second-2: darken(#39762b, 10%);
$segment-layer-background-live-speak--second: linear-gradient(
	to bottom,
	$segment-layer-background-live-speak--second-1 50%,
	$segment-layer-background-live-speak--second-2 50%
);
$segment-layer-background-remote: #e80064;
$segment-layer-background-remote--second: darken($segment-layer-background-remote, 10%);
$segment-layer-background-vt: #0a20ed;
$segment-layer-background-vt--second: darken($segment-layer-background-vt, 10%);
$segment-layer-background-script: #003600;
$segment-layer-background-mic: #1e6820;
$segment-layer-background-guest: #008a92;
$segment-layer-background-local: #9a2bd8;
$segment-layer-background-local--second: darken($segment-layer-background-local, 10%);

$segment-item-disabled-background: #898989;
$segment-item-disabled-color: #c9c9c9;


 */

const COLORS: Record<string, string> = {
	[ClassNames.CAMERA]: '#18791c',
	[ClassNames.GRAPHICS]: '#dc5c00',
	[ClassNames.LIVE_SPEAK]: 'linear-gradient(to bottom, #2f74ff 50%, #39762b 50%)',
	[ClassNames.LOCAL]: '#9a2bd8',
	[ClassNames.LOWER_THIRD]: '#ed7200',
	[ClassNames.REMOTE]: '#e80064',
	[ClassNames.SCRIPT]: '#003600',
	[ClassNames.VT]: '#0a20ed',
	[ClassNames.UNKNOWN]: '#4b4b4b',
}

const TALLY_COLORS: Record<string, string> = {
	[Tally.CURRENT]: '#ff0000',
	[Tally.NEXT]: '#00ff00',
}

export class BaseAdLibRenderer extends BaseRenderer {
	private getAdLibColor(classNames: string[] | undefined): string {
		if (classNames === undefined) return COLORS[ClassNames.UNKNOWN]
		const className = classNames.find((className) => Object.keys(COLORS).includes(className)) as ClassNames | undefined
		if (className) return COLORS[className]
		return COLORS[ClassNames.UNKNOWN]
	}

	private getTallyColor(tally: Tally | undefined): string | undefined {
		if (tally === undefined) return undefined
		if (Tally.CURRENT & tally) return TALLY_COLORS[Tally.CURRENT]
		if (Tally.NEXT & tally) return TALLY_COLORS[Tally.NEXT]
		return undefined
	}

	private getFontSize(label: string): number {
		if (label.length <= 3) {
			return 2.5
		}
		if (label.length < 5) {
			return 1.5
		}
		return 1
	}

	render(feedback: BitmapFeedback): void {
		if (!feedback?.content) return

		const label = feedback?.userLabel?.long ?? feedback?.content?.long ?? ''

		if (feedback.style) return this.renderStyled(label, feedback.style)

		const text = this.text
		text.p({
			children: label,
			align: 'center',
			spring: true,
			fontSize: this.percentToPixels(this.getFontSize(label)),
			lineHeight: this.percentToPixels(this.getFontSize(label)),
			background: this.getTallyColor(feedback.tally) ?? this.getAdLibColor(feedback.classNames),
			textShadowOffset: 1,
			lineClamp: 4,
		})
	}
}

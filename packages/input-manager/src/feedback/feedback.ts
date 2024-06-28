export interface Label {
	/** Optional, short representation of the label, up to 10 chars */
	short?: string
	/** Label for this trigger feedback */
	long: string
}

export enum Tally {
	/** Represented object currently On Air (on Program row, visible, etc.) */
	CURRENT = 0b10000,
	/** Represented object currently in Next (on Preview row, cued up, etc.) */
	NEXT = 0b1000,
	/** An alternative, custom state (ISO recording, etc.) */
	OTHER = 0b100,
	/** Object is available */
	PRESENT = 0b10,
	/** No tally */
	NONE = 0b0,
}

export enum ClassNames {
	AD_LIB = 'adLib',
	TAKE = 'take',
	MOVE_NEXT = 'move_next',

	UNKNOWN = 'unknown',
	/** Local camera sources (local to the studio, not requiring additional coordination) */
	CAMERA = 'camera',
	/** Video clips */
	VT = 'vt',
	/** Remote cameras & pre-produced sources */
	REMOTE = 'remote',
	/** Script and comments for the prompter */
	SCRIPT = 'script',
	/** Fullscreen graphics */
	GRAPHICS = 'graphics',
	/** Sources composed out of other sources, such as DVEs, "SuperSource", Additional M/Es, etc. */
	SPLITS = 'splits',
	/** Audio-only sources */
	AUDIO = 'audio',
	/** Graphical overlays on top of other video */
	LOWER_THIRD = 'lowerThird',
	/** Video-only clips or clips with only environment audio */
	LIVE_SPEAK = 'liveSpeak',
	/** Transition effects, content object can use VTContent or TransitionContent */
	TRANSITION = 'tranisiton',
	LIGHTS = 'lights',
	/** Uncontrolled local sources, such as PowerPoint presentation inputs, Weather systems, EVS replay machines, etc. */
	LOCAL = 'local',
}

export interface Feedback {
	/** The user-defined label for the Action assigned to this Feedback area */
	userLabel?: Label
	/** The label for this Action */
	action?: Label
	/** The label for the content attached to this Action */
	content?: Label
	/** The label for the type of content attached to this Action */
	contentClass?: Label
	/** The tally state bitmap */
	tally?: Tally
	/** Various classes attached to this Action - including the ones defined in `ClassNames` */
	classNames?: string[]
	/** List of class names to use when drawing the button */
	styleClassNames?: string[]
}

export type SomeFeedback = Feedback | null

export interface BitmapStyleProps {
	backgroundImage?: string
	background?: string
	fontSize?: number
	fontWeight?: 'bold' | 'normal'
	fontWidth?: 'narrow' | 'normal'
	fontStyle?: 'italic' | 'normal'
	color?: string
	textStrokeColor?: string
	textShadowColor?: string
	textShadowOffset?: number
	textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
	textPosition?:
		| 'left center'
		| 'center center'
		| 'right center'
		| 'left top'
		| 'center top'
		| 'right top'
		| 'left bottom'
		| 'center bottom'
		| 'right bottom'
	inlineBackground?: string
	displayLabel?: boolean
}

export interface BitmapFeedback extends Feedback {
	style?: BitmapStyleProps
}
export type SomeBitmapFeedback = BitmapFeedback | null

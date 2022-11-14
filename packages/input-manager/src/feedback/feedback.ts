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
	/** The label for the action assigned to this Feedback area */
	action?: Label
	content?: Label
	duration?: string
	tally?: Tally
	classNames?: string[]
	thumbnail?: string
}

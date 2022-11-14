export interface DeviceTriggerMountedAction {
	_id: string
	studioId: string
	showStyleBaseId: string
	deviceId: string
	deviceTriggerId: string
	values: Record<string, string | number | boolean>
	actionId: string
	actionType: string
	name?: string | ITranslatableMessage
}

export type PreviewWrappedAdLib = {
	_id: string
	_rank: number
	partId: string | null
	type: string
	label: string | ITranslatableMessage
	sourceLayerId: string
	outputLayerId: undefined
	expectedDuration: undefined
	item: any

	studioId: string
	showStyleBaseId: string
	triggeredActionId: string
	actionId: string
	sourceLayerType?: SourceLayerType
	isCurrent?: boolean
	isNext?: boolean
}

interface ITranslatableMessage {
	key: string
	args: Record<string, string>
}

export enum SourceLayerType {
	UNKNOWN = 0,
	/** Local camera sources (local to the studio, not requiring additional coordination) */
	CAMERA = 1,
	/** Video clips */
	VT = 2,
	/** Remote cameras & pre-produced sources */
	REMOTE = 3,
	/** Script and comments for the prompter */
	SCRIPT = 4,
	/** Fullscreen graphics */
	GRAPHICS = 5,
	/** Sources composed out of other sources, such as DVEs, "SuperSource", Additional M/Es, etc. */
	SPLITS = 6,
	/** Audio-only sources */
	AUDIO = 7,
	/** Graphical overlays on top of other video */
	LOWER_THIRD = 10,
	/** Video-only clips or clips with only environment audio */
	LIVE_SPEAK = 11,
	/** Transition effects, content object can use VTContent or TransitionContent */
	TRANSITION = 13,
	/** Light effects and controls */
	LIGHTS = 14,
	/** Uncontrolled local sources, such as PowerPoint presentation inputs, Weather systems, EVS replay machines, etc. */
	LOCAL = 15,
}

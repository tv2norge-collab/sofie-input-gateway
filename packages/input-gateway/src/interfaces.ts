export type DeviceSettings = Record<string, never>

type ValueTypes = string | number | boolean

export interface UserInputEvent {
	deviceId: string
	triggerId: string
	values: Record<string, ValueTypes>
}

export enum DeviceType {
	Mouse,
	Controller,
}

export enum ValueType {
	Toggle = 'toggle',
	Range = 'range', // 0 to 1
	Delta = 'delta', // positive or minus
	String = 'string',
	Number = 'number',
}

export interface UserInputDeviceManifest {
	deviceType: DeviceType
	inputInstances: Array<UserInputInstanceManifest>
}

export interface UserInputInstanceManifest {
	identifier: string
	arguments: {
		[path: string]: ValueType
	}
}

export enum ActionItemType {
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
	// CAMERA_MOVEMENT = 8,
	// TODOSYNC: What is this intended to be used for? Why isnt UNKNOWN used instead?
	METADATA = 'metadata',
	/** Graphical overlays on top of other video */
	LOWER_THIRD = 'lower_third',
	/** Video-only clips or clips with only environment audio */
	LIVE_SPEAK = 'live_speak',
	/** Transition effects, content object can use VTContent or TransitionContent */
	TRANSITION = 'transition',
	// LIGHTS = 14,
	/** Uncontrolled local sources, such as PowerPoint presentation inputs, Weather systems, EVS replay machines, etc. */
	LOCAL = 'local',
	// same as SourceLayerTypes + other actions
	ACTION_TAKE = 'action_take',
}

export interface ActionItem {
	label: string
	shortLabel?: string
	multiLineLabel?: string[]
	thumbnail?: string
	type: ActionItemType
}

export interface FeedbackInstance {
	actionItems: ActionItem[]
}

export const mouseExample: UserInputDeviceManifest = {
	deviceType: DeviceType.Mouse,
	inputInstances: [
		{
			identifier: 'verticalScroll',
			arguments: {
				delta: ValueType.Delta,
			},
		},
		{
			identifier: 'horizontalScroll',
			arguments: {
				delta: ValueType.Delta,
			},
		},
		{
			identifier: 'mouseMove',
			arguments: {
				x: ValueType.Delta,
				y: ValueType.Delta,
			},
		},
		{
			identifier: 'leftClick',
			arguments: {},
		},
		{
			identifier: 'middleClick',
			arguments: {},
		},
		{
			identifier: 'rightClick',
			arguments: {},
		},
	],
}

// export const xboxExample: UserInputEventManifest = {
// 	deviceType: DeviceType.Controller,
// 	inputs: {
// 		joysticks: {
// 			left: {
// 				x: ValueType.Range,
// 				y: ValueType.Range
// 			},
// 			right: {
// 				x: ValueType.Range,
// 				y: ValueType.Range
// 			}
// 		},
// 		triggers: {
// 			left: ValueType.Range,
// 			right: ValueType.Range
// 		},
// 		buttons: {
// 			dpad: {
// 				up: ValueType.Boolean,
// 				down: ValueType.Boolean,
// 				left: ValueType.Boolean,
// 				right: ValueType.Boolean,
// 			},
// 			a: ValueType.Boolean,
// 			b: ValueType.Boolean,
// 			x: ValueType.Boolean,
// 			y: ValueType.Boolean
// 		}
// 	}
// }

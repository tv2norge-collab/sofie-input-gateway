export type DeviceSettings = Record<string, never>

export interface UserInputEvent {
	deviceId: string
	triggerId: string
	values: { [arg: string]: any } // something like joysticks.left.x: 0.5, joysticks.left.y: 1
}

export enum DeviceType {
	Mouse,
	Controller,
}

export enum ValueType {
	Trigger = 'trigger',
	Toggle = 'toggle',
	Range = 'range', // 0 to 1
	Delta = 'delta', // positive or minus
	String = 'string',
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
	VT = 'vt',
	LIVE_SPEAK = 'liveSpeak',
	REMOTE = 'remote',
	LOCAL = 'local',
	// same as SourceLayerTypes +
	TAKE = 'take',
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

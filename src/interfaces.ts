export interface DeviceSettings {

}

export interface UserInputEvent {
	deviceId: string,
	deviceType: DeviceType,
	values: { [input: string]: number | boolean }, // something like joysticks.left.x: 0.5, joysticks.left.y: 1
}

export interface DeviceHandler {
	handleFeedback: (instance: FeedbackInstance) => boolean
}

export enum DeviceType {
	Mouse,
	Controller
}

export enum ValueType {
	Boolean,
	Range, // 0 to 1
	Delta // positive or minus
}


export interface UserInputDeviceManifest {
	deviceType: DeviceType
	inputInstances: Array<UserInputInstanceManifest>
}

export interface UserInputInstanceManifest {
	identifier: string,
	arguments: {
		[path: string]: ValueType
	}
}

export enum FeedbackType {
	State,
	Colour,
	Text
}

export interface FeedbackInstance {
	type: FeedbackType,
	values: any
}

export const mouseExample: UserInputDeviceManifest = {
	deviceType: DeviceType.Mouse,
	inputInstances: [
		{
			identifier: 'verticalScroll',
			arguments: {
				delta: ValueType.Delta
			}
		},
		{
			identifier: 'horizontalScroll',
			arguments: {
				delta: ValueType.Delta
			}
		},
		{
			identifier: 'mouseMove',
			arguments: {
				x: ValueType.Delta,
				y: ValueType.Delta
			}
		},
		{
			identifier: 'leftClick',
			arguments: {}
		},
		{
			identifier: 'middleClick',
			arguments: {}
		},
		{
			identifier: 'rightClick',
			arguments: {}
		}
	]
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

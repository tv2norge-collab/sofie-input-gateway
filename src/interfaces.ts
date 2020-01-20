export interface DeviceSettings {

}

export interface UserInputEvent {
	deviceId: string,
	deviceType: DeviceType,
	values: { [input: string]: number | boolean }, // something like joysticks.left.x: 0.5, joysticks.left.y: 1
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

export interface UserInputEventManifest {
	deviceType: DeviceType
	inputs: { [identifier: string]: UserInputManifest }
}

export interface UserInputManifest {
	[identifier: string]: UserInputManifest | ValueType
}

export const mouseExample: UserInputEventManifest = {
	deviceType: DeviceType.Mouse,
	inputs: {
		scrollWheels: {
			x: ValueType.Delta,
			y: ValueType.Delta
		},
		buttons: {
			left: ValueType.Boolean,
			right: ValueType.Boolean,
			Middle: ValueType.Boolean
		},
		movement: {
			x: ValueType.Delta,
			y: ValueType.Delta
		}
	}
}

export const xboxExample: UserInputEventManifest = {
	deviceType: DeviceType.Controller,
	inputs: {
		joysticks: {
			left: {
				x: ValueType.Range,
				y: ValueType.Range
			},
			right: {
				x: ValueType.Range,
				y: ValueType.Range
			}
		},
		triggers: {
			left: ValueType.Range,
			right: ValueType.Range
		},
		buttons: {
			dpad: {
				up: ValueType.Boolean,
				down: ValueType.Boolean,
				left: ValueType.Boolean,
				right: ValueType.Boolean,
			},
			a: ValueType.Boolean,
			b: ValueType.Boolean,
			x: ValueType.Boolean,
			y: ValueType.Boolean
		}
	}
}

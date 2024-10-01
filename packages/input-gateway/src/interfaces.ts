import { SomeDeviceConfig } from '@sofie-automation/input-manager'

export type DeviceSettings = Record<string, SomeDeviceConfig>

/**
 * Make all optional properties be required and `| undefined`
 * This is useful to ensure that no property is missed, when manually converting between types, but allowing fields to be undefined
 */
export type Complete<T> = {
	[P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : T[P] | undefined
}

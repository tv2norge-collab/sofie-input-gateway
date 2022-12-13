import { SomeDeviceConfig } from '@sofie-automation/input-manager'

export type DeviceSettings = {
	debugLogging?: boolean
	devices?: Record<string, SomeDeviceConfig>
}

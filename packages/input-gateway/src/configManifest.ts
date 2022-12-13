import { DeviceType, getIntegrationsConfigManifest } from '@sofie-automation/input-manager'
import {
	ConfigManifestEntryType,
	DeviceConfigManifest,
	TableEntryConfigManifestEntry,
} from '@sofie-automation/server-core-integration'

export const INPUT_DEVICE_CONFIG: DeviceConfigManifest = {
	deviceConfig: [
		{
			id: 'debugLogging',
			name: 'Activate Debug Logging',
			type: ConfigManifestEntryType.BOOLEAN,
		},
		{
			id: 'devices',
			name: 'Input Devices',
			type: ConfigManifestEntryType.TABLE,
			typeField: 'type',
			isSubDevices: true,
			defaultType: DeviceType.HTTP,
			config: getIntegrationsConfigManifest() as Record<string, TableEntryConfigManifestEntry[]>,
		},
	],
}

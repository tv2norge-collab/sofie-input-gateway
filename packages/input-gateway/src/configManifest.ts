import { ConfigManifestEntryType, DeviceConfigManifest } from '@sofie-automation/server-core-integration'

export const INPUT_DEVICE_CONFIG: DeviceConfigManifest = {
	deviceConfig: [
		{
			id: 'debugLogging',
			name: 'Activate Debug Logging',
			type: ConfigManifestEntryType.BOOLEAN,
		},
	],
}

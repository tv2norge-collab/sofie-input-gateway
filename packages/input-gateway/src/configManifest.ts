import {
	getIntegrationsConfigManifest,
	SubdeviceManifest as InputDeviceManifest,
} from '@sofie-automation/input-manager'
import {
	DeviceConfigManifest,
	JSONBlobStringify,
	JSONSchema,
	SubdeviceManifest,
} from '@sofie-automation/server-core-integration'

import DEVICE_CONFIG from './$schemas/options.json'

const subdeviceManifest: SubdeviceManifest = Object.fromEntries(
	Object.entries<InputDeviceManifest>(getIntegrationsConfigManifest()).map(([id, dev]) => {
		return [id, dev]
	})
)

export const INPUT_DEVICE_CONFIG: DeviceConfigManifest = {
	deviceConfigSchema: JSONBlobStringify<JSONSchema>(DEVICE_CONFIG),
	subdeviceManifest,
}

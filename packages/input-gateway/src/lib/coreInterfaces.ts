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

interface IBlueprintTranslatableMessage {
	key: string
	args?: Record<string, any>
}

/**
 * @enum - A translatable message (i18next)
 */
export interface ITranslatableMessage extends IBlueprintTranslatableMessage {
	/** namespace used */
	namespaces?: Array<string>
}

type TFunction = (key: unknown, ...args: any[]) => string

/**
 * Convenience function to translate a message using a supplied translation function.
 *
 * @param {ITranslatableMessage} translatable - the translatable to translate
 * @param {TFunction} i18nTranslator - the translation function to use
 * @returns the translation with arguments applied
 */
export function translateMessage(translatable: ITranslatableMessage, i18nTranslator: TFunction): string {
	// the reason for injecting the translation function rather than including the inited function from i18n.ts
	// is to avoid a situation where this is accidentally used from the server side causing an error
	const { key: message, args, namespaces } = translatable

	return i18nTranslator(message, { ns: namespaces, replace: { ...args } })
}

/**
 * Interpollate a translation key using the provided args. This can be used in the backend to compile the actual string
 * (at least a single, probably English, version) presented to the user, for use in logs and such.
 *
 * @export
 * @param {unknown} key Translation key, usually with interpollation handle-bar syntax placeholders
 * @param {...any} args Map of values to be inserted in place of placeholders
 * @return {string} the compiled string
 */
export function interpollateTranslation(key: unknown, ...args: any[]): string {
	if (!args[0]) {
		return String(key)
	}

	if (typeof args[0] === 'string') {
		return String(key || args[0])
	}

	if (args[0].defaultValue) {
		return args[0].defaultValue
	}

	if (typeof key !== 'string') {
		return String(key)
	}

	const options = args[0]
	if (options?.replace) {
		Object.assign(options, { ...options.replace })
	}

	let interpolated = String(key)
	for (const placeholder of key.match(/[^{}]+(?=})/g) || []) {
		const value = options[placeholder] || placeholder
		interpolated = interpolated.replace(`{{${placeholder}}}`, value)
	}

	return interpolated
}

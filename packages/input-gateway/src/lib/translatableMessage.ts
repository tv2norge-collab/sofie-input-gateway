import { ITranslatableMessage } from '@sofie-automation/shared-lib/dist/lib/translations'

type TFunction = (key: unknown, ...args: any[]) => string

type ITranslatableMessageExtended = ITranslatableMessage & {
	namespaces?: string[]
}

/**
 * Convenience function to translate a message using a supplied translation function.
 *
 * @param {ITranslatableMessage} translatable - the translatable to translate
 * @param {TFunction} i18nTranslator - the translation function to use
 * @returns the translation with arguments applied
 */
export function translateMessage(translatable: ITranslatableMessageExtended, i18nTranslator: TFunction): string {
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

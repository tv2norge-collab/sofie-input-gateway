import { TableEntryConfigManifestEntry } from '@sofie-automation/server-core-integration'

export enum Symbols {
	DOWN = '↧',
	UP = '↥',
	JOG = '↺',
	SHUTTLE = '⤿',
	MOVE = '⤮',
	T_BAR = '⬍',
}

export function throwNever(_never: never): never {
	throw new Error("Didn't expect to get here")
}

export function assertNever(_never: never): void {
	// Do nothing. This is a type guard
}

export type DeviceConfigManifest<ConfigObj extends object> = Array<
	{ id: keyof ConfigObj } & Omit<TableEntryConfigManifestEntry, 'id'>
>

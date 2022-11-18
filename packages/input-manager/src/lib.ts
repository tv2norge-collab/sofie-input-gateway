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

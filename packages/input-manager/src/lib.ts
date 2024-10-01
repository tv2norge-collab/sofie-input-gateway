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

// The value, 50 ms, was chosen because it is approximate the time it takes for a human to click a key (key down + up).
export const DEFAULT_ANALOG_RATE_LIMIT = 50

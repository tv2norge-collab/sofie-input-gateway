interface LeveledLogMethod {
	(message: string): Logger
	(message: string, meta: any): Logger
}

export interface Logger {
	error: LeveledLogMethod
	warn: LeveledLogMethod
	help: LeveledLogMethod
	data: LeveledLogMethod
	info: LeveledLogMethod
	debug: LeveledLogMethod
	prompt: LeveledLogMethod
	http: LeveledLogMethod
	verbose: LeveledLogMethod
	input: LeveledLogMethod
	silly: LeveledLogMethod
}

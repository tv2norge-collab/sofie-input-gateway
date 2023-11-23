import { SomeFeedback } from '../feedback/feedback'

export class FeedbackStore<T extends SomeFeedback> {
	private store: Record<string, Record<string, T>>

	constructor() {
		this.store = {}
		this.set.bind(this)
		this.get = this.get.bind(this)
		this.clear = this.clear.bind(this)
		this.allFeedbackIds = this.allFeedbackIds.bind(this)
	}

	public set(triggerFeedbackId: string, subTriggerId: string, feedback: T): void {
		if (this.store[triggerFeedbackId] === undefined) {
			this.store[triggerFeedbackId] = {}
		}

		this.store[triggerFeedbackId][subTriggerId] = feedback
	}

	public get(triggerFeedbackId: string, acceptedSubTriggerIds: string[]): T | null
	public get(triggerFeedbackId: string, subTriggerId: string): T | null
	public get(triggerFeedbackId: string, subTriggerId: string | string[]): T | null {
		const subTriggersInPriority = Array.isArray(subTriggerId) ? subTriggerId : [subTriggerId]

		const feedbackObj = this.store[triggerFeedbackId] as Record<string, T> | undefined
		if (!feedbackObj) {
			return null
		}

		for (const trigger of subTriggersInPriority) {
			if (feedbackObj[trigger]) {
				return feedbackObj[trigger]
			}
		}

		return null
	}

	public clear(): void {
		this.store = {}
	}

	public allFeedbackIds(): string[] {
		return Array.from(Object.keys(this.store))
	}
}

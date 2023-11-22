import { SomeFeedback } from '../feedback/feedback'

export class FeedbackStore<T extends SomeFeedback> {
	private feedbacks: Record<string, Record<string, T>> = {}

	public set(feedbackId: string, triggerId: string, feedback: T): void {
		if (this.feedbacks[feedbackId] === undefined) {
			this.feedbacks[feedbackId] = {}
		}

		this.feedbacks[feedbackId][triggerId] = feedback
	}

	public get(feedbackId: string, acceptedTriggerIds: string[]): T | null
	public get(feedbackId: string, triggerId: string): T | null
	public get(feedbackId: string, triggerId: string | string[]): T | null {
		const triggersInPriority = Array.isArray(triggerId) ? triggerId : [triggerId]

		const feedbackObj = this.feedbacks[feedbackId] as Record<string, T> | undefined
		if (!feedbackObj) return null

		for (const trigger of triggersInPriority) {
			if (feedbackObj[trigger]) return feedbackObj[trigger]
		}

		return null
	}

	public clear(): void {
		this.feedbacks = {}
	}

	public allFeedbackIds(): string[] {
		return Array.from(Object.keys(this.feedbacks))
	}
}

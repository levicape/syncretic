export type CodePipelineTriggerFileSpec = {
	includes: string[];
	excludes: string[];
};

export type CodePipelineTriggerEventSpec = {
	filePaths?: CodePipelineTriggerFileSpec;
	branches?: CodePipelineTriggerFileSpec;
	tags?: CodePipelineTriggerFileSpec;
};

export type CodePipelineTriggerGitConnectionSpec = {
	provider: "CodeStarSourceConnection";
	gitConfiguration: {
		sourceActionName: unknown; // SourceActions generic type
		push?: CodePipelineTriggerEventSpec[];
		pullRequest?: CodePipelineTriggerEventSpec[];
	};
};

export type CodePipelineTrigger = CodePipelineTriggerGitConnectionSpec;

export class CodePipelineTriggerBuilder {
	private provider = "CodeStarSourceConnection" as const;
	private sourceActionName: unknown;
	private pushEvents: CodePipelineTriggerEventSpec[] = [];
	private pullRequestEvents: CodePipelineTriggerEventSpec[] = [];

	setProvider(provider: "CodeStarSourceConnection"): this {
		this.provider = provider;
		return this;
	}

	setSourceActionName(sourceActionName: unknown): this {
		this.sourceActionName = sourceActionName;
		return this;
	}

	addPushEvent(event: CodePipelineTriggerEventSpec): this {
		this.pushEvents.push(event);
		return this;
	}

	setPushEvents(events: CodePipelineTriggerEventSpec[]): this {
		this.pushEvents = events;
		return this;
	}

	addPullRequestEvent(event: CodePipelineTriggerEventSpec): this {
		this.pullRequestEvents.push(event);
		return this;
	}

	setPullRequestEvents(events: CodePipelineTriggerEventSpec[]): this {
		this.pullRequestEvents = events;
		return this;
	}

	build(): CodePipelineTrigger {
		return {
			provider: this.provider,
			gitConfiguration: {
				sourceActionName: this.sourceActionName,
				push: this.pushEvents,
				pullRequest: this.pullRequestEvents,
			},
		};
	}
}

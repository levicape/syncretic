import { CommitMessages } from "../../command/CommitMessages.mjs";
import type { PipelineOptions } from "./Pipeline.mjs";

export class PipelineOptionsBuilder<Build extends { id: string }> {
	private skip: {
		all: boolean;
		build: boolean;
		tests: boolean;
		images: {
			build: boolean;
			publish: boolean;
		};
	};
	public forceBuild: boolean;
	public ciFileChanged: boolean;
	public lastBuild: Build | undefined;
	public changedFiles: string[];
	public buildRelease: boolean;

	constructor(
		lastBuild: Build | undefined,
		changedFiles: string[],
		buildRelease: boolean,
	) {
		this.lastBuild = lastBuild;
		this.changedFiles = changedFiles;
		this.buildRelease = buildRelease;

		const { forceBuild, ciFileChanged } = CommitMessages.force(this);
		this.forceBuild = forceBuild ?? false;
		this.ciFileChanged = ciFileChanged ?? false;

		const skipAll = CommitMessages.skipCi(this);
		const skipBuild = CommitMessages.skipBuild(this);
		const skipTests = CommitMessages.skipTests();
		const { buildImages, publishImages } = {
			...CommitMessages.publishImages(this),
			buildImages: CommitMessages.buildImages(this),
		};
		this.skip = {
			all: skipAll || false,
			build: skipBuild || false,
			tests: skipTests || false,
			images: {
				build: buildImages || false,
				publish: publishImages || false,
			},
		};
	}

	public build = (): PipelineOptions => {
		let buildId: string | undefined;
		if (this.lastBuild) {
			if (!this.forceBuild) {
				buildId = this.lastBuild.id;
			}
		}

		return {
			buildId,
			buildImages: this.skip.images.build,
			publishImages: this.skip.images.publish,
			skipTests: this.skip.tests,
		};
	};

	static for = async <Build extends { id: string }>(
		getLastBuild: () => Promise<Build | undefined>,
		getChangedFiles: () => Promise<string[]>,
		getBuildRelease: () => Promise<boolean>,
	): Promise<PipelineOptionsBuilder<Build>> => {
		return new PipelineOptionsBuilder(
			await getLastBuild(),
			await getChangedFiles(),
			await getBuildRelease(),
		);
	};
}

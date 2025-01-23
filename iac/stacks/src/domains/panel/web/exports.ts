import { z } from "zod";

export const FourtwoPanelWebStackExportsZod = z.object({
	fourtwo_panel_web_s3: z.object({
		artifactStore: z.object({
			bucket: z.string(),
		}),
		build: z.object({
			bucket: z.string(),
		}),
		staticwww: z.object({
			bucket: z.string(),
			public: z.object({
				arn: z.string(),
				domainName: z.string(),
				websiteEndpoint: z.string(),
				websiteDomain: z.string(),
			}),
		}),
	}),
	fourtwo_panel_web_codebuild: z.object({
		project: z.object({
			arn: z.string(),
			name: z.string(),
		}),
	}),
	fourtwo_panel_web_pipeline: z.object({
		pipeline: z.object({
			arn: z.string(),
			name: z.string(),
		}),
	}),
	fourtwo_panel_web_eventbridge: z.object({
		EcrImageAction: z.object({
			rule: z.object({
				arn: z.string(),
				name: z.string(),
			}),
			targets: z.object({
				pipeline: z.object({
					arn: z.string(),
					targetId: z.string(),
				}),
			}),
		}),
	}),
});

import { z } from "zod";

export const FourtwoPanelHttpStackExportsZod = z.object({
	fourtwo_panel_http_cloudmap: z.object({
		application: z.object({
			arn: z.string(),
			name: z.string(),
		}),
		instance: z.object({
			attributes: z.record(z.string()),
			id: z.string(),
		}),
		service: z.object({
			arn: z.string(),
			name: z.string(),
		}),
	}),
	fourtwo_panel_http_cloudwatch: z.object({
		loggroup: z.object({
			arn: z.string(),
		}),
	}),
	fourtwo_panel_http_codebuild: z.object({
		httphandler_extractimage: z.object({
			buildspec: z.object({
				bucket: z.string(),
				key: z.string(),
			}),
			project: z.object({
				arn: z.string(),
				name: z.string(),
			}),
		}),
		httphandler_updatelambda: z.object({
			buildspec: z.object({
				bucket: z.string(),
				key: z.string(),
			}),
			project: z.object({
				arn: z.string(),
				name: z.string(),
			}),
		}),
	}),
	fourtwo_panel_http_codepipeline: z.object({
		pipeline: z.object({
			arn: z.string(),
			name: z.string(),
			roleArn: z.string(),
			stages: z.array(
				z.object({
					actions: z.array(
						z.object({
							category: z.string(),
							configuration: z.record(z.string().optional()).optional(),
							name: z.string(),
							provider: z.string(),
							runOrder: z.number(),
						}),
					),
					name: z.string(),
				}),
			),
		}),
	}),
	fourtwo_panel_http_eventbridge: z.record(
		z.object({
			rule: z.object({
				arn: z.string(),
				name: z.string(),
			}),
			targets: z.object({
				pipeline: z.object({
					arn: z.string(),
				}),
			}),
		}),
	),
	fourtwo_panel_http_lambda: z.object({
		codedeploy: z.object({
			deploymentGroup: z.object({
				arn: z.string(),
				name: z.string(),
			}),
		}),
		http: z.object({
			alias: z.object({
				arn: z.string(),
				functionVersion: z.string(),
				name: z.string(),
			}),
			arn: z.string(),
			name: z.string(),
			url: z.string(),
			version: z.string(),
		}),
		role: z.object({
			arn: z.string(),
			name: z.string(),
		}),
	}),
	fourtwo_panel_http_s3: z.object({
		artifactStore: z.object({
			bucket: z.string(),
			region: z.string(),
		}),
		build: z.object({
			bucket: z.string(),
			region: z.string(),
		}),
		deploy: z.object({
			bucket: z.string(),
			region: z.string(),
		}),
	}),
});

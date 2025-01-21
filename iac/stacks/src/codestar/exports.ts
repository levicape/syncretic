import { z } from "zod";

export const FourtwoCodestarStackExportsZod = z.object({
	fourtwo_codestar_ecr: z.object({
		repository: z.object({
			arn: z.string(),
			url: z.string(),
			name: z.string(),
		}),
	}),
	fourtwo_codestar_codedeploy: z.object({
		application: z.object({
			arn: z.string(),
			name: z.string(),
		}),
		deploymentConfig: z.object({
			arn: z.string(),
			name: z.string(),
		}),
	}),
});

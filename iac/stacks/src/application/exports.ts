import { z } from "zod";

export const FourtwoApplicationRoot = "fourtwo" as const;

export const FourtwoApplicationStackExportsZod = z
	.object({
		fourtwo_application_servicecatalog: z.object({
			application: z.object({
				arn: z.string(),
				id: z.string(),
				name: z.string(),
				tag: z.string(),
			}),
		}),
		fourtwo_application_resourcegroups: z.record(
			z.object({
				group: z.object({
					arn: z.string(),
					id: z.string(),
					name: z.string(),
				}),
			}),
		),
		fourtwo_application_sns: z.record(
			z.object({
				topic: z.object({
					arn: z.string(),
					name: z.string(),
					id: z.string(),
				}),
			}),
		),
	})
	.passthrough();

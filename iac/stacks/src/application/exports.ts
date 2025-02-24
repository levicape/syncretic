import { z } from "zod";

export const FourtwoApplicationStackExportsZod = z.object({
	fourtwo_application_servicecatalog: z.object({
		application: z.object({
			arn: z.string(),
			id: z.string(),
			name: z.string(),
		}),
	}),
	fourtwo_application_costexplorer: z.record(
		z.object({
			$kind: z.literal("tag"),
			tag: z.object({
				status: z.string(),
				key: z.string(),
				type: z.string().optional(),
			}),
		}),
	),
	// fourtwo_application_resourcegroups: z.record(
	// 	z.object({
	// 		arn: z.string(),
	// 		name: z.string(),
	// 		id: z.string(),
	// 	}),
	// ),
});

import { z } from "zod";

export const FourtwoPanelChannelsStackrefRoot = "panel-channels";

export const FourtwoPanelChannelsStackExportsZod = z
	.object({
		fourtwo_panel_channels_sns: z.object({
			revalidate: z.object({
				topic: z.object({
					arn: z.string(),
					name: z.string(),
					id: z.string(),
				}),
			}),
		}),
	})
	.passthrough();

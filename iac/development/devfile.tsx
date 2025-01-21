#!/usr/bin/env node --import tsx
/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	DevfileCommandX,
	DevfileEventX,
	DevfileMetadataX,
	DevfileSourceComponentX,
	DevfileX,
} from "@levicape/fourtwo/x/devfile";

let data = (
	<DevfileX
		metadata={<DevfileMetadataX name={"fourtwo"} />}
		components={[<DevfileSourceComponentX name={"source"} />]}
		events={
			<DevfileEventX
				postStart={[
					"update-node",
					"install-corepack",
					"install-pnpm",
					"start-docker",
					"install-codecatalyst-workflow-cli",
				]}
			/>
		}
	>
		{[
			<DevfileCommandX
				id={"update-node"}
				exec={{
					component: "source",
					commandLine: "sudo npx -y n 23",
				}}
			/>,
			<DevfileCommandX
				id={"install-corepack"}
				exec={{
					component: "source",
					commandLine: "sudo corepack enable",
				}}
			/>,
			<DevfileCommandX
				id={"install-pnpm"}
				exec={{
					component: "source",
					commandLine: "sudo corepack use pnpm@latest",
				}}
			/>,
			<DevfileCommandX
				id={"start-docker"}
				exec={{
					component: "source",
					commandLine: "./entrypoint.sh",
				}}
			/>,
			<DevfileCommandX
				id={"install-codecatalyst-workflow-cli"}
				exec={{
					component: "source",
					commandLine: [
						[
							"sudo curl -sL https://github.com/aws/codecatalyst-runner-cli/releases/latest/download/ccr_Linux_x86_64.tar.gz -o -",
							"sudo tar -zx ccr",
						].join(" | "),
						"sudo mv ccr /usr/local/bin/ccr",
					].join(" && "),
				}}
			/>,
		]}
	</DevfileX>
);

import { stringify } from "yaml";

console.log(
	stringify(data.build(), {
		collectionStyle: "block",
		aliasDuplicateObjects: false,
		doubleQuotedAsJSON: true,
		minContentWidth: 0,
		lineWidth: 0,
	}),
);

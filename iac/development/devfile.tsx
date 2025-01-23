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

const NODE_VERSION = "23";
const MAKE_DEPENDENCIES = [
	"g++",
	"make",
	"cmake",
	"unzip",
	"libcurl-devel",
	"automake",
	"autoconf",
	"libtool",
].join(" ");
const PNPM_VERSION = "9";
const CCR_URL =
	"https://github.com/aws/codecatalyst-runner-cli/releases/latest/download/ccr_Linux_x86_64.tar.gz";

let data = (
	<DevfileX
		metadata={<DevfileMetadataX name={"fourtwo"} />}
		components={[<DevfileSourceComponentX name={"source"} />]}
		events={
			<DevfileEventX
				postStart={[
					"update-node",
					"install-make",
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
					commandLine: `sudo npx -y n ${NODE_VERSION}`,
				}}
			/>,
			<DevfileCommandX
				id={"install-make"}
				exec={{
					component: "source",
					commandLine: `sudo yum install -y ${MAKE_DEPENDENCIES}`,
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
					commandLine: `sudo corepack use pnpm@${PNPM_VERSION}`,
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
						[`sudo curl -sL ${CCR_URL} -o -`, "sudo tar -zx ccr"].join(" | "),
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

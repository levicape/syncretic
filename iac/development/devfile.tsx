#!/usr/bin/env node --import tsx
/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	DevfileCommandX,
	DevfileComponentX,
	DevfileEventX,
	DevfileMetadataX,
	DevfileSourceComponentX,
	DevfileX,
} from "../../src/ci/cd/pipeline/devfile/index-x.mjs";

let data = (
	<DevfileX
		metadata={<DevfileMetadataX name={"fourtwo"} />}
		components={[<DevfileSourceComponentX name={"source"} />]}
		events={<DevfileEventX postStart={["update-node", "install-pnpm"]} />}
	>
		{[
			<DevfileCommandX
				id={"update-node"}
				exec={{
					component: "source",
					commandLine: "sudo npx -y n 22",
				}}
			/>,
			<DevfileCommandX
				id={"install-pnpm"}
				exec={{
					component: "source",
					commandLine: "npx -y corepack install",
				}}
			/>,
		]}
	</DevfileX>
);

import { dump } from "js-yaml";
console.log(dump(data.build()));

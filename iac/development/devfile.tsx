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
		components={[<DevfileSourceComponentX name={"source"} />,
			<DevfileComponentX name={"dockerstore"} />
		]}
		events={<DevfileEventX postStart={["pnpm"]} />}
	>
		{[
			<DevfileCommandX
				id={"pnpm"}
				exec={{
					component: "source",
					commandLine: "npx corepack install",
				}}
			/>,
		]}
	</DevfileX>
);

import { dump } from "js-yaml";
console.log(dump(data.build()));

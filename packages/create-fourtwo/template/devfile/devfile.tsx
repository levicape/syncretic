#!/usr/bin/env -S node --import tsx

/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	type DevfileBuilder,
	DevfileCommandX,
	DevfileEventX,
	DevfileMetadataX,
	DevfileSourceComponentX,
	DevfileX,
} from "@levicape/fourtwo/devfile";

const devfile: DevfileBuilder = (
	<DevfileX
		metadata={<DevfileMetadataX name={"devfile-fourtwo"} />}
		components={[<DevfileSourceComponentX name={"source"} />]}
		events={<DevfileEventX postStart={["hello-jsx"]} />}
	>
		<DevfileCommandX
			id={"hello-jsx"}
			exec={{
				component: "source",
				commandLine: "echo 'Hello Fourtwo JSX!'",
			}}
		/>
	</DevfileX>
);

devfile.build();

#!/usr/bin/env -S node --import tsx

/** @jsxImportSource @levicape/syncretic */
/** @jsxRuntime automatic */

import {
	type DevfileBuilder,
	DevfileCommandX,
	DevfileEventX,
	DevfileMetadataX,
	DevfileSourceComponentX,
	DevfileX,
} from "@levicape/syncretic/devfile";

const devfile: DevfileBuilder = (
	<DevfileX
		metadata={<DevfileMetadataX name={"devfile-syncretic"}/>}
		components={[<DevfileSourceComponentX name={"source"} />]}
		events={<DevfileEventX postStart={["hello-jsx"]} />}
	>
		<DevfileCommandX
			id={"hello-jsx"}
			exec={{
				component: "source",
				commandLine: "echo 'Hello syncretic JSX!'",
			}}
		/>
	</DevfileX>
);

devfile.build();

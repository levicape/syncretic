#!/usr/bin/env -S node --import tsx

/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	Devfile,
	type DevfileBuilder,
	DevfileCommand,
	DevfileEvent,
	DevfileMetadata,
	DevfileResource,
	DevfileSourceComponent,
} from "@levicape/fourtwo/jsx/devfile/Devfile";

const devfile: DevfileBuilder = (
	<Devfile
		metadata={<DevfileMetadata name={"devfile-fourtwo"} />}
		components={[<DevfileSourceComponent name={"source"} />]}
		events={<DevfileEvent postStart={["hello-jsx"]} />}
	>
		<DevfileCommand
			id={"hello-jsx"}
			exec={{
				component: "source",
				commandLine: "echo 'Hello Fourtwo JSX!'",
			}}
		/>
	</Devfile>
);

devfile.build();

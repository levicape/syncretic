---
title: Fourtwo - Rendering JSX
titleTemplate: ':title'
---

# Rendering a JSX file
JSX components return a builder instance that has class methods for transforming it's contents into either yaml or json formats.

## Node 
```jsx
import { stringify } from "yaml";

const devfile = <Devfile
	metadata={<DevfileMetadata name={"devfile_fourtwo"} />}
	components={[<DevfileSourceComponent name={"source"} />]}
	events={
		<DevfileEvent
			postStart={[
				"hello-jsx"
			]}
		/>
	}
>
	<DevfileCommand
		id={"hello_jsx"}
		exec={{
			component: "source",
			commandLine: "echo 'Hello Fourtwo JSX!'",
		}}
	/>
</Devfile>

console.log(devfile.build());
```


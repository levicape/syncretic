---
title: Fourtwo - Rendering JSX
titleTemplate: ':title'
---

# Rendering a JSX file
JSX components return a builder instance that has class methods for transforming it's contents into either yaml or json formats.

---

## Node 
```jsx
import { stringify } from "yaml";

const devfile = <DevfileX
	metadata={<DevfileMetadataX name={"devfile_fourtwo"} />}
	components={[<DevfileSourceComponentX name={"source"} />]}
	events={
		<DevfileEventX
			postStart={[
				"hello-jsx",
			]}
		/>
	}
>
	<DevfileCommandX
		id={"hello_jsx"}
		exec={{
			component: "source",
			commandLine: "echo 'Hello Fourtwo JSX!'",
		}}
	/>
</DevfileX>

console.log(devfile.build());

```
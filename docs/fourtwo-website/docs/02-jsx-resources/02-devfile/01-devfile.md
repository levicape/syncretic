---
title: Fourtwo - Devfile
titleTemplate: ':title'
---

# Devfile components

[Devfile ](https://devfile.io)

## Devfile
```jsx
<Devfile
	metadata={<DevfileMetadata name={"devfile_fourtwo"} />}
	components={[<DevfileSourceComponent name={"source"} />]}
	events={
		<DevfileEvent
			postStart={[
				"hello-jsx",
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
```
[https://devfile.io/docs/2.3.0/devfile-schema] (Devfile schema)

### Devfile Props 
|   |   |   |
|---|---|---|
| metadata | DevfileMetadata | [DevfileMetadata](#devfilemetadata)
| components | DevfileSourceComponent |  [DevfileSourceComponent](#devfilesourcecomponent)
| events | DevfileEvent | [DevfileEvent](#devfileevent)
| commands | DevfileCommand | [DevfileCommand](#devfilecommand)


## DevfileMetadata

```jsx
<DevfileMetadata
	name={"devfile_fourtwo"} 
/>
```

```yaml
metadata:
  name: devfile_fourtwo
```


### DevfileMetadata Props 
|   |   |   |
|---|---|---|
| name | string | Optional devfile name

---

## DevfileSourceComponent
```jsx
<DevfileSourceComponent
	name={"source"} 
/>
```

### DevfileSourceComponent Props 
|   |   |   | 
|---|---|---|
| name | string | Mandatory name that allows referencing the component from other elements (such as commands) or from an external devfile that may reference this component through a parent or a plugin. 
| container.image | string 
| container.mountSources | boolean? | Toggles whether or not the project source code should be mounted in the component. 
| container.command | string[] | The command to run in the dockerimage component instead of the default one provided in the image. 


---

```yaml
components:
  - name: source
    container:
      image: public.ecr.aws/aws-mde/universal-image:4.0
      mountSources: true
```

## DevfileEvent
```jsx
<DevfileEvent
	postStart={[
		"hello-jsx",
	]}
/>
```

```yaml
events:
  postStart:
    - hello-jsx
```

### DevfileEvent Props
|   |   |   |
|---|---|---|
| postStart | string | IDs of commands that should be executed after stopping the devworkspace. |


## DevfileCommand
```jsx
<DevfileCommand
	id={"hello_jsx"}
	exec={{
		component: "source",
		commandLine: "echo 'Hello Fourtwo JSX!'",
	}}
/>
```

```yaml
commands:
  - id: hello_jsx
    exec:
      component: source
      commandLine: echo 'Hello Fourtwo JSX!' 
```

### DevfileCommand Props
|   |   |   |
|---|---|---|
| postStart | string | IDs of commands that should be executed after stopping the devworkspace.
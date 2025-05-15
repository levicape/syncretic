---
title: Fourtwo - Devfile
titleTemplate: ':title'
---

# Devfile components

[Devfile ](https://devfile.io)

## DevfileX
```jsx
<DevfileX
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
```

### Props 
|   |   |   |
|---|---|---|
| metadata | DevfileMetadata |  |   
| components | DevfileSourceComponent |   |
| events | DevfileEvent |   |
| commands | DevfileCommand |   |



## DefileMetadataX

```jsx
<DevfileMetadataX 
	name={"devfile_fourtwo"} 
/>
```

```yaml
metadata:
  name: devfile_fourtwo
```

## DevfileSourceComponentX
```jsx
<DevfileSourceComponentX 
	name={"source"} 
/>
```

```yaml
components:
  - name: source
    container:
      image: public.ecr.aws/aws-mde/universal-image:4.0
      mountSources: true
```

## DevfileEventX
```jsx
<DevfileEventX
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

## DevfileCommandX
```jsx
<DevfileCommandX
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
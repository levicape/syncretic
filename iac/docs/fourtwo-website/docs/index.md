---
title: Fourtwo - Quickstart
titleTemplate: ':title'
---

# Fourtwo

Fourtwo is a jsx system for defining IaC resources. It translates a tree of tags (`<Component>`) into the resource's native format (usually yaml).

Example:
```tsx
export const devfile: DevfileBuilder = <DevfileX
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

console.log(devfile().build());
// or
writeFileSync(devfile().build());
```
translates to the following yaml:

```yaml
schemaVersion: 2.0.0
metadata:
  name: devfile_fourtwo
components:
  - name: source
commands:
  - id: hello_jsx
    exec:
      component: source
      commandLine: echo 'Hello Fourtwo JSX!'
events:
  postStart:
    - hello_jsx
```

## Quick Start

To get started, run the fourtwo-create app to generate a template:

::: code-group

```sh [npm]
npm create fourtwo@latest
```

```sh [yarn]
yarn create fourtwo
```

```sh [pnpm]
pnpm create fourtwo@latest
```

```sh [bun]
bun create fourtwo@latest
```

```sh [deno]
deno init --npm fourtwo@latest
```

:::

## JSX Resources

Currently supported [inline JSX](../guide/getting-started) resources
- Devfile

## JSX Workflows

The [Fourtwo CLI](../guide/getting-started) can manage the following git based (gitops) workflows:

- CodeCatalyst
- Github Actions

## YAML Builders

These resources are provided as [Builder Classes](../guide/getting-started) and have no jsx components

- AWS CodeDeploy
- AWS CodeBuild


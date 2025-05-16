---
title: Fourtwo - Rendering JSX
titleTemplate: ':title'
---

# Rendering a JSX file
JSX components return a builder instance that has class methods for transforming it's contents into either yaml or json formats.
```jsx
<GithubWorkflowX
	name="on Push"
	on={{
		push: {},
	}}
>
	<GithubJobX
		id="build"
		name="Compile, Lint and Test all workspace packages"
		runsOn={GithubJobBuilder.defaultRunsOn()}
		steps={
			<Fragment>
				<GithubStepCheckoutX />
				<GithubStepNodeSetupX
					configuration={{
						packageManager: {
							node: "pnpm",
						},
						registry: {
							scope: "@levicape",
							host: `${env("LEVICAPE_REGISTRY")}`,
						},
						version: {
							node: "22.13.0",
						},
					}}
					children={(node) => {
						return (
							<Fragment>
								<GithubStepX
									name="Compile"
									run={["echo 'Compile all packages'"]}
								/>
							</Fragment>
						);
					}}
				/>
			</Fragment>
		}
	/>
</GithubWorkflowX>
```



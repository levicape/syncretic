---
title: Fourtwo - 
titleTemplate: ':title'
---

# Github Actions

```jsx
<GithubWorkflowX
	name={"on Push"}
	on={{
		push: {},
	}}
>
	<GithubJobX
		id={"build"}
		name={"Step"}
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
							scope: "@scope",
							host: `${env("NPM_REGISTRY")}`,
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
									run={["echo 'Hello world'"]}
								/>
							</Fragment>
						);
					}}
				/>
			</Fragment>
		}
	/>
</GithubWorkflowX>;
```


## 
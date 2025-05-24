---
title: Fourtwo - CodeCatalyst
titleTemplate: ':title'
---

# CodeCatalyst


```jsx
<CodeCatalystWorkflow
	name={"on Push"}
	on={{
		push: {},
	}}
>
	<GithubJob
		id={"build"}
		name={"Step"}
		runsOn={GithubJobBuilder.defaultRunsOn()}
		steps={
			<Fragment>
				<GithubStepCheckout />
				<GithubStep
					name="Compile"
					run={["echo 'Hello world'"]}
				/>
			</Fragment>
		}
	/>
</GithubWorkflow>;
```

---

## CodeCatalystWorkflow

A workflow is a configurable automated process that will run one or more jobs. Workflows are defined by a YAML file checked in to your repository and will run when triggered by an event in your repository, or they can be triggered manually, or at a defined schedule.


## GithubJob

| Property | Reference |
|---|---|
| push | https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#push |
| release | https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#release |
| pull_request | https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#pull_request |
| pull_request_target | https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#pull_request_target |

A workflow run is made up of one or more jobs, which run in parallel by default. To run jobs sequentially, you can define dependencies on other jobs using the jobs.<job_id>.needs keyword.

```jsx
<GithubJob>
```

```yaml
  build:
    name: Step
    runs-on: ubuntu-latest
```

### CodeCatalystStep

| Property | Type                | Reference                                                                                                                               | 
|----------|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| id       | string              | https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/using-jobs-in-a-workflow#setting-an-id-for-a-job  |
| name     | string              | https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/using-jobs-in-a-workflow#setting-a-name-for-a-job |
| runs-on  | string?             | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idsteps                                 |
| steps    | GithubStep         | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idsteps                                 |
| with     | Record              | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#example-of-jobsjob_idsteps                      |
| needs    | Array              | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idneeds                                 |
| packages | read ┃ write ┃ none | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#permissions                                     |

---

## GithubStepCheckout



```jsx
<GithubStepCheckout />
```

---

```yaml
- name: Checkout
  uses: actions/checkout@v2
```

---

## GithubStep

A job contains a sequence of tasks called steps. Steps can run commands, run setup tasks, or run an action in your repository, a public repository, or an action published in a Docker registry. Not all steps run actions, but all actions run as a step. Each step runs in its own process in the runner environment and has access to the workspace and filesystem. Because steps run in their own process, changes to environment variables are not preserved between steps. GitHub provides built-in steps to set up and complete a job.


```jsx
<GithubStep />
```

---

```yaml
- name: Compile
  run: echo 'Hello world';
```

### GithubStep Props

| Property | Type                         | Reference                                                                                                                               |
|----------|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| id       | string                       | https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/using-jobs-in-a-workflow#setting-an-id-for-a-job  |
| name     | string                       | https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/using-jobs-in-a-workflow#setting-a-name-for-a-job |
| runs-on  | string?                      | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idsteps                                 |
| steps    | GithubStep                  | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idsteps                                 |
| with     | Record<string, GithubStep>  | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idwith                      |
| needs    | Array\<string>                | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idneeds                                 |
| packages | read ┃ write ┃ none  | https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#permissions                                     |           |


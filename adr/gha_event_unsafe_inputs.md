However, there is a long list of event context data that might be attacker controlled and should be treated as potentially untrusted input:
```
github.event.issue.title
github.event.issue.body
github.event.pull_request.title
github.event.pull_request.body
github.event.comment.body
github.event.review.body
github.event.pages.*.page_name
github.event.commits.*.message
github.event.head_commit.message
github.event.head_commit.author.email
github.event.head_commit.author.name
github.event.commits.*.author.email
github.event.commits.*.author.name
github.event.pull_request.head.ref
github.event.pull_request.head.label
github.event.pull_request.head.repo.default_branch
github.head_ref
```

The best practice to avoid code and command injection vulnerabilities in GitHub workflows is to set the untrusted input value of the expression to an intermediate environment variable:
```
- name: print title
  env:
    TITLE: ${{ github.event.issue.title }}
  run: echo "$TITLE"
```


- Change component naming
- permissions props match GHA spec

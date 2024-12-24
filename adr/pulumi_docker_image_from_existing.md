I spent a while trying to find the functionality described in this issue (before finding the issue!). Eventually I worked around the issue by making a docker_dummy directory with this Dockerfile:

```
ARG SOURCE_IMAGE

FROM ${SOURCE_IMAGE}
```

I then use Pulumi's `buildAndPushImage`, and pass the name of the image I want to publish as a build arg. Leaving this here for the next person.
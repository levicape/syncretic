ivy -> Dev (On Push, destroy and recreate except for protected resources)
elm -> Deploy On Pull Request Flow
oak -> Main On Push, preview. Manual

elm -> On Push b:* | deploy, push
  On Pull request Open | push deploy

oak -> On Push b:main | preview, image
  On Pull request | preview, image
  Scheduled | Deploy
  Manual | Deploy, Push
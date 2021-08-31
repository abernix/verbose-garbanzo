# GitHub Issue/Pull API Hook

This is effectively a GitHub Action that does a URL fetch to an endpoint with `url` query string parameter.  It is meant to be called when an issue or PR is opened to add it to another system.  In practice, it's used for a GitHub Projects Beta API call, but it can be used for anything that matches this pattern really.

## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed `dist` folder.

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ npm run package
$ git add dist
$ git commit -a -m "prod dependencies"
$ git push origin releases/v1
```

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

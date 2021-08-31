import * as core from '@actions/core'
import * as github from '@actions/github'
import assert from 'assert'
import got from 'got'
import type {IssuesOpenedEvent} from '@octokit/webhooks-types'
interface MainInputs {
  organization: string
  bearerToken: string
}

function validateInput({organization, bearerToken}: MainInputs): void {
  assert.ok(
    typeof organization === 'string' && organization,
    'organization should be the github login'
  )
  assert.ok(
    typeof bearerToken === 'string' && bearerToken,
    'bearer_token must be set'
  )
}

async function run(): Promise<void> {
  try {
    if (
      github.context.eventName !== 'issues' ||
      github.context.payload.action !== 'opened'
    ) {
      throw new Error('Unsupported event!')
    }

    const payload = github.context.payload as IssuesOpenedEvent
    core.info(`This issue URL is ${payload.issue.html_url}`)

    const [envOrg, envRepo] = (process.env.GITHUB_REPOSITORY || '').split(
      '/',
      2
    )

    if (!envOrg || !envRepo) {
      throw new Error("Must set GITHUB_REPOSITORY in env as 'org/repo'.")
    }

    const organization: string = envOrg || core.getInput('organization')
    const bearerToken: string = core.getInput('bearer_token')
    validateInput({organization, bearerToken})

    const searchParams = new URLSearchParams()
    searchParams.set('url', payload.issue.html_url)

    const {success} = await got
      .get(
        'https://abernix-tagger--apollo-team-polaris-planning.netlify.app/tagger',
        {
          headers: {
            authorization: `Bearer ${bearerToken}`
          },
          searchParams
        }
      )
      .json()

    if (!success) {
      throw new Error("The team API didn't succeed")
    }

    // core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('Unknown error')
    }
  }
}

run()

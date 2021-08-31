import * as core from '@actions/core'
import * as github from '@actions/github'
import assert from 'assert'
import got from 'got'
import type {IssuesOpenedEvent} from '@octokit/webhooks-types'
interface MainInputs {
  apiUrl: string
  bearerToken: string
}

function validateInput({apiUrl, bearerToken}: MainInputs): void {
  assert.ok(typeof apiUrl === 'string' && apiUrl, 'api_url must be set')
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

    const apiUrl: string = core.getInput('api_url')
    const bearerToken: string = core.getInput('bearer_token')
    validateInput({apiUrl, bearerToken})

    const searchParams = new URLSearchParams()
    searchParams.set('url', payload.issue.html_url)

    const {success} = await got
      .get(apiUrl, {
        headers: {
          authorization: `Bearer ${bearerToken}`
        },
        searchParams
      })
      .json()

    if (!success) {
      throw new Error("The team API didn't succeed")
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('Unknown error')
    }
  }
}

run()

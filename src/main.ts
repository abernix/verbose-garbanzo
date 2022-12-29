import * as core from '@actions/core'
import * as github from '@actions/github'
import assert from 'assert'
import got from 'got'
import type {
  IssuesOpenedEvent,
  PullRequestOpenedEvent
} from '@octokit/webhooks-types'
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
      !['issues', 'pull_request'].includes(github.context.eventName) ||
      !['opened', 'reopened'].includes(github.context.payload.action || '')
    ) {
      throw new Error(
        `Unsupported event ${github.context.eventName} / ${github.context.payload.action}!`
      )
    }

    let htmlUrl: string | undefined
    if (github.context.eventName === 'pull_request') {
      htmlUrl = github.context.payload.pull_request?.html_url
    } else {
      htmlUrl = github.context.payload.issue?.html_url
    }

    assert.ok(
      typeof htmlUrl === 'string' && htmlUrl,
      'html_url must be present on event payload'
    )

    core.info(`This issue URL is ${htmlUrl}`)

    const apiUrl: string = core.getInput('api_url')
    const bearerToken: string = core.getInput('bearer_token')
    validateInput({apiUrl, bearerToken})

    const searchParams = new URLSearchParams()
    searchParams.set('url', htmlUrl)

    const {success}: { success?: boolean } = await got
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

import * as core from '@actions/core'
import assert from 'assert'
import {Octokit} from 'octokit'

const octokit = new Octokit({
  auth:
    process.env.ORG_GITHUB_TOKEN || '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'
})

interface MainInputs {
  organization: string
  projectId: number
  fieldOptionValues?: {fieldId: string; optionValueId: string}
}

function validateInput({organization, projectId}: MainInputs): void {
  assert.ok(
    typeof organization === 'string' && organization,
    'organization should be the github login'
  )
  assert.ok(
    typeof projectId === 'number' && projectId > 0,
    'projectId should be a number'
  )
}

interface GitHubGraphqlMetadata {
  repository: {
    issueOrPullRequest: {
      id: string
    } | null
  } | null
  organization: {
    projectNext: {
      id: string
      fields: {
        nodes: {
          id: string
          name: string
          settings: string
        }[]
      }
    } | null
  } | null
}

interface GitHubMetadata {
  issueOrPullId: string
  projectNodeId: string
  fields: GitHubFields[]
}

interface GitHubFields {
  id: string
  name: string
  options?: {
    [key: string]: string
    id: string
    name: string
    name_html: string
  }
}

async function getMetadata({
  projectOwner,
  issueOwner,
  repo,
  projectId
}: {
  projectOwner: string
  issueOwner: string
  repo: string
  projectId: number
}): Promise<GitHubMetadata> {
  const result: GitHubGraphqlMetadata = await octokit.graphql(
    `
    query GetMetadata($projectOwner: String!, $issueOwner: String!, $repo: String!, $projectId: Int!) {
      ## Get the Issue or Pull Request ID
      repository(owner: $issueOwner, name: $repo) {
        issueOrPullRequest(number: 96) {
          ... on Issue {
            id
          }

          ... on PullRequest {
            id
          }
        }
      }

      ## Get the Project attributes for our Polaris board
      organization(login: $projectOwner) {
        projectNext(number: $projectId) {
          id
          fields(first: 100) {
            nodes {
              id
              name
              settings
            }
          }
        }
      }
    }
  `,
    {
      projectOwner,
      issueOwner,
      repo,
      projectId,
      headers: {
        'GraphQL-Features': 'projects_next_graphql'
      }
    }
  )

  if (
    typeof result?.organization?.projectNext?.id !== 'string' ||
    typeof result.repository?.issueOrPullRequest?.id !== 'string'
  ) {
    throw new Error('missing expected information')
  }

  const fields: GitHubFields[] = result.organization.projectNext.fields.nodes.map(
    n => {
      let parsedSettings
      try {
        parsedSettings = JSON.parse(n.settings)
      } catch {
        parsedSettings = {}
      }

      const mapped: GitHubFields = {
        id: n.id,
        name: n.name
      }

      if (Array.isArray(parsedSettings.options)) {
        mapped.options = parsedSettings.options
      }

      return mapped
    }
  )

  return {
    issueOrPullId: result.repository.issueOrPullRequest.id,
    projectNodeId: result.organization.projectNext.id,
    fields
  }
}

async function run(): Promise<void> {
  try {
    // console.log(process.env);
    const [envOrg, envRepo] = (process.env.GITHUB_REPOSITORY || "" ).split('/', 2);

    if (!envOrg || !envRepo) {
      throw new Error("Must set GITHUB_REPOSITORY in env as 'org/repo'.");
    }

    const organization: string = envOrg || core.getInput('organization')
    const projectId = Number(core.getInput('project_id'))
    const fieldOptionValues: string = core.getInput('field_option_values')
    validateInput({organization, projectId})

    const metadata = await getMetadata({
      projectOwner: organization,
      issueOwner: envOrg,
      repo: envRepo,
      projectId
    })

    // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
    core.debug(`Working ${organization}'s project ${projectId}`)
    // core.debug(JSON.stringify(metadata))

    for (const match of fieldOptionValues.matchAll(/^\s*(?<fieldId>[A-Za-z0-9=]+)::(?<optionValueId>[A-Za-z0-9=]+)\s*$/gm)) {
      if (match && match.groups?.fieldId && match.groups?.optionValueId) {
        console.log(match.groups);
      }
    }

    // core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

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

interface ProjectNextItem {
  projectNextItem: {
    id?: string | null
  } | null
}

interface GitHubGraphqlUpdateProjectNextItemField {
  updateProjectNextItemField: ProjectNextItem | null
}

interface GitHubGraphqlAddProjectNextItem {
  addProjectNextItem: ProjectNextItem | null
}

interface GitHubProjectNextItem {
  id: string
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

async function addProjectNextItem({
  projectNodeId,
  contentId,
}: {
  projectNodeId: string
  /**
   * The GitHub ID for the PR or Issue
   */
  contentId: string
}): Promise<GitHubProjectNextItem> {
  const result: GitHubGraphqlAddProjectNextItem = await octokit.graphql(
    `
    mutation AddProjectNextItem (
      $projectNodeId: String!
      $contentId: String!
    ) {
      addProjectNextItem(
        input: {
          projectId: $projectNodeId
          contentId: $contentId
        }
      ) {
        projectNextItem {
          id
        }
      }

    }
  `,
    {
      projectNodeId,
      contentId,
      headers: {
        'GraphQL-Features': 'projects_next_graphql'
      }
    }
  )

  if (
    typeof result?.addProjectNextItem?.projectNextItem?.id !== "string"
  ) {
    throw new Error('missing expected info in addProjectNextItem')
  }

  return {
    id: result.addProjectNextItem.projectNextItem.id,
  }

}



async function updateProjectNextItemField({
  projectNodeId,
  itemId,
  fieldId,
  optionValueId
}: {
  projectNodeId: string
  fieldId: string
  itemId: string
  optionValueId: string
}): Promise<GitHubProjectNextItem> {
  const result: GitHubGraphqlUpdateProjectNextItemField = await octokit.graphql(
    `
    mutation UpdateProjectItemField(
      $projectNodeId: String!
      $fieldId: String!
      $itemId: String!
      $optionValueId: String!
    ) {
      updateProjectNextItemField(
        input: {
          projectId: $projectNodeId
          itemId: $itemId
          fieldId: $fieldId
          value: $optionValueId
        }
      ) {
        projectNextItem {
          id
        }
      }

    }
  `,
    {
      projectNodeId,
      fieldId,
      itemId,
      optionValueId,
      headers: {
        'GraphQL-Features': 'projects_next_graphql'
      }
    }
  )

  if (
    typeof result?.updateProjectNextItemField?.projectNextItem?.id !== "string"
  ) {
    throw new Error('missing expected info in updateProjectNextItemField')
  }

  return {
    id: result.updateProjectNextItemField.projectNextItem.id,
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
    throw new Error('missing expected info in getMetadata')
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

    const fieldOptionValuesMap = new Map<string, string>();
    for (const match of fieldOptionValues.matchAll(/^\s*(?<fieldId>[A-Za-z0-9=]+)::(?<optionValueId>[A-Fa-f0-9]+)\s*$/gm)) {
      if (match && match.groups?.fieldId && match.groups?.optionValueId) {
        fieldOptionValuesMap.set(match.groups.fieldId, match.groups.optionValueId)
      } else {
        throw new Error("malformed line");
      }
    }


    const item = await addProjectNextItem({
      projectNodeId: metadata.projectNodeId,
      contentId: metadata.issueOrPullId,
    });

    fieldOptionValuesMap.forEach(async (optionValueId, fieldId) => {
      await updateProjectNextItemField({
        projectNodeId: metadata.projectNodeId,
        itemId: item.id,
        fieldId,
        optionValueId,
      });
    });

    // core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

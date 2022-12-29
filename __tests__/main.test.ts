import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {resolve} from 'path'

// shows how the runner will run a javascript action with env / stdout protocol
describe('test runs', () => {
  test('issues', () => {
    const payloadPath = resolve(__dirname, '../payload-issue.json')
    const env = {
      INPUT_API_URL:
        'https://webhook.site/f636ed30-e72e-4996-881e-f76efcfe67c3',
      INPUT_BEARER_TOKEN: '123abc',
      GITHUB_EVENT_NAME: 'issues',
      GITHUB_EVENT_PATH: payloadPath
    }

    const np = process.execPath
    const ip = path.join(__dirname, '..', 'lib', 'main.js')
    const options: cp.ExecFileSyncOptions = {
      env
    }
    console.log(cp.execFileSync(np, [ip], options).toString())
  })
})

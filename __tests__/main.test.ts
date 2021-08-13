import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['GITHUB_REPOSITORY'] = 'apollographql/router'
  process.env['INPUT_PROJECT_ID'] = '18'
  process.env['INPUT_FIELD_OPTION_VALUES'] = `
    MDE2OlByb2plY3ROZXh0RmllbGQxODU1Nw==::404d8c00
    MDE2OlByb2plY3ROZXh0RmllbGQxODU2MQ==::36b20fc7
  `;
  // process.env['INPUT_ORGANIZATION'] = 'org'
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }
  console.log(cp.execFileSync(np, [ip], options).toString())
})

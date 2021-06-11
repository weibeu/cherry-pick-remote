import * as core from "@actions/core"
import * as github from "@actions/github"
import { exec } from '@actions/exec'

const REMOTE_REPOSITORY_TAG = "remote-repository"

async function exec_(command: String): Promise<void> {
  var _ = command.split(" ")
  await exec(_[0], _.slice(1))
}

async function run(): Promise<void> {

  if (github.context.payload.action !== "push-dispatch") {
    core.setFailed("Received GitHub event which is not push-dispatch.")
    return
  }

  try {
    var repository = core.getInput("repository")
    var branch = core.getInput("branch")
    var path = core.getInput("path")
    var token = core.getInput("token")
    var username = core.getInput("username")
    var email = core.getInput("email")

    core.setOutput("ref", branch)
    core.setOutput("fetch-depth", 0)
    core.setOutput("credentials", token)

    core.info(`Checking out to ${branch} branch.`)
    var _checkout = require("checkout/dist/index.js")

    core.info("Going to setup the GitHub credentials.")
    var _setupGitCredentials = require("setup-git-credentials/lib/main.js")

    core.info("Going to configure Git user details.")
    await exec_(`git config user.name "${username}"`)
    await exec(`git config user.email "${email}"`)

    core.info("Cherry pick commits from source repository.")
    await exec_(`git remote add ${REMOTE_REPOSITORY_TAG} https://github.com/${repository}`)
    await exec_(`git fetch ${REMOTE_REPOSITORY_TAG} --force`)
    await exec_(`git cherry-pick -x ${ github.context.payload.client_payload.before }..${ github.context.payload.client_payload.after }`)

    core.info(`Push updated ref to ${branch} branch`)
    await exec_(`git push --force`)

  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

import * as core from "@actions/core"
import * as github from "@actions/github"
import { exec } from "@actions/exec"

const REMOTE_REPOSITORY_TAG = "remote-repository"

async function run(): Promise<void> {
  try {
    var repository = core.getInput("repository")
    var path = core.getInput("path")

    core.info("Cherry pick commits from source repository.")
    await exec(`git remote add ${REMOTE_REPOSITORY_TAG} https://github.com/${repository}`)
    await exec(`git fetch ${REMOTE_REPOSITORY_TAG} --force`)
    await exec(`git cherry-pick -x ${ github.context.payload.client_payload.before }..${ github.context.payload.client_payload.after }`)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

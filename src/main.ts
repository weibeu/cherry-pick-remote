import * as core from "@actions/core"
import * as github from "@actions/github"
import { exec } from '@actions/exec'

const REMOTE_REPOSITORY_TAG = "remote-repository"

var repository = core.getInput("repository")
var branch = core.getInput("branch")
var path = core.getInput("path")
var token = core.getInput("token")
var username = core.getInput("username")
var email = core.getInput("email")

core.setOutput("ref", branch)
core.setOutput("fetch-depth", 0)
core.setOutput("credentials", token)

async function checkoutTargetBranch(): Promise<void> {
  if (github.context.payload.action !== "push-dispatch") {
    core.setFailed("Received GitHub event which is not push-dispatch.")
    return
  }
  try {
    core.info(`Checking out to ${branch} branch.`)
    var _checkout = require("checkout/dist/index.js")
  } catch(error) {
    core.setFailed(error.message)
  }
}

async function setCredentials(): Promise<void> {
  try {
    core.info("Going to setup the GitHub credentials.")
    var _setupGitCredentials = require("setup-git-credentials/lib/main.js")
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function configureUser(): Promise<void> {
  try {
    core.info("Going to configure Git user details.")
    await exec(`git config user.name "${username}"`)
    await exec(`git config user.email "${email}"`)
  } catch(error) {
    core.setFailed(error.message)
  }
}

async function cherryPick(): Promise<void> {
  try {
    core.info("Going to cherry pick commits from source repository.")
    await exec(`git remote add ${REMOTE_REPOSITORY_TAG} https://github.com/${repository}`)
    await exec(`git fetch ${REMOTE_REPOSITORY_TAG} --force`)
    await exec(`git cherry-pick -x ${ github.context.payload.client_payload.before }..${ github.context.payload.client_payload.after }`)
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function updateStream(): Promise<void> {
  try {
    core.info(`Going to push updated refs to ${branch} branch`)
    await exec(`git push --force`)
  } catch(error) {
    core.setFailed(error.message)
  }
}

const PROMISES = [checkoutTargetBranch, setCredentials, configureUser, cherryPick, updateStream];

PROMISES.reduce((p, f) => p.then(f), Promise.resolve()).then(() => {})

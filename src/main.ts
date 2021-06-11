import * as os from 'os';
import * as core from "@actions/core"
import * as github from "@actions/github"
import { promises as fs } from 'fs';
import { exec } from '@actions/exec'

const REMOTE_REPOSITORY_TAG = "remote-repository"

var repository = core.getInput("repository")
var branch = core.getInput("branch")
var path = core.getInput("path")
var token = core.getInput("token")
var username = core.getInput("username")
var email = core.getInput("email")

function xdg_config_home() {
	const xdg_config_home = process.env['XDG_CONFIG_HOME'];
	if (xdg_config_home) return xdg_config_home;
	return `${os.homedir()}/.config`
}

async function setCredentials(): Promise<void> {
  if (github.context.payload.action !== "push-dispatch") {
    core.setFailed("Received GitHub event which is not push-dispatch.")
    return
  }
  try {
    core.info("Going to setup the GitHub credentials.")
    const credentials = core.getInput('token', { required: true });

    await fs.mkdir(`${xdg_config_home()}/git`, { recursive: true });
    await fs.writeFile(`${xdg_config_home()}/git/credentials`, credentials, { flag: 'a', mode: 0o600 });

    await exec('git', ['config', '--global', 'credential.helper', 'store']);
    await exec('git', ['config', '--global', '--replace-all', 'url.https://github.com/.insteadOf', 'ssh://git@github.com/']);
    await exec('git', ['config', '--global', '--add', 'url.https://github.com/.insteadOf', 'git@github.com:']);
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function checkoutTargetBranch(): Promise<void> {
  try {
    core.info(`Checking out to ${branch} branch.`)
    await exec(`git clone ${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}`)
    await exec(`cd ${process.env["GITHUB_REPOSITORY"]?.split("/")[0]}`)
    await exec(`git checkout -b ${branch}`)
  } catch(error) {
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
    await exec(`git remote add ${REMOTE_REPOSITORY_TAG} ${process.env["GITHUB_SERVER_URL"]}/${repository}`)
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

setCredentials().then(() => checkoutTargetBranch().then(() => configureUser().then(() => cherryPick().then(() => updateStream().then(() => {}))))).then(() => {})

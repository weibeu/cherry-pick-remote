import { promises as fs } from "fs"
import { exec } from "@actions/exec"
import * as os from "os"
import * as core from "@actions/core"
import * as github from "@actions/github"
const minimatch = require("minimatch")

const REMOTE_REPOSITORY_TAG = "remote-repository"

function parsedJSONInput(inputString: string) {
  if (!inputString) {
    return undefined
  }
  return JSON.parse(inputString)
}

const repository = core.getInput("repository")
const branch = core.getInput("branch")
const remoteBranch = core.getInput("remote-branch")
const includedPaths = parsedJSONInput(core.getInput("include-paths"))
const excludedPaths = parsedJSONInput(core.getInput("exclude-paths"))
const credentials = core.getInput("credentials")
const username = core.getInput("username")
const email = core.getInput("email")

function xdg_config_home() {
	const xdg_config_home = process.env["XDG_CONFIG_HOME"]
	if (xdg_config_home) return xdg_config_home
	return `${os.homedir()}/.config`
}

function inAnyPaths(filename: string, wildcards: Array<string>): Boolean {
  if (!filename) {
    return false
  }
  for (let path of wildcards) {
    if (minimatch(filename, path)) {
      return true
    }
  }
  return false
}

async function execWithOutput(command: string): Promise<String> {
  var outputString = new String()
  var outputError = new String()
  await exec(command, undefined, {listeners: {
    stdout: (data: Buffer) => {
      outputString += data.toString()
    },
    stderr: (data: Buffer) => {
      outputError += data.toString()
    }
  }})
  return outputString
}

async function run(): Promise<void> {
  if (github.context.payload.action !== "push-dispatch") {
    core.setFailed("Received GitHub event which is not push-dispatch.")
    return
  }
  try {
    
    core.info("Going to setup the GitHub credentials.")
    await fs.mkdir(`${xdg_config_home()}/git`, { recursive: true })
    await fs.writeFile(`${xdg_config_home()}/git/credentials`, credentials, { flag: "a", mode: 0o600 })
    await exec("git", ["config", "--global", "credential.helper", "store"])
    await exec("git", ["config", "--global", "--replace-all", "url.https://github.com/.insteadOf", "ssh://git@github.com/"])
    await exec("git", ["config", "--global", "--add", "url.https://github.com/.insteadOf", "git@github.com:"])

    core.info(`Checking out to ${branch} branch.`)
    await exec(`git clone ${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}`)
    process.chdir(process.env["GITHUB_REPOSITORY"]?.split("/")[1] || String())
    await exec(`git checkout -b ${branch}`)

    core.info("Going to configure Git user details.")
    await exec(`git config user.name "${username}"`)
    await exec(`git config user.email "${email}"`)

    core.info("Going to cherry pick commits from source repository.")
    await exec(`git remote add ${REMOTE_REPOSITORY_TAG} ${process.env["GITHUB_SERVER_URL"]}/${repository}`)
    await exec(`git fetch ${REMOTE_REPOSITORY_TAG} --force`)

    var outputString = await execWithOutput(`git diff --name-only ${ github.context.payload.client_payload.before }..${ github.context.payload.client_payload.after }`)
    var includeFiles = new Array()
    for (let filename of outputString.split("\n")) {
      if (!filename) {
        continue
      }
      if (excludedPaths && inAnyPaths(filename, excludedPaths)) {
        continue
      }
      if (includedPaths && !inAnyPaths(filename, includedPaths)) {
        continue
      }
      includeFiles.push(filename)
    }

    if (!includeFiles) {
      core.setFailed("No files matched for cherry picking.")
      return
    }

    await exec(`git checkout ${REMOTE_REPOSITORY_TAG}/${remoteBranch}`)

    var includeCommitSHAs = new Array()
    for (let filename of includeFiles) {
      outputString = await execWithOutput(`git log -n 1 --pretty="%H" -- ${filename}`)
      includeCommitSHAs.push(outputString.trim())
    }

    await exec(`git checkout ${branch}`)
    await exec(`git pull origin ${branch}`)

    for (let commitSHA of includeCommitSHAs) {
      await exec(`git cherry-pick -x ${commitSHA}`)
    }

    core.info(`Going to push updated refs to ${branch} branch`)
    await exec(`git push --set-upstream origin ${branch}`)

  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

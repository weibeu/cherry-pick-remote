import * as github from "@actions/github"
import * as core from "@actions/core"
import { exec } from "@actions/exec"


async function run(): Promise<void> {
    if (github.context.payload.action !== "push-dispatch") {
        core.setFailed("Received GitHub event which is not push-dispatch.")
        return
    }
    try {
        var branch = core.getInput("branch")
        var token = core.getInput("token")
        var username = core.getInput("username")
        var email = core.getInput("email")

        core.setOutput("ref", branch)
        core.setOutput("fetch-depth", 0)
        core.setOutput("credentials", token)

        core.info(`Checking out to ${core.getInput("branch")} branch.`)
        var _checkout = require("checkout/dist/index.js")

        core.info("Going to setup the GitHub credentials.")
        var _setupGitCredentials = require("setup-git-credentials/lib/main.js")

        core.info("Going to configure Git user details.")
        await exec(`git config user.name "${username}"`)
        await exec(`git config user.email "${email}"`)
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()

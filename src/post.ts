import * as core from "@actions/core"
import { exec } from "@actions/exec"

async function run(): Promise<void> {
    var branch = core.getInput("branch")
    try {
        core.info(`Push updated ref to ${branch} branch`)
        await exec("git push --force")
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()

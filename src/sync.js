const program = require(`commander`)
const fs = require(`fs`)
const schedule = require(`node-schedule`)

const HAR = require(`./har`)

const showHelp = msg => {
  console.log(`${msg}\n`)
  program.outputHelp()
  process.exit(-1)
}

const parseArgs = program => {
  if (!program.config) {
    showHelp(
      `Provide a configuration file with --config. ` +
        `See config.json.example in the repo for a template.`
    )
  } else if (!fs.existsSync(program.config)) {
    showHelp(`Config file ${program.config} not found.`)
  }

  if (`testnet` !== program.network && `live` !== program.network) {
    showHelp(`Specify network 'live' or 'testnet' with --network.`)
  }

  return {
    configFile: program.config,
    network: program.network,
    exit: program.exit === true,
  }
}

program
  .option(
    `-c, --config [config.json]`,
    `Configuration - see config.json.example for a template`
  )
  .option(`-n, --network [live|testnet]`, `Network to ingest`)
  .option(
    `-e, --exit`,
    `Exit after syncing the latest files. ` +
      `By default the script will continue syncing indefinitely.`
  )
  .parse(process.argv)

const {configFile, network, exit} = parseArgs(program)

const config = JSON.parse(fs.readFileSync(configFile).toString())

const har = new HAR(
  config[network].harLocalPath,
  config[network].harRemotePath,
  config.archivistToolPath
)

const log = msg => console.log(`${new Date().toISOString()}: ${msg}`)

const syncOneTime = async () => {
  log(`Sync started ...`)
  const exitCode = await har.sync()
  log(`\nSync finished. exit: ${exitCode}\n`)
  return exitCode
}

;(async () => {
  // Run one time only if exit arg provided
  if (exit) {
    const exitCode = await syncOneTime()
    process.exit(exitCode)
  }

  // Setup a recurring schedule to continue syncing
  const scheduleMins = 5
  log(`Schedule recurring sync job to run every ${scheduleMins} minutes\n`)
  schedule.scheduleJob({rule: `* */${scheduleMins} * * * *`}, () =>
    syncOneTime().then(() => console.log(`done in job schedule too`))
  )
})()

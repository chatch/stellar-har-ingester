#!/usr/bin/env node
const program = require(`commander`)
const path = require(`path`)

const DB = require(`./db`)
const HAR = require(`./har`)

const defaultFileTypes = [
  HAR.fileTypes.ledger,
  HAR.fileTypes.transactions,
  HAR.fileTypes.results,
]

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
  }

  if (`testnet` !== program.network && `live` !== program.network) {
    showHelp(`Specify network 'live' or 'testnet' with --network.`)
  }

  if (program.single && program.range) {
    showHelp(
      `Specify either a single ledger (--single) OR a range (--range) but not both.`
    )
  }

  if (program.type && !HAR.fileTypes[program.type]) {
    showHelp(`File type [${program.type}] not supported.`)
  }

  const fileTypes = program.type ? [program.type] : defaultFileTypes

  const single = Number(single)
  if (program.single && single > 0 == false) {
    showHelp(`Single ledger argument must be a valid ledger sequence.`)
  }

  let range
  if (program.range) {
    const rangeRegex = /(\d*):(\d*)/
    const match = rangeRegex.exec(program.range)
    if (!match) {
      showHelp(`Failed to parse the range argument.`)
    }
    range = {from: Number(match[1]), to: Number(match[2])}
  }

  return {
    dryRun: program.dryrun === true,
    config: program.config,
    network: program.network,
    fileTypes,
    single,
    range,
  }
}

const init = ({config, network, fileTypes, single, range, dryRun}) => {
  const har = new HAR(
    config[network].harLocalPath,
    config[network].harRemotePath,
    config.archivistToolPath
  )

  let from
  let to
  if (single) {
    from = to = single
  } else {
    from = range.from
    to = range.to
  }

  return {
    har,
    dryRun,
    fileTypes,
    fromLedger: from,
    toLedger: to,
  }
}

program
  .option(
    `-c, --config [config.json]`,
    `Configuration - see config.json.example for a template`
  )
  .option(`-n, --network [live|testnet]`, `Network to ingest`)
  .option(`-s, --single [ledger number]`, `Import a single ledger`)
  .option(
    `-r, --range [from:to]`,
    `Import a range of ledgers in the form "from:to" (eg. "1:99999")`
  )
  .option(
    `-t, --type [type]`,
    `Ingest only the given type. By default ingest all (transactions, ledger, results)`
  )
  .option(`-d, --dryrun`, `Read files but don't insert into the database`)
  .parse(process.argv)

const args = parseArgs(program)
const {har, dryRun, fileTypes, fromLedger, toLedger} = init(args)

console.log(
  `Importing ${fromLedger} to ${toLedger} for types [${fileTypes}] ...\n`
)

const checkpoints = HAR.checkpointsForRange(fromLedger, toLedger)
console.log(`Checkpoint ledgers to ingest: ${checkpoints}`)

// split into batches to work around memory heap limit in node
const ledgersPerBatch = 2000
const ledgersPerCheckpoint = 64
const batchSize = ledgersPerBatch / ledgersPerCheckpoint

const checkpointChunks = []
while (checkpoints.length > 0) {
  checkpointChunks.push(checkpoints.splice(0, batchSize))
}

let db

const ingestLedgers = async ledgers => {
  console.log(`ingestLedgers: ${ledgers[0]} to ${ledgers[ledgers.length - 1]}`)

  if (!dryRun) {
    await db.txBegin()
  }

  return Promise.all(
    ledgers.map(checkpointLedger =>
      fileTypes.forEach(fileType => {
        const xdrFile = har.toHARFilePath(checkpointLedger, fileType)
        console.log(
          `reading from ${xdrFile
            .split(path.sep)
            .slice(-5)
            .join(path.sep)}`
        )

        const xdrType = HAR.fileTypeToXDRType[fileType]
        const recs = har.readRecordsFromXdrFile(xdrFile, xdrType)

        if (dryRun === true) {
          return
        }

        const storeFnName = `store${fileType[0].toUpperCase()}${fileType.substring(
          1
        )}Records`

        return db[storeFnName](recs).then(() =>
          console.log(`File for ${checkpointLedger}:${fileType} DONE`)
        )
      })
    )
  ).then(() => (db ? db.txCommit() : undefined))
}

const main = async () => {
  if (dryRun === false) {
    db = await DB.getInstance()
  }

  try {
    // TODO: run N batches in parallel at a time (for now run one at a time)
    for (const ledgerSeqArr of checkpointChunks) {
      await ingestLedgers(ledgerSeqArr)
    }
    console.log(`\nALL DONE\n`)
  } catch (err) {
    console.error(`Failure ingesting: ${err}`)
  } finally {
    if (db) db.close()
  }
}

main()

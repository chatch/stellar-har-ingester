const program = require(`commander`)
const path = require(`path`)
const Promise = require(`bluebird`)

const DB = require(`./db`)
const HAR = require(`./har`)

program
  .option(`-s, --single [ledger]`, `Import a single ledger`)
  .option(
    `-r, --range [range]`,
    `Import a range of ledgers in the form "from:to" (eg. "1:99999")`
  )
  .option(
    `-t, --type [type]`,
    `Ingest only the given type (transactions, ledger, results)`
  )
  .option(`-d, --dryrun`, `Read files but don't insert into the database`)
  .parse(process.argv)

if (!program.single && !program.range) {
  program.outputHelp()
  process.exit(-1)
}

let fileTypes
if (program.type) {
  if (!HAR.fileTypes[program.type]) {
    console.log(`File type [${program.type}] not supported`)
    program.outputHelp()
    process.exit(-1)
  }
  fileTypes = [program.type]
} else {
  fileTypes = [
    HAR.fileTypes.ledger,
    HAR.fileTypes.transactions,
    HAR.fileTypes.results,
  ]
}

let fromLedger
let toLedger

if (program.single) {
  fromLedger = toLedger = Number(program.single)
} else {
  const rangeRegex = /(\d*):(\d*)/
  const match = rangeRegex.exec(program.range)
  if (!match) {
    program.outputHelp()
    process.exit(-1)
  }

  fromLedger = Number(match[1])
  toLedger = Number(match[2])
}

console.log(
  `Importing ${fromLedger} to ${toLedger} for types [${fileTypes}] ...\n`
)

const dryRun = program.dryrun === true

const checkpoints = HAR.checkpointsForRange(fromLedger, toLedger)
console.log(`Checkpoint ledgers to ingest: ${checkpoints}`)

// split into batches to work around memory heap limit in node
const ledgersPerBatch = 50000
const ledgersPerCheckpoint = 64
const batchSize = ledgersPerBatch / ledgersPerCheckpoint

const checkpointChunks = []
while (checkpoints.length > 0) {
  checkpointChunks.push(checkpoints.splice(0, batchSize))
}

let db

const har = new HAR()

const ingestLedgers = ledgers => {
  console.log(`ingestLedgers: ${ledgers[0]} to ${ledgers[ledgers.length - 1]}`)

  return db
    .txBegin()
    .then(() =>
      Promise.all(
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

            if (dryRun) {
              return Promise.resolve()
            }

            const storeFnName = `store${fileType[0].toUpperCase()}${fileType.substring(
              1
            )}Records`

            return db[storeFnName](recs).then(() =>
              console.log(`File for ${checkpointLedger} DONE`)
            )
          })
        )
      )
    )
    .then(() => db.txCommit())
}

const main = () =>
  DB.getInstance()
    .then(dbInst => (db = dbInst))
    .then(() => Promise.each(checkpointChunks, ingestLedgers))
    .then(() => console.log(`\nALL DONE\n`))
    .catch(err => console.error(err))
    .finally(() => db.close())

main()

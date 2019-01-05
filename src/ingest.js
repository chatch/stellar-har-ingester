const program = require(`commander`)

const DB = require(`./db`)
const HAR = require(`./har`)

program
  .option(`-s, --single [ledger]`, `Import a single ledger`)
  .option(
    `-r, --range [range]`,
    `Import a range of ledgers in the form "from:to" (eg. "1:99999")`
  )
  .option(`-d, --dryrun`, `Read files but don't insert into the database`)
  .parse(process.argv)

if (!program.single && !program.range) {
  program.outputHelp()
  process.exit(-1)
}

let fromLedger
let toLedger

if (program.single) {
  fromLedger = toLedger = program.single
} else {
  const rangeRegex = /(\d*):(\d*)/
  const match = rangeRegex.exec(program.range)
  if (!match) {
    program.outputHelp()
    process.exit(-1)
  }

  fromLedger = Number(match[1])
  toLedger = Number(match[2])

  console.log(`Importing ${fromLedger} to ${toLedger} ...\n`)
}

const dryRun = program.dryrun === true

const xdrType = `TransactionHistoryEntry`
const checkpoints = HAR.checkpointsForRange(fromLedger, toLedger)
console.log(`Checkpoint ledgers to ingest: ${checkpoints}`)

const har = new HAR()

const main = async () => {
  const db = await DB.getInstance()
  return Promise.all(
    checkpoints.map(checkpointLedger => {
      const xdrFile = har.toHARFilePath(checkpointLedger)
      console.log(`reading from ${xdrFile}`)
      const recs = har.readRecordsFromXdrFile(xdrFile, xdrType)
      if (!dryRun) {
        return db.storeRecords(recs).then(() => console.log(`\nFile DONE`))
      }
    })
  ).then(() => db.close())
}

main().then(() => console.log(`\nALL DONE\n`))

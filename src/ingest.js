const program = require('commander')

const config = require('./config')
const DB = require('./db')
const {readRecordsFromXdrFile} = require('./har')

const DATA_DIR = config.harRootDir
const xdrType = 'TransactionHistoryEntry'
const xdrFile = `${DATA_DIR}/transactions-000e007f.xdr`

program
  .option('-s, --single [ledger]', 'Import a single ledger')
  .option(
    '-r, --range [range]',
    'Import a range of ledgers in the form "from:to" (eg. "1:99999")'
  )
  .parse(process.argv)

if (!program.single && !program.range) {
  program.outputHelp()
  process.exit(-1)
}

if (program.single) {
  console.log('single ledger import not yet implemented')
  process.exit(-1)
}

const rangeRegex = /(\d*):(\d*)/
const match = rangeRegex.exec(program.range)
if (!match) {
  program.outputHelp()
  process.exit(-1)
}

const fromLedger = match[1]
const toLedger = match[2]
console.log(`importing $${fromLedger} to ${toLedger}`)

const recs = readRecordsFromXdrFile(xdrFile, xdrType)

const db = DB.getInstance()
db.storeRecords(recs).then(() => {
  console.log('DONE')
  db.close()
})

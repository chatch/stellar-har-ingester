const {Client} = require(`pg`)

const config = require(`../config`)

const storeRecords = (dbClient, table, records) =>
  Promise.all(
    records.map(record =>
      dbClient.query(
        `INSERT INTO ${table} (ledger_sequence, data) VALUES ($1, $2)`,
        [record.ledgerSeq, record]
      )
    )
  ).catch(err => {
    console.error(
      `storeRecords(${table}) failure: (ledgers: ${records[0].ledgerSeq}:${
        records[records.length - 1].ledgerSeq
      }): ${err}: ${err.stack}`
    )
  })

class DB {
  /**
   * Get a new connected DB instance.
   * @return Promise<DB>
   */
  static getInstance() {
    const db = new DB()
    return db.init().then(() => db)
  }

  init() {
    this.dbClient = new Client(config.db)
    return this.dbClient
      .connect()
      .then(() => console.log(`\nDB connected!\n`))
      .catch(err => console.error(`DB connection error`, err.stack))
  }

  close() {
    return this.dbClient.end()
  }

  txBegin() {
    return this.dbClient.query(`BEGIN`)
  }

  txCommit() {
    return this.dbClient.query(`COMMIT`)
  }

  txRollback() {
    return this.dbClient.query(`ROLLBACK`)
  }

  storeTransactionsRecords(records) {
    return storeRecords(this.dbClient, `transactions`, records)
  }

  storeLedgerRecords(records) {
    return storeRecords(this.dbClient, `ledger`, records)
  }

  storeResultsRecords(records) {
    return storeRecords(this.dbClient, `results`, records)
  }
}

module.exports = DB

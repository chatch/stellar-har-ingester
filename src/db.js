const {Client} = require(`pg`)

const config = require(`../config`)

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
    this.dbClient.end()
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
    return Promise.all(
      records.map(record =>
        this.dbClient.query(
          `INSERT INTO transactions (ledger_sequence, data) VALUES ($1, $2)`,
          [record.ledgerSeq, record]
        )
      )
    ).catch(err => {
      console.error(
        `storeTransactionsRecords failure (ledgers: ${records[0].ledgerSeq}:${
          records[records.length - 1].ledgerSeq
        }): ${err}: ${err.stack}`
      )
    })
  }

  storeLedgerRecords(records) {
    return Promise.all(
      records.map(record =>
        this.dbClient.query(
          `INSERT INTO ledger (ledger_sequence, data) VALUES ($1, $2)`,
          [record.ledgerSeq, record]
        )
      )
    ).catch(err => {
      console.error(`storeLedgerRecords failure: ${err}`)
    })
  }
}

module.exports = DB

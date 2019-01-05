const {Client} = require(`pg`)

const config = require(`./config`)

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

  storeRecords(records) {
    return Promise.all(
      records.map(record =>
        this.dbClient.query(
          `INSERT INTO transactions (ledger_sequence, data) VALUES ($1, $2)`,
          [record[`_attributes`].ledgerSeq, record]
        )
      )
    ).catch(err => {
      console.error(`storeRecords failure: ${err}`)
    })
  }
}

module.exports = DB

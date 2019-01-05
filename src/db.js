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

  async storeRecords(records) {
    return Promise.all(
      records.map(record => {
        const seq = record[`_attributes`].ledgerSeq
        console.log(`Inserting ${seq}`)
        return this.dbClient
          .query(
            `INSERT INTO transactions (ledger_sequence, data) VALUES ($1, $2)`,
            [record[`_attributes`].ledgerSeq, record]
          )
          .then(() => {}) // console.log(`RES: ${JSON.stringify(res, null, 2)}`))
          .catch(err => console.error(`${seq} failed: ${err}`))
      })
    )
  }
}

module.exports = DB

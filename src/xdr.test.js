const path = require(`path`)

const HAR = require(`./har`)
const {xdrFileToBuffer, xdrToObject} = require(`./xdr`)

const TEST_DATA_ROOT = path.join(process.cwd(), `src`, `__data__`)
const har = new HAR(TEST_DATA_ROOT)

describe(`xdrToObject`, () => {
  test(`transactions`, () => {
    // Test the 1st record which is LEDGER 21833152 from MAINNET
    const buffer = xdrFileToBuffer(
      har.toHARFilePath(21833215, HAR.fileTypes.transactions)
    )

    const recSize = buffer.readUInt32BE() & 0x7fffffff
    const recordBuffer = buffer.readBuffer(recSize)

    const records = xdrToObject(
      recordBuffer,
      HAR.fileTypeToXDRType.transactions
    )
    //  console.log(JSON.stringify(records, null, 2))
    expect(JSON.stringify(records, null, 2)).toMatchSnapshot()
  })

  test(`ledger`, () => {
    // Test the 1st record which is LEDGER ??? 1048575? from TESTNET
    const buffer = xdrFileToBuffer(
      har.toHARFilePath(1048575, HAR.fileTypes.ledger)
    )

    const recSize = buffer.readUInt32BE() & 0x7fffffff
    const recordBuffer = buffer.readBuffer(recSize)

    const records = xdrToObject(recordBuffer, HAR.fileTypeToXDRType.ledger)
    //  console.log(JSON.stringify(records, null, 2))
    expect(JSON.stringify(records, null, 2)).toMatchSnapshot()
  })

  test(`results`, () => {
    const buffer = xdrFileToBuffer(
      har.toHARFilePath(21833215, HAR.fileTypes.results)
    )

    const recSize = buffer.readUInt32BE() & 0x7fffffff
    const recordBuffer = buffer.readBuffer(recSize)

    const records = xdrToObject(recordBuffer, HAR.fileTypeToXDRType.results)
    //  console.log(JSON.stringify(records, null, 2))
    expect(JSON.stringify(records, null, 2)).toMatchSnapshot()
  })
})

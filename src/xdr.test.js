const path = require(`path`)

const HAR = require(`./har`)
const {ed25519ToPublicKey, xdrFileToBuffer, xdrToObject} = require(`./xdr`)

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
})

test(`ed25519ToPublicKey`, () => {
  expect(
    ed25519ToPublicKey({
      _arm: `ed25519`,
      _value: {
        data: [
          154,
          255,
          164,
          158,
          84,
          122,
          37,
          29,
          149,
          169,
          103,
          148,
          210,
          79,
          248,
          22,
          11,
          217,
          254,
          212,
          149,
          228,
          49,
          24,
          226,
          11,
          180,
          136,
          228,
          202,
          130,
          149,
        ],
        type: `Buffer`,
      },
    })
  ).toEqual(`GCNP7JE6KR5CKHMVVFTZJUSP7ALAXWP62SK6IMIY4IF3JCHEZKBJKDZF`)
})

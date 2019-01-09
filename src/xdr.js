const {readFileSync} = require(`fs`)
const {gunzipSync} = require(`zlib`)

const SmartBuffer = require(`smart-buffer`).SmartBuffer
const {xdr, Operation, StrKey} = require(`stellar-base`)

/**
 * For a given .xdr.gz file this will return an input Buffer to the
 * raw XDR binary.
 * @param {string} xdrFile Absolute filepath to the .xdr.gz file
 * @return {SmartBuffer} Buffer to read bytes from the file
 */
const xdrFileToBuffer = xdrFile => {
  const xdrZipBuffer = readFileSync(xdrFile)
  const xdrBuffer = gunzipSync(xdrZipBuffer)
  return SmartBuffer.fromBuffer(xdrBuffer)
}

/**
 * For a given Buffer and XDR record type this will parse the raw bytes
 * to an XDR record.
 * @param {SmartBuffer} buffer A buffer to the XDR bytes.
 * @param {string} xdrType XDR type to expect and parse.
 * @return {object} Matching object for the XDR record.
 */
const xdrToObject = (buffer, xdrType) => {
  let record

  try {
    record = xdr[xdrType].fromXDR(buffer, `raw`)
  } catch (error) {
    console.error(error)
    throw new Error(`Input XDR could not be parsed`)
  }

  if (xdrType === `TransactionHistoryEntry`) {
    record = fromXDRTransactions(record)
  } else if (xdrType === `LedgerHeaderHistoryEntry`) {
    record = fromXDRLedger(record)
  } else if (xdrType === `TransactionHistoryResultEntry`) {
    record = fromXDRResults(record)
  }

  return record
}

/**
 * Walk through the list of transactions and the list of operations inside
 * each transactions record for a ledger and convert to readable/queryable types.
 *
 * @param {object} obj The root of a single ledger record from a transactions XDR file
 * @return {object} Same object with types converted.
 */
const fromXDRTransactions = obj => {
  const rec = {}

  rec.ledgerSeq = obj.ledgerSeq()

  const txSet = obj.txSet()
  rec.previousLedgerHash = txSet.previousLedgerHash().toString(`hex`)

  rec.transactions = []
  obj
    .txSet()
    .txes()
    .forEach(txObj => {
      const tx = txObj.tx()
      const txRec = {}

      txRec.fee = tx.fee()
      txRec.seqNum = tx.seqNum().toString()
      txRec.sourceAccount = StrKey.encodeEd25519PublicKey(
        tx.sourceAccount().value()
      )

      txRec.memo = memoXDRToTypeValueObject(tx.memo())
      if (txRec.memo.type === `memoNone`) delete txRec.memo

      txRec.operations = []
      tx.operations().forEach(opObj => {
        txRec.operations.push(Operation.fromXDRObject(opObj))
      })

      rec.transactions.push(txRec)
    })

  return rec
}

/**
 * Transform a record from a XDR Ledger file and convert to readable/queryable types.
 *
 * @param {object} obj The root of a single ledger record from a ledger XDR file
 * @return {object} Same object with types converted.
 */
const fromXDRLedger = obj => {
  const header = obj.header()

  const rec = {}

  rec.ledgerSeq = header.ledgerSeq()
  rec.hash = obj.hash().toString(`hex`)
  rec.baseFee = header.baseFee()
  rec.baseReserve = header.baseReserve()
  rec.maxTxSetSize = header.maxTxSetSize()
  rec.ledgerVersion = header.ledgerVersion()
  ;[`feePool`, `idPool`, `totalCoins`].forEach(
    key => (rec[key] = header[key]().toString())
  )
  rec.txSetResultHash = header.txSetResultHash().toString(`hex`)
  rec.closeTime = Number(
    header
      .scpValue()
      .closeTime()
      .toString()
  )

  return rec
}

/**
 * Transform a record from a XDR Transaction Results file and convert to readable/queryable types.
 *
 * @param {object} obj The root of a single ledger record from a results XDR file
 * @return {object} Same object with types converted.
 */
const fromXDRResults = obj => {
  const rec = {}

  rec.ledgerSeq = obj.ledgerSeq()

  const results = []
  const resultsArr = obj.txResultSet().results()

  resultsArr.forEach(txResultRoot => {
    const txResult = {}
    txResult.hash = txResultRoot.transactionHash().toString(`hex`)
    txResult.feeCharged = Number(
      txResultRoot
        .result()
        .feeCharged()
        .toString()
    )

    const txResultInner = txResultRoot.result().result()
    txResult.result = {
      name: txResultInner.switch().name,
      code: txResultInner.switch().value,
    }

    const txResultInnerValue = txResultInner.value()
    if (txResultInnerValue) {
      txResult.operations = []
      txResultInnerValue.forEach(opRoot => {
        const op = {}
        const opRec = opRoot.value()
        if (opRec) {
          op.type = {name: opRec.switch().name, code: opRec.switch().value}

          const opRes = opRec.value()
          op.result = {
            name: opRes.switch().name,
            code: opRes.switch().value,
            // TODO: add various result params - values depend on optype ..
            // value: opRes.value()
          }
        }
        txResult.operations.push(op)
      })
    }

    results.push(txResult)
  })
  rec.results = results

  return rec
}

/**
 * Takes the XDR object for a memo and returns a simple object with type and value properties.
 */
const memoXDRToTypeValueObject = obj => {
  const type = obj.switch().name
  let value
  if (type === `memoHash`) value = obj.value().toString(`hex`)
  else if (type === `memoText`) value = obj.value().toString()
  else value = obj.value()
  return {type, value}
}

module.exports = {
  xdrFileToBuffer,
  xdrToObject,
}

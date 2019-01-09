const path = require(`path`)
const {padStart} = require(`lodash`)

const {xdrFileToBuffer, xdrToObject} = require(`./xdr`)

const isEndOfBufferError = error =>
  error.message && error.message.indexOf(`beyond the bounds`) !== -1

const readRecord = inBuffer => {
  let recordBuffer = null
  try {
    const recSize = inBuffer.readUInt32BE() & 0x7fffffff
    recordBuffer = inBuffer.readBuffer(recSize)
  } catch (error) {
    if (isEndOfBufferError(error)) {
      return null
    } else {
      throw error
    }
  }
  return recordBuffer
}

class HAR {
  constructor(harRootDir) {
    this.rootDir = harRootDir
  }

  static toLedgerHex(ledgerNum) {
    return padStart(Number(ledgerNum).toString(16), 8, `0`)
  }

  /**
   * History files are stored at ledger numbers 1 less than multiples of 64.
   * @see here for details: https://github.com/stellar/stellar-core/blob/master/docs/history.md
   *
   * This routine determines the ledger number of the checkpoint file that
   * details of the given ledgerNum are in.
   *
   * @param ledgerNum Ledger to look up.
   * @return Matching checkpoint ledger.
   */
  static toCheckpoint(ledgerNum) {
    return Math.floor(ledgerNum / 64 + 1) * 64 - 1
  }

  /**
   * Return a list of checkpoint ledger hashes for a given range of ledgers to process.
   * @param fromLedger Range start
   * @param toLedger Range end
   * @return List of checkpoint ledger hashes.
   */
  static checkpointsForRange(fromLedger, toLedger) {
    const checkpointHashes = []

    for (let seq = fromLedger; seq < toLedger; seq += 64) {
      checkpointHashes.push(HAR.toCheckpoint(seq))
    }

    // add for toLedger if it wasn't added before loop termination
    if (
      HAR.toCheckpoint(toLedger) !==
      checkpointHashes[checkpointHashes.length - 1]
    ) {
      checkpointHashes.push(HAR.toCheckpoint(toLedger))
    }

    return checkpointHashes
  }

  toHARFilePath(ledgerNum, fileType) {
    const ledgerHex = HAR.toLedgerHex(ledgerNum)
    return path.join(
      this.rootDir,
      fileType,
      ledgerHex.slice(0, 2),
      ledgerHex.slice(2, 4),
      ledgerHex.slice(4, 6),
      `${fileType}-${ledgerHex}.xdr.gz`
    )
  }

  readRecordsFromXdrFile(xdrFile, xdrType) {
    const records = []

    const inBuffer = xdrFileToBuffer(xdrFile)
    let finished = false

    while (!finished) {
      const recordBuffer = readRecord(inBuffer)
      if (recordBuffer === null) {
        finished = true
        continue
      }
      records.push(xdrToObject(recordBuffer, xdrType))
    }

    return records
  }
}

HAR.fileTypes = Object.freeze({
  bucket: `bucket`,
  ledger: `ledger`,
  transactions: `transactions`,
  results: `results`,
  scp: `scp`,
})

HAR.fileTypeToXDRType = Object.freeze({
  bucket: `BucketEntry`,
  ledger: `LedgerHeaderHistoryEntry`,
  transactions: `TransactionHistoryEntry`,
  results: `TransactionHistoryResultEntry`,
  scp: `ScpHistoryEntry`,
})

module.exports = HAR

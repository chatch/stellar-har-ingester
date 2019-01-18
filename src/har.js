const fs = require(`fs`)
const childProcess = require(`child_process`)
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

/**
 * Show the status for an archive at a given path.
 *
 * Status is just the ledger sequence number of the latest ledger in the archive.
 *
 * @param {string} archivistPath Path to the stellar-archivist tool
 * @param {string} harPath Archive path - either local (eg. file://har-files)
 *                          or remote (eg. http://some.s3.bucket)
 * @return {number} Latest ledger sequence for the archive.
 */
const archiveStatus = (archivistPath, harPath) => {
  const cmdOutStr = childProcess
    .execFileSync(archivistPath, [`status`, harPath])
    .toString()
  const ledgerRE = /.*CurrentLedger: (\d*) /
  const match = ledgerRE.exec(cmdOutStr)
  return Number(match[1])
}

/**
 * Synchronize local archive with the remote archive downloading any newer files.
 *
 * @param {string} archivistPath Path to the stellar-archivist tool
 * @param {string} harLocalPath Local archive path (eg. file://har-files)
 * @param {string} harRemotePath Remote archive path (eg. http://some.s3.bucket)
 * @param {string} fromLedger Ledger to start syncing from
 * @return {boolean} Success - true|false
 */
const archiveSync = async (
  archivistPath,
  harLocalPath,
  harRemotePath,
  fromLedger
) => {
  if (!fs.existsSync(archivistPath)) {
    throw new Error(`stellar-archivist not at given path: ${archivistPath}`)
  }

  const child = childProcess.spawn(archivistPath, [
    `--low`,
    fromLedger,
    `mirror`,
    harRemotePath,
    `file://${harLocalPath}`,
  ])

  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)

  return new Promise(resolve => {
    child.on(`exit`, function(code, signal) {
      console.log(
        `\nstellar-archivist process exited with ` +
          `code ${code} and signal ${signal}\n`
      )
      resolve(code)
    })
  })
}

class HAR {
  constructor(harLocalPath, harRemotePath, archivistToolPath) {
    this.harLocalPath = harLocalPath
    this.harRemotePath = harRemotePath
    this.archivist = archivistToolPath
  }

  static toLedgerHex(ledgerNum) {
    return padStart(Number(ledgerNum).toString(16), 8, `0`)
  }

  /**
   * History files are stored at ledger numbers 1 less than multiples of 64.
   * @see details: https://github.com/stellar/stellar-core/blob/master/docs/history.md
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

  statusLocal() {
    return archiveStatus(this.archivist, `file://${this.harLocalPath}`)
  }

  statusRemote() {
    return archiveStatus(this.archivist, this.harRemotePath)
  }

  /**
   * Sync local archive with the remote archive
   * @returns {boolean} Success - true|false
   */
  sync() {
    const fromLedger = this.statusLocal()
    return archiveSync(
      this.archivist,
      this.harLocalPath,
      this.harRemotePath,
      fromLedger
    )
  }

  toHARFilePath(ledgerNum, fileType) {
    const ledgerHex = HAR.toLedgerHex(ledgerNum)
    return path.join(
      this.harLocalPath,
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

const path = require(`path`)
const HAR = require(`./har`)

const TEST_DATA_ROOT = path.join(process.cwd(), `src`, `__data__`)

test(`toLedgerHex`, () => {
  expect(HAR.toLedgerHex(0)).toEqual(`00000000`)
  expect(HAR.toLedgerHex(1)).toEqual(`00000001`)
  expect(HAR.toLedgerHex(1000000)).toEqual(`000f4240`)
  expect(HAR.toLedgerHex(4294967295)).toEqual(`ffffffff`)
})

test(`toCheckpoint`, () => {
  expect(HAR.toCheckpoint(1)).toEqual(63)
  expect(HAR.toCheckpoint(63)).toEqual(63)
  expect(HAR.toCheckpoint(64)).toEqual(127)
  expect(HAR.toCheckpoint(127)).toEqual(127)
  expect(HAR.toCheckpoint(128)).toEqual(191)
  expect(HAR.toCheckpoint(200000000)).toEqual(200000063)
})

test(`checkpointsForRange`, () => {
  expect(HAR.checkpointsForRange(1, 63)).toEqual([63])
  expect(HAR.checkpointsForRange(1, 64)).toEqual([63, 127])
  expect(HAR.checkpointsForRange(1, 128)).toEqual([63, 127, 191])
  expect(HAR.checkpointsForRange(1, 150)).toEqual([63, 127, 191])

  const rangeTo1000 = HAR.checkpointsForRange(1, 1000)
  expect(rangeTo1000.length).toEqual(16)
  expect(rangeTo1000[0]).toEqual(63)
  expect(rangeTo1000[rangeTo1000.length - 1]).toEqual(1023)
})

test(`toHARFilePath`, () => {
  const har = new HAR(`/tmp`)
  expect(har.toHARFilePath(1000000)).toEqual(
    `/tmp/transactions/00/0f/42/transactions-000f4240.xdr.gz`
  )
})

test(`readRecordsFromXdrFile`, () => {
  const har = new HAR(TEST_DATA_ROOT)
  const file = har.toHARFilePath(917567)
  const records = har.readRecordsFromXdrFile(file, `TransactionHistoryEntry`)
  expect(records.length).toEqual(64)
})

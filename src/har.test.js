const path = require('path')
const HAR = require('./har')

const TEST_DATA_ROOT = path.join(process.cwd(), 'src', '__data__')

test('toLedgerHex', () => {
  expect(HAR.toLedgerHex(0)).toEqual('00000000')
  expect(HAR.toLedgerHex(1)).toEqual('00000001')
  expect(HAR.toLedgerHex(1000000)).toEqual('000f4240')
  expect(HAR.toLedgerHex(4294967295)).toEqual('ffffffff')
})

test('toHARFilePath', () => {
  const har = new HAR('/tmp')
  expect(har.toHARFilePath(1000000)).toEqual(
    '/tmp/transactions/00/0f/42/transactions-000f4240.xdr.gz'
  )
})

test('readRecordsFromXdrFile', () => {
  const har = new HAR(TEST_DATA_ROOT)
  const file = har.toHARFilePath(917567)
  const records = har.readRecordsFromXdrFile(file, 'TransactionHistoryEntry')
  expect(records.length).toEqual(64)
})

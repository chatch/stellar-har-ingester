const {readFileSync} = require(`fs`)
const {gunzipSync} = require(`zlib`)

const SmartBuffer = require(`smart-buffer`).SmartBuffer
const {xdr, StrKey} = require(`stellar-base`)

const ASSET_CODE_TYPES = [`assetCode`, `assetCode4`, `assetCode12`]
const AMOUNT_TYPES = [
  `amount`,
  `startingBalance`,
  `sendMax`,
  `destAmount`,
  `limit`,
]
const HEX_HASH_TYPES = [`hash`, `previousLedgerHash`, `txSetHash`]

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

  record = convertRawTypes(record)

  return record
}

/**
 * Walk through the object converting raw types like Buffer dumps to readable/queryable types.
 *
 * @param {object} obj The XDR object record
 * @return {object} Same object with raw types converted.
 */
const convertRawTypes = obj => {
  if (obj.hasOwnProperty(`_attributes`)) {
    collapseIntermediaryKey(obj)
  }

  if (obj._arm === `ed25519`) {
    return ed25519ToPublicKey(obj)
  }

  if (ASSET_CODE_TYPES.indexOf(obj._arm) !== -1) {
    return assetCodeToString(obj)
  }

  AMOUNT_TYPES.forEach(key => {
    if (obj.hasOwnProperty(key)) {
      // store as string for now - can convert this to long on postgres import? perf impact of CAST() in SQL?
      // an alternative is to use BigNumber.js here too ...
      obj[key] = obj[key].toString()
    }
  })

  HEX_HASH_TYPES.forEach(key => {
    if (obj.hasOwnProperty(key)) {
      obj[key] = obj[key].toString(`hex`)
    }
  })

  if (obj.hasOwnProperty(`signature`)) {
    obj.signature = obj.signature.toString(`base64`)
  }

  if (obj.hasOwnProperty(`memo`) && typeof obj.memo.switch === `function`) {
    const type = obj.memo.switch().name
    const value = obj.memo.value()
    if (value) {
      obj.memo = {type, value: value.toString()}
    } else {
      delete obj.memo // remove memoNone's completely
    }
  }

  Object.keys(obj).forEach(k => {
    if (typeof obj[k] === `object`) {
      obj[k] = convertRawTypes(obj[k])
    }
  })

  return obj
}

/**
 * Converts an ed25519 Buffer record to a Stellar public key string.
 */
const ed25519ToPublicKey = obj => {
  return StrKey.encodeEd25519PublicKey(
    Array.isArray(obj._value.data) ? obj._value.data : obj._value
  )
}

/**
 * Collapses out an unwanted intermediary properties.
 *
 * eg. You have {a:{_props:{c: 1}}} but you want {a:{c:1}}.
 */
const collapseIntermediaryKey = obj => {
  Object.assign(obj, obj._attributes)
  delete obj._attributes
  return obj
}

/**
 * Converts an assetCode[4|12] record to a string
 */
const assetCodeToString = obj => {
  return obj._value.toString().replace(`\u0000`, ``)
}

module.exports = {
  ed25519ToPublicKey,
  collapseIntermediaryKey,
  convertRawTypes,
  xdrFileToBuffer,
  xdrToObject,
}

const winston = require('winston')
const blindSigs = require('blind-signatures')
const fs = require('fs').promises

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}

let govKey
async function loadKeys (cb) {
  logger.info('started loging the pub key')
  const keyText = await fs.readFile('./pub.pem')
  const pubKey = blindSigs.keyGeneration()
  govKey = pubKey.importKey(keyText, 'pkcs1-public-pem')
  logger.info('loaded the public key')
  logger.info(`N: ${govKey.keyPair.n}`)
  logger.info(`E: ${govKey.keyPair.e}`)
  cb()
}
// generate keys
// const PUB_KEY = govKey.exportKey('pkcs1-public-pem')
// const PRIV_KEY = govKey.exportKey('pkcs1-private-pem')
// // write to the file system
// fs.writeFile('pub.pem',PUB_KEY)
// .then(sucess => {
//   log.info('Successfully wrote public key to the file')
// })
// .catch(reason => {
//   log.error("Problem writing public keys to the file")
// })
// fs.writeFile('priv.pem',PRIV_KEY)
// .then(sucess => {
//   log.info('Successfully wrote private key to the file')
// })
// .catch(reason => {
//   log.error("Problem writing private key to the file")
// })

module.exports = {
  logger: logger,
  GovKey: govKey,
  loadKeys: loadKeys
}

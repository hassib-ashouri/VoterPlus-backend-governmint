'use strict'
// logger setup
const winston = require('winston')
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
if (process.env.NODE_ENV !== 'production')
{
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}
const blindSigs = require('blind-signatures')
const fs = require('fs').promises
// load env vars
const envVars = require('dotenv').config()
if (envVars.error)
{
  throw envVars.error
}
else
{
  logger.info('Loaded env variables', envVars.parsed)
}
// Express server setup
const PORT = process.env.PORT || 4000
const listenOn = process.env.ON || 'localhost'
const cors = require('cors')
const bodyParser = require('body-parser')
const app = require('express')()
// json body parsing
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cors())
// http server
const http = require('http')
const server = http.createServer(app)

// Socket.io setup
const io = require('socket.io')(server, {
  pingInterval: 10000,
  pingTimeout: 100000,
  cookie: false
})
// DB Setup
const mongoClient = require('mongodb').MongoClient
const DB_URL = process.env.DB_URL
const mysql = require('mysql2')

// initialization funcitons
const InitializeApp = require('./server')
const InitializeDB = require('./db')

async function loadKeys (cb)
{
  logger.info('started loading the pub key')
  const keyText = await fs.readFile('./priv.pem')
  const pubKey = blindSigs.keyGeneration()
  const govKey = pubKey.importKey(keyText, 'pkcs1-private-pem')
  logger.info('loaded the public key')
  logger.info(`N: ${govKey.keyPair.n}`)
  logger.info(`E: ${govKey.keyPair.e}`)
  cb(govKey)
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

loadKeys(async (govKeys) =>
{
  const pool = mysql.createPool({
    host: process.env.MYSQL_URL,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })
  // mongo db collection name
  const dbName = 'VoterPlus'
  const con = await mongoClient.connect(DB_URL, { useUnifiedTopology: true })
  const db = con.db(dbName)
  const DbModule = InitializeDB({ pool, db, log: logger })
  const initializedApp = InitializeApp({ app, db: DbModule, keys: govKeys, io, log: logger })
  server.listen(PORT, listenOn, () => logger.info(`listening on http://${listenOn}:${PORT}`))
})

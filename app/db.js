const log = require('./config').logger
const mongoClient = require('mongodb').MongoClient
const mysql = require('mysql2')
const pool = mysql.createPool({
  host: process.env.MYSQL_URL,
  user: process.env.MYSQL_USER,
  database: process.env.MYSQL_DB,
  password: process.env.MYSQL_PASS,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})
const DB_URL = process.env.DB_URL
// test mysql db
pool.query('show tables;', [], (err, rows, fields) => {
  if (err) {
    log.error('Problem Connecting to mysql', err)
  } else {
    log.info('Connected mysql successfully.')
  }
})

async function dbExecuter (op, dbName = 'VoterPlus') {
  let con
  try {
    con = await mongoClient.connect(DB_URL, { useUnifiedTopology: true })
    const DB = con.db(dbName)
    await op(DB)
  } catch (error) {
    log.error(error)
  } finally {
    con.close()
  }
}

async function insertTestDocument (document) {
  try {
    const db = await mongoClient.connect(DB_URL, { useUnifiedTopology: true })
    await db.collection('test collection').insertOne({ message: 'hello', args: document })
    await db.close()
  } catch (error) {
    console.error(error)
  }
}

function saveBlindVoteHashes (ssn, issue, hashes) {
  return new Promise((resolve, reject) => {
    dbExecuter(async (db) => {
      try {
        await db.collection('VoteHashes').insertOne({ ssn, issue, hashes })
        // resolve the top function and low at the same time.
        return resolve()
      } catch (error) {
        log.error(`Problem while inserting vote hashes for ${ssn} issue ${issue}`)
        log.error(error)
      }
    })
  })
}

async function getVoteHashes (ssn, issue) {
  return new Promise((resolve, reject) => {
    dbExecuter(async (db) => {
      try {
        const myCurser = await db.collection('VoteHashes').findOne({ ssn: { $eq: ssn }, issue: { $eq: issue } })
        // return the curser to the top level function
        resolve(myCurser)
        return
      } catch (error) {
        log.error(`Problem while finding vote hashes for ${ssn} issue ${issue}`)
        log.error(error)
      }
    })
  })
}

module.exports = {
  insertTestDocument,
  saveBlindVoteHashes,
  getVoteHashes
}

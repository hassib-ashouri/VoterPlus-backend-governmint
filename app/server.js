'use strict'
const controllers = require('./controllers')
const logger = require('./logger')
const config = require('./config')
const NodeRSA = require('node-rsa')

// Express server setup
const cors = require('cors')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const app = require('express')()
// json body parsing
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cors())
app.use(morgan('dev'))
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
const mysql = require('mysql2')

app.get('/', controllers.onTestReq)

app.post('/getIssues', controllers.getSupportedIssuesasync)
app.post('/votes', controllers.verifyVotersOnPost)
// order matters here
app.get('/issues/vm', controllers.getIssuesMeta)
app.get('/issues/:ids', controllers.getIssuesCounts)
app.get('/issues', controllers.getIssuesCounts)
app.post('/verifyCount', controllers.verifyVoteConsideration)
app.get('/admin/voters', controllers.getVoters)

io.on('connection', controllers.socketOnConnect)

async function loadKeys (filePath)
{
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
  const pubKey = new NodeRSA()
  const govKey = pubKey.importKey(config.govKey, 'pkcs1-private-pem')
  logger.debug(`
  loaded the public key
  N: ${govKey.keyPair.n.toString().slice(0, 50)}...
  E: ${govKey.keyPair.e}`)
  return govKey
}
async function initApp (expApp, httpServer, sqlPoolConfig, mongoUrl, mongoCollection, port, listenOn)
{
  const govKeys = await loadKeys('./priv.pem')
    .catch(reason =>
    {
      logger.error('Problem with loading the keys. Server stopped', reason)
      process.exit()
    })
  const pool = mysql.createPool(sqlPoolConfig)
  const con = await mongoClient.connect(mongoUrl, { useUnifiedTopology: true })
  const db = con.db(mongoCollection)
  // close when the process exists
  process.on('exit', () =>
  {
    con.close()
  })
  // make db available globally. this is for sockets
  global.mysqlDb = pool
  global.mongoDb = db
  global.keys = govKeys
  // for express controllers
  expApp.locals.mysqlDb = pool
  expApp.locals.mongoDb = db
  expApp.locals.keys = govKeys

  httpServer.listen(port, listenOn, () => logger.info(`listening on http://${listenOn}:${port}`))
  return httpServer
}

module.exports = initApp(app, server, config.sqlPoolConfig, config.mongoUrl, config.mongoCollection, config.port, config.on)

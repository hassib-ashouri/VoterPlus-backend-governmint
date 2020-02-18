'use strict'
const Config = require('./config')
const log = Config.logger
// load env vars
const envVars = require('dotenv').config()
if (envVars.error) {
  throw envVars.error
} else {
  log.info('Loaded env variables', envVars.parsed)
}
const http = require('http')
const PORT = process.env.PORT || 4000
const app = require('express')()
const cors = require('cors')
const server = http.createServer(app)
const bodyParser = require('body-parser')
const io = require('socket.io')(server, {
  pingInterval: 10000,
  pingTimeout: 100000,
  cookie: false
})
const db = require('./db')
const controllers = require('./controllers')

// json body parsing
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cors())

app.get('/', (req, res, next) => {
  res.send({ mess: 'Hello from Governmint.' })
})

app.post('/getIssues', (req, res, next) => {
  const ssn = req.body.ssn

  // db operation to get issues

  const issues = ['issue 1', 'issue 2']
  log.info('Got a request for issues')
  res.status(200).send(issues)
})

app.post('/getVotingRight', (req, res, next) => {
  const {
    ssn,
    issue
  } = req.body
  console.log('get Voting right requrest', ssn, issue)

  res.status(200).send({ vote: `Here is your voting right ${ssn} for issue ${issue}` })
})

io.on('connection', (socket) => {
  console.log('New socket connected', socket.id)
  // on test event
  socket.on('test', (args) => {
    console.log('Test Event:', 'Got the arguments:', args)
    db.insertTestDocument(args)
  })

  socket.on('template_acquisition', controllers.getVoteTempelate(socket))

  socket.on('blind_sig_select', controllers.processVotesHashes(socket))

  socket.on('blind_sig_reveal', controllers.verifyAndSign(socket))

  // log disconnection
  socket.on('disconnect', () => {
    console.log('socket', socket.id, 'disconnected')
  })
})

// only run the server after laoding the keys
Config.loadKeys(() => {
  server.listen(PORT, 'localhost', () => log.info(`listening on http://localhost:${PORT}`))
})

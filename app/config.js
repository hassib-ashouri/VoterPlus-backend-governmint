'use strict'
const logger = require('./logger')
const fs = require('fs')
// load env vars
const node_env = process.env.NODE_ENV || 'development'
// only use the dotenv lib when in dev
if (node_env === 'development')
{
  const envVars = require('dotenv').config({
    path: `./.env.${node_env}`
  })
  if (envVars.error)
  {
    throw envVars.error
  }
}

const configs = {
  govKey: process.env.GOV_KEY || fs.readFileSync('./priv.prem'),
  port: process.env.PORT || 4000,
  on: process.env.ON || 'localhost',
  mongoUrl: process.env.DB_URL,
  mongoCollection: 'VoterPlus',
  sqlPoolConfig: {
    host: process.env.MYSQL_URL,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASS,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  }
}
logger.debug('Loaded env variables', configs)
module.exports = configs

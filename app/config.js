'use strict'
const logger = require('./logger')
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

module.exports = {
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

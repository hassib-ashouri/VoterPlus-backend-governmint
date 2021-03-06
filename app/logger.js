'use strict'
// logger setup
const winston = require('winston')
const format = winston.format
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    format.timestamp(),
    format.colorize()
  ),
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: format.combine(format.uncolorize(), format.simple())
    }),
    new winston.transports.File({
      filename: 'combined.log',
      format: format.combine(format.uncolorize(), format.simple())
    })
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

module.exports = logger

const log = require('./config').logger
const getKey = require('./config').getKeys

const db = require('./db')

module.exports = {
  getVoteTempelate,
  processVotesHashes,
  verifyAndSign
}

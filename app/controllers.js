const log = require('./config').logger
const blindSigs = require('blind-signatures')
const db = require('./db')
const VOTE_TEMPLATE = 'This is one voting right for:ISSUE,E,N,NOUNCE,LHASHES,RHASHES'
const NUM_BLINDED_TEMPLATES = 10

function getVoteTempelate (socket) {
  return (args) => {
    log.info(`Socketid:${socket.id}. Got a request for a tempelate ${args}`)
    const {
      ssn,
      issue
    } = args
    // can voter vote

    // is a valid issue
    const response = {
      template: VOTE_TEMPLATE.replace(/ISSUE/, issue),
      quantity: NUM_BLINDED_TEMPLATES
    }
    // send the tempelate back
    socket.emit('template_acquisition_response', response)
  }
}

function processVotesHashes (socket) {
  return async ({ ssn, issue, blindVoteHashes }) => {
    log.info(`Got blind vote hashes for ${ssn} ${issue} ${blindVoteHashes}`)
    // persist the hashes in a mongo
    await db.saveBlindVoteHashes(ssn, issue, blindVoteHashes)
    // generate a random number to select
    const selected = 5
    socket.emit('blind_sig_select_response', { index: selected })
  }
}

function verifyAndSign (socket) {
  return async ({ ssn, issue }) => {
    log.infor(`Got the revealed data about the votes for ${ssn} ${issue}`)
    const voteHashes = await db.getVoteHashes(ssn, issue)
    // sign
    socket.emit('blind_sig_reveal_response', { rtv: `This is the signed right to vote on ${data.issue}` })
  }
}

module.exports = {
  getVoteTempelate,
  processVotesHashes,
  verifyAndSign
}

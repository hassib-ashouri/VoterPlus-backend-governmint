const log = (...s) => { console.log(...s) }
const ioClient = require('socket.io-client')
const blindSigs = require('blind-signatures')
const utils = require('../app/utils')
const Vote = require('../app/Vote').Vote
const fs = require('fs').promises
const socket = ioClient('http://localhost:4000')
let pubKey
loadKeys()
  .then(key => {
    pubKey = key
    socket.emit('template_acquisition', { ssn: '111111111', issue: '3je3' })
  })
  .catch(log)

socket.on('connect', () => {
  console.log('new socket connection', socket.id)
})

socket.on('disconnect', () => {
  console.log('disconnected with host')
})

// these two variables will be part of the global state
/**
 * @type {Vote[]}
 */
let generatedVotes
let blindVotesHashes
socket.on('template_acquisition_response', ({ template, quantity }) => {
  log('Recieved a template from Gov', template)
  log('Producing', quantity, ' Votes')
  generatedVotes = []
  blindVotesHashes = []
  // see how long does it take to gen
  console.time()
  for (let i = 0; i < quantity; i++) {
    const tempVote = new Vote(template, '111111111', pubKey.keyPair.e, pubKey.keyPair.n)

    generatedVotes.push(tempVote)
    blindVotesHashes.push(tempVote.blinded)
  }
  console.timeEnd()
  socket.emit('blind_sig_select', { ssn: '111111111', issue: '3je3', blindVoteHashes: blindVotesHashes })
})

socket.on('blind_sig_select_response', ({ index }) => {
  log('Vote index:', index, ' was selected')

  // step up intermediary info to finish blind sig sceme
  const blindingFactors_temp = []
  const votes_temp = []
  const voteshashed_temp = []
  generatedVotes.forEach((vote, i) => {
    if (index === i) {
      blindingFactors_temp.push(undefined)
      votes_temp.push(undefined)
      voteshashed_temp.push(undefined)
      return
    }
    blindingFactors_temp.push(vote.blindingFactor)
    votes_temp.push(vote.rawVote)
    voteshashed_temp.push(utils.hash(vote.rawVote))
  })
  socket.emit('blind_sig_reveal', { ssn: '111111111', issue: '3je3', bFactors: blindingFactors_temp, rawVotes: votes_temp, hashedVotes: voteshashed_temp })
})

socket.on('error', (error) => {
  console.error(error)
})

async function loadKeys () {
  return new Promise((resolve, reject) => {
    log('started loging the pub key')
    fs.readFile('./pub.pem')
      .then(keyText => {
        // cause i dont have access to NodeRSA
        const pubKey = blindSigs.keyGeneration()
        const nPubKey = pubKey.importKey(keyText, 'pkcs1-public-pem')
        log('loaded the public key')
        log(`N: ${nPubKey.keyPair.n}`)
        resolve(nPubKey)
      })
      .catch(reject)
  })
}

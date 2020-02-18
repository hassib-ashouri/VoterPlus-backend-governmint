const log = (...s) => { console.log(...s) }
const ioClient = require('socket.io-client')
const blindSigs = require('blind-signatures')
const crypto = require('crypto')
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
let generatedVotes, voteStrings
socket.on('template_acquisition_response', ({ template, quantity }) => {
  log('Recieved a template from Gov', template)
  log('Producing', quantity, ' Votes')
  generatedVotes = []
  voteStrings = []
  for (let i = 0; i < quantity; i++) {
    const tempVote = new Vote(template, '55555555', pubKey.keyPair.e, pubKey.keyPair.n)
    voteStrings.push(tempVote.toString())
    generatedVotes.push(tempVote)
    log('Made vote', i + 1, ' ', tempVote.toString())
  }
  socket.emit('blind_sig_select', { ssn: '111111111', issue: '3je3', blindVoteHashes: voteStrings })
})

socket.on('blind_sig_select_response', ({ index }) => {
  log('Vote index:', index, ' was selected')
  // blinding factors
  let factors
  // vote strings
  voteStrings
  // blinded votes strings
  let blindedVotesStrings
  // vote hashes
  let voteHashes
  socket.emit('blind_sig_reveal', {})
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

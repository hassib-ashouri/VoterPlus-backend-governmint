const log = (...s) =>
{
  console.log(...s)
}
const ioClient = require('socket.io-client')
const blindSigs = require('blind-signatures')
const utils = require('../app/utils')
const Vote = require('../app/Vote').Vote
const fs = require('fs').promises
const socket = ioClient('http://localhost:4000')
let pubKey
loadKeys()
  .then(key =>
  {
    pubKey = key
    log('submited a tem acquisition request')
    socket.emit('template_acquisition', { ssn: '123456789', issue: 'prop_44' })
    // socket.emit('vote', {
    //   signature: '1551539585521130381700869415367863780529755614350370225142624445435652133616260510173134532595165744641776456688565445327007385696971724180677524019285365923356504483647841228292967887291942378993109567141102468099346967152202985223606604725005277103436533724513712400840499556137345941186222669241327096810165977275682442370650703515928601394306431497533539435466327375211422380054886781136684599042989283413158852875795799293881133611747511284779451422063547339130417758542513481864327463710617767478753092382454329237811103233872223883793765593972876541655355666800037950476721142456361900627893530919836941547792',
    //   rtv: Vote.decode('{"signature":"1551539585521130381700869415367863780529755614350370225142624445435652133616260510173134532595165744641776456688565445327007385696971724180677524019285365923356504483647841228292967887291942378993109567141102468099346967152202985223606604725005277103436533724513712400840499556137345941186222669241327096810165977275682442370650703515928601394306431497533539435466327375211422380054886781136684599042989283413158852875795799293881133611747511284779451422063547339130417758542513481864327463710617767478753092382454329237811103233872223883793765593972876541655355666800037950476721142456361900627893530919836941547792","rawVote":"This is one voting right for:COMDOM,E,N,b39cee71ec708469c6a0dfd5fa72380b80f3a66457b2ded8dffab1af4e328a9fa57bd8a4bc74d926ae209d0adc539786,012588d22eefa84fcb2d5273320eaad146b354ccf7998b1371f10b14241109c7-ac47fa3a0496ff2761c2adaa0e2a1e48e20468e573225017120da9ac8fbdc6b5-9939164ab372b834f21517fb48af9399759c539581d6e36bcae2de5651e064be-a39f19b35ca9d7509e6a4e6328286a406639c7af1294951391131245684a666f-79266fe952f354f4bc7a8a1428c6423db6f053b02f10744268a9aa73d13b2bfe-df64d78aeb27f87905b0c8dd97fbc506eaef1b30596aa0004d3387ab0265fe58-bb50fe7b211657fd1d27e3158fa65758b5cebe8c2ea04175e66882ac9bdfbc41-cf91f58d53eff86fb2b22cf2a78762354fbf110c8cbef82ba23df436fa8fc551-f642965c5ed62dd68962dec16f8a1b31e70230091461f5861f5568f514f27819-5ecb18d3ebf64771a67d69948b23779ebf63de00ea4a065df3d4fd2727816fb0,7d32fbebffc4fdeb420324e163633b4af2b122fde9b46e65e5d45cf2ff9d4bf8-1ef4c80d68598412179d246b6be22dc786a0ea17e7cc144a66cb3c5ee555f84f-5f078fe8f9d6da3a7e7d51960cdb2f37745e21ff1480d521df6caa569ab586c8-b63a5afbf6158ab72527ef152560a91bdc33cedb826b321da2ad97ac558a7780-c71d5706baed84d059784e6c7434a0fd4534d87f76d565e27118f88a337e336c-4da974dd0d6a6bd5132d56fc5427af16e65207af1cd38c275487095ea5d2abc9-73f0e7ec88d4abcfcad8611ca739808daac1e4f2acde8ad95d4fdec36b3133d5-6b62e630e618c455e35e361ab74c1154a75410ce8e4d34803c04422f92ca9ba3-27eb871e46c99682391263c6b5862807e269374adea396323dedb9c695f750be-4041433f7bc19d80f6ac0e5986594a8e786da5ad7e5bd7181c2b7c30afd315c3","leftIdent":["8751c5d266f0373523c0e24c23042ef9cb75c1001ada108838d7785d4ccee6aeb13d1e1d40bbaf","40135c5d80b188e3262a37af6b1db52931e31cd9f7f61d90ffc940742d831795eb408065fa4669","f07727a7ce65f36a29116ae6b9c3b63c340015f27b5be87df949e40e92326df3626cdffed87976","6c47512456fa8e8ae2e96cc055e1d46365f47c8dfb8707abec821325a33cd67d1cc7cd9869d593","97383d23cd344f10eba8b3303c7c7a07b8b37f13f7fe8ce9635a72357e5a3aa0a0f338f9a7694d","68dd9216c94fa5359e85877b888565e9a2658a7128a80c0d618af41981ea8c8ae782fed9993b4e","aab04690e6b6be78c25552642284157bfbeb6922fbae175d22492747d146b387542309f9e28ccf","1040c867d9a3b6714ee5ed59ce2616fc9d2ef68fa8183ec133fb8d14d557aea72d83fc8a0e1721","becd78961bdd8ef9b23268c0b0225b82522d75c6a405cc40f8eae9becd30ea97af203a63676d69","8af2af2ca026ca3c46a4c203eaae6e0c7c5efb3cfb23b96f6e48ee54d13d5d11009dfb8337c389"],"rightIdent":["d339aca1469944154cae876c556b5a90a512e17273bd78fc18b1172f6cf4df9c89092924718998","147b352ea0d8fbc34944528f1d72c1405f843cab9e9175e4dfaf2f060db92ea7d374b75ccb745e","a41f4ed4ee0c804a467f0fc6cfacc2555a673580123c8009d92f8b7cb20854c15a58e8c7e94b41","382f38577693fdaa8d8709e0238ea00a0b935cff92e06fdfcce47c578306ef4f24f3faa158e7a4","c3505450ed5d3c3084c6d6104a130e6ed6d45f619e99e49d433c1d475e60039298c70fc0965b7a","3cb5fb65e926d615f1ebe25bfeea1180cc02aa0341cf647941ec9b6ba1d0b5b8dfb6c9e0a80979","fed82fe3c6dfcd58ad3b374454eb6112958c495092c97f29022f4835f17c8ab56c173ec0d3bef8","4428a114f9cac551218b8879b8496295f349d6fdc17f56b5139de266f56d979515b7cbb33f2516","eaa511e53bb4fdd9dd5c0de0c64d2feb3c4a55b4cd62a434d88c86cced0ad3a597140d5a565f5e","de9ac65f804fb91c29caa7239cc11a651239db4e9244d11b4e2e8126f107642338a9ccba06f1be"]}').rawVote,
    //   issue: 'COMDOM',
    //   choice: 'option a'

    // })
  })
  .catch(log)

socket.on('connect', () =>
{
  console.log('new socket connection', socket.id)
})

socket.on('disconnect', () =>
{
  console.log('disconnected with host')
})

// // these two variables will be part of the global state
// /**
//  * @type {Vote[]}
//  */
// let generatedVotes
// let blindVotesHashes
// socket.on('template_acquisition_response', ({ template, quantity, err }) =>
// {
//   log('Recieved a template from Gov', template)
//   log('Producing', quantity, ' Votes')
//   generatedVotes = []
//   blindVotesHashes = []
//   // see how long does it take to gen
//   console.time()
//   for (let i = 0; i < quantity; i++)
//   {
//     const tempVote = new Vote(template, '111111111', pubKey.keyPair.e, pubKey.keyPair.n)

//     generatedVotes.push(tempVote)
//     blindVotesHashes.push(tempVote.blinded)
//   }
//   console.timeEnd()
//   socket.emit('blind_sig_select', { ssn: '111111111', issue: '3je3', blindVoteHashes: blindVotesHashes })
// })

// socket.on('blind_sig_select_response', ({ index }) =>
// {
//   log('Vote index:', index, ' was selected')

//   // step up intermediary info to finish blind sig sceme
//   const blindingFactors_temp = []
//   const votes_temp = []
//   const voteshashed_temp = []
//   generatedVotes.forEach((vote, i) =>
//   {
//     if (index === i)
//     {
//       blindingFactors_temp.push(undefined)
//       votes_temp.push(undefined)
//       voteshashed_temp.push(undefined)
//       return
//     }
//     blindingFactors_temp.push(vote.blindingFactor)
//     votes_temp.push(vote.rawVote)
//     voteshashed_temp.push(utils.hash(vote.rawVote))
//   })
//   socket.emit('blind_sig_reveal', { ssn: '111111111', issue: '3je3', bFactors: blindingFactors_temp, rawVotes: votes_temp, hashedVotes: voteshashed_temp })
// })

// socket.on('blind_sig_reveal_response', ({ rtv }) =>
// {
//   log('received the right to vote', rtv)
// })

socket.on('error', (error) =>
{
  console.error(error)
})

async function loadKeys ()
{
  return new Promise((resolve, reject) =>
  {
    log('started loging the pub key')
    fs.readFile('./pub.pem')
      .then(keyText =>
      {
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

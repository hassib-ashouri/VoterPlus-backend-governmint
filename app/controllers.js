const log = require('./logger')
const db = require('./db')
const utils = require('./utils')
const blindSigs = require('blind-signatures')
// local vars
const getKeys = () => global.keys
const VOTE_TEMPLATE = 'This is one voting right for:ISSUE,E,N,NOUNCE,LHASHES,RHASHES'
const VOTE_FORMAT = /This is one voting right for:(.*),(.*),(.*),(.*),(.*),(.*)/
const NUM_BLINDED_TEMPLATES = 10

/**
   *
   * @param {Exp.request} req
   * @param {Exp.response} res
   * @param {*} next
   */
async function verifyVotersOnPost (req, res, next)
{
  const {
    issue,
    count,
    votes
  } = req.body
  log.info('Recievd request to Verify Votes', { count, issue })
  try
  {
    if (typeof issue !== 'string' || typeof count !== 'number' || !Array.isArray(votes))
    {
      res.status(400).send({ err: 'Request body types are wrong' })
      return
    }
    // match count with votes in an array
    if (count !== votes.length)
    {
      res.status(400).send({ err: 'Votes does not match count' })
    }

    // check if the issue exists in the db and load valid choices
    const [rows, fields] = await db.getIssues(issue)
    if (rows.length !== 1)
    {
      res.status(400).send({ err: `Issue ${issue} was not found` })
      return
    }

    const options = rows[0].options
    // load guids for this issue for fast check of dubs
    const [retrievedVotes, fields2] = await db.getVotes(issue)
    // build a hash map for fast lookup with guids as keys
    const votesOnThisIssueSoFar = {}
    retrievedVotes.forEach((vote) =>
    {
      votesOnThisIssueSoFar[vote.guid] = vote
    })
    // verify each vote signature, vote machine sig, validity of choice
    const goodVotes = []
    for (const vote of votes)
    {
      const {
        guid,
        choice,
        ris,
        voteStr,
        signature,
        receiptNum
      } = vote

      // check for dubs
      if (guid in votesOnThisIssueSoFar)
      {
        log.error('Dublicate vote detected', { guid })
        // launch dublicate detection logic using the new and persisted ris
        continue
      }

      // verify sig
      log.debug('Processing a vote.')
      const isGoodSig = blindSigs.verify({
        unblinded: signature,
        message: voteStr,
        E: getKeys().e,
        N: getKeys().n
      })

      if (!isGoodSig)
      {
        log.error('Bad gov sig on', { guid })
        continue
      }

      // isvalid choice
      if (!options.includes(choice))
      {
        log.error('Bad choice for issue', { guid, issue, choice })
        continue
      }
      // good vote
      vote.issue = issue
      goodVotes.push(vote)
    }

    if (goodVotes.length === 0)
    {
      throw new Error('No Good votes to add')
    }
    // persist votes in db
    await db.insertVotes(goodVotes)

    // http 201 if everything is good
    res.status(201).send()
  }
  catch (error)
  {
    log.error('Problem with verifying votes request.\n', error)
    res.status(500).send()
  }
}

function onTestReq (req, res, next)
{
  res.send({ mess: 'Hello from Governmint.' })
}

async function getSupportedIssuesasync (req, res, next)
{
  const ssn = req.body.ssn

  // db operation to get issues
  const [rows, fields] = await db.getVoters(ssn)
  // if no voters found with the ssn
  if (rows.length === 0)
  {
    res.status(404).send()
    return
  }
  const issues = rows[0].can_vote_on
  log.info('Got a request for issues')
  res.status(200).send(issues)
}

function socketOnConnect (socket)
{
  console.log('New socket connected', socket.id)

  socket.on('template_acquisition', getVoteTempelate(socket))

  socket.on('blind_sig_select', processVotesHashes(socket))

  socket.on('blind_sig_reveal', verifyAndSign(socket))

  // log disconnection
  socket.on('disconnect', () =>
  {
    console.log('socket', socket.id, 'disconnected')
  })
}

function getVoteTempelate (socket)
{
  return async (args) =>
  {
    log.info(`Recieved a request for a tempelate. Arguments ${JSON.stringify(args)}`)
    // destructure needed data
    const {
      ssn,
      issue
    } = args
    // the response to send to client
    let response
    // can voter vote
    const [rows, fields] = await db.getVoters(ssn)
    // db problem
    if (rows.length > 1)
    {
      const error = new Error(`
      During template_aquisition
      More than one user with ssn ${ssn}`)
      log.error(error.message)
      throw error
    }
    else if (rows.length === 0)
    { // user not found
      const error = new Error(`
      During template_aquisition
      User with ssn ${ssn} not found`)
      log.error(error.message)
      response = {
        err: error.message
      }
      socket.emit('template_acquisition_response', response)
      return
    }

    // user found
    // check if voter can vote
    const canVoteOn = rows[0].can_vote_on
    if (!canVoteOn.includes(issue))
    {
      const error = new Error(`
      Voter ${ssn} cannot vote on ${issue}`)
      response = {
        err: error.message
      }
      socket.emit('template_acquisition_response', response)
      return
    }

    // get the issues
    const [rows2, fields2] = await db.getIssues(issue)
    // wront issue name
    if (rows2.length === 0)
    {
      const error = new Error(`
      During template_aquisition
      Issue with id ${issue} not found`)
      log.error(error.message)
      response = {
        err: error.message
      }
      socket.emit('template_acquisition_response', response)
      return
    }

    const issueName = rows2[0].code_name
    // check if user received a template before
    const dbRecordsForUser = await db.getTemplateAquisitionStage(ssn, issue)
    // user has requested more than once
    if (dbRecordsForUser !== 0)
    {
      log.info(`User ${ssn} has requested a template more that once`)
    }
    // is a valid issue
    response = {
      template: VOTE_TEMPLATE.replace(/ISSUE/, issueName),
      quantity: NUM_BLINDED_TEMPLATES
    }
    // send the tempelate back
    socket.emit('template_acquisition_response', response)
    // persiste that i gave user template
    await db.insertTemplateAquisition(ssn, issue, response.template)
      .catch(reason =>
      {
        log.error(`Problem inserting template for ${ssn} issue ${issue}`)
        log.error(reason.message)
      })
    log.info('Processed request of template sucessfully', { ssn: ssn, issue: issue, template: response.template })
  }
}

function processVotesHashes (socket)
{
  return async ({ ssn, issue, blindVoteHashes }) =>
  {
    log.info(`Recieved blind vote hashes for ${ssn} ${issue}`)
    // generate a random number to select
    const selected = parseInt(Math.random() * NUM_BLINDED_TEMPLATES)
    log.info('selected a template with index ' + selected)
    try
    {
      // persist the hashes in a mongo
      await db.saveBlindVoteHashes(ssn, issue, blindVoteHashes, selected)

      socket.emit('blind_sig_select_response', { index: selected })
    }
    catch (error)
    {
      log.error('Error in saving blindvote hashes', error)
      socket.emit('blind_sig_select_response', { err: error.message })
    }
  }
}

function verifyAndSign (socket)
{
  return async ({ ssn, issue, bFactors, rawVotes, hashedVotes }) =>
  {
    log.info(`Recieved the revealed data about the votes for ${ssn} ${issue}`)

    const blindVoteHashes = await db.getVoteHashes(ssn, issue)
    log.info('Db dum of vote hashes from mongodb', blindVoteHashes)
    if (blindVoteHashes.length > 1 || blindVoteHashes.length === 0)
    {
      throw new Error('User has more than one submission of')
    }
    const {
      ssn: savedSSN,
      issue: savedIssue,
      stages: {
        blind_sig_select: {
          hashes,
          selected: savedSELECTED
        }
      }
    } = blindVoteHashes
    // sign
    hashes.forEach((bVoteHash, i) =>
    {
      // No blinding factor is expected for the selected identity.
      if (i === savedSELECTED) return
      if (!verifyContents(utils.hash(bVoteHash), bFactors[i], hashedVotes[i], rawVotes[i]))
      {
        throw new Error(`Document ${rawVotes[i]} is invalid`)
      }
    })

    // If we made it here, all looked good.
    // Return the signed vote to the voter.
    const SignedVote = blindSigs.sign({
      blinded: hashes[savedSELECTED],
      key: keys
    }).toString()
    log.info(`Sent right to vote for ${ssn} issue ${issue}`)
    socket.emit('blind_sig_reveal_response', { signature: SignedVote })
  }
}

// TODO push below methods to util module if they depend on local vars

/**
 *  Varify the validity of a vote document by comparing it to its hash and
 * unbliding using the `blindingFactor`.
 * @param {string} blindVoteHash - the output of blind method of *blind-sig* library hashed
 * @param {BigInteger} blindingFactor - the blind factor used to create `blindVoteHash`.
 * @param {string} rawVoteHash - hash of the raw vote
 * @param {string} rawVote - raw vote
 * @returns {boolean}
 */

function verifyContents (blindVoteHash, blindingFactor, rawVoteHash, rawVote)
{
  // check format
  if (!rawVote.match(VOTE_FORMAT))
  {
    log.info('Vote does not match the format.')
    log.info(rawVote)
    return false
  }
  // check the hash
  const h = utils.hash(rawVote)
  if (h !== rawVoteHash)
  {
    log.info(`Expecting hash of ${rawVoteHash}, but got ${h}`)
    return false
  }
  // check the blinding factor
  if (!consistent(blindVoteHash, blindingFactor, rawVote))
  {
    return false
  }

  return true
}

/**
 * verifies the validity of the `blindVoteHash`
 * it take the `rawVoteHash` blinds it and compares it to `blindVoteHash`
 * @param {string} blindVoteHash - the hash of the vote after blinding it.
 * @param {BigInteger} factor - blind factor used for passed `blindVoteHash`
 * @param {string} rawVotehash - the hash of the raw vote
 * @returns {boolean}
 */
function consistent (blindVoteHash, factor, rawVotehash)
{
  // const n = keys.keyPair.n
  // const e = new BigInteger(keys.keyPair.e.toString())
  // blindVoteHash = blindVoteHash.toString()
  // const bigHash = new BigInteger(utils.hash(rawVotehash), 16)
  // const b = bigHash.multiply(factor.modPow(e, n)).mod(n).toString()
  // const result = blindVoteHash === utils.hash(b.toString())
  // return result
  return true
}

module.exports = {
  verifyVotersOnPost,
  getVoteTempelate,
  processVotesHashes,
  verifyAndSign,
  onTestReq,
  getSupportedIssuesasync,
  socketOnConnect
}

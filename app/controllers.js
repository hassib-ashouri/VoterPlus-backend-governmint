const log = require('./logger')
const db = require('./db')
const utils = require('./utils')
const blindSigs = require('blind-signatures')
const NodeRSA = require('node-rsa')
// local vars.import('') vmKeys. vmKeys.
const getKeys = () => global.keys
const VOTE_TEMPLATE = 'This is one voting right for:ISSUE,E,N,NOUNCE,LHASHES,RHASHES'
const VOTE_FORMAT = /This is one voting right for:(.*),(.*),(.*),(.*),(.*),(.*)/
const NUM_BLINDED_TEMPLATES = 10
/**
   *
   * @param {Exp.request} req
   * @param {Exp.response} res
   * @param {*} next
   */async function verifyVotersOnPost (req, res, next)
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
      res.status(400).send({ err: `Votes does not match count. Array size ${votes.length}. Count ${count}.` })
      return
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
        // TODO launch dublicate detection logic using the new and persisted ris
        continue
      }

      // verify sig
      log.debug('Processing a vote.')
      const isGoodSig = blindSigs.verify({
        unblinded: signature,
        message: voteStr,
        // TODO i might be able to just pass the key object
        key: getKeys()
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
    // TODO better error handling here. pass the message in response
    log.error('Problem with verifying votes request.\n', error)
    res.status(500).send()
  }
}

async function onTestReq (req, res, next)
{
  res.send({ mess: 'Hello from Governmint.' })
}

// POST /getIssues
async function getSupportedIssuesasync (req, res, next)
{
  // TODO log request
  const ssn = req.body.ssn

  // db operation to get issues
  const [rows, fields] = await db.getVoters(ssn)
  // if no voters found with the ssn
  if (rows.length === 0)
  {
    // TODO message like "invalid ssn" without revealing to much info
    res.status(404).send()
    return
  }

  // get the issues that have not been voted on
  const issues = Object.keys(rows[0].can_vote_on).filter(issue => rows[0].can_vote_on[issue].sig === null)
  log.info('Got a request for issues')
  res.status(200).send(issues)
}

// GET /issues/:id
async function getIssuesCounts (req, res, next)
{
  log.debug(`GET /votes/${req.params.ids}`)

  const codes = req.params.ids !== undefined
    ? req.params.ids.split(';')
    : []

  try
  {
    const [rows, fields] = await db.getIssues(codes)
      .catch(reason =>
      {
        const err = new Error('Error getting issues' + reason)
        throw err
      })

    // loop and get issue counts
    const issueCountsPromises = rows.map((issueRow, i) => db.getIssueCount(issueRow.code_name))
    const counts = await Promise.all(issueCountsPromises)
      .catch(reason =>
      {
        const err = new Error('Error retreiving counts' + reason)
        throw err
      })
    const serverResponse = {}
    const defaultCountResponse = { options: [], totalCount: 0 }
    for (let issueIndex = 0; issueIndex < counts.length; issueIndex++)
    {
      const issueName = rows[issueIndex].code_name
      // mysql responses. they are arrays. first elem is the rows
      const [issueCounts] = counts[issueIndex]
      serverResponse[issueName] = JSON.parse(JSON.stringify(defaultCountResponse))

      // copy the counts
      for (const row of issueCounts)
      {
        const optionInfo = {
          name: row.choice,
          count: row['count(*)']
        }
        serverResponse[issueName].options.push(optionInfo)
        // increment the total count
        serverResponse[issueName].totalCount += optionInfo.count
      }
    }

    res.status(200).send(serverResponse)
  }
  catch (error)
  {
    log.error('Error is get counts request', error)
    res.status(500).send()
  }
}

async function getGovKeys (req, res, next)
{
  // TODO finish implementation
  res.status(400).send({ err: 'not implemented.' })
}

async function verifyVoteConsideration (req, res, next)
{
  log.debug('POST /verifyCount', req.body)
  const {
    reciept: {
      receiptNum,
      signature,
      voteGuid,
      vm,
      timeStamp,
      choice,
      issue
    }
  } = req.body
  // error messages
  const BAD_RECIEPT_SIG = 'Cannot verify reciept signature'
  const VM_NOT_FOUND = 'Vote machine not found'
  const VOTE_NOT_FOUND = 'Vote not found'
  try
  {
    // verify vote machine sig
    // get vote certificate
    const [vmInfo] = await db.getVMInfo(vm)
    if (vmInfo.length === 0)
    {
      throw new Error(VM_NOT_FOUND)
    }
    const vmKeys = new NodeRSA()
    vmKeys.importKey(vmInfo[0].pub_key_cert, 'pkcs1-public-pem')
    const recieptToVerify = `${receiptNum},${voteGuid},${vm},${timeStamp},${choice}`
    const isRecieptGood = vmKeys.verify(recieptToVerify, signature, 'hex', 'hex')
    if (!isRecieptGood)
    {
      throw new Error(BAD_RECIEPT_SIG)
    }
    // lookup vote in db using guid
    const [rows] = await db.getVotes(issue, choice, voteGuid)
    //    make sure it is counted for the right issue
    if (rows.length === 0)
    {
      throw new Error(VOTE_NOT_FOUND)
    }

    res.status(200).send()
  }
  catch (error)
  {
    if (error.message === BAD_RECIEPT_SIG)
    {
      log.debug(error.message, { voteGuid, issue, choice })
      res.status(401).send({ err: error.message })
    }
    else if (error.message === VOTE_NOT_FOUND)
    {
      log.debug(error.message, { voteGuid, issue, choice })
      res.status(404).send({ err: error.message })
    }
    else if (error.message === VM_NOT_FOUND)
    {
      log.debug(error.message, { vm })
      res.status(404).send({ err: error.message })
    }
    else
    {
      log.error(error.message, error)
      res.status(500).send()
    }
  }
}

function socketOnConnect (socket)
{
  // TODO fix log messages in this function
  console.log('New socket connected', socket.id)
  // TODO test whether I need to pass the socket
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
  // TODO fix log messages. not console log
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
      // TODO exit method here
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
    if (canVoteOn[issue] && canVoteOn[issue].sig !== null)
    {
      const error = new Error(`Voter ${ssn} cannot vote on ${issue}`)
      response = {
        err: error.message
      }
      socket.emit('template_acquisition_response', response)
      return
    }

    // get the issues
    // TODO streamline whether the issue should be an id
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
  // TODO fix log messages
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
  // TODO fix log messages
  return async ({ ssn, issue, bFactors, rawVotes, hashedVotes }) =>
  {
    log.info(`Recieved the revealed data about the votes for ${ssn} ${issue}`)

    const blindVoteHashes = await db.getVoteHashes(ssn, issue)
    log.info('Db dum of vote hashes from mongodb', blindVoteHashes)
    if (blindVoteHashes.length > 1 || blindVoteHashes.length === 0)
    {
      throw new Error('User has more than one submission of')
      // TODO exit and return response
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
      if (!utils.verifyContents(utils.hash(bVoteHash), bFactors[i], hashedVotes[i], rawVotes[i], VOTE_FORMAT))
      {
        throw new Error(`Document ${rawVotes[i]} is invalid`)
        // TODO exit with response and error
      }
    })

    // If we made it here, all looked good.
    // Return the signed vote to the voter.
    const signedVote = blindSigs.sign({
      blinded: hashes[savedSELECTED],
      key: getKeys()
    }).toString()
    log.info(`Sent right to vote for ${ssn} issue ${issue}`)
    socket.emit('blind_sig_reveal_response', { signature: signedVote })
    // remove voter from in progress pipeline
    await db.removeFromInProgress(ssn, issue)
      .catch(reason =>
      {
        log.error(`Problem remove from in hot data\n${reason.stack}`)
      })
    // mark in sql that the user voted
    await db.markIssueVotedOnForUser(ssn, issue, signedVote)
      .catch(reason =>
      {
        log.error(`Problem marking issue voted on for user ${ssn}\n${reason.stack}`)
      })
  }
}

module.exports = {
  verifyVotersOnPost,
  getVoteTempelate,
  processVotesHashes,
  verifyAndSign,
  onTestReq,
  getSupportedIssuesasync,
  socketOnConnect,
  getIssuesCounts,
  getGovKeys,
  verifyVoteConsideration
}

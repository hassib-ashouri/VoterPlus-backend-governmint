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
  */
async function verifyVotersOnPost (req, res, next)
{
  // TODO consider sending vm id as well
  const {
    issue,
    count,
    votes
  } = req.body
  log.debug('POST /votes', { count, issue })
  // error messages
  const WRONG_TYPE_IN_REQ = 'Request body types are wrong'
  const VOTE_COUNT_MISMATCH = `Votes does not match count. Array size ${votes.length}. Count ${count}.`
  const ISSUE_NOT_FOUND = `Issue ${issue} was not found`
  const NO_GOOD_VOTES = 'No Good votes to add'
  try
  {
    if (typeof issue !== 'string' || typeof count !== 'number' || !Array.isArray(votes))
    {
      throw new Error(WRONG_TYPE_IN_REQ)
    }
    // match count with votes in an array
    if (count !== votes.length)
    {
      throw new Error(VOTE_COUNT_MISMATCH)
    }

    // check if the issue exists in the db and load valid choices
    const [rows, fields] = await db.getIssues(issue)
    if (rows.length !== 1)
    {
      throw new Error(ISSUE_NOT_FOUND)
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
        // TODO launch dublicate detection logic using the new and persisted ris
        const [prevVote] = await db.getVotes(undefined, undefined, guid)

        const prevRis = prevVote[0].ris
        try
        {
          const cheeterIden = utils.revealCheater(ris, prevRis, 'This is one voting right for ')
          log.info('Identified cheater:', { cheeterIden })
          // TODO add some logic for identified cheater
        }
        catch (error)
        {
          log.error('Dublicate vote detected. Was not able to identify cheater', { guid })
        }
        continue
      }
      // TODO verify length of ris array

      // verify sig
      log.debug('Processing a vote.')
      const isGoodSig = blindSigs.verify({
        unblinded: signature,
        message: voteStr,
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
      throw new Error(NO_GOOD_VOTES)
    }
    // persist votes in db
    await db.insertVotes(goodVotes)

    // http 201 if everything is good
    res.status(201).send()
  }
  catch (error)
  {
    switch (error.message)
    {
      case WRONG_TYPE_IN_REQ:
      case VOTE_COUNT_MISMATCH:
      case ISSUE_NOT_FOUND:
      case NO_GOOD_VOTES:
        res.status(400).send({ err: error.message })
        break
      default:
        log.error('Problem with verifying votes request.\n', error)
        res.status(500).send()
    }
  }
}

async function onTestReq (req, res, next)
{
  res.send({ mess: 'Hello from Governmint.' })
}

// POST /getIssues
async function getSupportedIssuesasync (req, res, next)
{
  const ssn = req.body.ssn
  const BAD_SSN = 'No issues to vote on.'
  log.debug('POST /getIssues', { ssn })
  try
  {
    // db operation to get issues
    const [rows] = await db.getVoters(ssn)
    // if no voters found with the ssn
    if (rows.length === 0)
    {
      throw new Error(BAD_SSN)
    }

    // get the issues that have not been voted on
    const issues = Object.keys(rows[0].can_vote_on).filter(issue => rows[0].can_vote_on[issue].sig === null)
    res.status(200).send(issues)
  }
  catch (error)
  {
    switch (error.message)
    {
      case BAD_SSN:
        res.status(404).send()
        break
      default:
        res.status(500).send({ err: error.message })
    }
  }
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
    const [rows] = await db.getIssues(codes)
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
    switch (error.message)
    {
      default:
        log.error('Error is get counts request', error)
        res.status(500).send()
    }
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
    const isRecieptGood = vmKeys.verify(recieptToVerify, signature, 'utf8', 'hex')
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
    switch (error.message)
    {
      case BAD_RECIEPT_SIG:
        log.debug(error.message, { voteGuid, issue, choice })
        res.status(401).send({ err: error.message })
        break
      case VOTE_NOT_FOUND:
      case VM_NOT_FOUND:
        log.debug(error.message, { vm, voteGuid, issue, choice })
        res.status(404).send({ err: error.message })
        break
      default:
        log.error(error.message, error)
        res.status(500).send({ err: error.message })
    }
  }
}

function socketOnConnect (socket)
{
  log.debug('New socket connected', { id: socket.id })
  // assign proper controllers
  socket.on('template_acquisition', getVoteTempelate(socket))
  socket.on('blind_sig_select', processVotesHashes(socket))
  socket.on('blind_sig_reveal', verifyAndSign(socket))

  // log disconnection
  socket.on('disconnect', () =>
  {
    log.debug('Socket disconnected', { id: socket.id })
  })
}

function getVoteTempelate (socket)
{
  return async (args) =>
  {
    // destructure needed data
    const {
      ssn,
      issue
    } = args
    log.debug('Recieved a request for a tempelate. Arguments', { ssn, issue })
    const USER_NOT_UNIQUE = `During template_aquisition. More than one user with ssn ${ssn}`
    const USER_NOT_FOUND = `During template_aquisition. User with ssn ${ssn} not found`
    const VOTER_CANNOT_VOTE = `Voter ${ssn} cannot vote on ${issue}`
    const ISSUE_NOT_FOUND = `During template_aquisition. Issue with id ${issue} not found.`
    const ALREADY_IN_PROGRESS = 'Voter more than one vote at the same time. Try again in 3 mins'
    try
    {
      // can voter vote
      const [rows] = await db.getVoters(ssn)
      // db problem
      if (rows.length > 1)
      {
        const error = new Error(USER_NOT_UNIQUE)
        throw error
      }
      else if (rows.length === 0)
      { // user not found
        const error = new Error(USER_NOT_FOUND)
        throw error
      }
      // user found
      // check if voter can vote
      const canVoteOn = rows[0].can_vote_on
      if (canVoteOn[issue] && canVoteOn[issue].sig !== null)
      {
        const error = new Error(VOTER_CANNOT_VOTE)
        throw error
      }
      // get the issues
      // TODO streamline whether the issue should be an id
      const [rows2] = await db.getIssues(issue)
      // wront issue name
      if (rows2.length === 0)
      {
        const error = new Error(ISSUE_NOT_FOUND)
        throw error
      }
      const issueName = rows2[0].code_name
      // check if user received a template before
      const dbRecordsForUser = await db.getTemplateAquisitionStage(ssn, issueName)
      // user has requested more than once
      if (dbRecordsForUser !== 0)
      {
        const error = new Error(ALREADY_IN_PROGRESS)
        throw error
      }
      // is a valid issue
      const response = {
        template: VOTE_TEMPLATE.replace(/ISSUE/, issueName),
        quantity: NUM_BLINDED_TEMPLATES
      }
      // persiste that i gave user template
      await db.insertTemplateAquisition(ssn, issue, response.template)
        .catch(reason =>
        {
          log.error('Problem updating pipeline state', { ssn, issue })
          const error = new Error(reason.message)
          throw error
        })
        // send the tempelate back
      socket.emit('template_acquisition_response', response)
      log.debug('Processed request of template sucessfully', { ssn: ssn, issue: issue, template: response.template })
    }
    catch (error)
    {
      switch (error.message)
      {
        case ALREADY_IN_PROGRESS:
          socket.emit('template_acquisition_response', { err: error.message })
          // remove everything from the pipeline
          await db.removeFromInProgress(ssn, issue)
          break
        case USER_NOT_UNIQUE:
        case USER_NOT_FOUND:
        case VOTER_CANNOT_VOTE:
        case ISSUE_NOT_FOUND:
        default:
          socket.emit('template_acquisition_response', { err: error.message })
      }
    }
  }
}

function processVotesHashes (socket)
{
  return async ({ ssn, issue, blindVoteHashes }) =>
  {
    log.debug('Recieved blind vote hashes', { ssn, issue })
    // generate a random number to select
    const selected = parseInt(Math.random() * NUM_BLINDED_TEMPLATES)
    log.debug('Selected a template with index ', { selected, ssn, issue })
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
    log.debug(`Recieved the revealed data about the votes for ${ssn} ${issue}`)
    const VOTE_REQUESTED_BEFORE = 'User has submitted before'
    const VOTE_DOC_CANNOT_BE_VERIFIED = 'One of more of vote documents cannot be verified'
    try
    {
      const blindVoteHashes = await db.getVoteHashes(ssn, issue)
      if (blindVoteHashes.length > 1 || blindVoteHashes.length === 0)
      {
        throw new Error(VOTE_REQUESTED_BEFORE)
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
          throw new Error(VOTE_DOC_CANNOT_BE_VERIFIED)
        }
      })
      // If we made it here, all looked good.
      // Return the signed vote to the voter.
      const signedVote = blindSigs.sign({
        blinded: hashes[savedSELECTED],
        key: getKeys()
      }).toString()
      // remove voter from in progress pipeline
      await db.removeFromInProgress(ssn, issue)
        .catch(reason =>
        {
          log.error('Problem removing state from pipeline')
          const error = new Error(reason.message)
          throw error
        })
        // mark in sql that the user voted
      await db.markIssueVotedOnForUser(ssn, issue, signedVote)
        .catch(reason =>
        {
          log.error('Problem marking issue voted in mysql', { ssn, issue })
          const error = new Error(reason.message)
          throw error
        })
      socket.emit('blind_sig_reveal_response', { signature: signedVote })
      log.debug('Sent signed voting right', { ssn, issue })
    }
    catch (error)
    {
      switch (error.message)
      {
        case VOTE_REQUESTED_BEFORE:
        case VOTE_DOC_CANNOT_BE_VERIFIED:
        default:
          log.error(error.message)
          await db.removeFromInProgress(ssn, issue)
          socket.emit('blind_sig_reveal_response', { err: 'There is a problem processing your voting right. Try again' })
      }
    }
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

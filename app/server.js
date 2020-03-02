'use strict'
const utils = require('./utils')
const blindSigs = require('blind-signatures')

module.exports = ({ app, db, keys, io, log }) =>
{
  app.get('/', (req, res, next) =>
  {
    res.send({ mess: 'Hello from Governmint.' })
  })

  app.post('/getIssues', async (req, res, next) =>
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
  })

  io.on('connection', (socket) =>
  {
    console.log('New socket connected', socket.id)
    // on test event
    socket.on('test', (args) =>
    {
      console.log('Test Event:', 'Got the arguments:', args)
      db.insertTestDocument(args)
    })

    socket.on('template_acquisition', getVoteTempelate(socket))

    socket.on('blind_sig_select', processVotesHashes(socket))

    socket.on('blind_sig_reveal', verifyAndSign(socket))

    // log disconnection
    socket.on('disconnect', () =>
    {
      console.log('socket', socket.id, 'disconnected')
    })
  })
  const VOTE_TEMPLATE = 'This is one voting right for:ISSUE,E,N,NOUNCE,LHASHES,RHASHES'
  const VOTE_FORMAT = /This is one voting right for:(.*),(.*),(.*),(.*),(.*),(.*)/
  const NUM_BLINDED_TEMPLATES = 10

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

  return app
}

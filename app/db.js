const Db = require('mongodb').Db
const Pool = require('mysql2').Pool
const log = require('./logger')

/**
 *
 * @param {object} ref
 * @param {Db} ref.db
 * @param {Pool} ref.pool
 */

// helper variables
const votesInProgress = 'votesInProgress'
function getVoters (ssn)
{
  let q = `
    select * from voter
    where 1 = 1 `
  const inserts = []
  if (typeof ssn === 'string')
  {
    q += 'and ssn = ? '
    inserts.push(ssn)
  }
  else if (Array.isArray(ssn))
  {
    q += 'and ssn in (?) '
    inserts.push(ssn)
  }
  return executeQuery(q, inserts)
}

function getIssues (codeName)
{
  let q = `
    select *
    from issue
    where 1 = 1 `
  const inserts = []

  if (typeof codeName === 'string')
  {
    q += 'and code_name = ? '
    inserts.push(codeName)
  }
  else if (Array.isArray(codeName))
  {
    q += 'and code_name = (?) '
    inserts.push(codeName)
  }

  return executeQuery(q, inserts)
}

function getIssueCount (issueCodeName)
{
  const q = `
  select choice, count(*)
  from vote
  where issue_id = ?
  group by choice`
  const inserts = [issueCodeName]
  return executeQuery(q, inserts)
}

function getVotes (issueCode, choice = '')
{
  let q = `
    select *
    from vote
    where 1 = 1 `
  const inserts = []
  if (issueCode && typeof issueCode === 'string')
  {
    q += 'and issue_id = ?'
    inserts.push(issueCode)
  }
  else if (issueCode && Array.isArray(issueCode))
  {
    q += 'and issue_id in (?)'
    inserts.push(issueCode)
  }

  if (choice && typeof choice === 'string')
  {
    q += 'and choice = ?'
    inserts.push(choice)
  }
  else if (choice && Array.isArray(choice))
  {
    q += 'and choice in (?)'
    inserts.push(choice)
  }
  return executeQuery(q, inserts)
}

function executeQuery (query, inserts)
{
  /**
   * @type {Pool}
   */
  const promPool = global.mysqlDb.promise()
  return promPool.query(query, inserts)
}

/**
   *
   * @param {{guid,ris, receiptNum, issue, choice,vote_string,signature}[]} votes
   */
function insertVotes (votes)
{
  const q = `
    insert
    into vote (guid, issue_id, choice, ris, vote, sig, receipt)
    values ?`
  const inserts = []
  const votesToInsert = []
  for (const {
    guid,
    choice,
    issue,
    ris,
    voteStr,
    signature,
    receiptNum
  } of votes)
  {
    votesToInsert.push([guid, issue, choice, JSON.stringify(ris), voteStr, signature, receiptNum])
  }
  inserts.push(votesToInsert)
  return executeQuery(q, inserts)
}

async function insertTestDocument (document)
{
  try
  {
    await db.collection('test collection').insertOne({ message: 'hello', args: document })
  }
  catch (error)
  {
    console.error(error)
  }
}

/**
 *
 * @param {(dn:Db) => Promise<void>} op
 * @param {string=} dbName
 */
async function dbExecuter (op)
{
  try
  {
    /**
     * @type {Db}
     */
    const DB = global.mongoDb
    await op(DB)
  }
  catch (error)
  {
    log.error(error)
  }
}

async function insertTemplateAquisition (ssn, issue, template)
{
  return new Promise((resolve, reject) =>
  {
    dbExecuter(async (db) =>
    {
      try
      {
        await db.collection(votesInProgress).insertOne({ ssn, issue, stages: { template_aquisition: template } })
        return resolve()
      }
      catch (err)
      {
        reject(err)
      }
    })
  })
}

function getTemplateAquisitionStage (ssn, issue)
{
  return new Promise((resolve, reject) =>
  {
    dbExecuter(async (db) =>
    {
      try
      {
        const myCurser = await db.collection(votesInProgress).find({ ssn: { $eq: ssn }, issue: { $eq: issue } }).count()
        return resolve(myCurser)
      }
      catch (error)
      {
        reject(error)
      }
    })
  })
}

function saveBlindVoteHashes (ssn, issue, hashes, selected)
{
  return new Promise((resolve, reject) =>
  {
    dbExecuter(async (db) =>
    {
      try
      {
        const results = await db.collection(votesInProgress).updateMany({
          ssn: { $eq: ssn },
          issue: { $eq: issue }
        }, {
          $set: {
            'stages.blind_sig_select': { hashes, selected }
          }
        })
        // see if at least on doc was changed
        if (results.modifiedCount === 1)
        {
          return resolve()
        }
        else
        {
          const error = new Error(`
        Voter ${ssn} has more that one vote for issue ${issue}`)
          throw error
        }
      }
      catch (error)
      {
        log.error(`Problem while inserting vote hashes for ${ssn} issue ${issue}`)
        reject(error)
      }
    })
  })
}

function removeFromInProgress (ssn, issue)
{
  return new Promise((resolve, reject) =>
  {
    dbExecuter(async (db) =>
    {
      await db.collection(votesInProgress).deleteOne({ ssn: { $eq: ssn }, issue: { $eq: issue } })
        .catch(reason =>
        {
          reject(reason)
        })
      resolve()
    })
  })
}

function getVoteHashes (ssn, issue)
{
  return new Promise((resolve, reject) =>
  {
    dbExecuter(async (db) =>
    {
      try
      {
        const myCurser = await db.collection(votesInProgress).findOne({ ssn: { $eq: ssn }, issue: { $eq: issue } })
        // return the curser to the top level function
        resolve(myCurser)
        return
      }
      catch (error)
      {
        log.error(`Problem while finding vote hashes for ${ssn} issue ${issue}`)
        reject(error)
      }
    })
  })
}

function markIssueVotedOnForUser (ssn, issue, signature)
{
  const q = `
  update voter
  set can_vote_on = JSON_SET(can_vote_on, ?, ?)
  where ssn = ? ;`
  const inserts = [`$.${issue}`, `{"sig": ${signature},"timestamp": ${Date.now()}}`, ssn]
  return executeQuery(q, inserts)
}

module.exports = {
  getTemplateAquisitionStage,
  insertTemplateAquisition,
  insertTestDocument,
  saveBlindVoteHashes,
  removeFromInProgress,
  getVoteHashes,
  getVoters,
  getVotes,
  getIssues,
  insertVotes,
  getIssueCount,
  markIssueVotedOnForUser
}

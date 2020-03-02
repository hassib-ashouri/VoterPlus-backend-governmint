const Db = require('mongodb').Db
const Pool = require('mysql2').Pool

/**
 *
 * @param {object} ref
 * @param {Db} ref.db
 * @param {Pool} ref.pool
 */
function dbModuleSetUp ({ pool, db, log })
{
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

  function executeQuery (query, inserts)
  {
    const promPool = pool.promise()
    return promPool.execute(query, inserts)
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
 * @param {(op:Db) => Promise<void>} op
 * @param {string=} dbName
 */
  async function dbExecuter (op)
  {
    try
    {
      const DB = db
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
              stages: {
                blind_sig_select: { hashes, selected }
              }
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

  return {
    getTemplateAquisitionStage,
    insertTemplateAquisition,
    insertTestDocument,
    saveBlindVoteHashes,
    getVoteHashes,
    getVoters,
    getIssues
  }
}

// // test mysql db
// pool.query('show tables;', [], (err, rows, fields) =>
// {
//   if (err)
//   {
//     log.error('Problem Connecting to mysql', err)
//   }
//   else
//   {
//     log.info('Connected mysql successfully.')
//   }
// })

module.exports = dbModuleSetUp

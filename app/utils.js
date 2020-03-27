'use strict'
const crypto = require('crypto')
const BlindSigs = require('blind-signatures')
const HASH_ALG = 'sha256'

/**
 * identifies the ssn of the cheater and returning the valid identification string
 * if found.
 * @param {string[]} ris1
 * @param {string[]} ris2
 * @param {string} identificationString
 * @throws Error if identification string was not found.
 */
function revealCheater (ris1, ris2, identificationString)
{
  for (let ind = 0; ind < ris1.length; ind++)
  {
    const result = decryptOTP({
      key: Buffer.from(ris1[ind], 'hex'),
      ciphertext: Buffer.from(ris2[ind], 'hex'),
      returnType: 'string'
    })
    if (result.includes(identificationString))
    {
      return result
    }
  }
  // if we went thourgh all ris and no result was found. throw error.
  throw new Error('was not able to identify cheater.')
}

/**
 * XORs the key with the ciphertext.  By default, this function
 * returns a buffer, but 'string' or 'buffer' may be specified.
 * @param {Object} obj
 * @param {Buffer} obj.key - list of the keys in an ris
 * @param {Buffer} obj.ciphertext - list of the ciphertext in an ris
 * @param {string} obj.returnType - return type defaults to 'buffer'
 * @author credit Dr. Thomas Austin
 */
function decryptOTP ({ key, ciphertext, returnType })
{
  if (key.length !== ciphertext.length)
  {
    throw new Error('The length of the key must match the length of the ciphertext.')
  }
  const p = Buffer.alloc(key.length)
  for (let i = 0; i < key.length; i++)
  {
    p[i] = key[i] ^ ciphertext[i]
  }
  if (!returnType || returnType === 'buffer')
  {
    return p
  }
  else if (returnType === 'string')
  {
    return p.toString()
  }
  else
  {
    throw new Error(`${returnType} is not supported as a return type`)
  }
}

// hash a string
// credit Dr. Thomas Austin
function hash (s)
{
  s = s.toString()
  return BlindSigs.messageToHash(s)
}

/**
 * get a nounce as guid
 * Credit: Dr. Thomas Austin
 * @returns {String}
 */
function getNounce ()
{
  return crypto.randomBytes(48).toString('hex')
}

function makeOTP ({ string, buffer })
{
  if ((!string && !buffer) || (!!string && !!buffer))
  {
    console.log(string)
    console.log(buffer)
    throw new Error('Either string or buffer should be specified, but not both')
  }
  // If a string was specified, convert it to a buffer.
  if (string)
  {
    buffer = Buffer.from(string)
  }
  const key = crypto.randomBytes(buffer.length)
  const ciphertext = Buffer.alloc(buffer.length)
  for (let i = 0; i < buffer.length; i++)
  {
    ciphertext[i] = buffer[i] ^ key[i]
    // console.log(`${ciphertext[i]} = ${buffer[i]} ^ ${key[i]}`);
  }
  return { key, ciphertext }
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

function verifyContents (blindVoteHash, blindingFactor, rawVoteHash, rawVote, voteFormat)
{
  // check format
  if (!rawVote.match(voteFormat))
  {
    // log.info('Vote does not match the format.')
    // log.info(rawVote)
    return false
  }
  // check the hash
  const h = hash(rawVote)
  if (h !== rawVoteHash)
  {
    // log.info(`Expecting hash of ${rawVoteHash}, but got ${h}`)
    return false
  }
  // check the blinding factor
  // TODO replace consistent function with new functionalify from blindsigs
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
  revealCheater: revealCheater,
  getNounce: getNounce,
  hash: hash,
  makeOTP: makeOTP,
  verifyContents: verifyContents
}

'use strict'
/* global describe, it, before, after */
const assert = require('assert')
const log = require('../app/logger')
const votesToVerifyRequset = require('./votesToVerifyRequest')
const votesToVerifyRequset2 = require('./votesToVerifyRequest2')
const recieptObject = require('./VoteReciept')
const supertest = require('supertest')
let request

// describe('Template Aquisition', () =>
// {
//   it('should return an error for bad ssn', (done) =>
//   {

//   })
// })

describe('Governmint Tests', () =>
{
  before(async function waitForAppToInit ()
  {
    this.timeout(15000)
    const app = await require('../app/server')
    request = supertest(app)
    await global.mysqlDb.promise().query('Call resetDb();')
  })

  after(async function resetDb ()
  {
    await global.mysqlDb.promise().query('Call resetDb();')
  })

  describe('POST /votes', () =>
  {
    const req = votesToVerifyRequset

    it('should process votes ans', (done) =>
    {
      request
        .post('/votes')
        .send(req)
        .expect(res =>
        {
          log.info('Response to verifying votes', res.body)
        })
        .expect(201)
        .end(done)
    })

    it('should process votes', (done) =>
    {
      request
        .post('/votes')
        .send(votesToVerifyRequset2)
        .expect(res =>
        {
          log.info('Response to verifying votes', res.body)
        })
        .expect(201)
        .end(done)
    })
  })

  describe('GET /issues/:ids', () =>
  {
    it('should get all the issues', (done) =>
    {
      request
        .get('/issues')
        .expect(200)
        .expect(res =>
        {
          const issueNames = Object.keys(res.body)
          assert(issueNames.length > 0, 'No issues in response')
          assert(res.body[issueNames[0]].options)
          assert(res.body[issueNames[0]].options.length > 0)
          assert(Array.isArray(res.body[issueNames[0]].options))
          assert(typeof res.body[issueNames[0]].totalCount === 'number')
          assert(typeof res.body[issueNames[0]].deadline === 'string')
          assert(new Date(res.body[issueNames[0]].deadline), 'parsable into a date obj')
        })
        .end(done)
    })

    it('should get issue with id "Danny Deckchair"', (done) =>
    {
      const issueName = 'Danny Deckchair'
      request
        .get(`/issues/${issueName}`)
        .expect(200)
        .expect(res =>
        {
          assert(res.body[issueName])
        })
        .end(done)
    })

    it('should return an empty object', (done) =>
    {
      request
        .get('/issues/junk')
        .expect(200)
        .expect(res =>
        {
          assert(Object.keys(res.body).length === 0)
        })
        .end((err, res) =>
        {
          if (err) log.debug('body of bad request', { body: res.body })
          done(err)
        })
    })
  })

  describe('POST /verifyCount', () =>
  {
    const requestBody = {
      receipt: recieptObject
    }
    it('should verify correctly signed reciept', (done) =>
    {
      request
        .post('/verifyCount')
        .send(requestBody)
        .expect(200)
        .end(done)
    })

    it('should fail with bad recipt', (done) =>
    {
      done('Not implimented')
    })
  })

  describe('GET /issues/vm', () =>
  {
    it('should get a list of issues', (done) =>
    {
      request
        .get('/issues/vm')
        .expect(200)
        .expect(({ body }) =>
        {
          assert(Array.isArray(body))
          assert(body[0].name)
          assert(body[0].description)
          assert(body[0].deadline)
          assert(body[0].options)
          assert(Array.isArray(body[0].options))
        })
        .end((err, res) =>
        {
          if (err) log.error('Error in getting issue meta data', { body: res.body })
          done(err)
        })
    })
  })

  describe('GET /admin/voters?type=milicious', () =>
  {
    it('should return a list of milicious voters', (done) =>
    {
      request
        .get('/admin/voters?type=milicious')
        .expect(200)
        .expect(({ body }) =>
        {
          assert(Array.isArray(body))
          assert(body.length > 0, 'Should have at lease one milicious voter')
          const miliciousVoter = body[0]
          assert(miliciousVoter.fullName)
          assert(miliciousVoter.issue)
          assert(miliciousVoter.ssn)
        })
        .end((err, res) =>
        {
          if (err) log.debug('problem getting milicious votes', res.body)
          done(err)
        })
    })
  })
})

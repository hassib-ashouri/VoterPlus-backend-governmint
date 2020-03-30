'use strict'
/* global describe, it, before */
const assert = require('assert')
const log = require('../app/logger')
const votesToVerifyRequset = require('./votesToVerifyRequest')
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
          assert(typeof res.body[issueNames[0]].totalCount === 'number')
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
      done('Not implemented')
    })
  })
})

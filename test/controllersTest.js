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
})

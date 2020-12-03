'use strict'

const express = require('express')
const router = express.Router()

class RootRoute {
  constructor () {
    router.get('/', (req, res) => { res.send({ status: 'OK' }) })
    router.use('/bch', require('./bch'))
    router.use('/signingKeys', require('./signing-keys'))
    router.use('/admin', require('./admin'))

    return router
  }
}

module.exports = new RootRoute()

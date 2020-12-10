'use strict'

const express = require('express')
const router = express.Router()

/**
 * CashPayServer routes
 * @namespace Routes
 */

/**
 * Root Route
 * @memberof Routes
 * 
 */
class RootRoute {
  constructor () {
    router.get('/', (req, res) => { res.send({ status: 'OK' }) })
    router.use('/invoice', require('./invoice'))
    router.use('/signingKeys', require('./signing-keys'))
    router.use('/admin', require('./admin'))

    return router
  }
}

module.exports = new RootRoute()

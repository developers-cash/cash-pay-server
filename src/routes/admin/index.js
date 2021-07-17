'use strict'

const express = require('express')
const router = express.Router()

// Middlewares
const Authenticate = require('../../middlewares/authenticate')

// Utils/Libs
const ExtError = require('../../libs/extended-error')
const Invoice = require('../../models/invoices')

/**
 * Admin routes for Invoice Management
 */
class AdminRoute {
  constructor () {
    // Define the routes
    router.post('/search', Authenticate.isAPIKeyAllowed, (req, res) => this.postSearch(req, res))

    return router
  }

  /**
   * TODO Make neater - allow user to custom filter, etc
   */
  async postSearch (req, res) {
    try {
      if (!req.body.apiKey) {
        throw new ExtError('apiKey param is required', { httpStatusCode: 500 })
      }

      req.body.filters.apiKey = req.body.apiKey

      const total = await Invoice.count(req.body.filters)

      let invoices = await Invoice.find(req.body.filters, null, {
        skip: req.body.offset,
        limit: 50,
        sort: req.body.sort,
        virtuals: true
      })

      invoices = invoices.map(invoice => new Invoice(invoice).payload())

      res.send({
        invoices: invoices,
        total: total
      })
    } catch (err) {
      return res.status(err.httpStatusCode || 500).send({ error: err.message })
    }
  }
}

module.exports = new AdminRoute()

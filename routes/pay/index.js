'use strict'

const _ = require('lodash')
const express = require('express')
const router = express.Router()

// Utils/Libs
const ExtError = require('../../libs/extended-error')
const Invoice = require('../../models/invoices')
const Log = require('../../models/logs')

// Services
const Webhooks = require('../../services/webhooks')
const webSocket = require('../../services/websocket')

// Protocols
const BIP70 = require('../../protocols/bip70')
const JSONPaymentProtocol = require('../../protocols/json-payment-protocol')

class InvoiceRoute {
  constructor () {
    // Define the routes
    router.all('/create', (req, res) => this.allCreate(req, res))
    router.get('/pay/:invoiceId', (req, res) => this.getPay(req, res))
    router.post('/pay/:invoiceId', (req, res) => this.postPay(req, res))
    router.get('/state/:invoiceId', (req, res) => this.getState(req, res))

    return router
  }

  async allCreate (req, res) {
    Log.info(req)

    try {
      // Set default values
      const params = Object.assign({}, {
        network: 'main',
        outputs: [],
        memo: 'Payment',
        data: 'Example',
        userCurrency: 'USD'
      }, req.query, req.body)

      // Make sure that at least one output script exisis
      if (!params.outputs.length) {
        throw new ExtError('You must provide at least one output.', { httpStatusCode: 400 })
      }

      // Create the payment in MongoDB
      const invoiceDB = await Invoice.create({ params: params })

      // Send response to client
      res.send({
        invoice: {
          id: invoiceDB._id,
          params: invoiceDB.params,
          state: invoiceDB.state,
          service: {
            walletURI: invoiceDB.walletURI(),
            paymentURI: invoiceDB.paymentURI(),
            stateURI: invoiceDB.stateURI(),
            webSocketURI: invoiceDB.webSocketURI()
          }
        }
      })
    } catch (err) {
      Log.error(req, err)
      return res.status(err.httpStatusCode || 500).send({ error: err.message })
    }
  }

  async getPay (req, res) {
    Log.info(req)

    // Define this here so we have access to it in the "catch"
    let invoiceDB = null

    try {
      // Retrieve Invoice from Database
      invoiceDB = await Invoice.findById(req.params.invoiceId)
      if (!invoiceDB) {
        throw new ExtError('Invoice ID does not exist.', { httpStatusCode: 404 })
      }

      // If this is a static (paper) invoice...
      if (invoiceDB.params.static) {
        invoiceDB = await this._createStaticInvoice(invoiceDB)
      }

      // Make sure invoice has not expired
      if (Date.now() > new Date(invoiceDB.state.expires * 1000)) {
        throw new ExtError('Invoice has expired.', { httpStatusCode: 403 })
      }

      // Make sure transaction has not already been broadcast
      if (invoiceDB.state.broadcasted) {
        throw new ExtError('Invoice already paid.', { httpStatusCode: 403 })
      }

      //
      // BIP70 Payment Request
      //
      if (req.get('accept') === 'application/bitcoincash-paymentrequest') {
        return await BIP70.paymentRequest(req, res, invoiceDB)
      }

      //
      // JSON Payment Protocol Request
      //
      if (req.get('accept') === 'application/payment-request') {
        return await JSONPaymentProtocol.paymentRequest(req, res, invoiceDB)
      }

      throw new ExtError('Unsupported payment type.', { httpStatusCode: 400 })
    } catch (err) {
      Log.error(req, err)
      
      try {
        res.status(err.httpStatusCode || 500).send(err.message)
      } catch (err) {
        console.log('Response probably already sent to wallet')
      }

      // Send Error Webhook Notification (if it is defined)
      if (_.get(invoiceDB, 'params.webhooks.error')) await Webhooks.error(req, err, invoiceDB)
      
      // Notify any Websockets that might be listening
      webSocket.notify(invoiceDB.notifyId(), 'failed', {
        message: err.message,
        details: err.details || {}
      })
    }
  }

  async postPay (req, res) {
    Log.info(req)

    let invoiceDB = null

    try {
      // Retrieve Invoice from Database
      invoiceDB = await Invoice.findById(req.params.invoiceId)
      if (!invoiceDB) {
        throw new ExtError('Invoice ID does not exist.', { httpStatusCode: 404 })
      }

      // Make sure transaction has not already been broadcast
      if (invoiceDB.state.broadcasted) {
        throw new ExtError('Invoice already paid.', { httpStatusCode: 403 })
      }

      //
      // BIP70 Payment Ack
      //
      if (req.get('accept') === 'application/bitcoincash-paymentack') {
        return await BIP70.paymentAck(req, res, invoiceDB)
      }

      //
      // JSON Payment Protocol Payment Verification
      //
      if (req.get('content-type') === 'application/verify-payment') {
        return await JSONPaymentProtocol.paymentVerification(req, res, invoiceDB)
      }

      //
      // JSON Payment Protocol Payment
      //
      if (req.get('content-type') === 'application/payment') {
        return await JSONPaymentProtocol.payment(req, res, invoiceDB)
      }

      throw new ExtError('Unsupported payment type.', { httpStatusCode: 400 })
    } catch (err) {
      Log.error(req, err)
      
      try {
        res.status(err.httpStatusCode || 500).send(err.message)
      } catch (err) {
        console.log('Response probably already sent to wallet')
      }

      // Send Error Webhook Notification (if it is defined)
      if (_.get(invoiceDB, 'params.webhooks.error')) await Webhooks.error(req, err, invoiceDB)
      
      // Notify any Websockets that might be listening
      webSocket.notify(invoiceDB.notifyId(), 'failed', {
        message: err.message,
        details: err.details || {}
      })
    }
  }

  async getState (req, res) {
    try {
      // Retrieve payment
      const invoiceDB = await Invoice.findById(req.params.invoiceId)
      if (!invoiceDB) {
        throw new ExtError('Invoice ID does not exist.', { httpStatusCode: 404 })
      }

      res.send({
        id: invoiceDB._id,
        state: invoiceDB.state
      })
    } catch (err) {
      Log.error(req, err)
      return res.status(err.httpStatusCode || 500).send({ error: err.message })
    }
  }

  async _createStaticInvoice (invoice) {
    const staticInvoice = await Invoice.create({
      params: invoice.params,
      state: {
        originalId: invoice._id
      }
    })

    return staticInvoice
  }
}

module.exports = new InvoiceRoute()

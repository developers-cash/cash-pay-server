'use strict'

const express = require('express')
const router = express.Router()

// Utils/Libs
const ExtError = require('../../libs/extended-error')
const Invoice = require('../../models/invoices')

// Middlewares
const Authenticate = require('../../middlewares/authenticate')

// Services
const webSocket = require('../../services/websocket')

// Protocols
const BIP70 = require('../../protocols/bip70')
const JSONPaymentProtocol = require('../../protocols/json-payment-protocol')

// Validation
var validate = require('jsonschema').validate;

/**
  * Routes pertaining to invoice creation
  * @memberof Routes
  */
class InvoiceRoute {
  constructor () {
    // Define the routes
    router.all('/create', Authenticate.isAPIKeyAllowed, (req, res) => this.postCreate(req, res))
    router.get('/pay/:invoiceId', (req, res) => this.getPay(req, res))
    router.post('/pay/:invoiceId', (req, res) => this.postPay(req, res))

    return router
  }
  
  async postCreate (req, res) {
    try {
      // Validate the payload...
      try {
        validate(req.body, this._onCreateSchema(), {
          throwFirst: true
        })
      } catch (err) {
        const firstError = err.errors[0]
        throw new ExtError(`${firstError.property} ${firstError.message}`, 400)
      }

      // Create the payment in MongoDB
      const invoiceDB = await Invoice.create(req.body)

      // Send full payload to client (including 'options')
      res.send(invoiceDB.payload())
    } catch (err) {
      console.log(err)
      return res.status(err.httpStatusCode || 500).send(err.message)
    }
  }

  async getPay (req, res) {
    // Define this here so we have access to it in the "catch"
    let invoiceDB = null

    this._setupEvent(req, res)

    try {
      // Retrieve Invoice from Database
      invoiceDB = await Invoice.findById(req.params.invoiceId)
      if (!invoiceDB) {
        throw new ExtError('Invoice ID does not exist.', { httpStatusCode: 404 })
      }

      // Make sure invoice has not expired
      if (Date.now() > new Date(invoiceDB.expires * 1000)) {
        throw new ExtError('Invoice has expired.', { httpStatusCode: 403 })
      }

      // Make sure transaction has not already been broadcast
      if (invoiceDB.hasEvent('broadcasted')) {
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
      // Set event state
      res.locals.event.status = res.locals.event.status || 'failed'
      res.locals.event.message = err.message

      // Send error to wallet
      if (!res.writableEnded) {
        res.status(err.httpStatusCode || 500).send(err.message)
      }

      // Notify any Websockets that might be listening
      webSocket.notify(invoiceDB._id, 'failed', {
        message: err.message,
        details: err.details || {}
      })
    } finally {
      // Save event log
      if (invoiceDB) {
        invoiceDB.events.push(res.locals.event)
        invoiceDB.save()
      }
    }
  }

  async postPay (req, res) {
    let invoiceDB = null

    this._setupEvent(req, res)

    try {
      // Retrieve Invoice from Database
      invoiceDB = await Invoice.findById(req.params.invoiceId)
      if (!invoiceDB) {
        throw new ExtError('Invoice ID does not exist.', { httpStatusCode: 404 })
      }

      // Make sure transaction has not already been broadcast
      if (invoiceDB.hasEvent('broadcasted')) {
        throw new ExtError('Invoice already paid.', { httpStatusCode: 403 })
      }

      // Make sure invoice has not expired
      if (Date.now() > new Date(invoiceDB.expires * 1000)) {
        throw new ExtError('Invoice has expired.', { httpStatusCode: 403 })
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
      console.log(err)

      res.locals.event.status = res.locals.event.status || 'failed'
      res.locals.event.message = err.message

      // Send error to wallet
      if (!res.writableEnded) {
        res.status(err.httpStatusCode || 500).send(err.message)
      }

      // Notify any Websockets that might be listening
      webSocket.notify(invoiceDB._id, 'failed', {
        message: err.message,
        details: err.details || {}
      })
    } finally {
      // Save event log
      if (invoiceDB) {
        invoiceDB.events.push(res.locals.event)
        invoiceDB.save()
      }
    }
  }

  _setupEvent (req, res) {
    res.locals.event = {
      userAgent: req.get('user-agent'),
      requestedWith: req.get('x-requested-with'),
      ip: req.ip,
      req: {
        method: req.method,
        headers: JSON.stringify(req.headers),
        body: req.body ? req.body instanceof Buffer ? req.body.toString('base64') : JSON.stringify(req.body) : undefined
      },
      res: {
        headers: undefined,
        payload: undefined
      }
    }
  }
  
  _onCreateSchema () {
    return {
      type: 'object',
      properties: {
        apiKey: { type: "string", maxLength: 128 },
        currency: { type: "String", maxLength: 8 },
        network: { type: "string", maxlength: 8 },
        outputs: {
          type: "array",
          items: {
            properties: {
              "amount": { type: ["integer", "string"] },
              "address": { type: "string" },
              "script": { type: "string" }
            },
            additionalProperties: false
          }
        },
        expires: { type: "integer", minimum: 30, maximum: 24*60*60 },
        merchantData: { type: "string", maxLength: 2048 },
        data: { type: "string", maxLength: 2048 },
        privateData: { type: "string", maxLength: 2048 },
        userCurrency: { type: "string", maxLength: 8 },
        webhook: {
          type: 'object',
          properties: {
            broadcasting: { type: "string" },
            broadcasted: { type: "string" },
            confirmed: { type: "string" }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  }
}

module.exports = new InvoiceRoute()

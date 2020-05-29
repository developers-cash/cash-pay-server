const config = require('../config')
const ExtError = require('../libs/extended-error')

const Invoice = require('../models/invoices')

const axios = require('axios')
const LibCash = require('@developers.cash/libcash-js')

// LibCash instance
const libCash = new LibCash()
const privateKey = libCash.ECPair.fromWIF(config.wif)

/**
 * Webhooks
 * @todo Refactor this into a service
 */
class Webhooks {
  constructor() {
    
  }
  
  async start() {
    //setInterval(this._retryFailed, 60*60*1000)
    //this._retryFailed()
  }
  
  async send(endpoint, event, payload) {
    try {
      payload = Object.assign(payload, { event: event })
      return await axios.post(endpoint, payload, {
        headers: this._buildHeader(payload)
      })
    } catch(err) {
      console.log(err)
      throw ExtError(`Webhook "${event}" failed with error "${err.response.data || err.message}".`, {
        details: {
          type: `Webhook ${event}`,
          message: err.message
        }
      });
    }
  }
  
  /**
   * Use to send a webhook when an invoice is requested.
   * @param invoice The Invoice
   */
  async requested (invoice) {
    await this.send(invoice.params.webhooks.requested, 'requested', { invoice: invoice });
  }

  /**
   * Use to send a webhook when a transactoin is broadcasted to the network.
   * @param invoice The Invoice
   */
  async broadcasted (invoice) {
    await this.send(invoice.params.webhooks.broadcasted, 'broadcasted', { invoice: invoice });
  }

  /**
   * Use to send a webhook when a transactoin is broadcasted to the network.
   * @param invoice The Invoice
   */
  async confirmed (invoice) {
    await this.send(invoice.params.webhooks.confirmed, 'confirmed', { invoice: invoice });
  }

  /**
   * Use to send a webhook when an error has occurred.
   * @param req The ExpressJS Request
   * @param err The Error thrown
   * @param invoice The invoice
   */
  static async error (req, err, invoice) {
    const payload = {
      type: 'error',
      invoice: invoice,
      req: {
        headers: req.headers,
        query: req.query,
        params: req.params,
        body: req.body
      },
      error: {
        message: err.message,
        stack: err.stack
      }
    }

    return await axios.post(invoice.params.webhooks.error, payload, {
      headers: this._buildHeader(payload)
    })
  }

  _buildHeader (payload) {
    const digest = Buffer.from(libCash.Crypto.sha256(JSON.stringify(payload)), 'utf8')
    const signature = libCash.ECPair.sign(privateKey, digest)
    return {
      digest: digest.toString('base64'),
      'x-signature-type': 'ECC',
      'x-identity': config.domain,
      'x-signature': signature.toDER().toString('base64')
    }
  }
  
  async _retryFailed() {
    console.log('here')
    
    let cutOffDate = new Date()
    cutOffDate = cutOffDate.setDate(cutOffDate.getDate() - 3)
    
    //
    // Failed Broadcasted Webhooks
    //
    let failedBroadcasted = await Invoice.find({
      'createdAt': { $gte: cutOffDate },
      'params.webhooks.broadcasted': { $exists: true },
      'state.webhooks.broadcasted': { $exists: false },
      'state.webhooks.confirmed': { $exists: false },
    })
    
    failedBroadcasted.forEach(invoice => this.broadcasted(invoice))
    
    //
    // Failed Confirmed Webhooks
    //
    let failedConfirmed = await Invoice.find({
      'createdAt': { $gte: cutOffDate },
      'params.webhooks.confirmed': { $exists: true },
      'state.webhooks.confirmed': { $exists: false },
    })
    
    failedConfirmed.forEach(invoice => this.confirmed(invoice))
    
    console.log(failedBroadcasted)
    console.log(failedConfirmed)
  }
}

const webHooks = new Webhooks()

module.exports = webHooks

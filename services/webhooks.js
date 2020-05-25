const config = require('../config')

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
  /**
   * Use to send a webhook when an invoice is requested.
   * @param invoice The Invoice
   */
  static requested (invoice) {
    const payload = { type: 'requested', invoice: invoice }
    return axios.post(invoice.params.webhooks.requested, payload, {
      headers: this._buildHeader(payload)
    })
  }

  /**
   * Use to send a webhook when a transactoin is broadcasted to the network.
   * @param invoice The Invoice
   */
  static broadcasted (invoice) {
    const payload = { type: 'broadcasted', invoice: invoice }
    return axios.post(invoice.params.webhooks.broadcasted, payload, {
      headers: this._buildHeader(payload)
    })
  }

  /**
   * Use to send a webhook when a transactoin is broadcasted to the network.
   * @param invoice The Invoice
   */
  static confirmed (invoice) {
    const payload = { type: 'confirmed', invoice: invoice }
    return axios.post(invoice.params.webhooks.confirmed, payload, {
      headers: this._buildHeader(payload)
    })
  }

  /**
   * Use to send a webhook when an error has occurred.
   * @param req The ExpressJS Request
   * @param err The Error thrown
   * @param invoice The invoice
   */
  static error (req, err, invoice) {
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

    return axios.post(invoice.params.webhooks.error, payload, {
      headers: this._buildHeader(payload)
    })
  }

  static _buildHeader (payload) {
    const digest = Buffer.from(libCash.Crypto.sha256(JSON.stringify(payload)), 'utf8')
    const signature = libCash.ECPair.sign(privateKey, digest)
    return {
      digest: digest.toString('base64'),
      'x-signature-type': 'ECC',
      'x-identity': config.domain,
      'x-signature': signature.toDER().toString('base64')
    }
  }
}

module.exports = Webhooks

const config = require('../config')
const ExtError = require('../libs/extended-error')

const _ = require('lodash')
const axios = require('axios')
const LibCash = require('@developers.cash/libcash-js')

// LibCash instance
const libCash = new LibCash()
const privateKey = libCash.ECPair.fromWIF(config.wif)

/**
 * Webhooks
 * @memberof Services
 */
class Webhooks {
  async start () {
    console.log('Starting Webhooks Service')
  }

  async send (endpoint, event, payload) {
    try {
      payload = Object.assign(payload, { event: event })
      const res = await axios.post(endpoint, payload, {
        headers: this._buildHeader(payload)
      })

      // Throw an error if response code is not 200
      if (res.status !== 200) {
        throw ExtError(`Received ${res.status} response from endpoint`)
      }

      return res
    } catch (err) {
      console.log(err)
      throw ExtError(`Webhook "${event}" failed with error "${err.message}".`, {
        details: {
          type: `Webhook ${event}`,
          message: err.message
        }
      })
    }
  }

  /**
   * Use to send a webhook when an invoice is requested.
   * @param invoice The Invoice
   */
  async requested (invoice) {
    await this.send(invoice.webhook, 'requested', { invoice: invoice.payload() })
  }

  /**
   * Use to send a webhook when a transaction is broadcasting to the network.
   * @param invoice The Invoice
   */
  async broadcasting (invoice) {
    const res = await this.send(invoice.webhook.broadcasting, 'broadcasting', { invoice: invoice.payload() })

    // If JSON is returned, amend invoice
    if (res.headers['content-type'] === 'application/json') {
      Object.assign(
        invoice,
        _.pick(res.data, ['data', 'privateData'])
      )

      await invoice.save()
    }

    return res
  }

  /**
   * Use to send a webhook when a transactoin is broadcasted to the network.
   * @param invoice The Invoice
   */
  async broadcasted (invoice) {
    const res = await this.send(invoice.webhook.broadcasted, 'broadcasted', { invoice: invoice.payload() })

    // If JSON is returned, amend invoice
    if (res.headers['content-type'] === 'application/json') {
      Object.assign(
        invoice,
        _.pick(res.data, ['data', 'privateData'])
      )

      await invoice.save()
    }

    return res
  }

  /**
   * Use to send a webhook when a transactoin is broadcasted to the network.
   * @param invoice The Invoice
   */
  async confirmed (invoice) {
    await this.send(invoice.webhook.confirmed, 'confirmed', { invoice: invoice.payload() })
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
      invoice: invoice.payload(true),
      req: {
        headers: req.headers,
        query: req.query,
        params: req.options,
        body: req.body
      },
      error: {
        message: err.message,
        stack: err.stack
      }
    }

    return await axios.post(invoice.options.webhooks.error, payload, {
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
}

const webHooks = new Webhooks()

module.exports = webHooks

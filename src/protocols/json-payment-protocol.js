const config = require('../config')

const ExtError = require('../libs/extended-error')
const Utils = require('../libs/utils')

const engine = require('../services/engine')
const webhooks = require('../services/webhooks')
const webSocket = require('../services/websocket')

const _ = require('lodash')
const LibCash = require('@developers.cash/libcash-js')

// LibCash instance
const libCash = new LibCash()
const privateKey = libCash.ECPair.fromWIF(config.wif)

/**
 * JSON Payment Protocol
 * See: https://github.com/bitpay/jsonPaymentProtocol/blob/master/v1/specification.md
 */
class JSONPaymentProtocol {
  /**
   * Payment Request
   * @todo Implement digests, signatures, etc
   */
  static async paymentRequest (req, res, invoiceDB) {
    console.log('uh oh!')

    const payload = {
      network: invoiceDB.details.network,
      currency: 'BCH',
      requiredFeePerByte: 0,
      outputs: invoiceDB.details.outputs,
      time: new Date(invoiceDB.details.time * 1000).toISOString(),
      expires: new Date(invoiceDB.details.expires * 1000).toISOString(),
      memo: invoiceDB.details.memo,
      paymentUrl: invoiceDB.service.paymentURI(),
      paymentId: invoiceDB._id
    }

    // Send the response
    res.set(this._buildHeader(payload))
      .send(payload)

    // Set requested date of payment
    invoiceDB.state.requested = new Date()
    invoiceDB.save()

    // Send Webhook Notification (if it is defined)
    // Send Broadcasted Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'options.webhook')) {
      await webhooks.send(invoiceDB.options.webhook, 'requested', { invoice: invoiceDB.payload(true) })
    }

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB.notifyId(), 'requested', { invoice: invoiceDB })
  }

  /**
   * Payment Verification
   * @todo Implement digests, signatures, etc
   */
  static async paymentVerification (req, res, invoiceDB) {
    const body = JSON.parse(req.body)

    // Throw error if it's not the BCH chain
    if (body.currency.toLowerCase() !== 'bch') {
      throw new ExtError('Your transaction currency did not match the one on the invoice.', { httpStatusCode: 400 })
    }

    // TODO Verify Outputs

    // Send the response
    res.send({
      payment: body,
      memo: 'Transaction appears valid'
    })

    // Send Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'options.webhook')) {
      await webhooks.send(invoiceDB.options.webhook, 'verified', { invoice: invoiceDB.payload(true) })
    }

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB.notifyId(), 'verified', { invoice: invoiceDB.payload() })
  }

  /**
   * Payment
   * @todo implement (properly)
   */
  static async payment (req, res, invoiceDB) {
    const body = JSON.parse(req.body)

    // Throw error if it's not the BCH chain
    if (body.currency.toLowerCase() !== 'bch') {
      throw new ExtError('Your transaction currency did not match the one on the invoice.', { httpStatusCode: 400 })
    }

    // Decode the transactions
    const transactions = body.transactions

    // Verify the constructed transaction matches what's in the invoice
    if (!Utils.matchesInvoice(invoiceDB, transactions)) {
      throw new Error('Transaction does not match invoice')
    }

    // Send Broadcasting Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'options.webhooks.broadcasting')) await webhooks.broadcasting(invoiceDB)

    // Send transactions, save txids and set broadcast date
    invoiceDB.details.txIds = await engine.broadcastTx(transactions.map(tx => tx.toString('hex')))
    invoiceDB.state.broadcasted = new Date()
    invoiceDB.save()

    // Send the response
    res.set({
      'Content-Type': 'application/payment-ack'
    }).send({
      payment: {
        transactions: body.transactions
      },
      memo: 'Payment successful'
    })

    // Send Broadcasted Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'options.webhook')) {
      await webhooks.send(invoiceDB.options.webhook, 'broadcasted', { invoice: invoiceDB.payload(true) })
    }

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB.notifyId(), 'broadcasted', { invoice: invoiceDB.payload() })

    // If it's a static invoice, increment the quantity used on the original
    if (invoiceDB.details.behavior === 'static') {
      invoiceDB.incrementQuantityUsed()
    }
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

module.exports = JSONPaymentProtocol

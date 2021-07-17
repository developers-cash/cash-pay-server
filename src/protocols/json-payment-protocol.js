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
    // Log the event as a JPP Payment Request
    res.locals.event.type = 'JPP.PaymentRequest'

    // Compile outputs into friendly form for JPP
    let outputs = invoiceDB.outputs.map(output => { return {
      address: output.address,
      amount: output.amountNative
    }})
    
    // Compile headers and payload    
    const payload = {
      network: invoiceDB.network,
      currency: 'BCH',
      requiredFeePerByte: 0,
      outputs: outputs,
      time: new Date(invoiceDB.time * 1000).toISOString(),
      expires: new Date(invoiceDB.expires * 1000).toISOString(),
      memo: invoiceDB.memo || 'Confirm Payment',
      paymentUrl: invoiceDB.service.paymentURI,
      paymentId: invoiceDB.id
    }
    
    const headers = this._buildHeader(payload)
    
    // Save payload for debugging
    res.locals.event.res.headers = JSON.stringify(headers)
    res.locals.event.res.body = JSON.stringify(payload)
    
    // Send the response
    res.set(headers)
      .send(payload)

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'requested', { invoice: invoiceDB.payloadPublic() })
    
    res.locals.event.status = 'completed'
  }

  /**
   * Payment Verification
   * @todo Implement digests, signatures, etc
   */
  static async paymentVerification (req, res, invoiceDB) {
    // Log the event as a JPP Payment Request
    res.locals.event.type = 'JPP.PaymentVerification'
    
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
    webSocket.notify(invoiceDB._id, 'verified', { invoice: invoiceDB.payload() })
  }

  /**
   * Payment
   * @todo implement (properly)
   */
  static async payment (req, res, invoiceDB) {
    // Log the event as a BIP70 Payment Request
    res.locals.event.type = 'JPP.PaymentAck'
    res.locals.event.status = 'compiling'
    
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
    if (invoiceDB.webhook && invoiceDB.webhook.broadcasting) {
      res.locals.event.status = 'webhook.broadcasting'
      await webhooks.broadcasting(invoiceDB)
    }

    // Send transactions, save txids and set broadcast date
    res.locals.event.status = 'broadcasting'
    invoiceDB.txIds = await engine.broadcastTx(transactions.map(tx => tx.toString('hex')))
    invoiceDB.broadcasted = new Date()
    await invoiceDB.save()
    
    // Send Broadcasted Webhook Notification (if it is defined)
    if (invoiceDB.webhook && invoiceDB.webhook.broadcasted) {
      res.locals.event.status = 'webhook.broadcasted'
      await webhooks.broadcasted(invoiceDB)
    }
    
    // Compile the headers and payload
    const payload = {
      payment: {
        transactions: body.transactions
      },
      memo: 'Payment successful'
    }
    
    const headers = {
      'Content-Type': 'application/payment-ack'
    }
    
    // Set in the event
    res.locals.event.res.headers = JSON.stringify(headers)
    res.locals.event.res.body = JSON.stringify(payload)

    // Send the response
    res.set(headers)
       .send(payload)

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'broadcasted', { invoice: invoiceDB.payloadPublic() })
    
    res.locals.event.status = 'completed'
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

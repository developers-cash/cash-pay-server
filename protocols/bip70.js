const _ = require('lodash')
const PaymentProtocol = require('bitcore-payment-protocol')

const Utils = require('../libs/utils')

const engine = require('../services/engine')
const webhooks = require('../services/webhooks')
const webSocket = require('../services/websocket')

class BIP70 {
  static async paymentRequest (req, res, invoiceDB) {
    // Create the outputs in BIP70 format
    const outputs = invoiceDB.details.outputs.map(output => {
      const builtOutput = Utils.buildOutput(output)
      const bipOutput = new PaymentProtocol().makeOutput()
      bipOutput.set('amount', builtOutput.amount)
      bipOutput.set('script', builtOutput.script)
      return bipOutput.message
    })

    // Construct the payment details
    var details = new PaymentProtocol('BCH').makePaymentDetails()
    details.set('network', invoiceDB.details.network)
    details.set('outputs', outputs)
    details.set('time', invoiceDB.details.time)
    details.set('expires', invoiceDB.details.expires)
    details.set('payment_url', invoiceDB.service.paymentURI)

    // Optional fields
    if (_.get(invoiceDB, 'invoice.memo')) {
      details.set('memo', invoiceDB.details.memo)
    }

    // Form the request
    var request = new PaymentProtocol().makePaymentRequest()
    request.set('payment_details_version', 1)
    request.set('serialized_payment_details', details.serialize())

    // Serialize the request
    var rawBody = request.serialize()

    // Set output headers
    res.set({
      'Content-Type': PaymentProtocol.LEGACY_PAYMENT.BCH.REQUEST_CONTENT_TYPE,
      'Content-Length': request.length,
      'Content-Transfer-Encoding': 'binary'
    }).send(rawBody)

    // Set requested date of payment
    invoiceDB.state.requested = new Date()
    invoiceDB.save()

    // Send Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'options.webhooks.requested')) await webhooks.requested(invoiceDB)

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB.notifyId(), 'requested', { invoice: invoiceDB.payload() })
  }

  static async paymentAck (req, res, invoiceDB) {
    var body = PaymentProtocol.Payment.decode(req.body)
    var payment = new PaymentProtocol().makePayment(body)
    var transactions = payment.get('transactions')

    // Save the refundTo address
    // invoiceDB.state.refundTo = payment.get('refund_to')
    console.log(payment.get('refund_to'))

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

    // Make a payment acknowledgement
    var ack = new PaymentProtocol().makePaymentACK()
    ack.set('payment', payment.message)
    ack.set('memo', 'Payment successful.')
    var rawBody = ack.serialize()

    res.set({
      'Content-Type': PaymentProtocol.LEGACY_PAYMENT.BCH.PAYMENT_ACK_CONTENT_TYPE,
      'Content-Length': rawBody.length,
      'Content-Transfer-Encoding': 'binary'
    }).send(rawBody)

    // Send Broadcasted Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'options.webhooks.broadcasted')) await webhooks.broadcasted(invoiceDB)

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB.notifyId(), 'broadcasted', { invoice: invoiceDB.payload() })
    
    // If it's a static invoice, increment the quantity used on the original
    if (invoiceDB.details.behavior === 'static') {
      invoiceDB.incrementQuantityUsed()
    }
  }
}

module.exports = BIP70

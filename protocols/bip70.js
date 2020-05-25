const _ = require('lodash')
const PaymentProtocol = require('bitcore-payment-protocol')

const Utils = require('../libs/utils')

const engine = require('../services/engine')
const Webhooks = require('../services/webhooks')
const webSocket = require('../services/websocket')

class BIP70 {
  static async paymentRequest (req, res, invoiceDB) {
    // Create the outputs in BIP70 format
    const outputs = invoiceDB.params.outputs.map(output => {
      const builtOutput = Utils.buildOutput(output)
      const bipOutput = new PaymentProtocol().makeOutput()
      bipOutput.set('amount', builtOutput.amount)
      bipOutput.set('script', builtOutput.script)
      return bipOutput.message
    })

    // Construct the payment details
    var details = new PaymentProtocol('BCH').makePaymentDetails()
    details.set('network', invoiceDB.params.network)
    details.set('outputs', outputs)
    details.set('time', invoiceDB.params.time)
    details.set('expires', invoiceDB.params.expires)
    details.set('payment_url', invoiceDB.paymentURI())

    // Optional fields
    if (_.get(invoiceDB, 'params.memo')) {
      details.set('memo', invoiceDB.params.memo)
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

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'requested', invoiceDB)

    // Send Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'params.webhooks.requested')) Webhooks.requested(invoiceDB)
  }

  static async paymentAck (req, res, invoiceDB) {
    var body = PaymentProtocol.Payment.decode(req.body)
    var payment = new PaymentProtocol().makePayment(body)
    var transactions = payment.get('transactions')
    // var refundTo = payment.get('refund_to') // UNUSED
    // var memo = payment.get('memo') // UNUSED

    // Verify the constructed transaction matches what's in the invoice
    if (!Utils.matchesInvoice(invoiceDB, transactions)) {
      throw new Error('Transaction does not match invoice')
    }

    // Send transactions, save txids and set broadcast date
    invoiceDB.state.txIds = await engine.broadcastTx(transactions.map(tx => tx.toString('hex')))
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

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'broadcasted', invoiceDB)

    // Send Broadcasted Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'params.webhooks.broadcasted')) Webhooks.broadcasted(invoiceDB)
  }
}

module.exports = BIP70

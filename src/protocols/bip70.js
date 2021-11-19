const PaymentProtocol = require('bitcore-payment-protocol')

const Utils = require('../libs/utils')

const engine = require('../services/engine')
const webhooks = require('../services/webhooks')
const webSocket = require('../services/websocket')

class BIP70 {
  static async paymentRequest (req, res, invoiceDB) {
    // Log the event as a BIP70 Payment Request
    res.locals.event.type = 'BIP70.PaymentRequest'

    // Create the outputs in BIP70 format
    const outputs = invoiceDB.outputs.map(output => {
      const builtOutput = Utils.buildOutput(output)
      const bipOutput = new PaymentProtocol().makeOutput()
      bipOutput.set('amount', builtOutput.amount)
      bipOutput.set('script', builtOutput.script)
      return bipOutput.message
    })

    // Construct the payment details
    var details = new PaymentProtocol('BCH').makePaymentDetails()
    details.set('network', invoiceDB.network)
    details.set('outputs', outputs)
    details.set('time', invoiceDB.time)
    details.set('expires', invoiceDB.expires)
    details.set('payment_url', invoiceDB.service.paymentURI)

    // Optional fields
    if (invoiceDB.memo) {
      details.set('memo', invoiceDB.memo)
    }

    // Form the request
    var request = new PaymentProtocol().makePaymentRequest()
    request.set('payment_details_version', 1)
    request.set('serialized_payment_details', details.serialize())

    // Compile headers and payload
    const payload = request.serialize()
    const headers = {
      'Content-Type': PaymentProtocol.LEGACY_PAYMENT.BCH.REQUEST_CONTENT_TYPE,
      'Content-Length': request.length,
      'Content-Transfer-Encoding': 'binary'
    }

    // Save payload for debugging
    res.locals.event.res.headers = JSON.stringify(headers)
    res.locals.event.res.body = payload.toString('base64')

    // Set output headers
    res.set(headers)
      .send(payload)

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'requested', { invoice: invoiceDB.payloadPublic() })

    res.locals.event.status = 'completed'
  }

  static async paymentAck (req, res, invoiceDB) {
    // Log the event as a BIP70 Payment Request
    res.locals.event.type = 'BIP70.PaymentAck'
    res.locals.event.status = 'compiling'

    var body = PaymentProtocol.Payment.decode(req.body)
    var payment = new PaymentProtocol().makePayment(body)
    var transactions = payment.get('transactions')

    // Save the refundTo address
    invoiceDB.refundTo = payment.get('refund_to').map(output => {
      return {
        amount: output.amount,
        script: output.script.toString('hex')
      }
    })
    console.log(invoiceDB.refundTo)

    // Verify the constructed transaction matches what's in the invoice
    if (!Utils.matchesInvoice(invoiceDB, transactions)) {
      throw new Error('Transaction does not match invoice')
    }

    // Send broadcasting websocket event
    webSocket.notify(invoiceDB._id, 'broadcasting', { invoice: invoiceDB.payloadPublic() })

    // Send Broadcasting Webhook Notification (if it is defined)
    if (invoiceDB.webhook && invoiceDB.webhook.broadcasting) {
      res.locals.event.status = 'webhook.broadcasting'
      await webhooks.broadcasting(invoiceDB)
    }

    // Send transactions, save txids
    res.locals.event.status = 'broadcasting'
    invoiceDB.txIds = await engine.broadcastTx(transactions.map(tx => tx.toString('hex')))
    invoiceDB.broadcasted = new Date()
    await invoiceDB.save()

    // Send Broadcasted Webhook Notification (if it is defined)
    if (invoiceDB.webhook && invoiceDB.webhook.broadcasted) {
      res.locals.event.status = 'webhook.broadcasted'
      await webhooks.broadcasted(invoiceDB)
    }

    // Make a payment acknowledgement
    var ack = new PaymentProtocol().makePaymentACK()
    ack.set('payment', payment.message)
    ack.set('memo', invoiceDB.memoPaid || 'Payment successful.')

    // Compile Headers and payload
    const payload = ack.serialize()
    const headers = {
      'Content-Type': PaymentProtocol.LEGACY_PAYMENT.BCH.PAYMENT_ACK_CONTENT_TYPE,
      'Content-Length': payload.length,
      'Content-Transfer-Encoding': 'binary'
    }

    // Save payload for debugging
    res.locals.event.res.headers = JSON.stringify(headers)
    res.locals.event.res.body = payload.toString('base64')

    res.set(headers)
      .send(payload)

    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'broadcasted', { invoice: invoiceDB.payloadPublic() })

    res.locals.event.status = 'completed'
  }
}

module.exports = BIP70

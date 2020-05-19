const config = require('../config');

const _ = require('lodash');
const Bitbox = require('bitbox-sdk').BITBOX;
const fs = require('fs');
const path = require('path');
const PaymentProtocol = require('bitcore-payment-protocol');
const bitcore = require('bitcore-lib-cash');

const ExtError = require('../libs/extended-error');
const Log = require('../models/logs');
const Payment = require('../models/invoices');
const Utils = require('../libs/utils');

const webSocket = require('../services/websocket');
const Webhooks = require('../libs/webhooks');

class BIP70 {
  static async paymentRequest(req, res, invoiceDB) {
    // Create the outputs
    let outputs = [];
    for (let i = 0; i < invoiceDB.params.outputs.length; i++) {
      // Build the outputs and then put them in the correct format for BIP70 library
      let builtOutput = Utils.buildOutput(invoiceDB.params.outputs[i]);
      let output = new PaymentProtocol().makeOutput();
      output.set('amount', builtOutput.amount);
      output.set('script', builtOutput.script);
      outputs.push(output.message);
    }
    
    // Construct the payment details
    var details = new PaymentProtocol('BCH').makePaymentDetails();
    details.set('network', invoiceDB.params.network);
    details.set('outputs', outputs);
    details.set('time', invoiceDB.params.time);
    details.set('expires', invoiceDB.params.expires);
    details.set('payment_url', invoiceDB.paymentURI());
    
    // Optional fields
    if (_.get(invoiceDB, 'params.memo')) {
      details.set('memo', invoiceDB.params.memo);
    }
    
    if (_.get(invoiceDB, 'params.data')) {
      details.set('merchant_data', new Buffer(invoiceDB.params.data));
    }

    // Form the request
    var request = new PaymentProtocol().makePaymentRequest();
    request.set('payment_details_version', 1);
    request.set('serialized_payment_details', details.serialize());

    // Serialize the request
    var rawBody = request.serialize();
    
    // Set output headers
    res.set({
      'Content-Type': PaymentProtocol.LEGACY_PAYMENT.BCH.REQUEST_CONTENT_TYPE,
      'Content-Length': request.length,
      'Content-Transfer-Encoding': 'binary'
    });
    
    res.send(rawBody);
    
    // Set requested date of payment
    invoiceDB.state.requested = new Date();
    invoiceDB.save();
    
    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'requested', invoiceDB);
    
    // Send Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'params.requestedWebhook')) Webhooks.requested(invoiceDB);
  }
  
  static async paymentAck(req, res, invoiceDB) {
    var body = PaymentProtocol.Payment.decode(req.body);
    var payment = new PaymentProtocol().makePayment(body);
    var transactions = payment.get('transactions');
    var refundTo = payment.get('refund_to');
    var memo = payment.get('memo');
    
    // Verify the constructed transaction matches what's in the invoice
    if (!Utils.matchesInvoice(invoiceDB, transactions)) {
      throw new Error('Transaction does not match invoice');
    }
    
    // Send transactions, save txids and set broadcast date
    let bitbox = new Bitbox({ restURL: invoiceDB.bitboxEndpoint() });
    invoiceDB.state.txIds = await bitbox.RawTransactions.sendRawTransaction(transactions.map(tx => tx.toString('hex')));
    invoiceDB.state.broadcasted = new Date();
    invoiceDB.save();
    
    // Make a payment acknowledgement
    var ack = new PaymentProtocol().makePaymentACK();
    ack.set('payment', payment.message);
    ack.set('memo', 'Payment successful.');
    var rawBody = ack.serialize();
    
    res.set({
      'Content-Type': PaymentProtocol.LEGACY_PAYMENT.BCH.PAYMENT_ACK_CONTENT_TYPE,
      'Content-Length': rawBody.length,
      'Content-Transfer-Encoding': 'binary'
    });
    
    res.send(rawBody);
    
    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'broadcasted', invoiceDB);
    
    // Send Broadcasted Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'params.broadcastedWebhook')) Webhooks.broadcasted(req, err, invoiceDB);
  }
}

module.exports = BIP70;

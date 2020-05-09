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

const webSocket = require('../services/websocket');
const Webhooks = require('../libs/webhooks');

/**
 * JSON Payment Protocol
 * See: https://github.com/bitpay/jsonPaymentProtocol/blob/master/v1/specification.md
 */
class JSONPaymentProtocol {
  /**
   * Payment Request
   * @todo Implement digests, signatures, etc
   */
  static async paymentRequest(req, res, invoiceDB) {    
    // Send the response
    res.set({
      'digest': 'xxxx', // TODO
      'x-identity': 'xxxx', // TODO
      'x-signature-type': 'ECC',
      'x-signature': 'xxxx' // TODO
    }).send({
      network: invoiceDB.params.network,
      currency: 'BCH',
      requiredFeePerByte: 0,
      outputs: invoiceDB.params.outputs,
      time: new Date().toISOString(),
      expires: new Date(invoiceDB.params.expires).toISOString(),
      memo: invoiceDB.params.memo,
      paymentUrl: `https://${config.domain}/invoice/pay/${req.params.invoiceId}`,
      paymentId: invoiceDB._id
    });
    
    // Set requested date of payment
    invoiceDB.state.requested = new Date();
    invoiceDB.save();
    
    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'requested', invoiceDB);
    
    // Send Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'params.requestedWebhook')) Webhooks.requested(invoiceDB);
  }
  
  /**
   * Payment Verification
   * @todo Implement digests, signatures, etc
   */
  static async paymentVerification(req, res, invoiceDB) {
    let body = JSON.parse(req.body);
    
    // Throw error if it's not the BCH chain
    if (body.currency.toLowerCase() !== 'bch') {
      throw new ExtError('Your transaction currency did not match the one on the invoice.', { httpStatusCode: 400 });
    }
    
    // TODO Verify Outputs
    
    // Send the response
    res.send({
      payment: body,
      memo: 'Transaction appears valid'
    });
    
    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'verified', invoiceDB);
    
    // Send Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'params.verifiedWebhook')) Webhooks.verified(invoiceDB);
  }
  
  /**
   * Payment
   * @todo implement (properly)
   */
  static async payment(req, res, invoiceDB) {
    let body = JSON.parse(req.body);
    
    // Throw error if it's not the BCH chain
    if (body.currency.toLowerCase() !== 'bch') {
      throw new ExtError('Your transaction currency did not match the one on the invoice.', { httpStatusCode: 400 });
    }
    
    // Decode the transactions
    let transactions = body.transactions;
    
    // Verify the constructed transaction matches what's in the invoice
    if (!Utils.matchesInvoice(invoiceDB, transactions)) {
      throw new Error('Transaction does not match invoice');
    }
    
    // Send each transaction to the network
    let bitbox = new Bitbox({ restURL: (invoiceDB.params.network === 'main') ? `https://rest.bitcoin.com/v2/` : `https://trest.bitcoin.com/v2/` });
    for (let i = 0; i < transactions.length; i++) {
      let txResult = await bitbox.RawTransactions.sendRawTransaction(transactions[i].toString('hex'));  
    }
    
    // Send the response
    res.set({
      'Content-Type': 'application/payment-ack',
    }).send({
      payment: {
        transactions: body.transactions
      },
      memo: 'Payment successful'
    });
    
    // Set broadcasted date of payment
    invoiceDB.state.broadcasted = new Date();
    invoiceDB.save();
    
    // Notify any Websockets that might be listening
    webSocket.notify(invoiceDB._id, 'broadcasted', invoiceDB);
    
    // Send Broadcasted Webhook Notification (if it is defined)
    if (_.get(invoiceDB, 'params.broadcastedWebhook')) Webhooks.broadcasted(req, err, invoiceDB);
  }
}

module.exports = JSONPaymentProtocol;

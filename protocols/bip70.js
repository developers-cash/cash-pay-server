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
    details.set('payment_url', `https://${config.domain}/invoice/pay/${req.params.invoiceId}`);
    
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
    
    // Only sign the request if certs are configured
    // ElectronCash and Bitcoin.com Wallet do not require this
    if (config.certPath) {
      // Setup certificates (Note the HACK to support PEM!)
      var certificate = this.PEMToDER(fs.readFileSync(path.resolve(config.certPath, 'cert.pem'), { encoding: 'utf8' }));
      var chain = this.PEMToDER(fs.readFileSync(path.resolve(config.certPath, 'chain.pem'), { encoding: 'utf8' }));
      var privKey = fs.readFileSync(path.resolve(config.certPath, 'privkey.pem'), { encoding: 'utf8' });
      
      // Load the X509 certificate
      var certificates = new PaymentProtocol().makeX509Certificates();
      certificates.set('certificate', [certificate, chain]);
      
      request.set('pki_type', 'x509+sha256');
      request.set('pki_data', certificates.serialize());
    }
    
    request.set('serialized_payment_details', details.serialize());
    
    if (config.certPath) {
      request.sign(privKey);
    }

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
    let bitbox = new Bitbox({ restURL: (invoiceDB.params.network === 'main') ? `https://rest.bitcoin.com/v2/` : `https://trest.bitcoin.com/v2/` });
    console.log(transactions.map(tx => tx.toString('hex')));
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
  
  /**
   * The Bitcore BIP70 library expects DER certs.
   * TODO Replace Bitcore with a better BIP70 Library that detects cert format.
   */
  static PEMToDER(cert) {
    let split = cert.split(/\r?\n/);
    let body = split.filter(line => !line.startsWith('-----'));
    body = body.join();
    console.log(body);
    return Buffer.from(body, 'base64');
  }
}

module.exports = BIP70;

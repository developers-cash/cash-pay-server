'use strict'

const config = require('../../config');

const _ = require('lodash');
const express = require('express');
const router = express.Router();

// Utils/Libs
const ExtError = require('../../libs/extended-error');
const Invoice = require('../../models/invoices');
const Log = require('../../models/logs');
const Webhooks = require('../../libs/webhooks');

// Services
const rates = require('../../services/rates');
const webSocket = require('../../services/websocket');

// Protocols
const BIP70 = require('../../protocols/bip70');
const JSONPaymentProtocol = require('../../protocols/json-payment-protocol');

router.all('/create', async (req, res) => {
  Log.info(req);
  
  try {
    // Set default values
    let params = Object.assign({}, {
      network: 'main',
      outputs: [],
      memo: 'Payment',
      data: 'Example',
      userCurrency: 'USD',
    }, req.query, req.body);
    
    // We want to set the expiry at the point where the request was generated
    let now = Date.now() / 1000 | 0;
    params.time = now;
    params.expires = params.time + (params.expires || 60 * 60); // Default expiry to 1 Hour
    
    // Make sure that at least one output script exisis
    if (!params.outputs.length) {
      throw new ExtError('You must provide at least one output.', { httpStatusCode: 400 });
    }
    
    // Convert output amounts to Satoshis
    for (let i = 0; i < params.outputs.length; i++) {
      params.outputs[i].amount = await rates.convert(params.outputs[i].amount);
    }
    
    // Calculate the amount in user's currency and our base currency
    let meta = {
      baseCurrency: config.baseCurrency,
      baseCurrencyTotal: params.outputs.reduce((total, output) => total + rates.convertBCHTo(output.amount, config.baseCurrency), 0).toFixed(2),
      userCurrencyTotal: params.outputs.reduce((total, output) => total + rates.convertBCHTo(output.amount, params.userCurrency), 0).toFixed(2),
    }
    
    // Create the payment in MongoDB
    let invoiceDB = await Invoice.create({ params: params, meta: meta });
    
    // Send response to client
    res.send({
      service: {
        walletURI: invoiceDB.walletURI(),
        paymentURI: invoiceDB.paymentURI(),
        stateURI: invoiceDB.stateURI(),
        webSocketURI: invoiceDB.webSocketURI(),
      },
      invoice: {
        id: invoiceDB['_id'],
        params: invoiceDB.params,
        state: {
          requested: null,
          broadcasted: null
        },
        meta: meta
      },
    });
  } catch (err) {
    Log.error(req, err);
    return res.status(err.httpStatusCode || 500).send({ error: err.message });
  }
});

router.get('/pay/:invoiceId', async (req, res) => {
  Log.info(req);
  
  // Define this here so we have access to it in the "catch"
  let invoiceDB = null;
  
  try {
      // Retrieve Invoice from Database
      invoiceDB = await Invoice.findById(req.params.invoiceId);
      if (!invoiceDB) {
        throw new ExtError('Invoice ID does not exist.', { httpStatusCode: 404 });
      }
      
      // Make sure transaction has not already been broadcast
      if (invoiceDB.state.broadcasted) {
        throw new ExtError('Invoice already paid.', { httpStatusCode: 403 });
      }
      
      //
      // BIP70 Payment Request
      //
      if (req.get('accept') === 'application/bitcoincash-paymentrequest') {
        return await BIP70.paymentRequest(req, res, invoiceDB);
      }
      
      //
      // JSON Payment Protocol Request
      //
      if (req.get('accept') === 'application/payment-request') {
        return await JSONPaymentProtocol.paymentRequest(req, res, invoiceDB);
      }
      
      throw new ExtError('Unsupported payment type.', { httpStatusCode: 400 });
  } catch(err) {
      Log.error(req, err);
      res.status(err.httpStatusCode || 500).send({ error: err.message })
      
      // Notify any Websockets that might be listening
      webSocket.notify(invoiceDB._id, 'error', err.message);
      
      // Send Error Webhook Notification (if it is defined)
      if (_.get(invoiceDB, 'params.webhooks.error')) Webhooks.error(req, err, invoiceDB);
  }
});

router.post('/pay/:invoiceId', async (req, res) => {
  Log.info(req);
  
  let invoiceDB = null;
  
  try {
      // Retrieve Invoice from Database
      invoiceDB = await Invoice.findById(req.params.invoiceId);
      if (!invoiceDB) {
        throw new ExtError('Invoice ID does not exist.', { httpStatusCode: 404 });
      }
      
      // Make sure transaction has not already been broadcast
      if (invoiceDB.state.broadcasted) {
        throw new ExtError('Invoice already paid.', { httpStatusCode: 403 });
      }
    
      //
      // BIP70 Payment Ack
      //
      if (req.get('accept') === 'application/bitcoincash-paymentack') {
        return await BIP70.paymentAck(req, res, invoiceDB);
      }
      
      //
      // JSON Payment Protocol Payment Verification
      //
      if (req.get('content-type') === 'application/verify-payment') {
        return await JSONPaymentProtocol.paymentVerification(req, res, invoiceDB);
      }
      
      //
      // JSON Payment Protocol Payment
      //
      if (req.get('content-type') === 'application/payment') {
        return await JSONPaymentProtocol.payment(req, res, invoiceDB);
      }
      
      throw new ExtError('Unsupported payment type.', { httpStatusCode: 400 });
  } catch(err) {
      Log.error(req, err);
      res.status(err.httpStatusCode || 500).send({ error: err.message })
      
      // Notify any Websockets that might be listening
      webSocket.notify(invoiceDB._id, 'error', err.message);
      
      // Send Error Webhook Notification (if it is defined)
      if (_.get(invoiceDB, 'params.webhooks.error')) Webhooks.error(req, err, invoiceDB);
  }
});

router.get('/state/:invoiceId', async (req, res) => {
  //Log.info(req);
  
  try {
    // Retrieve payment
    let invoiceDB = await Invoice.findById(req.params.invoiceId);
    if (!invoiceDB) {
      throw new ExtError('Invoice ID does not exist.', { httpStatusCode: 404 });
    }
    
    res.send({
      id: invoiceDB['_id'],
      state: invoiceDB.state
    });
  } catch (err) {
    Log.error(req, err);
    return res.status(err.httpStatusCode || 500).send({ error: err.message });
  }
});

module.exports = router 

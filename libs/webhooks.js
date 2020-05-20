const config = require('../config');

const axios = require('axios');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');

const Bitbox = require('bitbox-sdk').BITBOX;

// Read the JWT Key
let bitbox = new Bitbox();
let privateKey = bitbox.ECPair.fromWIF(config.wif);

/**
 * Webhooks
 * @todo Refactor this into a service
 */
class Webhooks {
    /**
     * Use to send a webhook when an invoice is requested.
     * @param invoice The Invoice
     */
    static requested(invoice) {
      let payload = { type: 'requested', invoice: invoice };
      let signature = bitbox.ECPair.sign(privateKey, Buffer.from(bitbox.Crypto.sha256(JSON.stringify(payload)), 'utf8'));
      return axios.post(invoice.params.webhooks.requested, payload, {
        headers: { 'X-Signature': signature.toDER().toString('base64') }
      });
    }

    /**
     * Use to send a webhook when a transactoin is broadcasted to the network.
     * @param invoice The Invoice
     */
    static broadcasted(invoice) {
      let payload = { type: 'broadcasted', invoice: invoice };
      let signature = bitbox.ECPair.sign(privateKey, Buffer.from(bitbox.Crypto.sha256(JSON.stringify(payload)), 'utf8'));
      return axios.post(invoice.params.webhooks.broadcasted, payload, {
        headers: { 'X-Signature': signature.toDER().toString('base64') }
      });
    }
    
    /**
     * Use to send a webhook when an error has occurred.
     * @param req The ExpressJS Request
     * @param err The Error thrown
     * @param invoice The invoice
     */
    static error(req, err, invoice) {
      let payload = {
        type: 'error',
        invoice: invoice,
        req: {
          headers: req.headers,
          query: req.query,
          params: req.params,
          body: req.body,
        },
        error: {
          message: err.message,
          stack: err.stack
        }
      };
      
      let signature = bitbox.ECPair.sign(privateKey, Buffer.from(bitbox.Crypto.sha256(JSON.stringify(payload)), 'utf8'));
      
      return axios.post(invoice.params.webhooks.error, payload, {
        headers: { 'X-Signature': signature.toDER().toString('base64') }
      });
    }
}
 
module.exports = Webhooks;

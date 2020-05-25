const config = require('../config');

const axios = require('axios');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');

const LibCash = require('@developers.cash/libcash-js');

// LibCash instance
let libCash = new LibCash();
let privateKey = libCash.ECPair.fromWIF(config.wif);

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
      return axios.post(invoice.params.webhooks.requested, payload, {
        headers: this._buildHeader(payload)
      });
    }

    /**
     * Use to send a webhook when a transactoin is broadcasted to the network.
     * @param invoice The Invoice
     */
    static broadcasted(invoice) {
      let payload = { type: 'broadcasted', invoice: invoice };
      return axios.post(invoice.params.webhooks.broadcasted, payload, {
        headers: this._buildHeader(payload)
      });
    }
    
    /**
     * Use to send a webhook when a transactoin is broadcasted to the network.
     * @param invoice The Invoice
     */
    static confirmed(invoice) {
      let payload = { type: 'confirmed', invoice: invoice };
      return axios.post(invoice.params.webhooks.confirmed, payload, {
        headers: this._buildHeader(payload)
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
      
      return axios.post(invoice.params.webhooks.error, payload, {
        headers: this._buildHeader(payload)
      });
    }
    
    static _buildHeader(payload) {
      let digest = Buffer.from(libCash.Crypto.sha256(JSON.stringify(payload)), 'utf8');
      let signature = libCash.ECPair.sign(privateKey, digest);
      return {
        'digest': digest.toString('base64'),
        'x-signature-type': 'ECC',
        'x-identity': config.domain,
        'x-signature': signature.toDER().toString('base64')
      }
    }
}
 
module.exports = Webhooks;

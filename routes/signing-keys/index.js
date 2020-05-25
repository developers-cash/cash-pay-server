'use strict'

const config = require('../../config');

const _ = require('lodash');
const express = require('express');
const router = express.Router();

const Log = require('../../models/logs');

const LibCash = require('@developers.cash/libcash-js');

// LibCash instance
let libCash = new LibCash();
let privateKey = libCash.ECPair.fromWIF(config.wif);
let publicKey = libCash.ECPair.toPublicKey(privateKey);

router.all('/paymentProtocol.json', async (req, res) => {
  try {
    // Make these keys valid for only one hour
    let expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours()+1);
    
    res.send({
      owner: config.domain,
      expirationDate: expirationDate.toISOString(),
      validDomains: [
        config.domain
      ],
      publicKeys: [
        publicKey.toString('hex')
      ]
    });
  } catch (err) {
    Log.error(req, err);
    return res.status(err.httpStatusCode || 500).send({ error: err.message });
  }
});

module.exports = router;

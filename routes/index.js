'use strict'

const config = require('../config');

const express = require('express');
const router = express.Router();

router.get('/status', (req, res) => { res.send({status: 'OK'}) })

router.use('/invoice', require('./pay'));

// Only allow Log output if in debugging mode
if (config.env === 'debug') {
  router.use('/logs', require('./logs'));
}

module.exports = router;

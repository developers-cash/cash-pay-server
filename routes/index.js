'use strict'

const config = require('../config');

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => { res.send({status: 'OK'}) })

router.use('/invoice', require('./pay'));

module.exports = router;

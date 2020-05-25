'use strict'

const config = require('../config');

const express = require('express');
const router = express.Router();

class RootRoute {
  constructor() {
    router.get('/', (req, res) => { res.send({status: 'OK'}) })
    router.use('/invoice', require('./pay'));
    router.use('/signingKeys', require('./signing-keys'));
    
    return router;
  }
}


module.exports = new RootRoute;

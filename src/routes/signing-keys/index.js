'use strict'

const config = require('../../config')

const express = require('express')
const router = express.Router()

const LibCash = require('@developers.cash/libcash-js')

// LibCash instance
const libCash = new LibCash()
const privateKey = libCash.ECPair.fromWIF(config.wif)
const publicKey = libCash.ECPair.toPublicKey(privateKey)

const _ = require('lodash')

class SigningKeysRoute {
  constructor () {
    router.all('/paymentProtocol.json', this.allPaymentProtocol)

    return router
  }

  async allPaymentProtocol (req, res) {
    try {
      // Make these keys valid for only one hour
      const expirationDate = new Date()
      expirationDate.setHours(expirationDate.getHours() + 1)

      res.send({
        owner: config.domain,
        expirationDate: expirationDate.toISOString(),
        validDomains: [
          config.domain
        ],
        publicKeys: [
          publicKey.toString('hex')
        ]
      })
    } catch (err) {
      return res.status(err.httpStatusCode || 500).send({ error: err.message })
    }
  }
}

module.exports = new SigningKeysRoute()

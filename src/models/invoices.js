const config = require('../config')

const rates = require('../services/rates')

const _ = require('lodash')
const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  apiKey: { type: String, index: true },
  network: { type: String, default: 'main' },
  outputs: [{
    amount: String,
    amountConverted: Number,
    address: String,
    script: String
  }],
  time: { type: Number, default: () => new Date().getTime() / 1000 },
  expires: Number,
  memo: String,
  merchantData: String,
  data: String,
  privateData: String,
  userCurrency: { type: String, default: 'USD' },
  webhook: {
    broadcasting: String,
    broadcasted: String,
    confirmed: String
  },
  totals: {
    satoshiTotal: Number,
    baseCurrency: String,
    baseCurrencyTotal: Number,
    userCurrency: String,
    userCurrencyTotal: Number
  },
  broadcasted: Date,
  confirmed: Number,
  txIds: [String],
  events: [{
    time: { type: Date, default: () => new Date() },
    type: { type: String, index: true },
    status: { type: String, index: true },
    message: String,
    userAgent: String,
    requestedWith: String,
    ip: String
  }]
}, {
  timestamps: true
})

/**
 * These are the service URL's for various functionality
 */
schema.virtual('service').get(function () {
  return {
    paymentURI: `https://${config.domain}/invoice/pay/${this._id}`,
    walletURI: `${(this.network === 'main') ? 'bitcoincash' : 'bchtest'}:?r=https://${config.domain}/invoice/pay/${this._id}`,
    webSocketURI: `wss://${config.domain}`
  }
})

schema.methods.payloadPublic = function () {
  return _.omit(
    this.toObject({ virtuals: true }),
    'apiKey',
    'privateData',
    'webhook',
    'events'
  )
}

schema.methods.payload = function () {
  return this.toObject({ virtuals: true })
}

schema.methods.convertCurrencies = function () {
  this.totals.satoshiTotal = 0
  this.totals.baseCurrency = config.baseCurrency
  this.totals.baseCurrencyTotal = 0
  this.totals.userCurrencyTotal = 0

  this.outputs.forEach(output => {
    output.amountConverted = rates.convertToBCH(output.amount)

    this.totals.satoshiTotal += output.amountConverted
    this.totals.baseCurrencyTotal += rates.convertFromBCH(output.amountConverted, config.baseCurrency).toFixed(2)
    this.totals.userCurrencyTotal += rates.convertFromBCH(output.amountConverted, this.userCurrency).toFixed(2)
  })
}

schema.methods.hasEvent = function (eventType) {
  return this.events.find((event) => event.type === eventType && event.result === 'SUCCESS')
}

schema.pre('save', async function () {
  if (this.isNew) {
    this.convertCurrencies()
    this.expires = this.time + (this.expires || 60 * 15) // Default expiry to 15m
  }
})

module.exports = mongoose.model('Invoice', schema)

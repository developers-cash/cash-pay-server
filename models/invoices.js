const config = require('../config')

const rates = require('../services/rates')

const _ = require('lodash')
const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  /**
   * The id that will be used for Websocket event notifications
   */
  originalId: { type: String },

  /**
   * These fields should never be public. If you want to add a field that should be
   * exposed to the end-user, copy them to another field in the create hook
   */
  options: {
    behavior: { type: String, default: 'normal' },
    network: { type: String, default: 'main' },
    outputs: [{ amount: String, address: String, script: String }],
    expires: Number,
    memo: String,
    data: String,
    merchantKey: { type: String, index: true },
    privateData: String,
    static: {
      validUntil: Date,
      quantity: Number
    },
    userCurrency: String,
    webhooks: {
      requested: String,
      broadcasting: String,
      broadcasted: String,
      confirmed: String,
      error: String
    }
  },

  /**
   * This stores the computed invoice information. Fields under here are accessible
   * to the end-user.
   */
  invoice: {
    behavior: String,
    network: String,
    time: Number,
    expires: Number,
    outputs: [{ amount: Number, address: String, script: String }],
    memo: String,
    // refundTo: [{ amount: Number, address: String, script: String }], // TODO
    meta: {
      satsTotal: Number,
      baseCurrency: String,
      baseCurrencyTotal: Number,
      userCurrency: String,
      userCurrencyTotal: Number
    },
    txIds: [String]
  },

  /**
   * This stores state information. Fields under here will be accessible to the
   * end-user.
   */
  state: {
    events: {
      requested: Date,
      broadcasting: Date,
      broadcasted: Date,
      confirmed: Date
    },
    static: {
      quantityUsed: Number,
      expires: Date
    },
    webhooks: {
      requested: Date,
      broadcasted: Date,
      confirmed: Date
    }
  }
}, {
  timestamps: true
})

/**
 * These are the service URL's for various functionality
 */
schema.virtual('service').get(function () {
  return {
    paymentURI: `https://${config.domain}/invoice/pay/${this._id}`,
    stateURI: `https://${config.domain}/invoice/state/${this._id}`,
    walletURI: `${(this.options.network === 'main') ? 'bitcoincash' : 'bchtest'}:?r=https://${config.domain}/invoice/pay/${this._id}`,
    webSocketURI: `wss://${config.domain}`
  }
})

/**
 * This gets the ID that WebSocket notifications should be sent to
 */
schema.methods.notifyId = function () {
  return this.originalId || this._id
}

/**
 * This returns the Invoice payload as an object.
 * @param fullPayload If true, everything will be returned
 */
schema.methods.payload = function (fullPayload) {
  if (!fullPayload) {
    return _.omit(this.toObject({ virtuals: true }), 'options')
  }

  return this.toObject({ virtuals: true })
}

schema.methods.convertCurrencies = function () {
  this.invoice.meta.satsTotal = 0
  this.invoice.meta.baseCurrency = config.baseCurrency
  this.invoice.meta.baseCurrencyTotal = 0
  this.invoice.meta.userCurrencyTotal = 0

  this.options.outputs.forEach(output => {
    const outputAmount = rates.convertToBCH(output.amount)

    this.invoice.outputs.push({
      address: output.address,
      script: output.script,
      amount: outputAmount
    })

    this.invoice.meta.satsTotal += outputAmount
    this.invoice.meta.baseCurrencyTotal += rates.convertFromBCH(outputAmount, config.baseCurrency).toFixed(2)
    this.invoice.meta.userCurrencyTotal += rates.convertFromBCH(outputAmount, this.options.userCurrency).toFixed(2)
  })
}

schema.pre('save', async function () {
  if (this.isNew) {
    this.invoice.behavior = this.options.behavior
    this.invoice.network = this.options.network
    this.convertCurrencies()
    this.invoice.memo = this.options.memo
    this.invoice.time = Date.now() / 1000
    this.invoice.expires = this.invoice.time + (this.invoice.expires || 60 * 15) // Default expiry to 15m
    this.invoice.meta.userCurrency = this.options.userCurrency
  }
})

module.exports = mongoose.model('Invoice', schema)

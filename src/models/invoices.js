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
    userCurrency: { type: String, default: 'USD' },
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
  details: {
    behavior: String,
    network: String,
    time: Number,
    expires: Number,
    outputs: [{ amount: Number, address: String, script: String }],
    memo: String,
    // refundTo: [{ amount: Number, address: String, script: String }], // TODO
    meta: {
      satoshiTotal: Number,
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
      quantityUsed: Number
    },
    webhooks: {
      requested: Date,
      broadcasting: Date,
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
 * This will increment state.static.quantityUsed on the given Invoice ID
 */
schema.methods.incrementQuantityUsed = async function () {
  const originalInvoice = await mongoose.model('Invoice').findById(this.originalId)
  if (!_.get(originalInvoice, 'state.static.quantityUsed')) {
    _.set(originalInvoice, 'state.static.quantityUsed', 0)
  }
  originalInvoice.state.static.quantityUsed++
  originalInvoice.save()
}

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
  this.details.meta.satoshiTotal = 0
  this.details.meta.baseCurrency = config.baseCurrency
  this.details.meta.baseCurrencyTotal = 0
  this.details.meta.userCurrencyTotal = 0

  this.options.outputs.forEach(output => {
    const outputAmount = rates.convertToBCH(output.amount)

    this.details.outputs.push({
      address: output.address,
      script: output.script,
      amount: outputAmount
    })

    this.details.meta.satoshiTotal += outputAmount
    this.details.meta.baseCurrencyTotal += rates.convertFromBCH(outputAmount, config.baseCurrency).toFixed(2)
    this.details.meta.userCurrencyTotal += rates.convertFromBCH(outputAmount, this.options.userCurrency).toFixed(2)
  })
}

schema.pre('save', async function () {
  if (this.isNew) {
    this.details.behavior = this.options.behavior
    this.details.network = this.options.network
    this.convertCurrencies()
    this.details.memo = this.options.memo
    this.details.time = Date.now() / 1000
    this.details.expires = this.details.time + (this.details.expires || 60 * 15) // Default expiry to 15m
    this.details.meta.userCurrency = this.options.userCurrency
    this.state.static = {}
  }
})

module.exports = mongoose.model('Invoice', schema)

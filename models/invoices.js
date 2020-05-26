const config = require('../config')

const mongoose = require('mongoose')
const Schema = mongoose.Schema

const rates = require('../services/rates')

const schema = new Schema({
  params: {
    network: String,
    outputs: [{ amount: String, address: String, script: String }],
    memo: String,
    data: String,
    expires: Number,
    webhooks: {
      requested: String,
      broadcasted: String,
      confirmed: String,
      error: String
    },
    userCurrency: String,
    static: Boolean
  },
  state: {
    originalId: String,
    outputs: [{ amount: Number, address: String, script: String }],
    time: Number,
    expires: Number,
    baseCurrency: String,
    totals: {
      baseCurrency: Number,
      userCurrency: Number
    },
    requested: Date,
    broadcasted: Date,
    confirmed: Date,
    txIds: [String]
  }
}, {
  timestamps: true
})

schema.methods.paymentURI = function () {
  return `https://${config.domain}/invoice/pay/${this._id}`
}

schema.methods.stateURI = function () {
  return `https://${config.domain}/invoice/state/${this._id}`
}

schema.methods.walletURI = function (cb) {
  return `${(this.params.network === 'main') ? 'bitcoincash' : 'bchtest'}:?r=https://${config.domain}/invoice/pay/${this._id}`
}

schema.methods.webSocketURI = function () {
  return `wss://${config.domain}`
}

schema.methods.bitboxEndpoint = function () {
  return `${(this.params.network === 'main') ? 'https://rest.bitcoin.com/v2/' : 'https://trest.bitcoin.com/v2/'}`
}

schema.methods.notifyId = function() {
  return this.state.originalId || this._id
}

schema.methods.convertCurrencies = function () {
  this.state.baseCurrency = config.baseCurrency
  this.state.totals.baseCurrency = 0
  this.state.totals.userCurrency = 0
  
  this.params.outputs.forEach(output => {
    let outputAmount = rates.convertToBCH(output.amount)
    
    this.state.outputs.push({
      address: output.address,
      script: output.script,
      amount: outputAmount
    })
    
    this.state.totals.baseCurrency += rates.convertFromBCH(outputAmount, config.baseCurrency).toFixed(2)
    this.state.totals.userCurrency += rates.convertFromBCH(outputAmount, this.params.userCurrency).toFixed(2)
  })
}

schema.pre('save', async function () {
  if (this.isNew) {
    this.convertCurrencies()
    this.state.time = Date.now() / 1000
    this.state.expires = this.state.time + (this.params.expires || 60 * 15) // Default expiry to 15m
  }
})

module.exports = mongoose.model('Invoice', schema)

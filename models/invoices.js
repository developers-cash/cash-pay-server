const config = require('../config');

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
  params: {
    network: String,
    outputs: [{ amount: Number, address: String, script: String }],
    memo: String,
    data: String,
    time: Number,
    expires: Number,
    workarounds: Boolean,
    requestedWebhook: String,
    broadcastedWebhook: String,
    confirmedWebhook: String,
    doubleSpentWebhook: String,
    signWebhooks: Boolean,
    errorWebhook: String
  },
  state: {
    requested: Date,
    broadcasted: Date,
    confirmed: Date,
    doubleSpent: Date
  }
}, {
  timestamps: true
});

schema.methods.paymentURI = function() {
  return `https://${config.domain}/invoice/${this['_id']}`;
};

schema.methods.walletURI = function(cb) {
  return `${(this.params.network === 'main') ? 'bitcoincash' : 'bchtest'}:?r=https://${config.domain}/invoice/${this['_id']}`
};

module.exports = mongoose.model('Invoice', schema);

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
    doubleSpent: Date,
    txIds: [ String ],
  }
}, {
  timestamps: true
});

schema.methods.paymentURI = function() {
  return `https://${config.domain}/invoice/pay/${this['_id']}`;
};

schema.methods.qrCodeURI = function() {
  return `https://${config.domain}/invoice/qrcode/${this['_id']}`;
};

schema.methods.stateURI = function() {
  return `https://${config.domain}/invoice/state/${this['_id']}`;
};

schema.methods.walletURI = function(cb) {
  return `${(this.params.network === 'main') ? 'bitcoincash' : 'bchtest'}:?r=https://${config.domain}/invoice/pay/${this['_id']}`
};

schema.methods.webSocketURI = function() {
  return `wss://${config.domain}`;
};

schema.methods.bitboxEndpoint = function() {
  if (this.params.network === 'main') {
    return `https://rest.bitcoin.com/v2/`;
  }
  
  return `https://trest.bitcoin.com/v2/`;
}

module.exports = mongoose.model('Invoice', schema);

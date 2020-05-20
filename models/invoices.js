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
    webhooks: {
      requested: String,
      broadcasted: String,
      error: String
    }
  },
  state: {
    requested: Date,
    broadcasted: Date,
    txIds: [ String ],
  }
}, {
  timestamps: true
});

schema.methods.paymentURI = function() {
  return `https://${config.domain}/invoice/pay/${this['_id']}`;
};

schema.methods.stateURI = function() {
  return `https://${config.domain}/invoice/state/${this['_id']}`;
};

schema.methods.walletURI = function(cb) {
  return `${(this.params.network === 'main') ? 'bitcoincash' : 'bchtest'}:?r=https://${config.domain}/invoice/pay/${this['_id']}`;
};

schema.methods.webSocketURI = function() {
  return `wss://${config.domain}`;
};

schema.methods.bitboxEndpoint = function() {
  return `${(this.params.network === 'main') ? 'https://rest.bitcoin.com/v2/' : 'https://trest.bitcoin.com/v2/'}`;
}

module.exports = mongoose.model('Invoice', schema);

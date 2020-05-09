const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
  level: String,
  payload: new Schema({
    endpoint: String,
    headers: {
      "user-agent": String,
      "accept": String,
      "content-type": String,
      "origin": String,
      "referer": String,
      "x-forwarded-for": String,
      "x-real-ip": String
    },
    params: {
      
    },
    query: {
      
    },
    body: { type: 'Mixed' }
  }, {
    strict: false
  }),
  error: {
    message: String,
    stack: String,
  }
}, {
  timestamps: true,
  useNestedStrict: true
});

schema.statics.info = function(req) {
  return this.create({
    level: 'info',
    payload: {
      endpoint: req.originalUrl,
      headers: req.headers,
      params: req.params,
      query: req.query,
      body: req.body
    }
  });
}

schema.statics.error = function(req, err) {
  console.error(err);
  
  return this.create({
    level: 'error',
    payload: {
      endpoint: req.originalUrl,
      headers: req.headers,
      params: req.params,
      query: req.query,
      body: req.body
    },
    error: {
      message: err.message,
      stack: err.stack
    }
  });
}

module.exports = mongoose.model('Log', schema);

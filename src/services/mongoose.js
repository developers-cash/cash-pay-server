'use strict'

const config = require('../config')
const mongoose = require('mongoose')

mongoose.connection.on('connected', () => {
  console.log('[Mongoose] Connected')
})

mongoose.connection.on('error', (err) => {
  console.log(`[Mongoose] Could not connect to MongoDB because of ${err}`)
  process.exit(1)
})

mongoose.set('debug', false)

exports.connect = async () => {
  mongoose.connect(config.mongoDB, {
    keepAlive: 1,
    useNewUrlParser: true
  })

  mongoose.set('useCreateIndex', true)

  return mongoose.connection
}

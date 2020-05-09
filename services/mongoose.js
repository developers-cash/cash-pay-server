'use strict'

const config = require('../config')
const mongoose = require('mongoose')

mongoose.connection.on('connected', () => {
  console.log('MongoDB is connected')
})

mongoose.connection.on('error', (err) => {
  console.log(`Could not connect to MongoDB because of ${err}`)
  process.exit(1)
})

if (config.env === 'dev') {
  mongoose.set('debug', false)
}

mongoose.set('debug', false)

exports.connect = async () => {
  mongoose.connect('mongodb://mongo:27017/app', {
    keepAlive: 1,
    useNewUrlParser: true
  })

  mongoose.set('useCreateIndex', true)

  return mongoose.connection
} 

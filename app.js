'use strict'

const config = require('./config')

// Application
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const routes = require('./routes')

// Services
const engine = require('./services/engine')
const mongoose = require('./services/mongoose')
const rates = require('./services/rates')
const webSocket = require('./services/websocket')

async function main () {
  //
  // Setup MongoDB
  //
  try {
    console.log('Connecting to MongoDB')
    await mongoose.connect()
    console.log('Connected to MongoDB')
  } catch (err) {
    console.error(err.message)
  }

  //
  // Setup Rates Conversion
  //
  try {
    console.log('Setting up Rates Conversion')
    await rates.start()
    console.log('Rates Conversion setup')
  } catch (err) {
    console.error(err.message)
  }

  //
  // Setup Engine
  //
  try {
    console.log('Setting up Electrum-Cash Engine')
    await engine.start()
    console.log('Electrum-Cash Engine setup')
  } catch (err) {
    console.error(err.message)
  }

  //
  // Setup ExpressJS middleware, routes, etc
  //
  var app = express()
  app.use(cors())
  app.use(bodyParser.json())
  app.use(bodyParser.raw({ type: '*/*' }))
  app.use(routes)

  //
  // Set port and start ExpressJS Server
  //
  var server = app.listen(config.port, function () {
    console.log('Starting ExpressJS server')
    console.log(`ExpressJS listening at http://${server.address().address}:${server.address().port}`)
  })

  //
  // Start the WebSocket Server
  //
  try {
    console.log('Starting Websocket server')
    webSocket.startServer(server)
    console.log('Websocket Server started')
  } catch (err) {
    console.error(err)
  }
}

main()

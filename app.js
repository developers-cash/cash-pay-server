'use strict';

// Application
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const routes = require('./routes');

// Services
const mongoose = require('./services/mongoose');
const webSocket = require('./services/websocket');

async function init() {
  //
  // Setup MongoDB
  //
  try {
    console.log('Connecting to MongoDB');
    await mongoose.connect();
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error(err.message);
  }
  
  //
  // Setup ExpressJS middleware, routes, etc
  //
  var app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.raw({ type:'*/*' }));
  app.use(routes);
  
  //
  // Set port and start ExpressJS Server
  //
  var port = process.env.PORT || 8080;
  var server = app.listen(port, function() {
    console.log('Starting ExpressJS server');
    const host = server.address().address;
    const port = server.address().port;
    console.log(`ExpressJS listening at http://${host}:${port}`);
  });
  
  //
  // Start the WebSocket Server
  //
  try {
    console.log('Starting Websocket server');
    webSocket.startServer(server);
    console.log('Websocket Server started');
  } catch(err) {
    console.log(err);
  }
}

init();


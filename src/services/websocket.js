'use strict'

const config = require('../config')

const SocketIO = require('socket.io')

const LibCash = require('@developers.cash/libcash-js')

// LibCash instance
const libCash = new LibCash()
const privateKey = libCash.ECPair.fromWIF(config.wif)

/**
 * WebSocket Library for Notifying Clients of Payment Events
 */
class WebSocket {
  constructor () {
    this.subscriptions = {}
  }

  /**
   * Setup the Websocket server
   */
  async startServer (server) {
    // Setup Websockets
    const socket = SocketIO(server)

    socket.on('connection', (client) => this._onConnection(client))
  }

  /**
   * Notify any Websocket connections that are subscribed to
   * the given invoiceId that an event has occurred.
   * @param invoiceId The ID of the invoice
   * @param event The event that was triggered
   * @param invoice The Invoice data
   */
  async notify (invoiceId, event, invoice) {
    try {
      if (this.subscriptions[invoiceId]) {
        // Compile payload
        var payload = Object.assign({ event: event }, invoice)
        
        // Append signature
        payload = Object.assign(payload, { signature: this._buildSignature(payload) })
        
        for (const client of this.subscriptions[invoiceId]) {
          client.emit(event, payload)
        }
      }
    } catch (err) {
      console.log(err)
    }
  }

  /**
   * Triggered when a Websocket client connects
   * @param ws The Websocket of the client
   * @private
   */
  async _onConnection (client) {
    // Setup event listeners
    client.on('subscribe', (msg) => this._onSubscribe(client, msg))
    client.on('unsubscribe', (msg) => this._onUnsubscribe(client, msg))
  }

  /**
   * Triggered when a Websocket client subscribes to an Invoice ID
   * @param client The Websocket of the client
   * @param msg The payload
   * @private
   */
  async _onSubscribe (client, msg) {
    // TODO Make sure invoice exists
    // We really want to do this as soon as client connects.
    // If we don't, then we open ourselves up to DoS attacks.
    // So. perhaps, we force a subscribe within X seconds.
    // Otherwise, we boot the client for being cunts.

    if (!this.subscriptions[msg.invoiceId]) {
      this.subscriptions[msg.invoiceId] = []
    }

    this.subscriptions[msg.invoiceId].push(client)

    return client.emit('subscribed', {
      message: `Subscribed to ${msg.invoiceId}`
    })
  }

  /**
   * Triggered when a Websocket client unsubscribes from an Invoice ID
   * @param client The Websocket of the client
   * @param msg The payload
   * @private
   */
  async _onUnsubscribe (client, msg) {
    delete this.subscriptions[msg.invoiceId]

    return client.emit('unsubscribed', {
      message: `Unsubscribed from ${msg.invoiceId}`
    })
  }
  
  _buildSignature (payload) {
    const digest = Buffer.from(libCash.Crypto.sha256(JSON.stringify(payload)), 'utf8')
    const signature = libCash.ECPair.sign(privateKey, digest)
    return {
      digest: digest.toString('base64'),
      signatureType: 'ECC',
      identity: config.domain,
      signature: signature.toDER().toString('base64')
    }
  }
}

const webSocket = new WebSocket()

module.exports = webSocket

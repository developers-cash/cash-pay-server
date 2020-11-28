'use strict'

const _ = require('lodash')

const { ElectrumCluster } = require('electrum-cash')
const Invoice = require('../models/invoices')
const webhooks = require('../services/webhooks')

/**
 * @todo Abstract out so other engines can be plugged in
 */
class Engine {
  constructor () {
    this.electrum = null
  }

  /**
   * If this is a daemon-like process, you should instantiate it here.
   */
  async start () {
    // Initialize an electrum cluster where 2 out of 3 needs to be consistent, polled randomly with fail-over.
    this.electrum = new ElectrumCluster('Electrum cluster example', '1.4.1', 1, 1)

    // Add some servers to the cluster.
    this.electrum.addServer('bch.imaginary.cash')
    this.electrum.addServer('electroncash.de')
    this.electrum.addServer('electroncash.dk')
    this.electrum.addServer('electron.jochen-hoenicke.de', 51002)
    this.electrum.addServer('electrum.imaginary.cash')
    this.electrum.addServer('bitcoincash.network')
    this.electrum.addServer('bch0.kister.net')

    // Wait for enough connections to be available.
    await this.electrum.ready()

    // Subscribe to new blocks (so that we can check if our tx's confirmed)
    await this.electrum.subscribe((block) => this._checkForConfirmedTxs(block), 'blockchain.headers.subscribe')

    // Clean up empty and expired invoices
    // setInterval(this._cleanAbandonedInvoices, 1 * 60 * 1000)
  }

  /**
   * Broadcast transaction(s) to the network.
   * @param txs Single string or array
   * @return Array of txids
   */
  async broadcastTx (txs) {
    if (typeof txs === 'string') {
      txs = [txs]
    }

    const txIds = []

    for (let i = 0; i < txs.length; i++) {
      const txId = await this.electrum.request('blockchain.transaction.broadcast', txs[i])

      if (typeof txId !== 'string') {
        throw new Error('Failed to send transaction.')
      }

      txIds.push(txId)
    }

    return txIds
  }

  async _checkForConfirmedTxs (block) {
    // Find transactions pending confirmation
    const pendingConfirmation = await Invoice.find({
      broadcasted: { $exists: true },
      confirmed: { $exists: false }
    })

    // Loop through each transaction and check if confirmed
    for (const invoice of pendingConfirmation) {
      const event = {
        type: 'TransactionConfirmed',
        status: 'processing'
      }

      try {
        let confirmed = true

        for (let j = 0; j < invoice.txIds.length; j++) {
          const tx = await this.electrum.request('blockchain.transaction.get', invoice.txIds[j], true)
          console.log(tx)
          if (!tx.confirmations) {
            confirmed = false
            break
          }
        }

        if (confirmed) {
          // TODO investigate why Array sometimes returned
          if (Array.isArray(block)) {
            invoice.confirmed = block[block.length - 1].height
          } else {
            invoice.confirmed = block.height
          }

          // Send Confirmed Webhook Notification (if it is defined)
          if (_.get(invoice, 'webhook.confirmed')) {
            event.status = 'webhook.confirmed'
            await webhooks.confirmed(invoice)
          }
        }

        event.status = 'completed'
      } catch (err) {
        console.log(err)
        invoice.message = err.message
      } finally {
        invoice.events.push(event)
        await invoice.save()
      }
    }
  }

  async _cleanAbandonedInvoices () {
    console.log('cleaning')

    await Invoice.deleteMany({
      events: { $size: 0 },
      expired: { $gt: new Date().getTime() }
    })
  }
}

const engine = new Engine()

module.exports = engine

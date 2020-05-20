'use strict'

const _ = require('lodash');

const ElectrumCluster = require('electrum-cash').Cluster;
const Invoice = require('../models/invoices');
const Webhooks = require('../libs/webhooks');

/**
 * @todo Abstract out so other engines can be plugged in
 */
class Engine {
  constructor() {
    this.electrum = null;
  }
  
  /**
   * If this is a daemon-like process, you should instantiate it here.
   */
  async start() {
    // Initialize an electrum cluster where 2 out of 3 needs to be consistent, polled randomly with fail-over.
    this.electrum = new ElectrumCluster('Electrum cluster example', '1.4.1', 2, 3, ElectrumCluster.ORDER.RANDOM);

    // Add some servers to the cluster.
    this.electrum.addServer('bch.imaginary.cash');
    this.electrum.addServer('electroncash.de');
    this.electrum.addServer('electroncash.dk');
    this.electrum.addServer('electron.jochen-hoenicke.de', 51002);
    this.electrum.addServer('electrum.imaginary.cash');

    // Wait for enough connections to be available.
    await this.electrum.ready();
    
    // Subscribe to new blocks (so that we can check if our tx's confirmed)
    await this.electrum.subscribe(() => this._checkForConfirmedTxs(), 'blockchain.headers.subscribe');
  }
  
  /**
   * Broadcast transaction(s) to the network.
   * @param txs Single string or array
   * @return Array of txids
   */
  async broadcastTx(txs) {
    if (typeof txs === 'string') {
      txs = [txs];
    }
    
    let txIds = [];
    
    for (let i = 0; i < txs.length; i++) {
      let txId = await this.electrum.request('blockchain.transaction.broadcast', txs[i]);
      
      if (typeof txId !== 'string') {
        throw 'Failed to send transaction.';
      }
      
      txIds.push(txId);
    }
    
    return txIds;
  }
  
  async _checkForConfirmedTxs() {
    let pendingConfirmation = await Invoice.find({
      "state.broadcasted": { $exists: true },
      "state.confirmed": { $exists: false }
    });
    
    pendingConfirmation.forEach(async invoice => {
      let confirmed = true;
      
      for (let j = 0; j < invoice.state.txIds.length; j++) {
        let tx = await this.electrum.request('blockchain.transaction.get', invoice.state.txIds[j], true);
        if (!tx.confirmations) {
          confirmed = false;
          break;
        }
      }
      
      if (confirmed) {
        invoice.state.confirmed = new Date();
        invoice.save();
        
        // Send Confirmed Webhook Notification (if it is defined)
        if (_.get(invoice, 'params.webhooks.confirmed')) Webhooks.confirmed(invoice);
      }
    });
  }
}

const engine = new Engine;

module.exports = engine;

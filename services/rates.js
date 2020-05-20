'use strict'

const config = require('../config');

const axios = require('axios');

/**
 * @todo Abstract out so other engines can be plugged in
 */
class Rates {
  constructor() {
    this.rates = null;
    this.lastRefresh = new Date();
  }
  
  async start() {
    setInterval(this.refresh, config.ratesRefresh * 1000);
    this.refresh();
  }
  
  /**
   * @todo This code is disgusting. Fix me.
   */
  convert(amount) {
    // If it's already in satoshis, do nothing.
    if (typeof amount === 'number') {
      return amount;
    }
    
    // Otherwise, let's split it and get the value
    let splitValue = amount.match(/[\d\.]+/g);
    if (splitValue.length !== 1) {
      throw new Error('Invalid output amount given.');
    }
    let value = Number(splitValue[0]);
    
    // Now let's split the currency
    let splitCurrency = amount.match(/[a-zA-Z]+/g);
    
    // If no currency was specified (e.g. user accidentally gave a string)...
    if (!splitCurrency) {
      return Math.round(value);
    }
    
    // If the currency does not have a rate conversion
    let currency = splitCurrency[0];
    if (typeof this.rates[currency] === 'undefined') {
      throw new Error(`Currency ${currency} not supported.`);
    }
    
    return Math.round(value / Number(this.rates[currency]) * 100000000);
  }
  
  async refresh() {
    try {
      let priceRes = await axios.get('https://api.coinbase.com/v2/exchange-rates?currency=BCH');
      this.rates = priceRes.data.data.rates;
    } catch (err) {
      console.error("Error refreshing rates");
      console.error(err);
      return false;
    }
  }
}

const rates = new Rates;

module.exports = rates;

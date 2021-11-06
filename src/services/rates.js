'use strict'

const config = require('../config')

const axios = require('axios')

/**
 * @todo Abstract out so other engines can be plugged in
 */
class Rates {
  constructor () {
    this._rates = null
  }

  async start () {
    setInterval(() => this.refresh(), config.ratesRefresh * 1000)
    this.refresh()
  }

  convertToBCH (amount, fromCurrency) {
    if (typeof amount === 'string') {
      fromCurrency = amount.replace(/[^a-zA-Z]/g, '')
      amount = Number(amount.replace(/[^0-9.]/g, ''))
    }

    if (fromCurrency) {
      if (typeof this._rates[fromCurrency] === 'undefined') {
        throw new Error(`Currency ${fromCurrency} not supported.`)
      }

      amount = Math.round(amount / Number(this._rates[fromCurrency]) * 100000000)
    }

    return amount
  }

  convertFromBCH (amount, targetCurrency) {
    if (typeof this._rates[targetCurrency] === 'undefined') {
      throw new Error(`Currency ${targetCurrency} not supported.`)
    }

    return parseFloat(amount / 100000000 * Number(this._rates[targetCurrency]))
  }

  async refresh () {
    try {
      console.log('[Rates] Refreshing from Coinbase')
      const priceRes = await axios.get('https://api.coinbase.com/v2/exchange-rates?currency=BCH')
      this._rates = priceRes.data.data.rates
    } catch (err) {
      console.error(`[Rates] ${err.message}`)
      return false
    }
  }
}

const rates = new Rates()

module.exports = rates

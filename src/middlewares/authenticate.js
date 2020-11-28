'use strict'

const config = require('../config')

// Utils/Libs
const ExtError = require('../libs/extended-error')

/**
 * Admin routes for Invoice Management
 */
class Authenticate {
  /**
   * TODO Make neater - allow user to custom filter, etc
   */
  static async isAPIKeyAllowed (req, res, next) {
    try {
      // If there are whitelisted API Keys...
      if (config.apiKeys) {
        // If no API Key was provided in request...
        if (!req.body.apiKey) {
          throw new ExtError('API Key was not specified', { httpStatusCode: 403 })
        }

        // Split list of API Keys
        const apiKeys = config.apiKeys.split(',')

        // Check to see if API Key is in Whitelist
        if (!apiKeys.includes(req.body.apiKey)) {
          throw new ExtError('API Key is invalid', { httpStatusCode: 403 })
        }
      }

      next()
    } catch (err) {
      return res.status(err.httpStatusCode || 500).send({ error: err.message })
    }
  }
}

module.exports = Authenticate

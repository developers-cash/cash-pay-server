const LibCash = require('@developers.cash/libcash-js')

// LibCash instance
const libCash = new LibCash()

/**
 * Utility functions
 */
class Utils {
  static buildOutput (output) {
    const built = {
      amount: output.amount || 0
    }

    // If address is set, create P2PKH script
    if (output.address) {
      const address = libCash.Address.toHash160(output.address)
      const type = libCash.Address.detectAddressType(output.address)

      if (type === 'p2sh') {
        built.script = libCash.Script.fromASM(`OP_HASH160 ${address} OP_EQUAL`)
      } else if (type === 'p2pkh') {
        built.script = libCash.Script.fromASM(`OP_DUP OP_HASH160 ${address} OP_EQUALVERIFY OP_CHECKSIG`)
      } else {
        throw new Error('Unsupported address type')
      }
    } else if (output.script) { // If a script is set, convert it to buffer
      built.script = Buffer.from(output.script, 'hex')
    } else { // Otherwise, throw an error
      throw new Error('Output did not contain address or script')
    }

    return built
  }

  static buildOutputs (outputs) {
    const built = []
    for (const output of outputs) {
      built.push(Utils.buildOutput(output))
    }
    return built
  }

  /**
     * Verify that transaction contains outputs specified in invoice
     * @param invoice The Invoice
     * @param transaction Raw Transaction Hex
     */
  static matchesInvoice (invoiceDB, transactions) {
    // Build outputs so that they are in script format
    const invoiceOutputs = Utils.buildOutputs(invoiceDB.state.outputs)

    // Iterate through the transactions and their outputs
    for (const transaction of transactions) {
      let tx = ''

      // Convert string to buffer (JSON Payment Proto will give us string)
      if (typeof transaction === 'string') {
        tx = Buffer.from(transaction, 'hex')
      }

      // HACK Bitcore's BIP70 wraps buffers in its own format
      // We should try to move away from Bitcore in future.
      if (typeof transaction === 'object') {
        tx = transaction.toBuffer()
      }

      // Decode the transaction
      tx = libCash.Transaction.fromBuffer(tx)

      // Iterate through each output
      for (const out of tx.outs) {
        for (let i = invoiceOutputs.length - 1; i >= 0; i--) {
          const invoiceOut = invoiceOutputs[i]
          if (out.value === invoiceOut.amount && out.script.equals(invoiceOut.script)) {
            invoiceOutputs.splice(i, 1)
          }
        }
      }
    }

    // If all outputs have been given, return true
    return !invoiceOutputs.length
  }
}

module.exports = Utils

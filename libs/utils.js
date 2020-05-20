const config = require('../config');

const axios = require('axios');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');

const LibCash = require('@developers.cash/libcash-js');

// LibCash instance
let libCash = new LibCash();

/**
 * Utility functions
 */
class Utils {
    static buildOutput(output) {
      let built = {
        amount: output.amount || 0
      }
      
      // If address is set, create P2PKH script
      if (output.address) {
        let address = libCash.Address.toHash160(output.address);
        let type = libCash.Address.detectAddressType(output.address);
        
        if (type === 'p2sh') {
          built.script = libCash.Script.fromASM(`OP_HASH160 ${address} OP_EQUAL`);
        } else if (type === 'p2pkh') {
          built.script = libCash.Script.fromASM(`OP_DUP OP_HASH160 ${address} OP_EQUALVERIFY OP_CHECKSIG`);
        } else {
          throw new Error('Unsupported address type');
        }
      }
      
      // If a script is set, convert it to buffer
      else if (output.script) {
        built.script = Buffer.from(output.script, 'hex');
      }
      
      // Otherwise, throw an error
      else {
        throw new Error('Output did not contain address or script');
      }
      
      return built;
    }
  
    static buildOutputs(outputs) {
      let built = [];
      for (let output of outputs) {
        built.push(Utils.buildOutput(output));
      }
      return built;
    }
  
    /**
     * Verify that transaction contains outputs specified in invoice
     * @param invoice The Invoice
     * @param transaction Raw Transaction Hex
     */
    static matchesInvoice(invoiceDB, transactions) {
      // Build outputs so that they are in script format
      let invoiceOutputs = Utils.buildOutputs(invoiceDB.params.outputs);

      // Iterate through the transactions and their outputs
      for (let transaction of transactions) {
        let tx = '';
        
        // Convert string to buffer (JSON Payment Proto will give us string)
        if (typeof transaction === 'string') {
          tx = Buffer.from(transaction, 'hex');
        }
        
        // HACK Bitcore's BIP70 wraps buffers in its own format
        // We should try to move away from Bitcore in future.
        if (typeof transaction === 'object') {
          tx = transaction.toBuffer();
        }
        
        // Decode the transaction
        tx = libCash.Transaction.fromBuffer(tx);
        
        // Iterate through each output
        for (let out of tx.outs) {
          for (let i = invoiceOutputs.length - 1; i >= 0; i--) {
            let invoiceOut = invoiceOutputs[i];
            if (out.value === invoiceOut.amount && out.script.equals(invoiceOut.script)) {
              invoiceOutputs.splice(i, 1);
            }
          }
        }
      }
      
      // If all outputs have been given, return true
      return !invoiceOutputs.length;
    }
}
 
module.exports = Utils;

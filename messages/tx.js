
const { logger  } = require('../utils/logHandler');
const { bufferToBigIntLE, decodeVarInt } = require('../utils/helper');



class Tx {
  constructor({ version, inCount, txInArray, outCount, txOutArray, lockTime, messageLength } = {}) {
    this.command = 'tx';
    this.version = version;
    this.inCount = inCount;
    this.txInArray = txInArray;
    this.outCount = outCount;
    this.txOutArray = txOutArray;
    // this.witnessArray = witnessArray;
    this.lockTime = lockTime;
    this.messageLength = messageLength;
  }

  static parse(buffer) {
    try {
      
      const messageLength = buffer.length;
      let offset = 0;

      // Version - Uint32: 4 bytes
      const version = buffer.readUInt32LE(offset); // 32 bits - 4 bytes
      offset += 4;

      // Flag - Uint8: 0 or 2 bytes
      let flag = null;
      // let hasWitness = false;
      if (buffer[offset] === 0x00 && buffer[offset + 1] === 0x01) {
        flag = buffer.readUInt16LE(offset); // 16 bits - 2 bytes
        // hasWitness = true;
        offset += 2;
      }

      const { value: inCount, size: inCountSize } = decodeVarInt(buffer, offset);
      offset += inCountSize;

      // Tx In - Array[]: 41+ bytes
      const txInArray = [];
      for (let i = 0; i < inCount; i++) {
        const txHash = buffer.slice(offset, offset + 32).reverse();
        offset += 32;
        const txIndex = buffer.readUInt32LE(offset).toString();
        offset += 4;


        const { value: scriptLength, size: scriptLengthSize } = decodeVarInt(buffer, offset);
        offset += scriptLengthSize;

        if (scriptLength > buffer.length - offset) {
          logger('warn', 'Tx.parse - Script Length:', scriptLength, 'greater than bufferLength at offset', offset);
          return { tx: null, newOffset: 0 };
        }

        const signatureScript = scriptLength > 0 ? buffer.slice(offset, offset + scriptLength) : '';
        offset += scriptLength;
        const sequence = buffer.readUInt32LE(offset);
        offset += 4;

        txInArray.push({ txHash, flag, txIndex, scriptLength, signatureScript, sequence });
      }

      const { value: outCount, size: outCountSize } = decodeVarInt(buffer, offset);
      offset += outCountSize;

      // if (outCount > 100) { // Large number to prevent parsing error
      //   logger('warn', 'Tx.parse - OutCount:', outCount, 'greater than 100, Unrealistic output count ');
      //   return { tx: null, newOffset: this.messageLength };
      // }

      const MAX_TX_SIZE = 1_000_000;  // 1MB - larger than any standard tx
      if (messageLength > MAX_TX_SIZE) {
        logger('warn', `TX.parse - Message size: ${messageLength} exceeds max size allowed`);
        return { tx: null, newOffset: messageLength };
      }

      // Tx Out - Array[]: 9+ bytes
      const txOutArray = [];
      for (let i = 0; i < outCount; i++) {
        const txValueBuffer = buffer.slice(offset, offset + 8);
        const txValue = bufferToBigIntLE(txValueBuffer).toString();
        offset += 8;

        const { value: pkScriptLength, size: pkScriptLengthSize } = decodeVarInt(buffer, offset)

        offset += pkScriptLengthSize;

        if (pkScriptLength > buffer.length - offset) {
          logger('warn', `Tx.parse - Pk Script Length: ${pkScriptLength} greater than buffer length at: ${offset}`);
          return { tx: null, newOffset: 0 };
        }

        const pkScript = pkScriptLength > 0 ? buffer.slice(offset, offset + pkScriptLength) : '';
        offset += pkScriptLength;

        txOutArray.push({ txValue, pkScriptLength, pkScript });
      }

      // if (offset + 4 > buffer.length) throw new Error('Buffer too short for lockTime');
      const lockTime = buffer.readUInt32LE(offset);
      offset += 4;

      return { tx: new Tx({ version, flag, inCount, txInArray, outCount, txOutArray, lockTime, messageLength }), newOffset: offset };

    } catch (err) {
      logger('error', err, 'Tx.parse');
      return { tx: null, newOffset: 0 };
    }
  }

  toJsObject() {
    return {
      command: this.command,
      version: this.version,
      transaction_byte_size: this.messageLength,
      flag: this.flag ? this.flag.toString('hex') : null,
      inCount: this.inCount,
      input: this.txInArray.map(tx => ({
        hash: tx.txHash.toString('hex'),
        index: tx.txIndex,
        script_length: tx.scriptLength,
        signature_script: tx.signatureScript.toString('hex'),
        sequence: tx.sequence,
      })),
      outCount: this.outCount,
      output: this.txOutArray.map(tx => ({
        value: tx.txValue,
        pk_scriptLength: tx.pkScriptLength,
        pk_script: tx.pkScript.toString('hex'),
      })),
      // witnesses: this.witnessArray ? this.witnessArray.map(wit => wit.map(item => item.toString('hex'))) : null,
      lock_time: this.lockTime,
    };
  }
}

module.exports = Tx;


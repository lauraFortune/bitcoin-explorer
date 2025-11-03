
const { logger } = require('../utils/logHandler');
const { decodeVarInt, hash256 } = require('../utils/helper');


class Headers {
  constructor({ count, headers, inventory } = {}) {
    this.command = 'headers';
    this.count = count;
    this.headers = headers;
    this.inventory = inventory;
  }

  static parse(buffer) {
    try{

      let headersArray = [];
      let blockInventory = [];
      let offset = 0;
      const { value: headerCount, size: headerCountSize } = decodeVarInt(buffer, offset);
      offset += headerCountSize

      logger('info', 'Headers.parse - Header count:', headerCount);

      if (headerCount === 0) {
        logger('warn', 'headers.parse - Headers count:', headerCount);
        return new Headers({ count: headerCount, headers: headersArray });
      }

      // Parse each header
      for (let i = 0; i < headerCount; i++) {
        // Each header is 80 bytes
        if (buffer.length < offset + 80) {
          throw new Error(`Buffer too short for header ${i + 1}`);
        }
        
        const header = buffer.slice(offset, offset + 80);

        // Parse header fields (80 bytes total)
        const version = header.readInt32LE(0);
        const prevBlock = header.slice(4, 36).reverse().toString('hex');
        const merkleRoot = header.slice(36, 68).reverse().toString('hex');
        const timestamp = header.readUInt32LE(68);
        const bits = header.slice(72, 76).toString('hex');
        const nonce = header.readUInt32LE(76);

        // Calculate block hash
        const hashBE = hash256(header);                 // Block hash in big endian format
        const hashLE = Buffer.from(hashBE).reverse();   // Block hash in little endian format


        offset += 80;

        // Number of transactions (varint, always 0 in headers message)
        const { value: txCount, size: txSize } = decodeVarInt(buffer, offset);

        // txCount must be zero
        if (txCount !== 0) {
          throw new Error(`Expected txCount to be 0, got ${txCount}`);
        }

        offset += txSize;

        headersArray.push({
          version,
          prevBlock,
          merkleRoot,
          timestamp,
          bits,
          nonce,
          blockHash: hashBE.toString('hex'),
        });

        blockInventory.push({ type: 2, hash: hashLE});
      }

      

      return new Headers({ count: headerCount, headers: headersArray, inventory: blockInventory });

    } catch (err) {
      logger('error', 'Headers.parse', err);
      return null;
    }

  }
}

module.exports = Headers;
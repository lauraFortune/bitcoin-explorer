
const { logger } = require('../utils/logHandler');
const { encodeVarInt, signedIntToLittleEndian } = require('../utils/helper');

class GetHeaders {
  constructor({ 
    version = 70015,              // Bitcoin protocol version - default: 70015
    blockLocatorHashes = [],      // Array of block hashes (little endian)
    stopHash = Buffer.alloc(32)   // hash of last desired block hash (little endian) - 32 zero bytes -> up to tip
  } = {}) {
    this.command = 'getheaders';
    this.version = version;
    this.blockLocatorHashes = blockLocatorHashes;
    this.stopHash = stopHash;
  }

  serialise() {
    try {
      return Buffer.concat([
        signedIntToLittleEndian(this.version, 4),     // 4 byte buffer
        encodeVarInt(this.blockLocatorHashes.length),
        this.blockLocatorHashes.length ? Buffer.concat(this.blockLocatorHashes) : Buffer.alloc(0),
        this.stopHash,
      ]);

    } catch (err) {
      logger('error', err, 'GetHeaders.serialise Error');
      return null;
    }
  }
}

module.exports = GetHeaders;
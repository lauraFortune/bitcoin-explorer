
const { encodeVarInt } = require('../utils/helper');
const { logger } = require('../utils/logHandler');


class GetBlocks {
  constructor({ version = 70015, blockLocatorHashes, hashStop } = {}) {
    this.command = 'getblocks';
    this.version = version;
    this.blockLocatorHashes = blockLocatorHashes;
    this.hashCount = blockLocatorHashes.length;
    this.hashStop = hashStop;
  }


  serialise() {
    try{

      const versionBuffer = Buffer.alloc(4);
      versionBuffer.writeUInt32LE(this.version, 0);

      const hashCountBuffer = encodeVarInt(this.blockLocatorHashes.length);

      const blockHashLocatorBuffer = Buffer.concat(this.blockLocatorHashes.map(blockHash => {
        return Buffer.from(blockHash, 'hex');
      }))

      const hashStopBuffer = Buffer.from(this.hashStop, 'hex');

      return Buffer.concat([ versionBuffer, hashCountBuffer, blockHashLocatorBuffer, hashStopBuffer]);
    } catch (err) {
      logger('error', 'GetBlocks.serialise', err);
      return null;
    }
  }
}

module.exports = GetBlocks; 
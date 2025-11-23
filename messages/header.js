const { logger } = require('../utils/logHandler');
const { hash256, intToLittleEndian, littleEndianToBigInt } = require('../utils/helper');

require('dotenv').config();

const MAGIC_NUMBER = process.env.MAGIC_NUMBER;

class Header {
  constructor({ 
    command, 
    payload, 
  } = {}) {
    this.magic = Buffer.from(MAGIC_NUMBER, 'hex'); // 4 byte magic num 
    this.command = Buffer.alloc(12); // Set buffer to 12 bytes
    this.command.write(command, 'ascii'); // writes command in ASCII to command buffer
    this.payload = payload; // Payload (e.g. Version message)
    this.payloadLength = payload.length; // Message size
    // Performs double sha245 on payload and takes the first 4 bytes
    this.checksum = hash256(payload).slice(0, 4); 
  }

  serialise() {
    return Buffer.concat([
      this.magic,
      this.command,
      intToLittleEndian(this.payloadLength, 4), // payload length - 4 byte buffer
      this.checksum,
  
    ]);
  }

  // Extracts header from buffer message and returns parsed header object
  static parse(buffer) {
    try {
      // First check buffer message is greater than 24 Bytes
      if (buffer.length < 24 ){ // If less - too short to be valid message
        throw new Error(`Buffer less than 24 bytes: ${buffer.length} bytes`)
      }
      // Extract and parse header elements
      const command = buffer.slice(4, 16).toString('ascii').replace(/\0/g, ''); // Extracts and removes null chars
      const magicNumber = buffer.slice(0, 4).toString('hex'); // Bitcoin magic number
      const payloadBuffer = buffer.slice(16, 20); // Extracts payload buffer
      const payloadLength = littleEndianToBigInt(payloadBuffer); // Converts to int
      const checksum = buffer.slice(20, 24).toString('hex'); // Checksum as hex string
    
      // Returns parsed header elements as object
      return { magicNumber, command, payloadLength, checksum };
    } catch (err) {
      logger('error', 'Header.parse', err);
      return null;
    }
  }
}


module.exports = Header;



/**
 * Header: (version message) 
 * - https://learnmeabitcoin.com/technical/networking/#version
 
┌─────────────┬──────────────┬───────────────┬───────┬─────────────────────────────────────┐
│ Name        │ Example Data │ Format        │ Size  │ Bytes                               │
├─────────────┼──────────────┼───────────────┼───────┼─────────────────────────────────────┤
│ Magic Bytes │              │ bytes         │     4 │ F9 BE B4 D9                         │
│ Command     │ "version"    │ ascii bytes   │    12 │ 76 65 72 73 69 6F 6E 00 00 00 00 00 │
│ Size        │ 85           │ little-endian │     4 │ 55 00 00 00                         │
│ Checksum    │              │ bytes         │     4 │ F7 63 9C 60                         │
└─────────────┴──────────────┴───────────────┴───────┴─────────────────────────────────────┘
 */



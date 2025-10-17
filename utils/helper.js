
const crypto = require('crypto');
const ip = require('ip');

/**
 * Converts *unsigned int to little endian byte sequence
 * @param {number|BigInt} int     // Int to convert
 * @param {number} length         // Num bytes in buffer (1-6 OR 8)
 * @returns {Buffer}              // Little endian bytes
 */
const intToLittleEndian = (int, length) => {
  const buffer = Buffer.alloc(length); 
  if (length === 8) {
    buffer.writeBigUInt64LE( BigInt(int), 0);
  } else {
    buffer.writeUIntLE(Number(int), 0, length); 
  }
  return buffer;
}


/**
 * Converts *signed int to little endian byte sequence
 * @param {number|BigInt} int     // Int to convert
 * @param {number} length         // Num bytes in buffer (1-6 OR 8)
 * @returns {buffer}              // Little endian bytes
 */
const signedIntToLittleEndian = (int, length) => {
  const buffer = Buffer.alloc(length);
  if (length === 8) {
    buffer.writeBigInt64LE(BigInt(int), 0);
  } else {
    buffer.writeIntLE(Number(int), 0, length);
  } 
  return buffer;
}


/**
 * Converts *unsigned int to big endian byte sequence
 * @param {number|BigInt} int      // Int to convert
 * @param {number} length          // Num bytes in buffer (2, 4 or 8)
 * @returns {Buffer}               // Big endian bytes
 */
const intToBigEndian = (int, length) => {
  const buffer = Buffer.alloc(length);
  if (length === 2) {
    buffer.writeUInt16BE(Number(int), 0);
  } else if (length === 4) {
    buffer.writeUInt32BE(Number(int), 0);
  } else if (length === 8) {
    buffer.writeBigUInt64BE(BigInt(int), 0);
  }
  return buffer;
}


/**
 * Converts *unsigned little endian byte sequence to BigInt
 * @param {Buffer} buffer     // Buffer to decode     
 * @returns {BigInt}          // Decoded int
 */
const littleEndianToBigInt = (buffer) => {

  let intValue;
  const length = buffer.length;
  
  if (length === 8) {
    intValue = buffer.readBigUInt64LE(0);
  } else if (length <= 6) {
    intValue = BigInt(buffer.readUIntLE(0, length)); 
  } else {
    throw new Error(`littleEndianToBigInt: Buffer length not supported for safe integer conversion`);
  }
  return intValue;
}


/**
 * Converts *signed little endian byte sequence to BigInt
 * @param {Buffer} buffer     // Buffer to decode 
 * @returns {BigInt}          // Decoded int 
 */
const signedLittleEndianToBigInt = (buffer) => {
  let intValue;
  const length = buffer.length;

  if (length === 8) {
    intValue = buffer.readBigInt64LE(0);
  } else if ( length <= 6 ) {
    intValue = BigInt(buffer.readIntLE(0, length));
  } else {
    throw new Error(`signedLittleEndianToBigInt: Buffer length not supported for safe integer conversion`);
  }
  return intValue;
}


/**
 * Converts BigInt to safe JS Number
 * @param {BigInt} bigIntValue    // BigInt value to convert 
 * @returns {number}              // Number OR throws error if num exceeds JS MAX_SAFE_INTEGER
 */
const bigIntToSafeNumber = (bigIntValue) => {
  const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);
  if(bigIntValue > maxSafeInteger) {
    throw new  Error(`BigInt value exceeds safe integer range`);
  } 
  return Number(bigIntValue);
}


/**
 * Decodes varints from buffer
 * @param {Buffer} buffer     // Buffer containing varint
 * @param {number} [offset=0]     // Varint starting position in buffer
 * @returns {Object}          // Object {value: number|BigInt, size: number}
 */
function decodeVarInt(buffer, offset = 0) {
  const firstByte = buffer.readUInt8(offset);
  if (firstByte < 0xfd) {
    return { value: firstByte, size: 1 };
  } else if (firstByte === 0xfd) {
    const value = buffer.readUInt16LE(offset + 1);
    return { value, size: 3 };
  } else if (firstByte === 0xfe) {
    const value = buffer.readUInt32LE(offset + 1);
    return { value, size: 5 };
  } else {
    const value = buffer.readBigUInt64LE(offset + 1);
    return { value, size: 9 };
  }
}


/**
 * Encodes integer as varint
 * @param {number|BigInt} int       // Integer (number OR BigInt) to encode
 * @returns {Buffer}                // Varint encoded buffer (1, 3, 5, or 9 bytes)
 */
function encodeVarInt(int) {

  // First: Normalise int to BigInt
  const bigIntVal = (typeof int === 'bigint') ? int : BigInt(int);

  if (bigIntVal < 0xfd) {
    return Buffer.from([Number(bigIntVal)]);
  } else if (bigIntVal <= 0xffff) {
    const buffer = Buffer.alloc(3);
    buffer.writeUInt8(0xfd, 0);
    buffer.writeUInt16LE(Number(bigIntVal), 1);
    return buffer;
  } else if (bigIntVal <= 0xffffffff) {
    const buffer = Buffer.alloc(5);
    buffer.writeUInt8(0xfe, 0);
    buffer.writeUInt32LE(Number(bigIntVal), 1);
    return buffer;
  } else {
    const buffer = Buffer.alloc(9);
    buffer.writeUInt8(0xff, 0);
    buffer.writeBigUInt64LE(bigIntVal, 1);
    return buffer;
  }
}


/**
 * Converts buffer to BigInt using little endian byte order
 * @param {Buffer} buffer     // Buffer to convert       
 * @returns {BigInt}          // Bigint representation of buffer
 */
function bufferToBigIntLE(buffer) {
  const hex = buffer.toString('hex');
  return BigInt(`0x${hex.match(/../g).reverse().join('')}`)
}


/**
 * Converts IPv4 and IPv6 addresses to 16 byte buffer
 * - If IPv4 converts to IPv6 address first
 * - Uses npm lib 'IP' to verify ip address format
 * @param {string} ipAddress      // IPv4 Or IPv6 address string
 * @returns {Buffer}              // 16-byte buffer in IPv6 format
 */
const ipToBuffer = (ipAddress) => {
  // if IPv4
  if (ip.isV4Format(ipAddress)){ 
    return Buffer.concat([ // Concatenates buffers to single 16 byte buffer (IPv6)
      Buffer.alloc(10), // 10 byte buffer
      Buffer.from([0xff, 0xff]), // 2 byte buffer
      ip.toBuffer(ipAddress) // 4 byte buffer
    ]) // if IPv6
  } else if (ip.isV6Format(ipAddress)) {
    return ip.toBuffer(ipAddress); // convert directly to IPv6 byte buffer
  } else {
    throw new Error('Invalid IP Address!')
  }
}

/**
 * Performs a double round of SHA256 hashing on input buffer
 * - Uses npm lib 'crypto' for hashing
 * @param {Buffer} input      // Bytes to hash 
 * @returns {Buffer}          // Double SHA-256 result
 */
const hash256 = (input) => {
  const singleHash = crypto.createHash('sha256').update(input).digest();  // first hash round
  return crypto.createHash('sha256').update(singleHash).digest();         // second hash round
}


module.exports = {
  intToLittleEndian,
  signedIntToLittleEndian,
  intToBigEndian,
  littleEndianToBigInt,
  signedLittleEndianToBigInt,
  bigIntToSafeNumber,
  decodeVarInt,
  encodeVarInt,
  bufferToBigIntLE,
  ipToBuffer,
  hash256,
}


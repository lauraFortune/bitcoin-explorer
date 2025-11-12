const { logger } = require('../utils/logHandler');
const { handleVersion, handleVerack, handlePing, handlePong, handleInv, handleBlock, handleTx, handleHeaders, handleNotFound, } = require('./messageHandler');


// Listen for incoming messages to complete handshake
const commandHandler = (socket, data, address) => { 

  // Initialise buffer for socket - if buffer doesn't already exist
  if (!socket._buffer) socket._buffer = Buffer.alloc(0);
  socket._buffer = Buffer.concat([socket._buffer, data]);   // Update socket's buffer
  let buffer = socket._buffer;                              // Create local reference

  while (buffer.length >= 24) {
    const header = buffer.slice(0, 24);               // Extract the header
    const payloadLength = header.readUInt32LE(16);    // Extract the payload length (4 bytes starting from the 16th byte)

    if (buffer.length < 24 + payloadLength) break;    // Message not complete

    const payload = buffer.slice(24, 24 + payloadLength);   // Extract the payload
    const command = header.slice(4, 16).toString('ascii').replace(/\0/g, '');
      
    try{
      processMessage(command, socket, address, payload); // Process the message
    } catch (err) {
      logger('error', err, 'CommandHandler Error:', command, 'from', address );
    }
      
    buffer = buffer.slice(24 + payloadLength); // Remove the processed message from the buffer
    socket._buffer = buffer;                   // Save updated buffer on socket
  }
};

function processMessage(command, socket, address, payload) {
  switch (command) {
    case 'version':
      handleVersion(socket, address);
      break;
    case 'verack':
      handleVerack(socket, address);
      break;
    case 'ping':
      handlePing(socket, address)
      break;
    case 'pong':
      handlePong(socket, address);
      break;
    case 'inv':
      handleInv(socket, address, payload);
      break;
    case 'headers':
      handleHeaders(socket, address, payload);
      break;
    case 'block':
      handleBlock(socket, address, payload);
      break;
    case 'tx':
      handleTx(socket, address, payload);
      break;
    case 'notfound':
      handleNotFound(socket, address, payload);
      break;
    default: // Logs any other msg types received
      logger('info','Ignore', command, 'from', address );
  } 
}

module.exports = commandHandler;

const { logger } = require('../utils/logHandler');
const createConnection = require('./create-connection');
const getIps = require('./dns-resolver');
const handshake = require('./handshake');
const foreverLoop = require('./foreverLoop');
const net = require('net');

let aborted = false;
let currentSocket = null;

const abortConnection = () => {
  aborted = true;

  if (currentSocket) {
    try {
      currentSocket._cleanup();
    } catch (err) {
      logger('warn', 'Cleanup failed during abort:', err.message);
    }
    currentSocket = null;
  }
  logger('info', 'Connection attempts aborted');
}

const loadConnection = async (btc_port, btc_host, onSocketConnected) => {

  aborted = false;

  logger('info', 'BTC Port:', btc_port);
  logger('info', 'Node:', btc_host);

  const host = btc_host.trim();
  const addresses = net.isIP(host) ? [host] : await getIps(host);

  if (!addresses || addresses.length === 0){
    logger('error', 'No addresses returned:', btc_host);
    return;
  }

  // Keep trying with while loop
  while (!aborted) {
    const connected = await connection(btc_port, addresses, onSocketConnected); // Initiates node connection process
    if (connected) {
      break;
    } else {
      if (aborted) break;
      // If connection failed, wait before retrying
      logger('warn', 'Connection failed, retrying in 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  }

  if (aborted) {
    logger('info', 'loadConnection: Aborted by user');
  }

};


const connection = async (btc_port, addresses, onSocketConnected) => {
  let handshakeComplete = false;

  for (const address of addresses) { 
    if (handshakeComplete) break; // If successful handshake, break
    if (aborted) break;           // If connection has been aborted, break

    try {
      const socket = await createConnection(btc_port, address); // Create TCP connection to Bitcoin network address
      currentSocket = socket;

      if (aborted) {
        socket._cleanup();
        break;
      }

      const performHandshake = await handshake(socket, address);

      if (aborted) {
        socket._cleanup();
        break;
      }
      
      if(performHandshake === true) { // On Success
        handshakeComplete = true; // Update variable

        // Call back runs and global activeSocket is updated
        if (onSocketConnected) { onSocketConnected(socket) }

        await foreverLoop(socket, address); // awaits - async function 'foreverloop' with successfull address
        currentSocket = null;
        break; // Exits for loop
      } else { // Else unsuccessful handshake
        socket._cleanup(); // Cleans up and calls socket.destroy internally
        currentSocket = null;
        continue; // Continue to next function
      }

    } catch (err) { // Catch - node connection errors
      logger('error', err, 'Connection Error');
      currentSocket = null;
      return;
    } 
  };// end for loop 
  
  if (!handshakeComplete) { // If no success after for loop complete
    logger('warn', 'Connection.handshake Failed');
    return false; // Returns false if not connected
  } else {
    return true; // Retrurns true if connected
  }
  
};



module.exports = {
  loadConnection,
  abortConnection,
}

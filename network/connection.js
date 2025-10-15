
const { logger } = require('../utils/logHandler');
const createConnection = require('./create-connection');
const getIps = require('./dns-resolver');
const handshake = require('./handshake');
const foreverLoop = require('./foreverLoop');



const loadConnection = async (btc_port, btc_host, onSocketConnected) => {

    logger('info', 'BTC Port:', btc_port);
    logger('info', 'Node:', btc_host);

    // Checks if ip address is DNS Seed (String), in which case resolve them, else list of ip addresses 
    const addresses = typeof(btc_host) === 'string' ? await getIps(btc_host) : btc_host;


    if (!addresses || addresses.length === 0){
      logger('error', 'No addresses returned:', btc_host);
      return;
    }

    // Keep trying with while loop
    while (true) {
      const connected = await connection(btc_port, addresses, onSocketConnected); // Initiates node connection process
      if (connected) {
        break;
      } else {
        // If connection failed, wait before retrying
        logger('warn', 'Connection failed, retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    }

};


const connection = async (btc_port, addresses, onSocketConnected) => {
  let handshakeComplete = false;

  for (const address of addresses) { 
    if (handshakeComplete) break; // Failsafe - If successful handshake, break out of for loop

    try {
      const socket = await createConnection(btc_port, address); // Create TCP connection to Bitcoin network address
      const performHandshake = await handshake(socket, address);
      
      if(performHandshake === true) { // On Success
        handshakeComplete = true; // Update variable

        // Call back runs and global activeSocket is updated
        if (onSocketConnected) { onSocketConnected(socket) }

        await foreverLoop(socket, address); // awaits - async function 'foreverloop' with successfull address
        break; // Exits for loop
      } else { // Else unsuccessful handshake
        socket.destroy(); // Close connection
        continue; // Continue to next function
      }

    } catch (err) { // Catch - node connection errors
      logger('error', err, 'Connection Error');
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
}

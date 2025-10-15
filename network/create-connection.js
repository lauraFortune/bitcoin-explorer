
const {logger } = require('../utils/logHandler');
const net = require('net');


const createConnection = (port, host) => {
  return new Promise((resolve, reject) => { 

    const socket = net.createConnection({ port, host });
    let cleanedUp = false;

    /**
     * Socket functions
     */

    // Comprehensive cleanup to prevent data leaks
    const cleanup = (err) => {

      if (cleanedUp) return;
      cleanedUp = true;

      logger('warn', 'Cleaning up....');

      // Clear ping timer first
      if (socket._pingTimer) {
        clearInterval(socket._pingTimer);
        socket._pingTimer = null;
      }

      // Emit handshake broken BEFORE removing listeners so that foreverloop can hear it
      socket.emit('handshakeBroken', err);

      // Now safe to remove all listeners
      socket.removeAllListeners();
      socket._buffer = null;  // Clear buffer

      // Close Socket
      try {
        socket.end();
      } catch { }     // Ignore possible error as socket has already been closed

      // Destroy Socket
      try {
        if (err) {
          socket.destroy(err);
        } else {
          socket.destroy();
        }
      } catch { }   // Ignore possible error as socket has already been destroyed

    }

    socket._cleanup = cleanup;

    // Clear specific data listener
    socket.clearDataListener = (onData) => {
      socket.off('data', onData);
    }

    // Check if data listeners are removed
    const dataListners = socket.checkDataListenersRemoved = () => {
      const listeners = socket.listeners('data');
      logger('success', listeners.length, listeners);
      return listeners.length;
    }

    socket.dataListners = dataListners;

    
    /**
     * Event listners
     */
    
    // On connect
    socket.once('connect', () => {
      logger('success', 'CreateConnection - Connect success with', host, ':', port );
      resolve(socket);
    });

    // On error
    socket.once('error', (err) => { 
      logger('error', err, 'CreateConnection - Error with', host, ':', port);
      cleanup(err);
    });

            
    // On end 
    socket.once('end', () => {
      logger('warn', 'CreateConnection - Ending network connection', host, ':', port);
    })

    // on close
    socket.once('close', (err) => {
      if (err) {
        logger('error', err, 'CreateConnection - Closing network connection with error', host, ':', port);
      } else {
        logger('warn', 'CreateConnection - Closing network connection without error', host, ':', port);
      }
      // Cleanup is handled externally - not here
    })

  });
}



module.exports = createConnection;

const {logger } = require('../utils/logHandler');
const net = require('net');


const createConnection = (port, host) => {
  return new Promise((resolve, reject) => { 

    const socket = net.createConnection({ port, host });

    /**
     * Socket functions
     */

    // Comprehensive cleanup to prevent data leaks
    const cleanup = (err) => {
      logger('warn', 'Cleaning up....');
      socket.emit('handshakeBroken');
      socket.removeAllListeners();
      socket._buffer = null;  // Clear buffer
      if (socket) {
        socket.end();
        if (err) {
          socket.destroy(err);
        } else {
          socket.destroy(); // Gracefully destroy without error
        }
      }
    }

    socket.cleanup = cleanup;

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
      logger('warn', 'Cleaned up...');
      reject(err);
    });

            
    // On end 
    socket.once('end', () => {
      logger('warn', 'CreateConnection - Ending network connection', host, ':', port);
    })

    // On close
    socket.once('close', (err) => {
      if(err) {
        logger('error', err, 'CreateConnection - Closing network connection with error', host, ':', port);
        cleanup(err);
        reject(err);
      } else {
        logger('warn', 'CreateConnection - Closing network connection without error', host, ':', port);
        cleanup();
        resolve();
      }
    });

  });
}



module.exports = createConnection;
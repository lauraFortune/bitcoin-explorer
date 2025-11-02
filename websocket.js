const { Server } = require('socket.io');
const { logger } = require('./utils/logHandler');
const { loadConnection: connectToNode, abortConnection } = require('./network/connection');
const { setIoInstance } = require('./broadcast');

let io;
let activeSocket = null; // Store active BTC socket globally (single user support only)

const websocketSetup = (server, btc_port) => {
  try {

    if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
      logger('error', 'Websocket.setup: CORS_ORIGIN must be set in production mode');
      throw new Error('CORS_ORIGIN environment variable required for production')
    }

    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGIN.split(',').map(url => url.trim()) // Prod mode - list of allowed domain urls
      : true   // Dev mode - allow all urls
    
    io = new Server(server, {
      pingTimeout: 60000,
      pingInterval: 25000,
      cors: {
        origin: allowedOrigins
      }
    });

    setIoInstance(io); // set the IO instance for broadcasting

    io.on('connection', (ws) => {
      console.log('connecting to websocket');
      logger('info', 'a user connected');
  
      ws.on('start', async (data) => {
        console.log('starting websocket....');
        logger('info', 'Start streaming Bitcoin data');

        // Clean up existing connection first
        if (activeSocket) {
          logger('warn', 'Cleaning up existing connection before starting new one');
          try {
            activeSocket._cleanup();
          } catch (err) {
            logger('error', 'Cleanup failed on start:', err.message);
          }
          activeSocket = null;
        }

        const { dnsSeed, ipAddress } = data;
        const btc_host = dnsSeed || ipAddress;

        // BTC Port, Host and Socket passed to load connection with
        connectToNode(btc_port, btc_host, (socket) => { activeSocket = socket }); // Callback stores socket reference once connection succeeds
      });
  
      ws.on('stop', () => {
        console.log('stopping websocket....');
        logger('info', 'Stop streaming Bitcoin data');

        abortConnection();
        
        // Close active BTC socket - if exists
        if (activeSocket) {
          try {
            activeSocket._cleanup();
          } catch (err) {
            logger('error', 'Cleanup failed on stop:', err.message);
          }
          activeSocket = null;
        }
      });
  
      ws.on('disconnect', (reason) => {
        console.log('disconnecting websocket....');
        logger('info', `a user disconnected: ${reason}`);

        abortConnection();

        // Clean up BTC socket if user closes browser without closing connection
        if (activeSocket) {
          try {
            activeSocket._cleanup();
          } catch (err) {
            logger('error', 'Cleanup failed on disconnect:', err.message);
          }
          
          activeSocket = null;
        }
      });
    }) // end on connection
  
    return io;

  } catch (err) {
    logger('error', 'connectToWebSocket - Socket.IO connection error:', err);
  }
}; // end connectToWebSocket



module.exports = {
  websocketSetup,
}

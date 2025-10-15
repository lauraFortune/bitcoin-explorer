
const { logger } = require('./utils/logHandler');

let io;


const setIoInstance = (ioInstance) => {
  io = ioInstance;
};


const broadcast = (data) => {
  try {
    if(io) {
      io.emit('btcData', data);
    }
  } catch (err) {
    logger('error', 'BroadcastBitcoin - Socket.IO emit error:', err);
  }
}


module.exports = {
  setIoInstance,
  broadcast,
}
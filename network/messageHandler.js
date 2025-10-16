const { logger } = require('../utils/logHandler');
const { verackMessage, getBlocksMessage, pongMessage, getDataMessage } = require("../builders/messageBuilder");
const Inv = require('../messages/inv');
const Block = require('../messages/block');
const Transaction = require('../messages/tx');
const { setLatestBlock } = require('../store/blockData'); // Global variable - stores latest block
const { setLatestTx } = require('../store/txData'); // Global variable - stores latest tx 
const { broadcast } = require('../broadcast');


const getBlocks = (socket, address) => {
  const networkBlockMessage = getBlocksMessage();
  socket.write(networkBlockMessage);
  console.log(`Sent GetBlocks to ${address}`);
}

const handleVersion = (socket, address) => {
  logger('info', 'MessageHandler - Received Version', address);

  // websocket broadcast
  broadcast(`received version from ${address}`);

  const networkVerackMessage = verackMessage(); // 3. Send verack msg upon receiving version
  socket.write(networkVerackMessage);
  logger('info', 'MessageHandler - Sent Verack to', address);

  broadcast(`sent verack to ${address}`);
}

const handleVerack = (socket, address) => {
  logger('info', 'MessageHandler - Received Verack from', address);

  broadcast(`received verack from ${address}`);

  socket.emit('performedHandshake'); // Emit successful handshake event - updates handshake function

  broadcast(`performed handshake with ${address}`);
  // getBlocks(socket, address);
}

const handlePing = (socket, address) => {
  logger('info', 'MessageHandler - Received Ping from', address);

  // websocket broadcast
  broadcast(`received ping from ${address}`);

  const networkPongMessage = pongMessage();
  socket.write(networkPongMessage);
  logger('info', 'MessageHandler - Sent Pong to', address);

  // websocket broadcast
  broadcast(`sent pong to ${address}`);
}

const handlePong = (socket, address) => {
  logger('info', 'MessageHandler - Received Pong from', address);

    // websocket broadcast
    broadcast(`Received Pong from ${address}`);
}

const handleInv = (socket, address, payload) => {
  logger('info', 'MessageHandler - Received Inv from', address);
  const parsedInv = Inv.parse(payload);
  logger('info', 'MessageHandler - Parsed Inv:', JSON.stringify(parsedInv));

  broadcast(parsedInv);

  const networkGetDataMessage = getDataMessage(parsedInv.inventory);
  socket.write(networkGetDataMessage);
  logger('info', 'MessageHandler - Sent GetData to', address);
}

const handleBlock = (address, payload) => {
  logger('block', 'MessageHandler - Received Block from', address);
  const parsedBlock = Block.parse(payload);
  if (parsedBlock) {
    parsedBlock.calculateHash();
    parsedBlock.calculateDifficulty();
    const objBlock = parsedBlock.toJsObject();
    logger('block', `MessgeHandler - Parsed Block:\n`, JSON.stringify(objBlock, null, 2));
    setLatestBlock(objBlock);

    // websocket broadcast
    broadcast(objBlock);
  } else {
    logger('error', 'MessageHandler - Failed to Parse Block from', address);
  }
}

const handleTx = (address, payload) => {
  logger('tx', 'MessageHandler - Received Tx from', address);
  const {tx: parsedTx} = Transaction.parse(payload);
  if (parsedTx) {
    const objTx = parsedTx.toJsObject();
    logger('tx', `MessgeHandler - Parsed Tx:\n`, JSON.stringify(objTx, null, 2));
    setLatestTx(objTx);

    // websocket broadcast
    broadcast(objTx);
  } else {
    logger('error', 'MessageHandler - Failed to Parse Tx from', address);
  }
}

module.exports = {
  handleVersion,
  handleVerack,
  getBlocks,
  handlePing,
  handlePong,
  handleInv,
  handleBlock,
  handleTx
}

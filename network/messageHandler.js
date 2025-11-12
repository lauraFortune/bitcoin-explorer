const { logger } = require('../utils/logHandler');
const { getCheckpoint } = require('../utils/bitcoinSync');
const {
  verackMessage,
  getBlocksMessage,
  pongMessage,
  getDataMessage,
  sendHeadersMessage,
  getHeadersMessage,
} = require('../builders/messageBuilder');
const Inv = require('../messages/inv');
const Headers = require('../messages/headers');
const Block = require('../messages/block');
const Transaction = require('../messages/tx');
const { setLatestBlock } = require('../store/blockData');
const { setLatestTx } = require('../store/txData');
const { broadcast } = require('../broadcast');

const MAX_BLOCK_CHUNK = 3;  // 3–4 recommended
const BLOCK_TIMEOUT_MS = 60000;

function ensureSocketState(socket) {
  if (!socket._blockQueue) {
    socket._blockQueue = [];
    socket._blockQueueSet = new Set();
    socket._awaitingBlocks = new Set();
    socket._fetchingBlocks = false;
    socket._blockFetchTimer = null;
  }
}

function bufferFromHash(hash) {
  if (Buffer.isBuffer(hash)) return hash;
  if (typeof hash === 'string') return Buffer.from(hash, 'hex');
  return Buffer.from(hash);
}

function enqueueBlocks(socket, items, context = '') {
  ensureSocketState(socket);
  let added = 0;

  items.forEach((item) => {
    const hashBuf = bufferFromHash(item.hash);
    const hashHex = hashBuf.toString('hex');

    if (socket._blockQueueSet.has(hashHex) || socket._awaitingBlocks.has(hashHex)) {
      return;
    }

    socket._blockQueue.push({ type: 2, hash: hashBuf });
    socket._blockQueueSet.add(hashHex);
    added += 1;
  });

  if (added > 0) {
    logger('info', `MessageHandler - Queued ${added} blocks${context ? ` (${context})` : ''}`);
  }

  requestNextBlockChunk(socket);
}

function requestNextBlockChunk(socket) {
  ensureSocketState(socket);
  if (socket._fetchingBlocks) return;
  if (socket._blockQueue.length === 0) return;

  const chunk = socket._blockQueue.splice(0, MAX_BLOCK_CHUNK);
  socket._awaitingBlocks = new Set(chunk.map((item) => item.hash.toString('hex')));
  socket._fetchingBlocks = true;

  const networkGetDataMessage = getDataMessage(chunk);
  socket.write(networkGetDataMessage);
  logger('info', `MessageHandler - Sent GetData for ${chunk.length} blocks`);

  // Broadcast GETDATA to frontend
  broadcast({ type: 'getdata-sent', data: { count: chunk.length } });

  if (socket._blockFetchTimer) clearTimeout(socket._blockFetchTimer);
  socket._blockFetchTimer = setTimeout(() => {
    logger('warn', 'MessageHandler - Block fetch timeout, retrying pending hashes');
    const pending = Array.from(socket._awaitingBlocks).map((hex) => ({
      type: 2,
      hash: Buffer.from(hex, 'hex'),
    }));

    socket._awaitingBlocks.clear();
    socket._fetchingBlocks = false;
    socket._blockFetchTimer = null;

    if (pending.length > 0) {
      enqueueBlocks(socket, pending, 'retry');
    } else {
      requestNextBlockChunk(socket);
    }
  }, BLOCK_TIMEOUT_MS);
}

function markBlockDelivered(socket, hashHex) {
  ensureSocketState(socket);

  if (socket._blockFetchTimer && socket._awaitingBlocks.size === 0) {
    clearTimeout(socket._blockFetchTimer);
    socket._blockFetchTimer = null;
  }

  socket._blockQueueSet.delete(hashHex);
  socket._awaitingBlocks.delete(hashHex);

  if (socket._awaitingBlocks.size === 0 && socket._fetchingBlocks) {
    socket._fetchingBlocks = false;
    logger('info', 'MessageHandler - Completed current block chunk');
    requestNextBlockChunk(socket);
  }
}

const getBlocks = (socket, address) => {
  const networkBlockMessage = getBlocksMessage();
  socket.write(networkBlockMessage);
  logger('info', 'MessageHandler - Sent GetBlocks to', address);
};

const handleVersion = (socket, address) => {
  logger('info', 'MessageHandler - Received Version', address);
  broadcast(`received version from ${address}`);

  const networkVerackMessage = verackMessage();
  socket.write(networkVerackMessage);
  logger('info', 'MessageHandler - Sent Verack to', address);

  broadcast(`sent verack to ${address}`);
};

const handleVerack = (socket, address) => {
  logger('info', 'MessageHandler - Received Verack from', address);
  broadcast(`received verack from ${address}`);

  socket.emit('performedHandshake');
  broadcast(`performed handshake with ${address}`);

  ensureSocketState(socket);
  socket._lastBlockActivity = Date.now();

  // Bootstrap tracking
  socket._bootstrapping = true;
  socket._bootstrapRemaining = 10;
  socket._seenBlockInv = false;
  if (socket._invFallbackTimer) { try { clearTimeout(socket._invFallbackTimer); } catch {} }
  socket._invFallbackTimer = null;

  // Build locator from API checkpoint or genesis (BE -> LE)
  let locatorLE;
  if (process.env.API_SYNC === 'true') {
    const targetBlockHash = getCheckpoint(); // 64-hex BE
    if (targetBlockHash) {
      locatorLE = Buffer.from(targetBlockHash, 'hex').reverse().toString('hex');
      logger('info', `MessageHandler - Using API checkpoint for getblocks: ${targetBlockHash.substring(0, 16)}....`);
      broadcast('Using API checkpoint to sync with blockchain');
    }
  }
  if (!locatorLE) {
    const genesisBE = process.env.GENESIS.replace(/'/g, '');
    locatorLE = Buffer.from(genesisBE, 'hex').reverse().toString('hex');
    logger('info', 'MessageHandler - Using genesis for getblocks (No API checkpoint yet)');
    broadcast('Using genesis to sync with blockchain (pure P2P)');
  }

  // Send getblocks with stronger locator: [tip-10, genesis]
  const genesisLE = Buffer.from(process.env.GENESIS.replace(/'/g, ''), 'hex').reverse().toString('hex');
  const locatorList = locatorLE && locatorLE !== genesisLE ? [locatorLE, genesisLE] : [locatorLE];
  const msg = getBlocksMessage({ locatorHexLE: locatorList });
  socket.write(msg);
  logger('info', 'MessageHandler - Sent getblocks to', address);
  broadcast({ type: 'getblocks-sent', data: {} });

  // Fallback: if no block INV appears, switch to headers after 5s
  socket._invFallbackTimer = setTimeout(() => {
    if (!socket._seenBlockInv) {
      try {
        socket.write(sendHeadersMessage());
        const locBuf = Buffer.from(locatorLE, 'hex');
        socket.write(getHeadersMessage([locBuf]));
        logger('info', 'Fallback: sent sendheaders + getheaders (no block INV yet) to', address);
      } catch (err) {
        logger('warn', 'Fallback headers request failed:', err.message);
      }
    }
  }, 5000);
};

const handlePing = (socket, address) => {
  logger('info', 'MessageHandler - Received Ping from', address);
  broadcast(`received ping from ${address}`);

  const networkPongMessage = pongMessage();
  socket.write(networkPongMessage);
  logger('info', 'MessageHandler - Sent Pong to', address);

  broadcast(`sent pong to ${address}`);
};

const handlePong = (socket, address) => {
  logger('info', 'MessageHandler - Received Pong from', address);
  broadcast(`received pong from ${address}`);
};

const handleInv = (socket, address, payload) => {
  logger('info', 'MessageHandler - Received Inv from', address);
  const parsedInv = Inv.parse(payload);
  logger('info', 'MessageHandler - Parsed Inv:', JSON.stringify(parsedInv));

  const blockInvItems = parsedInv.inventory.filter((item) => item.type === 2);
  const txInvItems = parsedInv.inventory.filter((item) => item.type === 1);

  // Broadcast INV with counts
  broadcast({ type: 'inv', data: { blockCount: blockInvItems.length, txCount: txInvItems.length } });

  if (blockInvItems.length > 0) {
    socket._lastBlockActivity = Date.now();
    // Mark that we have block announcements; cancel fallback timer if set
    socket._seenBlockInv = true;
    if (socket._invFallbackTimer) { try { clearTimeout(socket._invFallbackTimer); } catch {} socket._invFallbackTimer = null; }

    if (socket._bootstrapping && (socket._bootstrapRemaining || 0) > 0) {
      const want = Math.max(0, socket._bootstrapRemaining);
      const subset = blockInvItems.slice(-want); // newest first from this INV batch
      enqueueBlocks(socket, subset, 'bootstrap');
    } else {
      enqueueBlocks(socket, blockInvItems, 'inv');
    }
  }

  // Request transaction data
  if (txInvItems.length > 0) {
    const txGetData = getDataMessage(txInvItems);
    socket.write(txGetData);
    logger('info', `MessageHandler - Sent GetData for ${txInvItems.length} transactions`);
  }
};

const handleHeaders = (socket, address, payload) => {
  logger('info', 'MessageHandler - Received Headers from', address);
  const parsedHeaders = Headers.parse(payload);

  if (!parsedHeaders) {
    logger('error', 'MessageHandler - Failed to Parse Headers from', address);
    return;
  }

  const headersInv = parsedHeaders.inventory;
  const batchSize = headersInv.length;
  // broadcast({ type: 'headers', data: parsedHeaders });
  broadcast({ type: 'headers', data: { count: parsedHeaders.count }});

  if (batchSize > 0) {
    socket._lastBlockActivity = Date.now();
    socket._lastBlockHash = headersInv[batchSize - 1].hash;
    socket._last10BlockRefs = headersInv.slice(-10);
  }

  if (!socket._syncedToTip) {
    if (batchSize === 2000) {
      logger('info', 'MessageHandler - Received full batch of headers, requesting more..');
      socket.write(getHeadersMessage([socket._lastBlockHash]));
      return;
    }

    socket._syncedToTip = true;
    const last10BlockRefs = batchSize > 0 ? headersInv.slice(-10) : socket._last10BlockRefs || [];

    if (last10BlockRefs.length > 0) {
      enqueueBlocks(socket, last10BlockRefs, 'bootstrap');
    }
    return;
  }

  if (batchSize > 0) {
    const chunk = headersInv.slice(-10);
    if (chunk.length > 0) {
      enqueueBlocks(socket, chunk, 'live');
    }
  }
};

const handleBlock = (socket, address, payload) => {
  logger('block', 'MessageHandler - Received Block from', address);
  const parsedBlock = Block.parse(payload);

  if (parsedBlock) {
    socket._lastBlockActivity = Date.now();

    const hashBE = parsedBlock.calculateHash();
    const hashLE = Buffer.from(hashBE, 'hex').reverse().toString('hex');
    markBlockDelivered(socket, hashLE);

    // Bootstrap completion tracking
    if (socket._bootstrapping) {
      socket._bootstrapRemaining = Math.max(0, (socket._bootstrapRemaining || 0) - 1);
      if (socket._bootstrapRemaining === 0) {
        socket._bootstrapping = false;
        logger('info', 'Bootstrap complete: collected 10 recent blocks');
        // Notify frontend that we're now in live monitoring mode
        broadcast({ type: 'sendheaders-active', data: {} });
      }
    }

    parsedBlock.calculateDifficulty();
    const objBlock = parsedBlock.toJsObject();
    logger('block', `MessageHandler - Parsed Block:\n`, JSON.stringify(objBlock, null, 2));
    setLatestBlock(objBlock);
    const summary = {
      hash: objBlock.hash,
      version: objBlock.version,
      timestamp: objBlock.timestamp,
      transaction_count: objBlock.transaction_count,
      difficulty: objBlock.difficulty
    };
    broadcast({ type: 'block', data: summary });
  } else {
    logger('error', 'MessageHandler - Failed to Parse Block from', address);
  }
};

const handleTx = (socket, address, payload) => {
  logger('tx', 'MessageHandler - Received Tx from', address);
  const { tx: parsedTx } = Transaction.parse(payload);

  if (parsedTx) {
    const objTx = parsedTx.toJsObject();
    logger('tx', `MessageHandler - Parsed Tx:\n`, JSON.stringify(objTx, null, 2));
    setLatestTx(objTx);
    broadcast({ type: 'tx', data: objTx });
  } else {
    logger('error', 'MessageHandler - Failed to Parse Tx from', address);
  }
};

const handleNotFound = (socket, address, payload) => {
  const parsed = Inv.parse(payload);
  const missing = parsed && parsed.inventory ? parsed.inventory.filter(i => i.type === 2) : [];
  for (const item of missing) {
    // Inv.parse returns the 32-byte hash as little-endian hex; matches your queue keys
    markBlockDelivered(socket, item.hash);
  }
  if (missing.length > 0) {
    logger('warn', `NotFound for ${missing.length} blocks from ${address} — skipped.`);
  }
};

module.exports = {
  handleVersion,
  handleVerack,
  getBlocks,
  handlePing,
  handlePong,
  handleInv,
  handleHeaders,
  handleBlock,
  handleTx,
  handleNotFound,
};

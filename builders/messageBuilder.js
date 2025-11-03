
const Header = require('../messages/header');
const Version = require('../messages/version');
const Verack = require('../messages/verack');
const Ping = require('../messages/ping');
const Pong = require('../messages/pong');
const SendHeaders = require('../messages/sendHeaders');
const GetData = require('../messages/getData');
const GetBlocks = require('../messages/getBlocks');
const GetHeaders = require('../messages/getHeaders');


/**
 * Function creates version network message
 * - Version Network Message = serialised version + serialised header
 * - Returns byte sequence version network message
 */
const versionMessage = () => {
  const version = new Version(); // Creates new instance of Version
  const serialisedVersion = version.serialise();
  const header = new Header({ command: 'version', payload: serialisedVersion })
  const serialisedHeader = header.serialise();
  const networkMessage = Buffer.concat([serialisedHeader, serialisedVersion]);
  return networkMessage;
}

/**
 * Function creates verack network message
 * - Verack Network Message = serialised verack + serialised header
 * - Returns byte sequence verack network message
 */
const verackMessage = () => {
  const verack = new Verack(); // Creates new instance of Verack
  const serialisedVerack = verack.serialise();
  const header = new Header({ command: 'verack', payload: serialisedVerack});
  const serialisedHeader = header.serialise();
  const networkMessage = Buffer.concat([serialisedHeader, serialisedVerack]);
  return networkMessage;
}

const pingMessage = () => {
  const ping = new Ping(); // Creates new instance of Ping
  const serialisedPing = ping.serialise();
  const header = new Header({ command: 'ping', payload: serialisedPing });
  const serialisedHeader = header.serialise();
  const networkMessage = Buffer.concat([serialisedHeader, serialisedPing]);
  return networkMessage;
}

const pongMessage = () => {
  const pong = new Pong(); // Creates new instance of Pong
  const serialisedPong = pong.serialise();
  const header = new Header({ command: 'pong', payload: serialisedPong });
  const serialisedHeader = header.serialise();
  const networkMessage = Buffer.concat([serialisedHeader, serialisedPong]);
  return networkMessage;
}

const sendHeadersMessage = () => {
  const sendHeaders = new SendHeaders();
  const serialisedSendHeaders = sendHeaders.serialise();
  const header = new Header({ command: 'sendheaders', payload: serialisedSendHeaders });
  const serialisedHeader = header.serialise();
  const networkMessage = Buffer.concat([serialisedHeader, serialisedSendHeaders]);
  return networkMessage;
}

const getHeadersMessage = (blockLocatorHashes) => {
  const getHeaders = new GetHeaders({ blockLocatorHashes });
  const serialisedGetHeaders = getHeaders.serialise();
  const header = new Header({ command: 'getheaders', payload: serialisedGetHeaders });
  const serialisedHeader = header.serialise();
  const networkMessage = Buffer.concat([serialisedHeader, serialisedGetHeaders])
  return networkMessage;
};

const getDataMessage = (invItems) => {
  const getData = new GetData(); // Creates new instance of GetData
  getData.loadInvData(invItems); // Loads inv data into GetData Message
  const serialisedGetData = getData.serialise(); 
  const header = new Header({ command: 'getdata', payload: serialisedGetData });
  const serialisedHeader = header.serialise();
  const networkMessage = Buffer.concat([serialisedHeader, serialisedGetData]);
  return networkMessage;
}

const getBlocksMessage = ({ locatorHexLE, stopHexLE = '0000000000000000000000000000000000000000000000000000000000000000' } = {} ) => {  // stophexLE = '000...00' - Gets blocks all the way up to tip
    const getBlocks = new GetBlocks({ 
      blockLocatorHashes: locatorHexLE,
      hashStop: stopHexLE,
    }); 
    const serialisedGetBlocks = getBlocks.serialise();
    const header = new Header({ command: 'getblocks', payload: serialisedGetBlocks });
    const serialisedHeader = header.serialise();
    const networkMessage = Buffer.concat([serialisedHeader, serialisedGetBlocks]);
    return networkMessage;
}


module.exports = {
  versionMessage,
  verackMessage,
  getDataMessage,
  getBlocksMessage,
  pingMessage,
  pongMessage,
  sendHeadersMessage,
  getHeadersMessage
};
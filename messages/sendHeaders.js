
class SendHeaders {
  constructor() {
    this.command = 'sendheaders';
  }
  serialise() {
    return Buffer.alloc(0);
  }
}

module.exports = SendHeaders;

/**
 * SendHeaders Message:
 * - https://github.com/bitcoin/bips/blob/master/bip-0130.mediawiki
 * - https://en.bitcoin.it/wiki/Protocol_documentation#sendheaders
 *
 The "sendheaders" is a simple message header without a payload:
 - Tells connected node to send new block announcements via headers instead of inv
┌─────────────┬───────────────┬───────────────┬───────┬─────────────────────────────────────┐
│ Name        │ Example Data  │ Format        │ Size  │ Example Bytes                       │
├─────────────┼───────────────┼───────────────┼───────┼─────────────────────────────────────┤
│ Magic Bytes │               │ bytes         │     4 │ F9 BE B4 D9                         │
│ Command     │ "sendheaders" │ ascii bytes   │    12 │ 73 65 6E 64 68 65 61 64 65 72 73 00 │
│ Size        │ 0             │ little-endian │     4 │ 00 00 00 00                         │
│ Checksum    │               │ bytes         │     4 │ 5D F6 E0 E2                         │
└─────────────┴───────────────┴───────────────┴───────┴─────────────────────────────────────┘

 */

const { logger } = require('./logHandler');

/**
 * Async API call to synchronise with the Bitcoin blockchain
 * Fetches a recent block hash in the background and caches it
 * If API is down returns null
 */

let checkpoint = null;  // Cache hash of the 10th most recently mined block (64-hex big endian format)


async function updateCheckpoint() {

  try {
    const tipHeightRes = await fetch(`https://blockstream.info/api/blocks/tip/height`); // Fetches height(block number) of most recent block
    const tipHeight = parseInt(await tipHeightRes.text(), 10); // Extract text from response body, cAPI returns number as string --> convert to number (specify decimal (base 10) for safety)

    // Ensure valid number returned
    if (!Number.isFinite(tipHeight)) {
      logger('warn', 'BitcoinSync.updateCheckpoint: Invalid tip height returned from API');
      return;
    }

    const targetHeight = Math.max(0, tipHeight - 10);
    const targetBlockHashRes = await fetch(`https://blockstream.info/api/block-height/${targetHeight}`); // Fetches block hash of the 10th most recent block
    const targetBlockHash = (await targetBlockHashRes.text()).trim();   // Extracts the text from the response body and trims white space

    // Validate hash format (64-hex chars)
    if (/^[0-9a-f]{64}$/i.test(targetBlockHash)) {
      checkpoint = targetBlockHash;
      logger('info', `BitcoinSync.updateCheckpoint: Checkpoint updated: ${targetBlockHash} (height: ${targetHeight})`);
    } else {
      logger('warn', 'BitcoinSync.updateCheckpoint: API returned invalid hash format');
    }

  } catch (err) {
    // Silently fails: checkpoint stays as is - handleVerach falls back to Genesis
    logger('warn', `BitcoinSync.updateCheckpoint: API fetch failed: ${err.message}`);
  }

}

/**
 * Gets the cached block hash - may be null if API hasn't responded yet (or failed)
 */
function getCheckpoint() {
  return checkpoint;
}


function startBlockchainSync(interval = 3600000) { // 3600000 = 1hr intervals
  logger('info', 'Starting background Bitcoin sync');

  updateCheckpoint();
  setInterval(updateCheckpoint, interval);
}

module.exports = { startBlockchainSync, getCheckpoint };

document.addEventListener('DOMContentLoaded', () => {

  console.log('logging');
  /*
  * STATE VARIABLES
  */

  // Counters
  let blocks = 0;                   // Block Count
  let transactions = 0;             // TX Count
  let renderedHashes = new Set();   // Track rendered blocks (table)

  // Bootstrap Tracking
  let bootstrapBlocks = 0;         // Counter: bootstrap blocks received
  let bootstrapTotal = 10;         // Total amount of blocks to complete bootstrap
  let isBootstrapping = false;     // Flag for bootstrapping phase 

  // Connected Node Stats
  let targetNode = '';             // User's input (DNS seed or IP address) from frontend 
  let connectedPeer = '';          // Resolved Peer IP address from backend


  /*
  * DOM ELEMENTS
  */

  // Connection Section
  const dnsSeedSelect = document.getElementById('dns-seed');
  const ipAddressInput = document.getElementById('ip-address');
  const connectBtn = document.getElementById('connect-btn');
  const resetButton = document.getElementById('reset-button');

  // Stats Section
  const blockCounter = document.getElementById('blockCounter');
  const txCounter = document.getElementById('txCounter');
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  const connectionStage = document.getElementById('connection-stage');
  const blockActivity = document.getElementById('block-activity');
  const txActivity = document.getElementById('tx-activity');
  const nodeSeed = document.getElementById('node-seed');
  const peerAddress = document.getElementById('peer-address');

  // Bootstrap Progress
  const bootstrapProgress = document.getElementById('bootstrap-progress');
  const bootstrapCount = document.getElementById('bootstrap-count');
  const bootstrapBar = document.getElementById('bootstrap-bar');

  // Latest Block Preview
  const latestBlockSection = document.getElementById('latest-block-section');
  const latestHash = document.getElementById('latest-hash');
  const latestTimestamp = document.getElementById('latest-timestamp');
  const latestTxCount = document.getElementById('latest-txcount');
  const latestDifficulty = document.getElementById('latest-difficulty');

  // Tabs Section
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const consoleOutput = document.getElementById('console-output');

  // Console Section
  const toggleBtn = document.getElementById('console-toggle');
  const consoleWrapper = document.getElementById('console-wrapper');
  const chevron = document.getElementById('console-chevron');
  const consoleHint = document.getElementById('console-hint');
  const consoleLiveIndicator = document.getElementById('console-live-indicator');

  /*
  * DATATABLES
  */

  // DataTables Setup
  const tableOptions = {
    paging: true,
    pageLength: 10,
    ordering: true,
    deferRender: true,
    autoWidth: false,         // disable auto width calculation
    dom: 't<"dt-bottom"ip>',  // table + info + pager (hide length/search)
    columnDefs: [
      { targets: [0,1,2,3,4], className: 'td'},
    ],
    order: [[2, 'desc']],     // sort by timestamp column
  }

  // Initialise Tables
  const blockTable = new DataTable('#blockTable', Object.assign({}, tableOptions, { columns: [ { width: '8ch' }, { width: '40ch' }, { width: '20ch' }, { width: '12ch' }, { width: '10ch' } ] }));    
  const txTable = new DataTable('#txTable', tableOptions);  

  // Adjust columns after initialisation (and once more on next tick)
  blockTable.columns.adjust();
  txTable.columns.adjust();
  setTimeout(() => {
    try { blockTable.columns.adjust(); txTable.columns.adjust(); } catch {}
  }, 0);

  /*
  * HELPER FUNCTIONS
  */

  // Connection goes through stages: idle -> connecting -> handshake -> syncing -> live
  // Update text and color to signify each stage
  function setConnectionStage(stage) {
    const stages = {
      'idle': { text: 'Idle', color: 'text-jet/40' },
      'connecting': { text: 'Performing handshake...', color: 'text-yellow' },
      'syncing': { text: 'Syncing recent blocks...', color: 'text-lime' },
      'live': { text: 'Live ● Listening for new blocks', color: 'text-green' }
    };
    const config = stages[stage] || stages['idle'];
    connectionStage.textContent = config.text;
    connectionStage.className = `text-xs font-mono mb-3 ${config.color}`;
  }

  // Update and render bootstrap progress to user
  function updateBootstrapProgress(current, total) {
    // Update state variables
    bootstrapBlocks = current;                  // Number of blocks bootstrapped (counter)
    bootstrapTotal = total;                     // Number of blocks to bootstrap (10)
    const percentage = (current / total) * 100; // Percentage of bootstrap complete

    bootstrapCount.textContent = `${current}/${total}`  // e.g. "2/10"
    bootstrapBar.style.width = `${percentage}%`;

    // If bootstrap complete
    if (current >= total) {
      setTimeout(() => {
        bootstrapProgress.classList.add('hidden');      // Hide progress bar
        setConnectionStage('live');                     // Update connection stage
        isBootstrapping = false;                        // Reset flag
      }, 500);  // Timeout is triggered 500ms(1/2 sec) after bootstrap complete - delay so user sees "10/10" briefly
    }
  }

  // Pads single digit numbers with leading zero
  function padTwo(number) {
    return String(number).padStart(2, '0');
  }

  // Format DateTime string to fixed width for consistency: YYYY-MM-DD HH:mm:ss 
  function formatTime(dtString) {
    const dtObject = new Date(dtString);                    // Convert dt string to date object
    if (isNaN(dtObject)) return dtString;                   // If dateTime Object invalid return original dateTime string
    return  `${dtObject.getUTCFullYear()}-${padTwo(dtObject.getUTCMonth()+1)}-${padTwo(dtObject.getUTCDate())} ${padTwo(dtObject.getUTCHours())}:${padTwo(dtObject.getUTCMinutes())}:${padTwo(dtObject.getUTCSeconds())}`;
  }

  // Add comma seperation for number readability
  function comma(n) {
    try {
      return Number(n).toLocaleString();
    } catch {
      return String(n);
    }
  }

  // Convert DateTime string to Unix epoch ms for numeric sorting
  function epoch(dtString) {
    const unixTime = Date.parse(dtString);  // Parses string to ms passed since Jan 1 1970
    return isNaN(unixTime) ? 0 : unixTime;  // Return Unix Time or 0 (if invalid)
  }

  // Pulse activity indicator
  function pulseActivity(element) {
    element.className = 'text-xs text-green transition-all duration-300 mt-2';  // Flashes "Receiving..." for 1 sec
    setTimeout(() => {  
      element.className = 'text-xs text-green/0 transition-all duration-300 mt-2';
    }, 1000); // Resets text to zero transparency after 1 sec
  }

  // Update UI (Latest Block Preview) with latest block data 
  function updateLatestBlock(block) {
    latestBlockSection.classList.remove('hidden');
    // Truncate block hash --> e.g. 000000...1012e
    latestHash.textContent = block.hash.substring(0, 6) + '...' + block.hash.substring(block.hash.length - 7);
    latestTimestamp.textContent = formatTime(block.timestamp);
    latestTxCount.textContent = block.transaction_count;
    latestDifficulty.textContent = block.difficulty ? block.difficulty.toFixed(2) : '-';
  }

  // Copy text to clipboard using Clipboard API - silently fails if API unavailable or error
  function copyText(text) {
    return navigator.clipboard?.writeText(text).catch(()=>{});
  }

  // Adds timestamped network messages to frontend console
  function addToConsole(msg, category='info', direction=null) {

    // Skip line if identical to previous
    if (addToConsole._last === msg) return;
    addToConsole._last = msg;

    // Get timestamp
    const now = new Date();
    const time = `${padTwo(now.getHours())}:${padTwo(now.getMinutes())}:${padTwo(now.getSeconds())}`;

    // Get symbol
    const symbol =
      direction === 'outgoing' ? '→' :
      direction === 'incoming' ? '←' :
      category === 'success' ? '✓' :
      category === 'warning' ? '⚠' :  
      category === 'error' ? '✗' : '→';
    
    // Get text color
    const colourClass = 
      category === 'handshake' ? 'text-[#AED6EF]' :
      category === 'live' ? 'text-green' :
      category === 'sync' ? 'text-yellow' :
      category === 'keepalive' ? 'text-pink' :
      category === 'warning' ? 'text-yellow' :
      category === 'error' ? 'text-pink' :
      category === 'success' ? 'text-white/90' : 'text-white/70';

    // Get Message to display
    // If message type present (first word in caps), extract and wrap in brackets
    const match = msg.match(/^([A-Z]+)[\s:]/);
    let formattedMessage = msg;

    if (match) {
      const msgType = match[1];
      const rest = msg.substring(msgType.length).replace(/^[\s:]+/, '');
      formattedMessage = `<span class="font-bold">[${msgType}]</span> ${rest}`;
    }
    
    // Build DOM Elements
    const line = document.createElement('div');
    line.classList.add('console-line', colourClass); 

    const timeSpan = document.createElement('span');
    const symbolSpan = document.createElement('span');
    symbolSpan.classList.add('font-black', 'text-2xl', 'px-2'); // Make symbol bolder
    const msgSpan = document.createElement('span');

    // Set content
    timeSpan.textContent = time;
    symbolSpan.textContent = symbol;
    msgSpan.innerHTML = formattedMessage;

    // Assemble and add to console
    line.append(timeSpan, symbolSpan, msgSpan);
    consoleOutput.appendChild(line);

    // Ensure console is never more than 100 lines (keep newest)
    while (consoleOutput.children.length > 100) {
      consoleOutput.removeChild(consoleOutput.firstChild);
    }

    // Auto scroll to bottom
    consoleOutput.scrollTop = consoleOutput.scrollHeight;

  }


  /*
  * SOCKET.IO CONNECTION
  */

  // Socket State
  let streamToUI = false;                // Gate to control BTC UI updates
  let onBtcData = null;                  // btcData handler function - attach/detach


  const socket = io();  // reconnect is enable by default 

  /*
  * SOCKET EVENT HANDLERS
  */

  // Attach Handler to Socket
  const attachBtcHandler = () => {
    
    if (onBtcData) return;              // Handler already attached, don't attach twice
    
    onBtcData = (message) => {
      if (!streamToUI) return;          // If not streaming BTC data to UI -> ignore

      // Handle backend broadcasts --> Populate frontend console & update UI cards
      if (typeof message === 'string') {
        // Connection stage updates
        if (message.includes('received version')) {
          setConnectionStage('handshake');
          addToConsole(`VERSION: Received from ${connectedPeer}`, 'handshake', 'incoming');
        } else if (message.includes('sent verack')) {
          addToConsole(`VERACK: Sent to ${connectedPeer}`, 'handshake', 'outgoing');
        } else if (message.includes('received verack')) {
          setConnectionStage('syncing');
          bootstrapProgress.classList.remove('hidden');
          isBootstrapping = true;
          addToConsole(`VERACK: Handshake complete • P2P connection active`, 'success');

          // Update status UI (connecting -> connected)
          statusDot.classList.remove('bg-yellow', 'bg-pink');
          statusDot.classList.add('bg-lime');
          statusLabel.textContent = 'Connected';
          connectBtn.textContent = 'Disconnect';
          connectBtn.disabled = false;
          connectBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else if (message.includes('sent ping')) {
          addToConsole(`PING: Sent to ${connectedPeer}`, 'keepalive', 'outgoing');
        } else if (message.includes('received ping')) {
          addToConsole(`PING: Received from ${connectedPeer}`, 'keepalive', 'incoming');
        } else if (message.includes('sent pong')) {
          addToConsole(`PONG: Sent to ${connectedPeer}`, 'keepalive', 'outgoing');
        } else if (message.includes('received pong')) {
          addToConsole(`PONG: Received from ${connectedPeer}`, 'keepalive', 'incoming');
        } else {
          addToConsole(message);
        }

        return;
      }

      // Handle messages by type --> Populate tables and counters
      const { type, data } = message;

      // Peer connection info
      if (type === 'peer-connected') {
        connectedPeer = data.address;
        peerAddress.textContent = data.address;
        addToConsole(`TCP: Connection established to ${data.address}:8333`, 'handshake', 'incoming');
        return;
      }

      // DNS resolution
      if (type === 'dns-resolved') {
        const ipv4Count = data.ipv4 || 0;
        const ipv6Count = data.ipv6 || 0;
        addToConsole(`DNS: Resolved ${data.seed} -> ${ipv4Count} IPv4, ${ipv6Count} IPv6 addresses`, 'handshake', 'incoming');
        return;
      }

      // GETBLOCKS request
      if (type === 'getblocks-sent') {
        addToConsole(`GETBLOCKS: Requesting recent block inventory`, 'sync', 'outgoing');
        return;
      }

      // GETDATA request
      if (type === 'getdata-sent') {
        const count = data.count || 0;
        addToConsole(`GETDATA: Requesting ${count} block${count > 1 ? 's' : ''}`, 'sync', 'outgoing');
        return;
      }

      // INV accouncement - only log if blocks present
      if (type === 'inv') {
        const blockCount = data.blockCount || 0;
        const txCount = data.txCount || 0;
        if (blockCount > 0) {
          const parts = [`${blockCount} block${blockCount > 1 ? 's' : ''}`];
          if (txCount > 0) parts.push(`${txCount} tx${txCount > 1 ? 's': ''}`);
          addToConsole(`INV: Peer announcing ${parts.join(', ')}`, 'sync', 'incoming');
        }
        return;
      }

      // HEADERS message
      if (type === 'headers') {
        const count = Number(data.count) || 0;
        if (count > 0) {
          const isLivePush = count <= 10 && !isBootstrapping;
          const category = isLivePush ? 'live' : 'sync';
          const context = isLivePush ? '(proactive push via SENDHEADERS)' : '';
          addToConsole(`HEADERS: Received ${count} block header${count > 1 ? 's' : ''} ${context}`, category, 'incoming');
        }
        return;
      }

      // SENDHEADERS activation
      if (type === 'sendheaders-active') {
        setConnectionStage('live');
        addToConsole('SENDHEADERS: Enabled (BIP 130) • Peer pushes new blocks automatically', 'live', 'incoming');
        return;
      }

      // BLOCK received
      if (type === 'block') {
        if (renderedHashes.has(data.hash)) return;
        renderedHashes.add(data.hash);

        // Update bootstrap progress
        if (isBootstrapping && bootstrapBlocks < bootstrapTotal) {
          updateBootstrapProgress(bootstrapBlocks + 1, bootstrapTotal);
        }

        const txCount = Number(data.transaction_count) || 0;
        const diff = Number(data.difficulty) || 0;

        // Format hash 000000...d8fb292
        const hashDisplay = `${data.hash.substring(0, 6)}...${data.hash.substring(data.hash.length - 7)}`;

        // Add row to table with formatted cells
        const node = blockTable.row.add([
          `<span data-order="${Number(data.version) || 0}">${data.version ?? ''}</span>`,
          `<span class="hash" title="${data.hash}">${hashDisplay}</span> <button type="button" class="text-xs text-jet/60 hover:text-jet" data-copy="${data.hash}">copy</button>`,
          `<span data-order="${epoch(data.timestamp)}">${formatTime(data.timestamp)}</span>`,
          `<span class="num" data-order="${txCount}">${comma(txCount)}</span>`,
          `<span class="num" data-order="${diff}">${comma(diff)}</span>`
        ]).draw(false).node();

        // Flash animation
        if (node) {
          node.classList.add('new-row');
          setTimeout(() => node.classList.remove('new-row'), 1200);
        }

        // Update UI
        blockCounter.textContent = ++blocks;
        pulseActivity(blockActivity);
        updateLatestBlock({ hash: data.hash, timestamp: data.timestamp, transaction_count: txCount, difficulty: diff });
      
        // Console
        const category = isBootstrapping ? 'sync' : 'live';
        const prefix = isBootstrapping ? `BLOCK #${blocks}` : 'BLOCK (LIVE)';
        addToConsole(`${prefix}: ${data.hash} • ${comma(txCount)} txs`, category, 'incoming');
        return;
      }

      // Transaction received
      if (type === 'tx') {
        txTable.row.add([
          data.version ?? '',
          data.transaction_byte_size ?? '',
          data.inCount ?? '',
          data.outCount ?? '',
          data.lock_time ?? ''
        ]).draw(false);

        txCounter.textContent = ++transactions;
        pulseActivity(txActivity);

        // Show hint once
        if (!onBtcData._txHintShown) {
          addToConsole('Mempool transactions streaming in background (view Mempool tab)', 'success');
          onBtcData._txHintShown = true;
        }
      }
    };


    socket.on('btcData', onBtcData);    // add handler to socket
  };

  // Detach Handler from Socket
  const detachBtcHandler = () => {
    if (!onBtcData) return;             // Handler already detached, don't try detach again

    socket.off('btcData', onBtcData);   // Remove handler from socket
    onBtcData = null;

  };

  // Socket Error Handler
  socket.on('connection-error', (err) => {
    console.error('Connection error: ', err);
    alert('Failed to connect to server');
  });


  /*
  * SELECT/INPUT EVENT HANDLERS 
  */

  // Clear IP when DNS is selected
  dnsSeedSelect.addEventListener('change', () => {
    if (dnsSeedSelect.value !== '') ipAddressInput.value = '';
    
  });

  // Clear DNS when IP is typed
  ipAddressInput.addEventListener('input', () => {
    if (ipAddressInput.value) dnsSeedSelect.value = '';
  });

  /*
  * BUTTON EVENT HANDLERS 
  */

  // Connect Button
  connectBtn.addEventListener('click', () => {


    if (statusLabel.textContent === 'Connected' || statusLabel.textContent === 'Connecting...') {
      // DISCONNECT
      socket.emit('stop');

      // Stop streaming data to UI
      detachBtcHandler();
      streamToUI = false; 
      
      // Update console live indicator
      consoleLiveIndicator.textContent = '● Idle';
      consoleLiveIndicator.className = 'text-xs font-mono uppercase text-pink';

      // Reset connection card
      nodeSeed.textContent = 'Not Connected';
      peerAddress.textContent = '-';
      
      // Update Status
      statusDot.classList.remove('bg-lime', 'bg-yellow');
      statusDot.classList.add('bg-pink');
      statusLabel.textContent = 'Disconnected';
      connectBtn.textContent = 'Connect';
      connectBtn.disabled = false;
      connectBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      // CONNECT
      const dnsSeed = dnsSeedSelect.value.trim();
      const ipAddress = ipAddressInput.value.trim();

      // Validate - One field must be selected/entered to start connection
      if (!dnsSeed && !ipAddress) {
        alert('Please select a DNS seed or enter a valid IP address');
        return;
      }

      // Clear previous connection data from frontend
      blockTable.clear().draw();
      txTable.clear().draw();
      consoleOutput.textContent = '';
      blocks = 0;
      transactions = 0;
      blockCounter.textContent = '0';
      txCounter.textContent = '0';

      // Reset bootstrap state
      renderedHashes.clear()
      isBootstrapping = false;
      bootstrapBlocks = 0;
      bootstrapProgress.classList.add('hidden');
      bootstrapBar.style.width = '0%';
      bootstrapCount.textContent = '0/10';
      latestBlockSection.classList.add('hidden');
      setConnectionStage('idle');

      // Start streaming data to UI
      attachBtcHandler()
      streamToUI = true;

      socket.emit('start', { dnsSeed, ipAddress });

      // Update node/peer labels
      if (dnsSeed) {
        targetNode = dnsSeed;
        nodeSeed.textContent = targetNode;
        peerAddress.textContent = 'Resolving...';
      } else {
        targetNode = ipAddress;
        nodeSeed.textContent = '';
        peerAddress.textContent = ipAddress;
      }
      
      // Update console live indicator
      consoleLiveIndicator.textContent = '● Live';
      consoleLiveIndicator.className = 'text-xs font-mono uppercase text-green';

      // Update Status
      statusDot.classList.remove('bg-pink');
      statusDot.classList.add('bg-yellow');
      statusLabel.textContent = 'Connecting';
      connectBtn.textContent = 'Connecting...';
      connectBtn.disabled = true;
      connectBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    
  });

  // Reset Button
  resetButton.addEventListener('click', () => {
    socket.emit('stop');

    // Stop streaming data to UI
    detachBtcHandler();
    streamToUI = false;

    blockTable.clear().draw();
    txTable.clear().draw();
    consoleOutput.textContent = '';
    blocks = 0;
    transactions = 0;
    blockCounter.textContent = '0';
    txCounter.textContent = '0';
    // Reset bootstrap state
    renderedHashes.clear();
    isBootstrapping = false;
    bootstrapBlocks = 0;
    bootstrapProgress.classList.add('hidden');
    bootstrapBar.style.width = '0%';
    bootstrapCount.textContent = '0/10';
    latestBlockSection.classList.add('hidden');
    setConnectionStage('idle');
    // Reset Connection Inputs
    dnsSeedSelect.value = '';
    ipAddressInput.value = '';

    // Reset Connection card labels
    nodeSeed.textContent = 'Not Connected';
    peerAddress.textContent = '-';

    // Update Status
    statusDot.classList.remove('bg-lime', 'bg-yellow');
    statusDot.classList.add('bg-pink');
    statusLabel.textContent = 'Disconnected';
    connectBtn.textContent = 'Connect';
    connectBtn.disabled = false;
    connectBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  });

  /*
  * CONSOLE TOGGLE HANDLER
  */
  toggleBtn.addEventListener('click', () => {
    consoleWrapper.classList.toggle('hidden');
    const isHidden = consoleWrapper.classList.contains('hidden');
    chevron.textContent = isHidden ? '▶' : '▼';
    consoleHint.textContent = isHidden ? '[Click to expand]' : '[Click to collapse]'
  });


  /*
  * TAB EVENT HANDLERS
  */

  // Tab Switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Update Buttons
      tabButtons.forEach(btn => {
        btn.classList.remove('border-jet', 'bg-white');
        btn.classList.add('border-transparent');
      });
      button.classList.add('border-jet', 'bg-white');
      button.classList.remove('border-transparent');
    
      // Update Content
      tabContents.forEach(content => {
        content.classList.add('hidden');
      });
      document.getElementById(tabName).classList.remove('hidden');

      // Redraw tables
      if (tabName === 'blocks-content') blockTable.columns.adjust().draw();
      if (tabName === 'transactions-content') txTable.columns.adjust().draw();
    });
  });

  // Copy button delegate for hash copy buttons in tables
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const val = btn.getAttribute('data-copy');
    if (val) copyText(val);
  });

});
const state = {
  ws: null, worker: null, mining: false, hashrate: 0, accepted: 0, rejected: 0,
  mode: 'standby', jit: '--', status: 'disconnected', workerReady: false,
  pendingConnect: false, reconnectTimer: null, currentJobId: null,
  currentJobSeq: 0, currentJobDiff: 0, lastJob: null,
  shareEtaStart: 0, shareEtaTotal: 0, datasetBuilt: false, hashrateMax: 0,
};

const params = new URLSearchParams(location.search);
const fullMemory = params.get('light') !== '1' && params.get('full') !== '0';
let jitDecision = params.get('jit') === '0' || params.get('nojit') === '1' ? false : true;
const enableJit = jitDecision;
const profileCore = params.get('profile') === '1';
const requestedThreads = Number(params.get('threads'));
const defaultThreads = fullMemory ? 32 : (navigator.hardwareConcurrency || 4);
let datasetThreads = Math.max(1, Math.min(32, requestedThreads || defaultThreads));
let datasetInitThreads = Math.max(1, Math.min(32, Number(params.get('init_threads')) || 32));

const $ = (id) => document.getElementById(id);

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function readLe(bytes, offset, len) {
  let value = 0n;
  for (let i = 0; i < len; i++) value |= BigInt(bytes[offset + i]) << BigInt(i * 8);
  return value;
}

function targetToDiff(targetHex) {
  const raw = hexToBytes(targetHex);
  let target = 0n;
  if (raw.length === 4) {
    const t32 = readLe(raw, 0, 4);
    if (t32 !== 0n) target = 0xffffffffffffffffn / (0xffffffffn / t32);
  } else if (raw.length === 8) {
    target = readLe(raw, 0, 8);
  } else if (raw.length >= 32) {
    target = readLe(raw, 24, 8);
  }
  return target ? Number(0xffffffffffffffffn / target) : 0;
}

function updateUI() {
  if ($('hashrate')) $('hashrate').textContent = state.hashrate.toFixed(0) + ' H/s';
  if ($('accepted')) $('accepted').textContent = state.accepted;
  if ($('rejected')) $('rejected').textContent = state.rejected;
  if ($('mode')) $('mode').textContent = state.mode;
  if ($('statusText')) $('statusText').textContent = state.status;
  const dot = $('statusDot');
  if (dot) {
    dot.className = 'status-dot' + (state.status === 'connected' || state.status === 'mining' ? ' active' : state.status === 'error' ? ' error' : '');
  }
  state.hashrateMax = Math.max(state.hashrateMax, state.hashrate);
}

function addLog(text, cls) {
  const box = $('logBox');
  if (!box) return;
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">[${time}]</span><span style="color:${cls === 'ok' ? '#3fcf6a' : cls === 'err' ? '#e74c3c' : '#888'}">${text}</span>`;
  box.appendChild(entry);
  box.scrollTop = box.scrollHeight;
  if (box.children.length > 200) box.removeChild(box.firstChild);
}

function startMining() {
  const wallet = $('walletInput').value.trim();
  const poolHost = $('poolHost').value.trim();
  const poolPort = parseInt($('poolPort').value) || 3333;

  if (!wallet || wallet.length < 95) { alert('Invalid wallet address'); return; }

  state.walletAddress = wallet;
  $('setup').classList.add('hidden');
  $('mining').classList.remove('hidden');
  $('walletDisplay').textContent = wallet;

  addLog('Starting miner...', 'info');
  connectPool(wallet, poolHost, poolPort);
}

function connectPool(wallet, host, port) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${proto}://${location.host}`;

  addLog(`Connecting to proxy at ${wsUrl}...`, 'info');
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    addLog('Connected to proxy', 'ok');
    state.status = 'connected';
    updateUI();

    state.ws.send(JSON.stringify({
      method: 'set_target',
      params: { host, port, wallet }
    }));

    state.ws.send(JSON.stringify({
      method: 'login',
      params: { login: wallet, pass: 'x', rigid: '', agent: 'xmr-webminer/1.0' }
    }));
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.error) {
        addLog(`Error: ${msg.error.message || msg.error}`, 'err');
        state.status = 'error';
        updateUI();
        return;
      }

      if (msg.result && msg.result.job) {
        state.currentJobId = msg.result.id;
        handleJob(msg.result.job);
      }

      if (msg.result && msg.result.status === 'OK') {
        state.accepted++;
        addLog('Share accepted!', 'ok');
        updateUI();
      }

      if (msg.method === 'job' && msg.params) {
        handleJob(msg.params);
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  };

  state.ws.onerror = (err) => {
    addLog('WebSocket error', 'err');
    state.status = 'error';
    updateUI();
  };

  state.ws.onclose = () => {
    addLog('Disconnected from proxy', 'err');
    state.status = 'disconnected';
    state.mining = false;
    updateUI();

    if (!state.pendingConnect) {
      state.pendingConnect = true;
      setTimeout(() => {
        state.pendingConnect = false;
        connectPool(wallet, host, port);
      }, 5000);
    }
  };
}

function handleJob(job) {
  state.lastJob = job;
  state.currentJobDiff = targetToDiff(job.target);
  state.status = 'mining';
  state.mining = true;
  updateUI();

  addLog(`Job received: ${job.job_id} (diff: ${state.currentJobDiff})`, 'info');

  if (state.worker) {
    state.worker.postMessage({ type: 'job', job });
  } else {
    initWorker(job);
  }
}

function initWorker(job) {
  addLog('Initializing RandomX worker...', 'info');

  state.worker = new Worker(`worker.js?v=${Date.now()}`);

  state.worker.onmessage = (e) => {
    const msg = e.data;

    switch (msg.type) {
      case 'hashrate':
        state.hashrate = msg.hashrate || 0;
        updateUI();
        break;

      case 'job':
        if (msg.job) handleJob(msg.job);
        break;

      case 'share':
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
          state.ws.send(JSON.stringify({
            method: 'submit',
            params: {
              id: state.currentJobId,
              job_id: msg.job.job_id,
              nonce: msg.nonce,
              result: msg.result
            }
          }));
          addLog('Share submitted', 'info');
        }
        break;

      case 'status':
        state.mode = msg.message || 'running';
        updateUI();
        addLog(msg.message, 'info');
        break;

      case 'ready':
        state.workerReady = true;
        addLog('Worker ready, starting mining', 'ok');
        if (job) state.worker.postMessage({ type: 'job', job });
        break;

      case 'error':
        addLog(msg.message || 'Worker error', 'err');
        break;
    }
  };

  state.worker.onerror = (err) => {
    addLog('Worker error: ' + err.message, 'err');
    state.status = 'error';
    updateUI();
  };

  state.worker.postMessage({
    type: 'init',
    wallet: state.walletAddress,
    threads: datasetThreads,
    initThreads: datasetInitThreads,
    jit: enableJit,
    fullMemory,
    profile: profileCore
  });
}

// Auto-start if wallet is in URL
if (params.get('wallet')) {
  $('walletInput').value = params.get('wallet');
  if (params.get('poolHost')) $('poolHost').value = params.get('poolHost');
  if (params.get('poolPort')) $('poolPort').value = params.get('poolPort');
  setTimeout(startMining, 100);
}

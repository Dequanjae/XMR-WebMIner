// RandomX WASM Worker - handles mining in a Web Worker context
(() => {
  let v = 'dev';
  try {
    const m = (self.location && self.location.search || '').match(/[?&]v=([^&]+)/);
    if (m) v = m[1];
  } catch (_) {}
  importScripts(`randomx.js?v=${encodeURIComponent(v)}`);
})();

let Module = null;
let mining = false;
let currentJob = null;
let inputPtr = 0;
let hashPtr = 0;
let targetPtr = 0;
let mineResultPtr = 0;
let mineCtx = 0;
let jitEnabled = true;
let fullMemory = false;
let datasetThreads = 1;
let datasetInitThreads = 32;
let profileCore = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function postStatus(msg) {
  postMessage({ type: 'status', message: msg });
}

function postHashrate(hr) {
  postMessage({ type: 'hashrate', hashrate: hr });
}

async function initRandomX(config) {
  postStatus('Loading RandomX WASM...');

  Module = await createRandomX({
    onRuntimeInitialized: () => {},
    print: (text) => console.log('[RX]', text),
    printErr: (text) => console.error('[RX]', text),
  });

  postStatus('RandomX loaded, allocating cache...');
  const cachePtr = Module._randomx_alloc_cache(Module._randomx_get_flags());
  if (!cachePtr) throw new Error('Failed to allocate cache');

  postStatus('Generating cache (this takes a moment)...');
  const seedHash = new Uint8Array(32);
  Module._randomx_init_cache(cachePtr, seedHash);

  postStatus('Creating VM...');
  const vmPtr = Module._randomx_create_vm(cachePtr, null);
  if (!vmPtr) throw new Error('Failed to create VM');
  mineCtx = vmPtr;

  inputPtr = Module._malloc(32);
  hashPtr = Module._malloc(32);
  targetPtr = Module._malloc(32);

  postStatus('RandomX ready!');
  postMessage({ type: 'ready' });
  return vmPtr;
}

function mineOnce(job) {
  if (!Module || !mineCtx) return;

  const blob = Buffer.from(job.blob, 'hex');
  const target = Buffer.from(job.target, 'hex');

  Module.HEAPU8.set(blob, inputPtr);
  Module.HEAPU8.set(target, targetPtr);

  const start = Date.now();
  let hashes = 0;
  const duration = 5000; // mine for 5 seconds per batch

  while (Date.now() - start < duration && mining) {
    const nonce = new Uint8Array(4);
    crypto.getRandomValues(nonce);
    Module.HEAPU8.set(nonce, inputPtr + 39);

    Module._randomx_calculate_hash(mineCtx, inputPtr, 76, hashPtr);
    hashes++;

    const hash = Buffer.from(Module.HEAPU8.slice(hashPtr, hashPtr + 32)).toString('hex');

    // Check if hash meets target
    const hashNum = BigInt('0x' + hash);
    const targetNum = target.length >= 32
      ? BigInt('0x' + target.slice(24, 32).toString('hex'))
      : target.length >= 8
        ? BigInt('0x' + target.slice(0, 8).toString('hex'))
        : BigInt('0x' + target.toString('hex'));

    if (targetNum > 0n && hashNum <= targetNum) {
      postMessage({
        type: 'share',
        job: job,
        nonce: nonce.toString('hex'),
        result: hash
      });
    }
  }

  const elapsed = (Date.now() - start) / 1000;
  const hashrate = Math.round(hashes / elapsed);
  postHashrate(hashrate);
}

function miningLoop() {
  if (!mining || !currentJob) return;

  mineOnce(currentJob);

  if (mining) {
    setTimeout(miningLoop, 100);
  }
}

self.onmessage = async (e) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      try {
        fullMemory = msg.fullMemory !== false;
        jitEnabled = msg.jit !== false;
        datasetThreads = msg.threads || 1;
        datasetInitThreads = msg.initThreads || 32;
        profileCore = msg.profile || false;
        await initRandomX(msg);
      } catch (err) {
        postMessage({ type: 'error', message: err.message });
      }
      break;

    case 'job':
      currentJob = msg.job;
      if (!mining && Module && mineCtx) {
        mining = true;
        miningLoop();
      }
      break;

    case 'stop':
      mining = false;
      break;
  }
};

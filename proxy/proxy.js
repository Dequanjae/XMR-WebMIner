const net = require('net');
const tls = require('tls');
const { WebSocketServer } = require('ws');

// Config from env
const POOL_HOST = process.env.POOL_HOST || 'xmrpool.eu';
const POOL_PORT = parseInt(process.env.POOL_PORT) || 3333;
const POOL_SSL  = process.env.POOL_SSL === 'true';
const WALLET    = process.env.WALLET || 'YOUR_WALLET_ADDRESS_HERE';
const WS_PORT   = parseInt(process.env.PROXY_PORT) || 8081;
const DIFF      = parseInt(process.env.DIFF) || 5000;

console.log('[proxy] Pool: ' + POOL_HOST + ':' + POOL_PORT + ' (ssl: ' + POOL_SSL + ')');
console.log('[proxy] Wallet: ' + WALLET);
console.log('[proxy] WebSocket listening on :' + WS_PORT);

// Pool connection (CryptoNote JSON-RPC 2.0)
let poolSocket = null;
let poolBuffer = '';
let poolId = null;
let currentJob = null;
const miners = new Set();
let msgId = 1;
let minerIdCounter = 1;

function connectPool() {
    const connectFn = POOL_SSL ? tls.connect : net.connect;
    poolSocket = connectFn({ host: POOL_HOST, port: POOL_PORT }, () => {
        console.log('[pool] Connected to pool');
        // CryptoNote login
        poolSocket.write(JSON.stringify({
            id: msgId++,
            jsonrpc: '2.0',
            method: 'login',
            params: {
                login: WALLET,
                pass: 'x',
                agent: 'xmr-wasm-proxy/1.0'
            }
        }) + '\n');
    });
    poolSocket.setEncoding('utf8');
    poolSocket.on('data', onPoolData);
    poolSocket.on('error', (err) => { console.error('[pool] Error:', err.message); setTimeout(connectPool, 5000); });
    poolSocket.on('close', () => { console.log('[pool] Disconnected, reconnecting in 5s...'); poolId = null; currentJob = null; setTimeout(connectPool, 5000); });
}

function processBuffer() {
    const lines = poolBuffer.split('\n');
    poolBuffer = lines.pop();
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            handlePoolMessage(JSON.parse(trimmed));
        } catch (e) {
            console.error('[pool] Parse error:', e.message, 'data:', trimmed.substring(0, 100));
        }
    }
    if (poolBuffer.trim()) {
        try {
            handlePoolMessage(JSON.parse(poolBuffer.trim()));
            poolBuffer = '';
        } catch (e) {
            // incomplete JSON, wait for more data
        }
    }
}

function onPoolData(data) {
    poolBuffer += data;
    processBuffer();
}

function handlePoolMessage(msg) {
    // Login response
    if (msg.id && msg.result && msg.result.job) {
        if (msg.result.id) {
            poolId = msg.result.id;
            console.log('[pool] Logged in, id: ' + poolId);
        }
        currentJob = msg.result.job;
        console.log('[pool] Got job (height: ' + (currentJob.height || '?') + ', id: ' + currentJob.job_id + ')');
        broadcastJob();
        return;
    }

    // Login error
    if (msg.id && msg.error) {
        console.error('[pool] Login failed:', JSON.stringify(msg.error));
        return;
    }

    // New job from pool
    if (msg.method === 'job') {
        currentJob = msg.params;
        console.log('[pool] New job (height: ' + (currentJob.height || '?') + ', id: ' + currentJob.job_id + ')');
        broadcastJob();
        return;
    }

    // Submit response
    if (msg.id && msg.result) {
        if (msg.result.status === 'OK') {
            console.log('[pool] Share accepted');
            broadcastToMiners({ type: 'accepted' });
        } else {
            console.log('[pool] Share rejected: ' + (msg.result.status || 'unknown'));
            broadcastToMiners({ type: 'rejected' });
        }
        return;
    }

    // Submit error
    if (msg.id && msg.error) {
        console.error('[pool] Submit error:', JSON.stringify(msg.error));
        broadcastToMiners({ type: 'rejected' });
        return;
    }

    console.log('[pool] Unhandled:', JSON.stringify(msg).substring(0, 200));
}

function submitShare(msg) {
    if (!poolSocket || !poolId) return;
    // Miner sends: {method:"submit", params:{id, job_id, nonce, result}, id:1}
    const params = msg.params || {};
    const id = msgId++;
    poolSocket.write(JSON.stringify({
        id: id,
        jsonrpc: '2.0',
        method: 'submit',
        params: {
            id: poolId,
            job_id: params.job_id,
            nonce: params.nonce,
            result: params.result
        }
    }) + '\n');
    console.log('[pool] Submitting share (id: ' + id + ', job: ' + params.job_id + ')');
}

// WebSocket
const wss = new WebSocketServer({ port: WS_PORT });
wss.on('connection', (ws) => {
    miners.add(ws);
    const minerId = 'miner-' + (minerIdCounter++);
    console.log('[ws] Miner connected: ' + minerId + ' (total: ' + miners.size + ')');

    // Send login response so the miner sets its login_id
    // Miner expects: {result: {id: "...", job: {...}}} for login response
    if (currentJob && poolId) {
        ws.send(JSON.stringify({
            id: 1,
            result: {
                id: poolId,
                job: {
                    job_id: currentJob.job_id,
                    blob: currentJob.blob,
                    target: currentJob.target,
                    height: currentJob.height,
                    seed_hash: currentJob.seed_hash
                }
            }
        }));
        console.log('[ws] Sent login response with job to ' + minerId);
    } else {
        // No job yet - send empty login response
        ws.send(JSON.stringify({
            id: 1,
            result: {
                id: 'proxy',
                job: null
            }
        }));
        console.log('[ws] Sent login response (no job yet) to ' + minerId);
    }

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            // Miner sends: {method:"login", params:{...}, id:1} - ignore it
            if (msg.method === 'login') {
                return;
            }
            // Miner sends: {method:"submit", params:{id, job_id, nonce, result}, id:1}
            if (msg.method === 'submit') {
                submitShare(msg);
                return;
            }
            // Legacy format fallback
            if (msg.type === 'share') {
                submitShare({ params: { job_id: msg.jobId, nonce: msg.nonce2, result: msg.result } });
                return;
            }
        } catch (e) {
            console.error('[ws] Message parse error:', e.message);
        }
    });
    ws.on('close', () => { miners.delete(ws); console.log('[ws] Miner disconnected: ' + minerId + ' (total: ' + miners.size + ')'); });
});

function broadcastJob() {
    for (const ws of miners) sendJobToMiner(ws);
}

function sendJobToMiner(ws) {
    if (ws.readyState !== 1 || !currentJob) return;
    // Miner expects: {method:"job", params:{job_id, blob, target, height, seed_hash}}
    ws.send(JSON.stringify({
        method: 'job',
        params: {
            job_id: currentJob.job_id,
            blob: currentJob.blob,
            target: currentJob.target,
            height: currentJob.height,
            seed_hash: currentJob.seed_hash
        }
    }));
}

function broadcastToMiners(msg) { const data = JSON.stringify(msg); for (const ws of miners) { if (ws.readyState === 1) ws.send(data); } }

// Health check
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('XMR Proxy Online\nMiners: ' + miners.size + '\nPool: ' + POOL_HOST + ':' + POOL_PORT + '\nLogged In: ' + (poolId ? 'yes (' + poolId + ')' : 'no'));
}).listen(8082, () => console.log('[http] Health check on :8082'));

connectPool();

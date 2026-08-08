const net = require('net');
const tls = require('tls');
const { WebSocketServer } = require('ws');

// Config from env
const POOL_HOST = process.env.POOL_HOST || 'pool.minexmr.com';
const POOL_PORT = parseInt(process.env.POOL_PORT) || 4444;
const POOL_SSL  = process.env.POOL_SSL === 'true';
const WALLET    = process.env.WALLET || 'YOUR_WALLET_ADDRESS_HERE';
const WS_PORT   = parseInt(process.env.PROXY_PORT) || 8081;
const DIFF      = parseInt(process.env.DIFF) || 5000;

console.log('[proxy] Pool: ' + POOL_HOST + ':' + POOL_PORT + ' (ssl: ' + POOL_SSL + ')');
console.log('[proxy] Wallet: ' + WALLET);
console.log('[proxy] WebSocket listening on :' + WS_PORT);

// Stratum
let poolSocket = null;
let poolBuffer = '';
let subscribed = false;
let authorized = false;
let currentJob = null;
const miners = new Set();
let shareId = 100;

function connectPool() {
    const connectFn = POOL_SSL ? tls.connect : net.connect;
    poolSocket = connectFn({ host: POOL_HOST, port: POOL_PORT }, () => {
        console.log('[pool] Connected to pool');
        subscribed = false;
        authorized = false;
        poolSocket.write(JSON.stringify({ id: 1, method: 'mining.subscribe', params: ['xmr-wasm-proxy/1.0'] }) + '\n');
    });
    poolSocket.setEncoding('utf8');
    poolSocket.on('data', onPoolData);
    poolSocket.on('error', (err) => { console.error('[pool] Error:', err.message); setTimeout(connectPool, 5000); });
    poolSocket.on('close', () => { console.log('[pool] Disconnected, reconnecting in 5s...'); subscribed = false; authorized = false; currentJob = null; setTimeout(connectPool, 5000); });
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
    if (msg.id === 1) {
        if (msg.result) {
            console.log('[pool] Subscribed');
            subscribed = true;
            poolSocket.write(JSON.stringify({ id: 2, method: 'mining.authorize', params: [WALLET, 'xmr-wasm-proxy'] }) + '\n');
        } else {
            console.error('[pool] Subscribe failed:', JSON.stringify(msg));
        }
        return;
    }
    if (msg.id === 2) {
        authorized = msg.result === true;
        console.log('[pool] Authorized: ' + authorized);
        if (!authorized) {
            console.error('[pool] Authorization failed — check wallet address');
        }
        return;
    }
    if (msg.method === 'mining.notify') {
        currentJob = msg.params;
        console.log('[pool] New job received (height: ' + (currentJob[3] || '?') + ')');
        broadcastJob();
        return;
    }
    if (msg.result === true && msg.id >= 100) {
        console.log('[pool] Share accepted (id: ' + msg.id + ')');
        broadcastToMiners({ type: 'accepted' });
        return;
    }
    if (msg.result === false && msg.id >= 100) {
        console.log('[pool] Share rejected (id: ' + msg.id + ')');
        broadcastToMiners({ type: 'rejected' });
        return;
    }
    if (msg.method === 'mining.set_difficulty') {
        console.log('[pool] Difficulty set to: ' + msg.params[0]);
        return;
    }
    console.log('[pool] Unhandled:', JSON.stringify(msg).substring(0, 200));
}

function submitShare(result) {
    if (!poolSocket || !authorized) return;
    const id = shareId++;
    poolSocket.write(JSON.stringify({
        id: id,
        method: 'mining.submit',
        params: [WALLET, result.jobId, result.nonce2, result.result, result.target]
    }) + '\n');
    console.log('[pool] Submitting share (id: ' + id + ')');
}

// WebSocket
const wss = new WebSocketServer({ port: WS_PORT });
wss.on('connection', (ws) => {
    miners.add(ws);
    console.log('[ws] Miner connected (total: ' + miners.size + ')');
    if (currentJob && subscribed) sendJobToMiner(ws);
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'share') submitShare(msg);
        } catch (e) {}
    });
    ws.on('close', () => { miners.delete(ws); console.log('[ws] Miner disconnected (total: ' + miners.size + ')'); });
});

function broadcastJob() { for (const ws of miners) sendJobToMiner(ws); }
function sendJobToMiner(ws) {
    if (ws.readyState !== 1 || !currentJob) return;
    ws.send(JSON.stringify({ type: 'job', jobId: currentJob[0], blob: currentJob[1], target: currentJob[2], height: currentJob[3] }));
}
function broadcastToMiners(msg) { const data = JSON.stringify(msg); for (const ws of miners) { if (ws.readyState === 1) ws.send(data); } }

// Health check
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('XMR Proxy Online\nMiners: ' + miners.size + '\nPool: ' + POOL_HOST + ':' + POOL_PORT + '\nSubscribed: ' + subscribed + '\nAuthorized: ' + authorized);
}).listen(8082, () => console.log('[http] Health check on :8082'));

connectPool();

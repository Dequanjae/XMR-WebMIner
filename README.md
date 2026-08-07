# XMR-WASM Web Miner

Browser-based Monero (XMR) miner using WebAssembly — hosted on your NAS with a WebSocket proxy.

## Architecture

```
Browser ──→ nginx (port 8088) ──→ miner.wasm (WebAssembly)
              │
              └──→ xmr-node-proxy (port 8081) ──→ Mining Pool
```

- **nginx** serves the static miner files (HTML/JS/WASM)
- **xmr-node-proxy** acts as a WebSocket bridge between the browser and the Monero mining pool
- All mining happens in-browser on the device that opens the page
- NAS only runs the proxy — CPU load is on the mining device

## Prerequisites

- Docker and Docker Compose (on your NAS or server)
- A Monero wallet address (e.g. Cake Wallet)
- Devices with WebAssembly + WebSocket support (all modern browsers)

## Quick Start

### 1. Clone & Configure

```bash
git clone https://github.com/Dequanjae/XMR-WebMIner.git
cd XMR-WebMIner
```

### 2. Set Your Wallet

Edit `proxy/config.json` and replace `YOUR_WALLET_ADDRESS_HERE` with your Monero wallet address:

```json
"username": "YOUR_WALLET_ADDRESS_HERE"
```

Or use environment variables in docker-compose (recommended — see step 3).

### 3. Deploy with Docker Compose

```bash
docker compose up -d --build
```

This builds and starts two containers:
- `xmr-web-miner` on port **8088** (the web UI)
- `xmr-miner-proxy` on port **8081** (WebSocket proxy)

### 4. Access the Miner

Open on any device on your local network:

```
http://YOUR_NAS_IP:8088/miner.html?wallet=YOUR_WALLET_ADDRESS
```

For a custom proxy port (if you changed it in `config.json`):

```
http://YOUR_NAS_IP:8088/miner.html?wallet=YOUR_WALLET_ADDRESS&port=8081
```

### 5. Admin Dashboard

Open `http://YOUR_NAS_IP:8088/index.html` to view the admin dashboard with live stats.

---

## Docker Compose Reference

The `docker-compose.yml` supports these environment variables for the proxy:

| Variable | Default | Description |
|----------|---------|-------------|
| `WALLET` | `YOUR_WALLET_ADDRESS_HERE` | Your Monero wallet address |
| `POOL_HOST` | `pool.supportxmr.com` | Mining pool hostname |
| `POOL_PORT` | `7777` | Mining pool port |
| `PROXY_PORT` | `8081` | Port the proxy listens on |
| `COIN` | `xmr` | Coin to mine |
| `DIFF` | `5000` | Mining difficulty |

---

## NAS Deployment (Dockhand)

For deploying on a NAS via Dockhand API:

### Step 1: Prepare the payload

```python
import json
with open('docker-compose.yml') as f:
    compose = f.read()
payload = json.dumps({"name": "xmr-webminer", "compose": compose, "start": True})
with open('payload.json', 'w') as f:
    f.write(payload)
```

### Step 2: Deploy via API

```bash
curl -X POST 'http://YOUR_DOCKHAND_IP:9009/api/stacks?env=1' \
  -H 'Content-Type: application/json' \
  -d @payload.json
```

### Step 3: Check status

```bash
curl -s 'http://YOUR_DOCKHAND_IP:9009/api/stacks?env=1' | python3 -m json.tool
```

### Step 4: Stop / Delete

```bash
# Stop
curl -X POST 'http://YOUR_DOCKHAND_IP:9009/api/stacks/xmr-webminer/stop?env=1'

# Delete
curl -X DELETE 'http://YOUR_DOCKHAND_IP:9009/api/stacks/xmr-webminer?env=1'
```

---

## Files

```
├── docker-compose.yml      # Docker Compose config
├── proxy/
│   ├── config.json          # Proxy pool configuration
│   └── Dockerfile           # Builds xmr-node-proxy
├── web/
│   ├── index.html           # Admin dashboard
│   ├── miner.html           # Mining page (wallet input + stats)
│   ├── miner.js             # Client-side miner bridge
│   ├── miner.worker.js      # WebAssembly worker
│   └── miner.wasm           # Compiled CryptoNight WASM blob
└── README.md
```

---

## Troubleshooting

### Web miner shows "idle" / "waiting..."

- **Proxy not ready**: The proxy does `git clone` + `npm install` on every container start. This takes 2-5 minutes on slow hardware (e.g. Pentium N3710). Wait for it to finish.
- **Check proxy logs**: Look for `Node.js vX.X.X` followed by pool connection messages.
- **Wrong port**: Make sure the miner URL includes `&port=8081` if you changed the proxy port.

### Proxy crash-looping (`fatal: destination path '/app' already exists`)

Add `rm -rf /app &&` before `git clone` in the proxy command. This happens on container restart when `/app` already exists.

### Web miner shows "failed to load engine"

- **WASM not in repo**: Make sure `web/miner.wasm` exists (82KB). If not, build it from [xmr-wasm](https://github.com/jtgrassie/xmr-wasm) with `make TYPE=release` and commit.

### Container won't start on NAS

- **Image pull fails**: Some NAS devices can't pull Docker images directly. Pre-pull on a desktop first, or use a registry mirror.
- **Port conflict**: Check if ports 8088/8081 are already in use.

---

## Notes

- All mining happens in-browser on the device that opens the page
- Close the browser tab to stop mining
- The proxy uses a 1% developer fee (configurable in `config.json`)
- Only works on devices with WebAssembly and WebSocket support (all modern browsers)
- CPU usage is on the mining device, not the NAS (NAS only runs the proxy)

## Credits

- [xmr-wasm](https://github.com/jtgrassie/xmr-wasm) — Monero WASM miner
- [xmr-node-proxy](https://github.com/jtgrassie/xmr-node-proxy) — WebSocket proxy
# XMR-WASM Web Miner

Browser-based Monero (XMR) miner using WebAssembly — hosted on your NAS with a WebSocket proxy.

## Architecture

```
Browser ──→ nginx (port 8080) ──→ miner.wasm (WebAssembly)
   │
   └──→ xmr-node-proxy (port 8081) ──→ Mining Pool
```

- **nginx** serves the static miner files (HTML/JS/WASM)
- **xmr-node-proxy** acts as a WebSocket bridge between the browser and the Monero mining pool

## Prerequisites

- Docker and Docker Compose (on your NAS or server)
- A Monero wallet address

## Setup

### 1. Clone & Configure

```bash
git clone https://github.com/Dequanjae/XMR-WebMIner.git
cd XMR-WebMIner
```

### 2. Configure the Proxy Wallet

Edit `proxy/config.json` and replace `YOUR_WALLET_ADDRESS_HERE` with your Monero wallet address:

```json
"username": "YOUR_WALLET_ADDRESS_HERE"
```

You can also change the pool (default is `pool.supportxmr.com`) or add multiple pools.

### 3. Start with Docker Compose

```bash
docker compose up -d --build
```

This builds and starts two containers:
- `xmr-web-miner` on port **8080** (the web UI)
- `xmr-miner-proxy` on port **8081** (WebSocket proxy)

### 4. Access the Miner

Open `http://YOUR_NAS_IP:8080/miner.html?wallet=YOUR_WALLET_ADDRESS` on any device on your local network.

Replace `YOUR_WALLET_ADDRESS` with your actual Monero wallet address.

For a custom proxy port (if you changed it in `config.json`):
```
http://YOUR_NAS_IP:8080/miner.html?wallet=YOUR_WALLET_ADDRESS&port=8081
```

### 5. Admin Dashboard

Open `http://YOUR_NAS_IP:8080/index.html` to view the admin dashboard with live stats.

## Files

```
├── docker-compose.yml    # Docker Compose config
├── proxy/
│   ├── config.json       # Proxy pool configuration
│   └── Dockerfile         # Builds xmr-node-proxy
├── web/
│   ├── index.html       # Admin dashboard
│   ├── miner.html       # Mining page (wallet input + stats)
│   ├── miner.js         # Client-side miner bridge
│   ├── miner.worker.js  # WebAssembly worker
│   └── miner.wasm       # Compiled CryptoNight WASM blob
└── README.md
```

## Notes

- All mining happens in-browser on the device that opens the page
- Close the browser tab to stop mining
- The proxy uses a 1% developer fee (configurable in `config.json`)
- Only works on devices with WebAssembly and WebSocket support (all modern browsers)

## Credits

- [xmr-wasm](https://github.com/jtgrassie/xmr-wasm) — Monero WASM miner
- [xmr-node-proxy](https://github.com/jtgrassie/xmr-node-proxy) — WebSocket proxy

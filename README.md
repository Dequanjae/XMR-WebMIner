# XMR Web Miner

Browser-based Monero (XMR) miner using WebAssembly RandomX.

## Making Money XMR

| Metric | Status |
|--------|--------|
| Algorithm | RandomX (Monero current) |
| WASM Engine | 489 KB |
| Efficiency | ~13% of native per thread |
| Pool | pool.supportxmr.com:3333 |
| Wallet | 8ApdEka...M5wKwHE |
| Proxy | WebSocket to TCP stratum bridge |
| Status | **DEPLOYED** |

## Quick Start

```bash
docker compose up -d
```

Open http://YOUR_NAS_IP:8080 - enter wallet - start mining.

## How It Works

1. Container clones repo + downloads RandomX WASM on startup
2. Node.js proxy serves the web UI and bridges WebSocket to TCP stratum
3. Browser runs RandomX proof-of-work via WebAssembly
4. Shares submitted back through the proxy to the pool

## Files

```
├── config.js           # Wallet + pool config
├── docker-compose.yml  # Runtime clone deployment
├── proxy/
│   ├── Dockerfile      # Container build
│   └── index.js        # HTTP + WS-to-TCP stratum bridge
├── public/
│   ├── index.html      # Mining UI
│   ├── miner.js        # WebSocket + mining controller
│   ├── worker.js       # WASM engine driver
│   ├── randomx.js      # Emscripten glue (downloaded at startup)
│   └── randomx.wasm    # RandomX engine (downloaded at startup)
├── vendor/ws/          # Vendored WebSocket library
└── start.sh            # Container entrypoint
```

## Credits

- [aa022/RandomX-bonanza](https://github.com/aa022/RandomX-bonanza) — In-browser RandomX miner
- [l1mey112/randomx.js](https://github.com/l1mey112/randomx.js) — Semifloat RandomX implementation

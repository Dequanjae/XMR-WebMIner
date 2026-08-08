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

## Quick Start

```bash
docker compose up -d --build
```

Open http://YOUR_NAS_IP:8080 - enter wallet - start mining.

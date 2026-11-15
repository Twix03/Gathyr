#!/usr/bin/env bash
# Deploy the current branch on the server:  cd /services/Gathyr && ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# node comes from nvm on the server; non-interactive shells don't load it
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

[ -f deploy/livekit.yaml ] || { echo "deploy/livekit.yaml missing (copy from deploy/livekit.example.yaml)"; exit 1; }
[ -f Backend/.env ] || { echo "Backend/.env missing"; exit 1; }

echo "→ pulling"
git pull --ff-only

echo "→ backend deps"
Backend/.venv/bin/pip install -q -r Backend/requirements.txt

echo "→ frontend build"
(cd Frontend && npm ci --no-audit --no-fund --silent && npm run build --silent)

echo "→ restarting API (active rooms are reset)"
sudo systemctl restart gathyr-backend
for i in $(seq 1 20); do
  curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && { echo "✓ API healthy"; exit 0; }
  sleep 0.5
done
echo "✗ API did not become healthy — check deploy/backend.log"; exit 1

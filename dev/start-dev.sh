#!/usr/bin/env bash
# Local development: LiveKit :7882, backend :8001 (auto-reload), Vite :5173.
# Uses ports that don't clash with production, and NEVER writes Backend/.env
# (dev settings are passed as environment variables).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV="$ROOT/dev"

command -v livekit-server >/dev/null || { echo "livekit-server not found (brew install livekit)"; exit 1; }
[ -x "$ROOT/Backend/.venv/bin/uvicorn" ] || { echo "Backend venv missing: cd Backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt"; exit 1; }
[ -d "$ROOT/Frontend/node_modules" ] || { echo "Run: cd Frontend && npm install"; exit 1; }
[ -f "$ROOT/Frontend/.env.development.local" ] || cp "$ROOT/Frontend/.env.example" "$ROOT/Frontend/.env.development.local"

livekit-server --config "$DEV/livekit-dev.yaml" >"$DEV/livekit.log" 2>&1 &
echo $! >"$DEV/.livekit.pid"

(
  cd "$ROOT/Backend"
  LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=devsecret_devsecret_devsecret_0000 \
  LIVEKIT_URL=http://127.0.0.1:7882 DEBUG=true FEEDBACK_PATH="$DEV/feedback.jsonl" \
  CORS_ORIGINS='["http://localhost:5173","http://127.0.0.1:5173"]' \
    exec .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001 --reload --ws-max-size 65536
) >"$DEV/backend.log" 2>&1 &
echo $! >"$DEV/.backend.pid"

(cd "$ROOT/Frontend" && exec npx vite --port 5173 --strictPort) >"$DEV/frontend.log" 2>&1 &
echo $! >"$DEV/.frontend.pid"

echo "Gathyr dev running:"
echo "  app      http://localhost:5173"
echo "  api      http://localhost:8001/docs"
echo "  livekit  ws://localhost:7882"
echo "logs in dev/*.log — stop with dev/stop-dev.sh"

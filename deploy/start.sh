#!/bin/bash
# ============================================================
#  Gathyr — Start all services (Cloudflare Tunnel edition)
#  Run from the project root: ./deploy/start.sh
# ============================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$PROJECT_ROOT/deploy"
BACKEND_DIR="$PROJECT_ROOT/Backend"
FRONTEND_DIST="$PROJECT_ROOT/Frontend/dist"
LIVEKIT_PID_FILE="$DEPLOY_DIR/.livekit.pid"
BACKEND_PID_FILE="$DEPLOY_DIR/.backend.pid"
FRONTEND_PID_FILE="$DEPLOY_DIR/.frontend.pid"
TUNNEL_PID_FILE="$DEPLOY_DIR/.tunnel.pid"

echo "🚀 Starting Gathyr..."

echo "🛠  Building frontend..."
cd "$PROJECT_ROOT/Frontend"
npm run build
cd "$PROJECT_ROOT"

# ── Sanity checks ────────────────────────────────────────────
if [ ! -d "$FRONTEND_DIST" ]; then
  echo "❌ Frontend build failed (dist directory not found)."
  exit 1
fi

if ! command -v livekit-server &> /dev/null; then
  echo "❌ livekit-server not found. Run: brew install livekit"
  exit 1
fi

if ! command -v cloudflared &> /dev/null; then
  echo "❌ cloudflared not found. Run: brew install cloudflare/cloudflare/cloudflared"
  exit 1
fi

# ── Copy production env to Backend ──────────────────────────
cp "$DEPLOY_DIR/.env.production" "$BACKEND_DIR/.env"
echo "✅ Copied production .env to Backend"

# ── Serve Frontend static files (port 3000) ─────────────────
echo "▶  Starting frontend file server on :3000..."
npx --yes serve -s "$FRONTEND_DIST" -l 3000 &> "$DEPLOY_DIR/frontend.log" &
echo $! > "$FRONTEND_PID_FILE"
echo "✅ Frontend server started (pid $(cat $FRONTEND_PID_FILE))"

# ── Start LiveKit ────────────────────────────────────────────
echo "▶  Starting LiveKit server..."
livekit-server --config "$DEPLOY_DIR/livekit.yaml" &> "$DEPLOY_DIR/livekit.log" &
echo $! > "$LIVEKIT_PID_FILE"
echo "✅ LiveKit started (pid $(cat $LIVEKIT_PID_FILE)) — logs: deploy/livekit.log"

# ── Start FastAPI backend ────────────────────────────────────
echo "▶  Starting FastAPI backend..."
cd "$BACKEND_DIR"
source .venv/bin/activate 2>/dev/null || true
uvicorn main:app --host 0.0.0.0 --port 8000 --no-access-log &> "$DEPLOY_DIR/backend.log" &
echo $! > "$BACKEND_PID_FILE"
echo "✅ Backend started (pid $(cat $BACKEND_PID_FILE)) — logs: deploy/backend.log"

# Give services a moment to start before opening the tunnel
sleep 2

# ── Start Cloudflare Tunnel ──────────────────────────────────
echo "▶  Starting Cloudflare Tunnel..."
cd "$PROJECT_ROOT"
cloudflared tunnel --config "$DEPLOY_DIR/cloudflare-tunnel.yml" run &> "$DEPLOY_DIR/tunnel.log" &
echo $! > "$TUNNEL_PID_FILE"
echo "✅ Tunnel started (pid $(cat $TUNNEL_PID_FILE)) — logs: deploy/tunnel.log"

echo ""
echo "✨ Gathyr is live at https://gathyr.app"
echo "   LiveKit:  wss://livekit.gathyr.app"
echo ""
echo "   To stop all services: ./deploy/stop.sh"

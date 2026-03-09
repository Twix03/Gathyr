#!/bin/bash
# ============================================================
#  Gathyr — Local Dev / Testing
#  Runs on SEPARATE PORTS from production so both can coexist:
#
#  Frontend: http://localhost:5173  (Vite dev, hot reload)
#  Backend:  http://localhost:8001  (prod uses :8000)
#  LiveKit:  ws://localhost:7882    (prod uses :7880)
# ============================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/Backend"
FRONTEND_DIR="$PROJECT_ROOT/Frontend"
DEV_DIR="$PROJECT_ROOT/dev"

LIVEKIT_PID_FILE="$DEV_DIR/.livekit.pid"
BACKEND_PID_FILE="$DEV_DIR/.backend.pid"
FRONTEND_PID_FILE="$DEV_DIR/.frontend.pid"

mkdir -p "$DEV_DIR"

echo "🛠  Starting Gathyr dev environment..."

# ── Sanity checks ────────────────────────────────────────────
if ! command -v livekit-server &> /dev/null; then
  echo "❌ livekit-server not found. Run: brew install livekit"
  exit 1
fi

# ── Write dev .env to Backend ────────────────────────────────
# (Overwrites whatever start.sh may have put there)
cat > "$BACKEND_DIR/.env" << 'EOF'
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
DEBUG=true
CORS_ORIGINS=["http://localhost:5173","http://localhost:8001","http://127.0.0.1:5173","http://127.0.0.1:8001"]
EOF
echo "✅ Dev .env written to Backend"

# ── Start LiveKit on :7882 ────────────────────────────────────
echo "▶  Starting LiveKit dev server on :7882..."
livekit-server --config "$DEV_DIR/livekit-dev.yaml" &> "$DEV_DIR/livekit.log" &
echo $! > "$LIVEKIT_PID_FILE"
echo "✅ LiveKit started (pid $(cat $LIVEKIT_PID_FILE))"

# ── Start FastAPI backend on :8001 ───────────────────────────
echo "▶  Starting FastAPI backend on :8001..."
cd "$BACKEND_DIR"
source .venv/bin/activate 2>/dev/null || true
uvicorn main:app --host 0.0.0.0 --port 8001 --reload &> "$DEV_DIR/backend.log" &
echo $! > "$BACKEND_PID_FILE"
echo "✅ Backend started (pid $(cat $BACKEND_PID_FILE), with --reload)"

# ── Start Vite dev server on :5173 ───────────────────────────
echo "▶  Starting Vite dev server on :5173..."
cd "$FRONTEND_DIR"
npm run dev &> "$DEV_DIR/frontend.log" &
echo $! > "$FRONTEND_PID_FILE"
echo "✅ Frontend started (pid $(cat $FRONTEND_PID_FILE))"

echo ""
echo "🎉 Dev environment ready! (Production at gathyr.app is unaffected)"
echo ""
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8001/docs"
echo "   LiveKit:  ws://localhost:7882"
echo ""
echo "   Logs: dev/backend.log | dev/frontend.log | dev/livekit.log"
echo "   Stop: ./dev/stop-dev.sh"

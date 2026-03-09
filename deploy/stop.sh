#!/bin/bash
# ============================================================
#  Gathyr — Stop all services
#  Run from the project root: ./deploy/stop.sh
# ============================================================

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping Gathyr services..."

stop_pid() {
  local NAME=$1
  local PID_FILE=$2
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null && echo "✅ $NAME stopped" || echo "⚠️  $NAME was not running"
    rm "$PID_FILE"
  else
    echo "⚠️  $NAME pid file not found"
  fi
}

stop_pid "Cloudflare Tunnel" "$DEPLOY_DIR/.tunnel.pid"
stop_pid "LiveKit"           "$DEPLOY_DIR/.livekit.pid"
stop_pid "Backend"           "$DEPLOY_DIR/.backend.pid"
stop_pid "Frontend server"   "$DEPLOY_DIR/.frontend.pid"

echo "Done."

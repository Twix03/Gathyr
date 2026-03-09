#!/bin/bash
# ============================================================
#  Gathyr — Stop local dev services
# ============================================================

DEV_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping dev services..."

stop_pid() {
  local NAME=$1
  local PID_FILE=$2
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null && echo "✅ $NAME stopped" || echo "⚠️  $NAME was not running"
    rm "$PID_FILE"
  else
    echo "⚠️  $NAME pid file not found (already stopped?)"
  fi
}

stop_pid "LiveKit dev"   "$DEV_DIR/.livekit.pid"
stop_pid "Backend dev"   "$DEV_DIR/.backend.pid"
stop_pid "Frontend dev"  "$DEV_DIR/.frontend.pid"

echo "Done. Production (gathyr.app) is still running."

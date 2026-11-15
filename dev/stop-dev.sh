#!/usr/bin/env bash
DEV="$(cd "$(dirname "$0")" && pwd)"
for svc in frontend backend livekit; do
  f="$DEV/.$svc.pid"
  if [ -f "$f" ]; then
    pid=$(cat "$f")
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null && echo "stopped $svc" || true
    rm -f "$f"
  fi
done

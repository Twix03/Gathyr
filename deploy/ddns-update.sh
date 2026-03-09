#!/bin/bash
# ============================================================
#  Namecheap Dynamic DNS Updater
#  Updates your A record if your public IP changes.
#
#  Setup (one-time):
#    1. Enable "Dynamic DNS" in Namecheap dashboard
#       (Domain List → Manage → Dynamic DNS → toggle ON, copy the password)
#    2. Set DDNS_PASSWORD below
#    3. Add to crontab: crontab -e
#       */5 * * * * /Users/sathwik/Desktop/gathyr/deploy/ddns-update.sh
# ============================================================

# ── Config ───────────────────────────────────────────────────
DOMAIN="gathyr.app"
HOSTS=("@" "livekit")        # Both root and livekit subdomain
DDNS_PASSWORD="REPLACE_WITH_NAMECHEAP_DDNS_PASSWORD"
IP_CACHE_FILE="/tmp/gathyr_last_ip"
# ─────────────────────────────────────────────────────────────

CURRENT_IP=$(curl -s ifconfig.me)

if [ -z "$CURRENT_IP" ]; then
  echo "$(date): Failed to get public IP" >> /tmp/gathyr_ddns.log
  exit 1
fi

# Read last known IP
LAST_IP=""
if [ -f "$IP_CACHE_FILE" ]; then
  LAST_IP=$(cat "$IP_CACHE_FILE")
fi

if [ "$CURRENT_IP" = "$LAST_IP" ]; then
  # IP unchanged, nothing to do
  exit 0
fi

echo "$(date): IP changed from $LAST_IP to $CURRENT_IP — updating DNS..." >> /tmp/gathyr_ddns.log

for HOST in "${HOSTS[@]}"; do
  RESPONSE=$(curl -s "https://dynamicdns.park-your-domain.com/update?host=${HOST}&domain=${DOMAIN}&password=${DDNS_PASSWORD}&ip=${CURRENT_IP}")
  echo "$(date): Updated $HOST.$DOMAIN → $CURRENT_IP | Response: $RESPONSE" >> /tmp/gathyr_ddns.log
done

echo "$CURRENT_IP" > "$IP_CACHE_FILE"

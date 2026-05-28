# Gathyr

Gathyr is a real-time co-experience platform for social interactions, gaming, and media sharing.

## Project Structure

- **Backend/** — FastAPI server handling room logic, signaling, and game state
- **Frontend/** — Vite + React application for the user interface
- **deploy/** — Production configuration and systemd unit files

## Architecture (Production — VPS)

```
Browser → Cloudflare (TLS) → gathyr.app:80 → Caddy → Frontend dist/ or Backend :8000
Browser → livekit.gathyr.app:443 → Caddy (Let's Encrypt TLS) → LiveKit :7880
WebRTC  → livekit.gathyr.app UDP 50000-60000 → LiveKit (direct, no proxy)
```

### Port Map

| Port | Protocol | Service |
|------|----------|---------|
| 80 | TCP | Caddy — receives proxied HTTP from Cloudflare |
| 443 | TCP | Caddy — TLS for livekit.gathyr.app (Let's Encrypt) |
| 8000 | TCP | FastAPI backend (internal only) |
| 7880 | TCP | LiveKit signaling (internal → Caddy) |
| 7881 | TCP | LiveKit TCP fallback media |
| 50000–60000 | UDP | LiveKit WebRTC media (direct) |

### DNS (Cloudflare)

| Record | Type | Value | Proxy |
|--------|------|-------|-------|
| `gathyr.app` | A | `129.159.234.189` | ✅ Orange (Flexible SSL) |
| `livekit.gathyr.app` | A | `129.159.234.189` | ❌ Grey (DNS only) |

---

## Services

All three services run as **systemd units** — they start automatically on boot and restart on crash.

| Unit | Description |
|------|-------------|
| `caddy` | Reverse proxy + static frontend server |
| `gathyr-backend` | FastAPI/uvicorn on :8000 |
| `gathyr-livekit` | LiveKit server on :7880 |

### Status

```bash
sudo systemctl status caddy gathyr-backend gathyr-livekit
```

### Logs

```bash
# Live log tailing
journalctl -u gathyr-backend -f
journalctl -u gathyr-livekit -f
journalctl -u caddy -f

# Log files
tail -f deploy/backend.log
tail -f deploy/livekit.log
```

---

## Reloading & Restarting

### Frontend change (rebuild + reload)
```bash
cd /services/Gathyr/Frontend && npm run build
sudo systemctl reload caddy
```

### Backend code change
```bash
sudo systemctl restart gathyr-backend
```

### LiveKit config change
```bash
sudo systemctl restart gathyr-livekit
```

### Caddy config change
```bash
sudo cp /services/Gathyr/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## Installing from Scratch

### 1. Install system dependencies

```bash
# LiveKit server
curl -sSL https://get.livekit.io | bash

# Caddy
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

### 2. Python backend

```bash
cd Backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 3. Frontend

```bash
cd Frontend
npm install
npm run build
```

### 4. Configure secrets

Copy and fill in `deploy/.env.production` → `Backend/.env`:
```bash
cp deploy/.env.production Backend/.env
```
Ensure `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` match in both `Backend/.env` and `deploy/livekit.yaml`.

### 5. Firewall (OCI — must do both)

**OCI Console Security List** — open ingress rules for TCP 80, 443, 7880, 7881 and UDP 50000–60000.

**OS iptables** (OCI pre-inserts a REJECT rule — insert before it):
```bash
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 7880 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 7881 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p udp --dport 50000:60000 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

### 6. Install systemd services

```bash
sudo cp deploy/gathyr-backend.service /etc/systemd/system/
sudo cp deploy/gathyr-livekit.service /etc/systemd/system/
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable --now gathyr-backend gathyr-livekit caddy
```

---

## Features

- **Low Latency Media** — LiveKit WebRTC with UDP for high-quality video/audio
- **Floating Video Grid** — Custom UI for repositioning and resizing participant tiles
- **Document Picture-in-Picture** — Persistent video overlay across tabs
- **Synchronized Games** — Real-time multiplayer via WebSockets

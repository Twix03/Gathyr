# Gathyr — Self-Hosting Guide

Deploy Gathyr on your Mac at **https://gathyr.app**. This guide takes ~30 minutes end-to-end.

---

## Step 1 — Install Dependencies

```bash
# Install Caddy (reverse proxy + automatic HTTPS)
brew install caddy

# Install LiveKit server binary
brew install livekit
```

Verify installs:
```bash
caddy version
livekit-server --version
```

---

## Step 2 — Generate a Strong LiveKit Secret

```bash
openssl rand -hex 32
```

Copy the output. You'll use it in the next two steps.

---

## Step 3 — Configure Production Environment

Open `deploy/.env.production` and fill in your secret:
```
LIVEKIT_API_KEY=gathyr_key
LIVEKIT_API_SECRET=<PASTE_SECRET_HERE>
```

Open `deploy/livekit.yaml` and set the same secret under `keys`:
```yaml
keys:
  gathyr_key: <PASTE_SECRET_HERE>
```

> ⚠️ Both values **must match exactly** or LiveKit token auth will fail.

---

## Step 4 — DNS Setup on Namecheap

1. Log in → **Domain List** → **Manage** next to `gathyr.app`
2. Go to **Advanced DNS** tab
3. Add two A records:

| Type | Host | Value |
|------|------|-------|
| A Record | `@` | `106.51.80.211` |
| A Record | `livekit` | `106.51.80.211` |

> Your current public IP is `106.51.80.211`. Verify with: `curl ifconfig.me`

---

## Step 5 — Router Port Forwarding

Log into your home router (usually `192.168.1.1` or `192.168.0.1`):

1. Find **Port Forwarding** settings
2. Add rules pointing to your Mac's local IP (find it with `ipconfig getifaddr en0`):

| External Port | Internal IP | Internal Port | Protocol |
|---|---|---|---|
| 80 | your-mac-local-ip | 80 | TCP |
| 443 | your-mac-local-ip | 443 | TCP |
| 7880 | your-mac-local-ip | 7880 | TCP |
| 3478 | your-mac-local-ip | 3478 | UDP |

> Ports 7880 and 3478 are for LiveKit WebRTC.

---

## Step 6 — Build the Frontend

```bash
cd /Users/sathwik/Desktop/gathyr/Frontend
npm run build
```

This creates `Frontend/dist/` — Caddy will serve files from here.

---

## Step 7 — Set Up DDNS (Dynamic IP protection)

If your ISP changes your IP occasionally, this auto-updates Namecheap DNS.

**Enable Dynamic DNS on Namecheap:**
1. Domain List → Manage → **Dynamic DNS** tab → toggle **ON**
2. Copy the **Dynamic DNS Password** shown

**Configure the script:**
Open `deploy/ddns-update.sh` and set:
```bash
DDNS_PASSWORD="your-namecheap-ddns-password"
```

**Add to crontab** (runs every 5 minutes):
```bash
crontab -e
```
Add this line:
```
*/5 * * * * /Users/sathwik/Desktop/gathyr/deploy/ddns-update.sh
```

---

## Step 8 — Allow Caddy Through macOS Firewall

System Settings → Network → Firewall → Options → Add `caddy` and allow incoming connections.

Or temporarily disable the firewall while testing.

---

## Step 9 — First Run 🚀

```bash
cd /Users/sathwik/Desktop/gathyr
./deploy/start.sh
```

On first run, Caddy will automatically:
- Request a free Let's Encrypt SSL certificate for `gathyr.app` and `livekit.gathyr.app`
- Start serving over HTTPS

> ⚠️ For certificate issuance to work: DNS must be propagated AND ports 80/443 must be forwarded. This can take up to a few hours after DNS changes.

---

## Stop Services

```bash
./deploy/stop.sh
```

---

## Logs

| Service | Log file |
|---------|----------|
| Caddy | `deploy/caddy.log` |
| FastAPI Backend | `deploy/backend.log` |
| LiveKit | `deploy/livekit.log` |
| DDNS updates | `/tmp/gathyr_ddns.log` |

---

## Troubleshooting

**Site not loading:**
- Check if DNS has propagated: `dig gathyr.app`
- Check if ports are open: `curl -v http://gathyr.app`
- Check Caddy logs: `tail -f deploy/caddy.log`

**Camera/mic not working:**
- HTTPS must be working — check if browser shows 🔒 padlock

**LiveKit connection failed:**
- Verify `livekit.gathyr.app` resolves: `dig livekit.gathyr.app`
- Check LiveKit logs: `tail -f deploy/livekit.log`
- Verify secret matches in both `.env.production` and `livekit.yaml`

**Backend errors:**
```bash
tail -f deploy/backend.log
```

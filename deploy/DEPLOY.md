# Deploying Gathyr

Production runs on the Oracle VM (`ssh ubuntu@oracle`) from a git checkout at
**`/services/Gathyr`**.

| Piece | How it runs |
|---|---|
| API | systemd `gathyr-backend` → uvicorn on `127.0.0.1:8000` (unit: `deploy/gathyr-backend.service`) |
| Media | systemd `gathyr-livekit` → `livekit-server --config deploy/livekit.yaml` |
| Web | Caddy serves `Frontend/dist`, proxies `/api`, `/ws`, `/health` (blocks in `deploy/Caddyfile`) |
| DNS | `gathyr.app` via Cloudflare (proxied); `livekit.gathyr.app` DNS-only so WebRTC hits the VM |

## Routine deploy

```bash
ssh ubuntu@oracle
cd /services/Gathyr && ./deploy/deploy.sh
```

Then verify from your machine: `BASE_URL=https://gathyr.app e2e/.venv/bin/python e2e/smoke.py`.

Restarting the API ends all active rooms (state is in memory): people in a call see
"Your session expired" and have to start a new room. Deploy when rooms are quiet:
`curl -s localhost:8000/health` shows the room count.

## Secrets (never committed)

| File | Contents |
|---|---|
| `Backend/.env` | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `CORS_ORIGINS=["https://gathyr.app"]` |
| `Frontend/.env.production` | `VITE_API_BASE_URL=https://gathyr.app`, `VITE_WS_BASE_URL=wss://gathyr.app`, `VITE_LIVEKIT_URL=wss://livekit.gathyr.app` |
| `deploy/livekit.yaml` | copy of `livekit.example.yaml` with the same key/secret as `Backend/.env` |

### Rotating the LiveKit key
```bash
KEY="gk_$(openssl rand -hex 6)"; SECRET="$(openssl rand -hex 32)"
# put KEY: SECRET under `keys:` in deploy/livekit.yaml and the same pair in Backend/.env, then:
sudo systemctl restart gathyr-livekit gathyr-backend
```

## Firewall (Oracle security list + iptables)
TCP 80, 443, 7881 · UDP 7882, 50000–60000 · TURN: TCP 5349, UDP 3478, UDP 30000–40000.

## TURN
TURN lets people behind strict corporate/school networks connect. It needs the `ubuntu` user to
read Caddy's certificate for `livekit.gathyr.app`:

```bash
D=/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/livekit.gathyr.app
for d in /var/lib/caddy /var/lib/caddy/.local /var/lib/caddy/.local/share /var/lib/caddy/.local/share/caddy \
         /var/lib/caddy/.local/share/caddy/certificates $(dirname $D); do sudo setfacl -m u:ubuntu:x $d; done
sudo setfacl -R -m u:ubuntu:rX $D && sudo setfacl -d -m u:ubuntu:rX $D   # -d: renewals inherit it
```
then set `turn.enabled: true` in `deploy/livekit.yaml` and restart `gathyr-livekit`.

## One-time setup on a fresh server
```bash
sudo cp deploy/gathyr-backend.service deploy/gathyr-livekit.service /etc/systemd/system/
sudo cp deploy/logrotate-gathyr /etc/logrotate.d/gathyr
sudo systemctl daemon-reload && sudo systemctl enable --now gathyr-livekit gathyr-backend
# paste the blocks from deploy/Caddyfile into /etc/caddy/Caddyfile, then: sudo systemctl reload caddy
```

## Logs & feedback
- `deploy/backend.log`, `deploy/livekit.log` (rotated weekly by logrotate)
- User feedback: `~/.gathyr/feedback.jsonl`

# Grain Relay Deployment for Pinseekr Golf

This directory contains the deployment configuration for running a [Grain](https://github.com/0ceanSlim/grain) Nostr relay on Umbrel (or any Docker host) with Caddy for automatic SSL.

## Architecture

```
Internet (wss://relay.pinseekr.golf)
         │
         ▼
┌─────────────────────────────────────────┐
│  Caddy (ports 80/443)                   │
│  - Auto SSL via Let's Encrypt           │
│  - WebSocket proxy                      │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Grain Relay (port 8080 internal)       │
│  - Nostr protocol                       │
│  - Kind whitelist for golf events       │
│  - Rate limiting                        │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  MongoDB (port 27017 internal)          │
│  - Event storage                        │
│  - Persistent data                      │
└─────────────────────────────────────────┘
```

## Prerequisites

1. **Domain DNS**: Point `relay.pinseekr.golf` A record to your server's public IP
2. **Port Forwarding**: Forward ports 80 and 443 to your Umbrel device
3. **Docker & Docker Compose**: Pre-installed on Umbrel

## Quick Start

```bash
# SSH into Umbrel
ssh umbrel@umbrel.local

# Clone or copy this folder
mkdir -p ~/pinseekr-relay
cd ~/pinseekr-relay
# Copy deploy/umbrel contents here

# Start the stack
docker compose up -d

# Check logs
docker compose logs -f
```

## Configuration

### Grain Config (`config/config.json`)

Key settings:

| Setting | Value | Description |
|---------|-------|-------------|
| `kind_whitelist.kinds` | `[0, 1, 3, 4, 5, 6, 7, 1111, 30005, 30007, 30010, 30011, 30100, 30382, 31924]` | Only accept golf-related Nostr kinds |
| `rate_limit.event_limit` | `50` | Events per second limit |
| `pubkey_blacklist.enabled` | `true` | Block spam pubkeys |
| `relay_info.name` | `Pinseekr Golf Relay` | Relay name shown to clients |

### Allowed Event Kinds

| Kind | Name | Description |
|------|------|-------------|
| 0 | User Metadata | Profiles |
| 1 | Short Text Note | General posts |
| 3 | Contacts | Follow lists |
| 4 | Encrypted DM | Round invites |
| 5 | Event Deletion | Delete events |
| 6 | Repost | Reposts |
| 7 | Reaction | Likes |
| 1111 | Comment | NIP-22 comments |
| 30005 | Settlement | Round settlements |
| 30007 | Tournament | Pinseekr Cup tournaments |
| 30010 | Player Score | Per-player scores |
| 30011 | Invite Accept | Round join confirmations |
| 30100 | Golf Course | Course data |
| 30382 | Golf Profile | Player profiles |
| 31924 | Golf Round | Complete rounds |

### Caddy Config (`Caddyfile`)

- Auto-obtains SSL certificate from Let's Encrypt
- WebSocket headers configured for Nostr
- Access logging to `/data/access.log`

## Management

```bash
# View relay status
docker compose ps

# View logs
docker compose logs grain
docker compose logs caddy
docker compose logs mongodb

# Restart relay
docker compose restart grain

# Stop everything
docker compose down

# Update to latest Grain version
docker compose pull
docker compose up -d
```

## Data Persistence

| Directory | Contents |
|-----------|----------|
| `./mongo_data` | MongoDB database files |
| `./caddy_data` | SSL certificates |
| `./caddy_config` | Caddy config cache |
| `./config` | Grain configuration |

## Backup

```bash
# Backup MongoDB data
docker compose exec mongodb mongodump --out /data/db/backup
cp -r ./mongo_data/backup ~/pinseekr-backup-$(date +%Y%m%d)
```

## Verify Deployment

```bash
# Check relay info
curl https://relay.pinseekr.golf

# Test WebSocket (install websocat)
echo '["REQ","test",{"limit":1}]' | websocat wss://relay.pinseekr.golf

# Check from browser console
const ws = new WebSocket('wss://relay.pinseekr.golf');
ws.onopen = () => console.log('Connected!');
ws.onerror = (e) => console.error('Error:', e);
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SSL not working | Check DNS, ensure ports 80/443 are open |
| Connection refused | `docker compose ps` - check all services are running |
| MongoDB errors | Check `docker compose logs mongodb` |
| Rate limited | Adjust `rate_limit` settings in config.json |

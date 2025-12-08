# Testing Deployment - Friends & Family

Simple deployment for testing Pinseekr Golf with friends and family through the pinseekr.golf domain.

## What You Get

- **pinseekr.golf** → Your React frontend app
- **relay.pinseekr.golf** → Nostr relay for golf data
- Auto SSL certificates via Let's Encrypt
- One-command deployment
- Perfect for gathering feedback!

## Prerequisites

### 1. Domain DNS Setup
Point both domains to your public IP:
```
pinseekr.golf         A    YOUR.PUBLIC.IP.ADDRESS
relay.pinseekr.golf   A    YOUR.PUBLIC.IP.ADDRESS
```

### 2. Port Forwarding
Forward these ports from your router to your Umbrel device:
- Port `80` → Umbrel:80 (for SSL certificate verification)
- Port `443` → Umbrel:443 (for HTTPS traffic)

### 3. Docker
Already installed on Umbrel ✅

## Quick Setup

### Step 1: Copy Files to Umbrel
```bash
# SSH to your Umbrel device
ssh umbrel@umbrel.local

# Create deployment directory
mkdir -p ~/pinseekr-testing
cd ~/pinseekr-testing

# Copy the deploy/testing folder contents here
# (You can use scp, rsync, or copy manually)
```

### Step 2: One-Command Deploy
```bash
# Make deploy script executable
chmod +x deploy.sh

# Deploy everything
./deploy.sh
```

That's it! The script will:
1. Build your React frontend
2. Create necessary directories and configs
3. Start MongoDB, Grain relay, Nginx, and Caddy
4. Set up automatic SSL certificates

## What Happens

| Service | Purpose | Available At |
|---------|---------|-------------|
| **Frontend** | React app (served by Caddy) | https://pinseekr.golf |
| **Relay** | Nostr relay (Grain) | wss://relay.pinseekr.golf |
| **Database** | MongoDB | Internal only |
| **Caddy** | Web server + SSL + proxy | Handles all traffic |

## Share With Friends

Just send them: **https://pinseekr.golf** 🎯

They can:
- ✅ Create golf rounds and invite others
- ✅ Enter scores on mobile devices
- ✅ Join rounds using invite codes
- ✅ View live leaderboards
- ✅ Try the interactive demo

## Management Commands

```bash
# Check if everything is running
docker compose ps

# View live logs (Ctrl+C to exit)
docker compose logs -f

# View specific service logs
docker compose logs relay
docker compose logs caddy
docker compose logs mongodb

# Restart a service
docker compose restart relay

# Restart everything
docker compose restart

# Update to latest code
./deploy.sh

# Stop everything
docker compose down

# Clean up (removes all data!)
docker compose down -v
rm -rf data/
```

## Troubleshooting

### "This site can't be reached"
- ✅ Check DNS A records are pointing to your public IP
- ✅ Check port forwarding (80, 443) is configured
- ✅ Wait 5-10 minutes for DNS propagation

### "Your connection is not private" (SSL errors)
- ✅ Wait 5-10 minutes for Let's Encrypt certificates
- ✅ Check `docker compose logs caddy` for certificate errors
- ✅ Ensure port 80 is forwarded (needed for certificate verification)

### App loads but can't connect to relay
- ✅ Check `docker compose logs relay`
- ✅ Verify `relay.pinseekr.golf` DNS is set up
- ✅ Test WebSocket: `websocat wss://relay.pinseekr.golf`

### Frontend shows old version
- ✅ Run `./deploy.sh` to rebuild and redeploy
- ✅ Clear browser cache (Ctrl+F5)

### Services keep restarting
- ✅ Check logs: `docker compose logs`
- ✅ Check available disk space: `df -h`
- ✅ Check available memory: `free -h`

## Data & Backups

Your data is stored in:
- **Golf rounds & scores**: `./data/mongo/`
- **SSL certificates**: `./data/caddy/`
- **Relay config**: `./relay-config/`

### Simple Backup
```bash
# Create backup
tar -czf pinseekr-backup-$(date +%Y%m%d).tar.gz data/ relay-config/

# Restore from backup
tar -xzf pinseekr-backup-YYYYMMDD.tar.gz
```

## Configuration

### Relay Settings
Edit `relay-config/config.json` to:
- Change rate limits
- Add/remove supported event kinds
- Block specific users (if needed)

### Frontend Config
The app automatically uses:
- **Primary relay**: `wss://relay.pinseekr.golf`
- **Fallback relays**: Public Nostr relays

## Performance Tips

For better performance with multiple users:
- Monitor with `docker stats`
- Consider increasing relay rate limits
- Add more storage if needed
- Check network bandwidth usage

---

**Perfect for testing!** No complex security setup required - just get it running and gather feedback from friends and family. 🏌️‍♂️
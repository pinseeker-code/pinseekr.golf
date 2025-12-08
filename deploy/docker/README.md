# Docker Deployment - Production PWA

Simple Docker container deployment for pinseekr.golf production hosting.

## What This Creates

- **Single lightweight container** (~15MB) with Caddy + your React PWA
- **Automatic HTTPS** with Let's Encrypt certificates for pinseekr.golf
- **PWA optimized** with proper caching, service worker support, and mobile install
- **Production ready** with security headers and compression

## Quick Deployment

### Prerequisites
1. **DNS**: Point `pinseekr.golf` A record to your Umbrel's public IP
2. **Ports**: Forward 80 and 443 from router to Umbrel
3. **Docker**: Already installed on Umbrel

### Deploy
```bash
# On your Umbrel device (SSH or terminal)
git clone https://github.com/pinseeker-code/pinseekr.golf.git
cd pinseekr.golf

# Make script executable and deploy
chmod +x deploy/docker/build-and-deploy.sh
./deploy/docker/build-and-deploy.sh
```

## Development Workflow

### On Windows (Development)
```bash
# Make changes to your code
npm run dev        # Test locally
git add .
git commit -m "Update feature"
git push origin main
```

### On Umbrel (Production)
```bash
# Update and redeploy
git pull origin main
./deploy/docker/build-and-deploy.sh
```

## What the Script Does

1. **Builds** your React app (`npm run build`)
2. **Creates** Docker image with Caddy + built files
3. **Stops** any existing container
4. **Starts** new container with:
   - Port 80/443 exposed
   - Auto-restart enabled
   - SSL certificate persistence
   - Proper caching headers

## Container Details

| Component | Purpose |
|-----------|---------|
| **Caddy** | Web server + automatic HTTPS |
| **React Build** | Your PWA static files |
| **Volumes** | SSL certificates (persistent) |

## Management

```bash
# View logs
docker logs -f pinseekr-golf

# Restart container
docker restart pinseekr-golf

# Stop container
docker stop pinseekr-golf

# Update deployment
./deploy/docker/build-and-deploy.sh

# Check status
docker ps | grep pinseekr-golf
```

## Troubleshooting

### "Site can't be reached"
- ✅ Check DNS A record points to correct IP
- ✅ Verify port forwarding (80, 443)
- ✅ Check container is running: `docker ps`

### SSL Certificate Issues
- ✅ Wait 5-10 minutes for initial certificate
- ✅ Check logs: `docker logs pinseekr-golf`
- ✅ Ensure port 80 is accessible (needed for verification)

### Container Won't Start
- ✅ Check logs: `docker logs pinseekr-golf`
- ✅ Verify build completed: `ls -la dist/`
- ✅ Check available disk space: `df -h`

## Benefits

- ✅ **Fast deploys** (~30 seconds)
- ✅ **Tiny footprint** (15MB vs 500MB+ Node containers)
- ✅ **Zero runtime deps** (no Node.js security updates needed)
- ✅ **Auto SSL** (Let's Encrypt integration)
- ✅ **PWA ready** (proper headers, offline support)
- ✅ **Production grade** (caching, compression, security)

Perfect for friends & family testing with a professional deployment! 🏌️‍♂️
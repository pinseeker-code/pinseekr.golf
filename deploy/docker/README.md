# Docker Deployment - Portainer Stack for Umbrel

Portainer stack deployment for pinseekr.golf on Umbrel devices.

## What This Creates

- **Single lightweight container** (~15MB) with Caddy + your React PWA
- **Automatic HTTPS** with Let's Encrypt certificates for pinseekr.golf
- **PWA optimized** with proper caching, service worker support, and mobile install
- **Production ready** with security headers and compression
- **Persistent volumes** for Caddy data and configuration
- **Health checks** for container monitoring

## Prerequisites

1. **DNS**: Point `pinseekr.golf` A record to your Umbrel's public IP
2. **Ports**: Forward 80 and 443 from router to Umbrel
3. **Portainer**: Installed on Umbrel (recommended by Umbrel)

## Portainer Stack Deployment

### Step 1: Install Portainer on Umbrel
If not already installed, install Portainer from the Umbrel App Store.

### Step 2: Clone Repository on Umbrel
```bash
# SSH to your Umbrel or use the terminal
git clone https://github.com/pinseeker-code/pinseekr.golf.git
cd pinseekr.golf
```

### Step 3: Deploy via Portainer
1. Open Portainer in your browser (usually at http://umbrel.local:9000)
2. Go to **Stacks** → **Add Stack**
3. Name: `pinseekr-golf`
4. **Upload** or **Repository** method:
   - **Repository**: Use `https://github.com/pinseeker-code/pinseekr.golf.git`
   - **Compose path**: `deploy/docker/docker-compose.yml`
   - Or **Upload**: Copy the `docker-compose.yml` content
5. Click **Deploy the stack**

## Development Workflow (Recommended for Umbrel)

### On Windows (Development)
```bash
# Make changes to your code
npm run dev        # Test locally
git add .
git commit -m "Update feature"
git push origin main
```

### On Umbrel (via Portainer)
1. In Portainer, go to your `pinseekr-golf` stack
2. Click **Editor** → **Update the stack** → **Pull and redeploy**
3. This will pull latest code and rebuild the container

## Alternative: Manual Deployment

If you prefer command line (requires SSH access):
```bash
# Update and redeploy
git pull origin main
./deploy/docker/build-and-deploy.sh
```

## `stack.env` (Portainer Repository deployment requirement)

When deploying a stack from the **Repository** option in Portainer, Portainer requires a `stack.env` file to already exist in the Git repository at the compose path. The `deploy/docker/stack.env` file in this repo provides the environment variables Portainer will load into the stack.

Example contents (already present in `deploy/docker/stack.env`):

```
# Required: agree to Caddy's terms to enable automatic ACME certificate issuance
CADDY_AGREE=true

# Optional: email used by ACME providers for account registration and recovery
#ACME_EMAIL=admin@pinseekr.golf
```

If you deploy via Portainer's Web editor, Upload, or a Custom template, Portainer will auto-create a `stack.env` from the variables you set during the stack creation instead.

Keep `stack.env` in the repository when using the Repository deployment method so Portainer can read these variables at deploy time.

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
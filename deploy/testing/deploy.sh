#!/bin/bash
# Pinseekr Golf Testing Deployment Script
# One-command deployment for friends & family testing

set -e

echo "🏌️ Pinseekr Golf - Testing Deployment"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Run this script from the deploy/testing directory"
    exit 1
fi

# Build the frontend
echo "📦 Building frontend..."
cd ../..
if ! npm run build; then
    echo "❌ Frontend build failed"
    exit 1
fi
cd deploy/testing

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/mongo data/caddy data/caddy_config

# Create relay config if it doesn't exist
if [ ! -f relay-config/config.json ]; then
    echo "⚙️  Creating relay config..."
    mkdir -p relay-config
    cat > relay-config/config.json << 'EOF'
{
  "relay_info": {
    "name": "Pinseekr Golf Testing Relay",
    "description": "Testing relay for Pinseekr Golf app - friends & family access",
    "pubkey": "",
    "contact": "",
    "supported_nips": [1, 2, 4, 9, 11, 12, 15, 16, 20, 22, 28, 33, 40],
    "software": "https://github.com/0ceanslim/grain",
    "version": "latest"
  },
  "server": {
    "host": "0.0.0.0",
    "port": 8080
  },
  "database": {
    "mongodb_uri": "mongodb://mongodb:27017/",
    "database_name": "pinseekr_testing"
  },
  "rate_limit": {
    "enabled": true,
    "event_limit": 100,
    "window_seconds": 60,
    "connection_limit": 50
  },
  "kind_whitelist": {
    "enabled": true,
    "kinds": [0, 1, 3, 4, 5, 6, 7, 1111, 30001, 30002, 30003, 30004, 30005, 30007, 30010, 30011, 30100, 30382, 31924]
  },
  "pubkey_blacklist": {
    "enabled": false,
    "pubkeys": []
  },
  "content_filter": {
    "enabled": false,
    "max_content_length": 50000,
    "max_tag_count": 100
  }
}
EOF
    echo "✅ Created relay config with golf-specific event kinds"
fi

# Stop any existing services
echo "🛑 Stopping existing services..."
docker compose down 2>/dev/null || true

# Pull latest images
echo "📥 Pulling latest Docker images..."
docker compose pull

echo "🚀 Starting services..."
docker compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
if docker compose ps | grep -q "unhealthy\|exited"; then
    echo "❌ Some services failed to start properly:"
    docker compose ps
    echo ""
    echo "📜 Check logs with: docker compose logs"
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app will be available at:"
echo "   🎮 Frontend: https://pinseekr.golf"
echo "   📡 Relay:    wss://relay.pinseekr.golf"
echo ""
echo "📋 DNS Setup Required:"
echo "   1. Point pinseekr.golf A record to your public IP"
echo "   2. Point relay.pinseekr.golf A record to your public IP"
echo "   3. Forward ports 80 and 443 to this device"
echo ""
echo "⏰ SSL certificates may take 5-10 minutes to obtain"
echo ""
echo "📊 Useful commands:"
echo "   Check status: docker compose ps"
echo "   View logs:    docker compose logs -f"
echo "   Restart:      docker compose restart"
echo "   Update:       ./deploy.sh"
echo "   Stop all:     docker compose down"
echo ""
echo "🎯 Share with friends: https://pinseekr.golf"
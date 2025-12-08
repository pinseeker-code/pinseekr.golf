#!/bin/bash
# Pinseekr Golf - Docker Build & Deploy Script
# Builds React app and deploys to Umbrel as Docker container

set -e

echo "🏌️ Pinseekr Golf - Docker Deployment"
echo "===================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Build the React app
echo "📦 Building React app..."
if ! npm run build; then
    echo "❌ React build failed"
    exit 1
fi

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ Error: dist/ folder not found after build"
    exit 1
fi

echo "✅ React app built successfully"

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t pinseekr-golf:latest -f deploy/docker/Dockerfile .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully"
else
    echo "❌ Docker build failed"
    exit 1
fi

# Stop and remove existing container
echo "🛑 Stopping existing container..."
docker stop pinseekr-golf 2>/dev/null || echo "   No existing container to stop"
docker rm pinseekr-golf 2>/dev/null || echo "   No existing container to remove"

# Deploy new container
echo "🚀 Deploying new container..."
docker run -d \
  --name pinseekr-golf \
  -p 80:80 \
  -p 443:443 \
  --restart unless-stopped \
  -v caddy_data:/data \
  -v caddy_config:/config \
  pinseekr-golf:latest

if [ $? -eq 0 ]; then
    echo "✅ Container deployed successfully"
else
    echo "❌ Container deployment failed"
    exit 1
fi

# Wait a moment for container to start
sleep 3

# Check container status
echo "🔍 Checking container status..."
if docker ps | grep -q "pinseekr-golf"; then
    echo "✅ Container is running"
else
    echo "❌ Container failed to start"
    echo "📜 Container logs:"
    docker logs pinseekr-golf
    exit 1
fi

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "🌐 Your app is available at:"
echo "   🎮 https://pinseekr.golf"
echo "   📱 PWA ready for mobile install"
echo ""
echo "📋 DNS Requirements:"
echo "   Point pinseekr.golf A record to your Umbrel's public IP"
echo "   Forward ports 80 and 443 to your Umbrel device"
echo ""
echo "⏰ SSL certificate will be obtained automatically"
echo "   (may take 5-10 minutes on first deployment)"
echo ""
echo "📊 Management commands:"
echo "   View logs:    docker logs -f pinseekr-golf"
echo "   Restart:      docker restart pinseekr-golf"
echo "   Stop:         docker stop pinseekr-golf"
echo "   Update:       ./deploy/docker/build-and-deploy.sh"
echo ""
echo "🎯 Share with friends: https://pinseekr.golf"
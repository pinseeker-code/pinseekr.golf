# Pinseekr Golf - Production Docker Container
# Multistage build: builds React app then serves with Caddy

# Stage 1 - Build React app
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Stage 2 - Serve with Caddy
FROM caddy:2-alpine

# Copy built app from builder stage
COPY --from=builder /app/dist /srv

# Copy Caddy configuration for pinseekr.golf
COPY deploy/docker/Caddyfile /etc/caddy/Caddyfile

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Caddy starts automatically and serves files from /srv/
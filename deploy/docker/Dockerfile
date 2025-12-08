# Pinseekr Golf - Production Docker Container
# Lightweight Caddy container serving React PWA

FROM caddy:2-alpine

# Copy built React app
COPY dist/ /srv/

# Copy Caddy configuration for pinseekr.golf
COPY deploy/docker/Caddyfile /etc/caddy/Caddyfile

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Caddy starts automatically and serves files from /srv/
# Auto-obtains SSL certificates for configured domains
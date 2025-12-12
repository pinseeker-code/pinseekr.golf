Grain (private) — Portainer stack

Contents
- `docker-compose.yml` — Grain relay (binds host port 8080 → container 8080)

Deploy (Portainer)
1. Portainer → Stacks → Add stack → Name: `grain`.
2. Upload the ZIP (grain-stack.zip) or paste the `docker-compose.yml` into the Web editor.
3. Deploy the stack.

Tailscale / Private testing
- After deploy the relay will be reachable at Umbrel's Tailscale IP, e.g. `http://100.94.28.97:8080`.
- For WebSocket clients use ws:// (Tailscale does not require TLS): `ws://100.94.28.97:8080`

Quick tests (from your laptop)
- Check basic HTTP health (if relay exposes):
  curl -v "http://100.94.28.97:8080/"

- Connect with `websocat` (install on laptop):
  websocat ws://100.94.28.97:8080

- Nostr basic REQ test (subscribe) — in a websocat session paste:
  ["REQ","sub-1",{"kinds":[1,2,3]}]
  (you should receive subscription output)

Example JSON files
- course.json and user.json are application-level payloads; if you plan to store them as Nostr events, create signed Nostr `EVENT` objects and send over the relay. For connectivity testing you can use `REQ` subscriptions above.

Notes
- This stack runs privately on Umbrel and is suitable for testing via Tailscale.
- If you later want public access, I can add a Caddy reverse-proxy + Cloudflare Tunnel configuration to expose `wss://relay.pinseekr.golf` with TLS.

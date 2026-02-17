Quick guide — using Grimoire (or any WS REQ) to watch NIP-46 connect events

1) Add the relay
- In Grimoire (or any Nostr inspector), add the relay URL:
  wss://relay.pinseekr.golf

2) Subscribe to NIP-46 events (kind 24133)
- To watch all connect traffic:
  ["REQ","grimoire-1",{"kinds":[24133]}]

- To watch replies for a specific client pubkey (replace <CLIENT_PUBKEY>):
  ["REQ","grimoire-1",{"kinds":[24133],"#p":["<CLIENT_PUBKEY>"]}]

3) Example raw WebSocket (wscat)
- Connect and send the REQ manually:

  npx wscat -c wss://relay.pinseekr.golf
  # then paste one of the REQ lines above and press enter

4) Local subscriber script (included)
- Script: `tools/grimoire-subscribe.js`
- Usage examples:

  # subscribe to all NIP-46 events
  node tools/grimoire-subscribe.js

  # subscribe for a specific client pubkey
  node tools/grimoire-subscribe.js 0123456789abcdef...

  # or use env vars
  PUBKEY=012345... RELAY=wss://relay.pinseekr.golf node tools/grimoire-subscribe.js

5) Troubleshooting
- If you don't see events:
  - Confirm the relay is reachable (curl the /info endpoint).
  - Ensure the signer (Amber) is connected to the same relay and approved the request.
  - Some wallets publish to other relays; try subscribing to commonly used relays too (e.g., nos.lol, relay.primal.net).

6) Why this helps
- You can verify whether a connect/ack from a remote signer appears on the relay (helps distinguish client vs. relay vs. signer issues).


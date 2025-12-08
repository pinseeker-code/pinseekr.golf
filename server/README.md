pyramid-relays server example

This folder contains example servers that serve a relay discovery document used by the client.

Endpoints served:

- `/pyramid-relays.json` (preferred — no ".well-known" in the path)
- `/relay-info.json` (fallback)
- `/.well-known/pyramid-relays` (legacy compatibility)

Features:

- Returns a JSON document describing relays and a `cache_max_age` field.
- Supports `ETag` and responds `304 Not Modified` when the client sends a matching `If-None-Match` header.
- If the file does not exist, returns an embedded sample document.

## Go Version

Build and run with Go 1.20+:

```powershell
# from repository root (or server/)
go run ./server -port=8080 -file=./server/pyramid-relays.json

# or build
go build -o pyramid-relays ./server
./pyramid-relays -port=8080 -file=./server/pyramid-relays.json
```

## Node.js Version

Run with Node.js (requires `express`):

```powershell
npm install express
node ./server/pyramid_relays.js ./server/pyramid-relays.json
```

Or with a custom port:

```powershell
PORT=8080 node ./server/pyramid_relays.js ./server/pyramid-relays.json
```

Sample `pyramid-relays.json` structure:

```json
{
  "cache_max_age": 600,
  "relays": [
    { "url": "wss://relay.nostr.band", "readable": true, "writable": true, "priority": 1 },
    { "url": "wss://relay.damus.io", "readable": true, "writable": true, "priority": 2 }
  ]
}
```

A sample `pyramid-relays.json` is included in this folder.

Testing the conditional fetch with curl:

```powershell
# fetch the document and see ETag
curl -i http://localhost:8080/pyramid-relays.json

# repeat with If-None-Match (paste the ETag value from the previous response)
curl -i -H "If-None-Match: \"etag-value-here\"" http://localhost:8080/pyramid-relays.json
```

Notes

- The client in this repository now prefers `/pyramid-relays.json` as the primary discovery path and will fall back to `/relay-info.json` and `/.well-known/pyramid-relays` for compatibility.
- You can host `pyramid-relays.json` on your webserver (same host as your site) or run this example server.

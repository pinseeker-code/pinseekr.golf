## Pinseekr.golf — Nostr Tagging (Canonical)

This file defines the minimal, canonical tagging scheme used across Pinseekr.golf. Keep it short and stable.

- **App namespace:** include `['t','golf']` on all app events.
- **Subtype:** include a second `t` tag for the resource, e.g. `['t','golf-course']`, `['t','golf-round']`, `['t','golf-profile']`.
- **Stable ID:** use `['d','<id>']` as a replaceable-resource identifier when the resource is updated over time.
- **Human metadata:** include `['name','...']`, `['location','...']`, and `['alt','...']` (NIP-31) where appropriate.

Example (course event):

- `kind`: use the app-level kind `APP_KIND = 36912` for new app events; older domain kinds may still appear in history.
- `content`: JSON course object
- `tags`:
  - `['t','golf']`
  - `['t','golf-course']`
  - `['d','pebble-beach-1678901234567']`
  - `['name','Pebble Beach Golf Links']`
  - `['location','Pebble Beach, CA']`
  - `['alt','Golf course definition for Pebble Beach']`

Querying note: use a `#t` filter for both app + subtype, for example `{'#t': ['golf','golf-course']}`.

Keep this file concise; it is the canonical reference used by code and tests.
- tags:

# NIP-XX: Pinseekr Golf Protocol

`draft` `optional`

This NIP defines a protocol for storing and sharing golf-related data on the Nostr network using addressable events.

## Kind Numbers

All Pinseekr custom kinds use the **369xx** block:

| Kind | Name | Description |
|------|------|-------------|
| 36901 | Golf Round | Round container (who, where, when, scorecard) |
| 36902 | Golf Course | Course definition (holes, pars, yardages) |
| 36903 | Player Score | Per-player scores for a round (addressable) |
| 36904 | Golf Profile | User's handicap, preferences, visibility |
| 36905 | Tournament | Multi-round competition container |
| 36910 | Badge Award | Badge achievement awards |

---

## Golf Course Events (Kind 36902)

Golf courses are represented as addressable events with `kind 36902` and tagged with `t: "golf-course"`.

### Event Structure

```json
{
  "kind": 36902,
  "content": "<course_name> - <course_location>",
  "tags": [
    ["d", "<unique_course_identifier>"],
    ["name", "<course_name>"],
    ["location", "<course_location>"],
    ["t", "golf-course"],
    ["hole1", "<par_for_hole_1>"],
    ["hole2", "<par_for_hole_2>"],
    ...
    ["hole18", "<par_for_hole_18>"],
    ["alt", "Golf course information for <course_name>"]
  ]
}
```

### Required Tags

- `d`: Unique identifier for the course (should be URL-friendly)
- `name`: The full name of the golf course
- `location`: Location description (city, state, country format recommended)
- `t`: Must include "golf-course" for discoverability
- `hole1` through `hole18`: Par values for each hole (3, 4, or 5)
- `alt`: Human-readable description per NIP-31

### Content Field

The content field should contain a brief description combining the course name and location for human readability.

### Example

```json
{
  "kind": 36902,
  "content": "Pebble Beach Golf Links - Pebble Beach, CA",
  "tags": [
    ["d", "pebble-beach-golf-links-1640995200"],
    ["name", "Pebble Beach Golf Links"],
    ["location", "Pebble Beach, CA"],
    ["t", "golf-course"],
    ["hole1", "4"],
    ["hole2", "5"],
    ["hole3", "4"],
    ["hole4", "4"],
    ["hole5", "3"],
    ["hole6", "5"],
    ["hole7", "3"],
    ["hole8", "4"],
    ["hole9", "4"],
    ["hole10", "4"],
    ["hole11", "4"],
    ["hole12", "3"],
    ["hole13", "4"],
    ["hole14", "5"],
    ["hole15", "4"],
    ["hole16", "4"],
    ["hole17", "3"],
    ["hole18", "5"],
    ["alt", "Golf course information for Pebble Beach Golf Links"]
  ]
}
```

## Querying Golf Courses

Clients can query golf courses using:

```javascript
// Get all golf courses
await nostr.query([{
  kinds: [36902],
  "#t": ["golf-course"]
}]);

// Search by name or location (if relay supports NIP-50)
await nostr.query([{
  kinds: [36902],
  "#t": ["golf-course"],
  search: "pebble beach"
}]);
```

---

## Player Score Events (Kind 36903)

Per-player score updates for a specific round. Addressable so relays keep only the latest per pubkey+kind+d-tag.

### Event Structure

```json
{
  "kind": 36903,
  "tags": [
    ["d", "<roundId>"],
    ["player", "<playerPubkey>"]
  ],
  "content": "{\"scores\": {\"1\":4,\"2\":3,\"3\":5}, \"total\": 36, \"updatedAt\": 1690000000000}"
}
```

### Tags

- `d`: Round identifier (addressable key)
- `player`: Redundant player pubkey tag (event author must match)

### Content

JSON object with:
- `scores`: Object mapping hole number to score
- `total`: Total strokes
- `updatedAt`: Unix timestamp in milliseconds

---

## Invite Delivery

Invites are delivered via encrypted direct messages (kind 4). We use NIP-44 encryption with a JSON payload.

### Invite Payload Example

```json
{
  "type": "round-invite",
  "roundId": "abc123",
  "joinUrl": "https://pinseekr.golf/join/ABC123",
  "code": "ABC123",
  "fromName": "Alice",
  "meta": { "course": "Coal Creek" }
}
```

---

## Implementation Notes

- Course identifiers (`d` tag) should be unique and URL-friendly
- Par values must be integers between 3 and 5
- Total par is calculated by summing all hole par values
- Clients should validate that exactly 18 holes are provided
- Location format is flexible but "City, State" or "City, Country" is recommended

## Rationale

This approach leverages Nostr's decentralized architecture to create a community-maintained golf course database. Using addressable events allows course information to be updated while maintaining a consistent identifier. The minimal data structure focuses on essential information needed for golf scoring applications while remaining extensible.

---

## Reference Implementation

The authoritative kind definitions are in `src/lib/golf/types.ts`:

```typescript
export const GOLF_KINDS = {
  ROUND: 36901,
  COURSE: 36902,
  PLAYER_SCORE: 36903,
  GOLF_PROFILE: 36904,
  TOURNAMENT: 36905,
  BADGE_AWARD: 36910,
} as const;
```

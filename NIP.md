# NIP-XX: Golf Course Database

`draft` `optional`

This NIP defines a protocol for storing and sharing golf course information on the Nostr network using addressable events.

## Golf Course Events

Golf courses are represented as addressable events with `kind 30100` and tagged with `t: "golf-course"`.
````markdown
# NIP-XX: Golf Course Database

`draft` `optional`

This NIP defines a protocol for storing and sharing golf course information on the Nostr network using addressable events.

## Golf Course Events

Golf courses are represented as addressable events with `kind 30100` and tagged with `t: "golf-course"`.

### Event Structure

```json
{
  "kind": 30100,
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
  "kind": 30100,
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
  kinds: [30100],
  "#t": ["golf-course"]
}]);

// Search by name or location
await nostr.query([{
  kinds: [30100],
  "#t": ["golf-course"],
  search: "pebble beach"  // If relay supports NIP-50
}]);
```

## Implementation Notes

- Course identifiers (`d` tag) should be unique and URL-friendly
- Par values must be integers between 3 and 5
- Total par is calculated by summing all hole par values
- Clients should validate that exactly 18 holes are provided
- Location format is flexible but "City, State" or "City, Country" is recommended for consistency

## Rationale

This approach leverages Nostr's decentralized architecture to create a community-maintained golf course database. Using addressable events allows course information to be updated while maintaining a consistent identifier. The minimal data structure focuses on essential information needed for golf scoring applications while remaining extensible.
````

## Project-specific kinds added

- `30010` - `player-score` (addressable)
  - Purpose: per-player score updates for a specific round. Addressable so relays keep the latest per pubkey+kind+`d`.
  - Tags:
    - `['d', '<roundId>']`  // addressable identifier for the round
    - `['player', '<playerPubkey>']`  // redundant player pubkey tag (event author must match)
  - Content: JSON object with full per-hole scores and metadata. Example:
    ```json
    {
      "scores": {"1":4,"2":3,"3":5},
      "total": 36,
      "updatedAt": 1690000000000
    }
    ```

- `30011` - `invite-accept`
  - Purpose: signed proof that a player accepted an invite to a round.
  - Tags:
    - `['d', '<roundId>']`
    - `['action', 'join']`
  - Content: optional short text; the host verifies `event.pubkey` matches invited pubkey.

**Invite delivery**

- Invites are delivered via encrypted direct messages. We use the project's signer `nip44.encrypt()` helper to encrypt a JSON payload and publish it as a `kind:4` encrypted DM with a `p` tag for the recipient. This is a compatibility-first approach; full NIP-17 gift-wrap is more private but more involved.

Invite payload example (encrypted):
```json
{
  "type": "round-invite",
  "roundId": "abc123",
  "joinUrl": "https://example.org/join/ABC123",
  "code": "ABC123",
  "fromName": "Alice",
  "meta": { "course": "Coal Creek" }
}
```

Recipient should accept by publishing a signed `30011` accept event tagged with `['d', roundId]` and `['action', 'join']`. The host will treat that as verification.
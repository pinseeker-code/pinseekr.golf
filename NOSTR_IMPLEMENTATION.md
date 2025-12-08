# Nostr Implementation Overview

This document provides a high-level overview of how the Pinseekr golf app uses the Nostr protocol for decentralized data storage and social features.

## NIPs Implemented

| NIP | Name | Usage |
|-----|------|-------|
| NIP-01 | Basic Protocol | Core event structure, filters, and relay communication |
| NIP-05 | DNS-based Verification | Profile verification via `nip05` field |
| NIP-07 | Browser Extension | Login via browser extensions (Alby, nos2x, etc.) |
| NIP-10 | Text Notes & Threads | Event references and threading |
| NIP-19 | Bech32 Entities | `npub`, `nsec`, `note`, `nevent`, `naddr` encoding/decoding |
| NIP-22 | Comments | Kind 1111 for threaded comments on any event |
| NIP-31 | Alt Tags | `alt` tag for human-readable event descriptions |
| NIP-44 | Encrypted Direct Messages | Encryption for round invites |
| NIP-46 | Nostr Connect (Bunker) | Remote signer connections via `bunker://` URIs |

---

## Event Kinds Used

### Standard Nostr Kinds

| Kind | Name | Description | Hook/File |
|------|------|-------------|-----------|
| **0** | User Metadata | Profile information (name, picture, bio, etc.) | `useAuthor.ts`, `EditProfileForm.tsx` |
| **3** | Contacts | User's contact/follow list | `useContacts.ts` |
| **4** | Encrypted DM | Encrypted round invites (legacy, compatibility) | `NewRoundPage.tsx` |
| **1111** | Comment | NIP-22 threaded comments | `useComments.ts`, `usePostComment.ts` |

### Custom Golf Kinds (Addressable: 30000–39999)

| Kind | Name | Description | Hook/File |
|------|------|-------------|-----------|
| **30005** | Settlement Result | Round settlement with payment info and invoices | `NewRoundPage.tsx` |
| **30007** | Tournament | Tournament/wager events for Pinseekr Cup | `NewRoundPage.tsx` |
| **30010** | Player Score | Per-player score updates for a round (addressable by `d` tag) | Defined in `NIP.md` |
| **30011** | Invite Accept | Signed proof that a player accepted a round invite | Defined in `NIP.md` |
| **30100** | Golf Course | Golf course data (name, location, hole pars) | `useGolfCourses.ts`, `useDiscoverCourses.ts` |
| **30382** | Golf Profile | Player golf profile (stats, handicap, badges, achievements) | `useGolfProfile.ts`, `social.ts` |
| **31924** | Golf Round | Complete round event (scores, participants, course data) | `social.ts` |

---

## Detailed Kind Specifications

### Kind 0: User Metadata
Standard Nostr profile metadata stored as JSON in the `content` field.

**Fields used:**
- `name` - Display name
- `about` - Bio/description
- `picture` - Avatar URL
- `banner` - Profile banner URL
- `website` - Personal website
- `nip05` - Verified identifier
- `lud16` - Lightning address for zaps

**Files:** `useAuthor.ts`, `EditProfileForm.tsx`, `SignupDialog.tsx`

---

### Kind 3: Contacts
User's follow/contact list with pubkeys stored in `p` tags.

**Files:** `useContacts.ts`

---

### Kind 4: Encrypted Direct Messages
Used for sending round invites. Encrypted using NIP-44.

**Invite payload structure:**
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

**Files:** `NewRoundPage.tsx`

---

### Kind 1111: Comments (NIP-22)
Threaded comments that can be attached to any event or URL.

**Tag structure:**
- `E`/`e` - Event ID reference (uppercase for root, lowercase for direct parent)
- `A`/`a` - Addressable event reference (`kind:pubkey:d-tag`)
- `I`/`i` - URL reference
- `K`/`k` - Kind of referenced event
- `P`/`p` - Pubkey of referenced event author

**Files:** `useComments.ts`, `usePostComment.ts`, `CommentsSection.tsx`

---

### Kind 30005: Settlement Result
Published after a round to record payment settlements.

**Structure:**
```json
{
  "kind": 30005,
  "tags": [
    ["d", "<roundId>-result"],
    ["t", "golf"],
    ["t", "settlement"],
    ["round", "<roundId>"]
  ],
  "content": "{\"payments\": [...], \"invoices\": [...], \"note\": \"...\"}"
}
```

**Files:** `NewRoundPage.tsx`

---

### Kind 30007: Tournament
Tournament configuration and wager information for Pinseekr Cup games.

**Structure:**
```json
{
  "kind": 30007,
  "tags": [
    ["d", "<roundId>-tournament"],
    ["t", "golf"],
    ["t", "tournament"],
    ["t", "pinseekr-cup"]
  ],
  "content": "{\"tournament\": {...}, \"wagers\": {...}, \"tournamentTotal\": 1500, \"invoicePlaceholders\": [...]}"
}
```

**Files:** `NewRoundPage.tsx`

---

### Kind 30010: Player Score
Per-player score updates for a specific round. Addressable so relays keep only the latest per pubkey+kind+d-tag.

**Structure:**
```json
{
  "kind": 30010,
  "tags": [
    ["d", "<roundId>"],
    ["player", "<playerPubkey>"]
  ],
  "content": "{\"scores\": {\"1\": 4, \"2\": 3, ...}, \"total\": 36, \"updatedAt\": 1690000000000}"
}
```

**Files:** Defined in `NIP.md`

---

### Kind 30011: Invite Accept
Signed proof that a player accepted an invite to join a round.

**Structure:**
```json
{
  "kind": 30011,
  "tags": [
    ["d", "<roundId>"],
    ["action", "join"]
  ],
  "content": ""
}
```

**Files:** Defined in `NIP.md`

---

### Kind 30100: Golf Course
Golf course database entries with hole-by-hole par information.

**Structure:**
```json
{
  "kind": 30100,
  "tags": [
    ["d", "<course-slug>"],
    ["name", "Pebble Beach Golf Links"],
    ["location", "Pebble Beach, CA"],
    ["t", "golf-course"],
    ["hole1", "4"],
    ["hole2", "5"],
    ...
    ["hole18", "5"],
    ["alt", "Golf course information for Pebble Beach"]
  ],
  "content": "Pebble Beach Golf Links - Pebble Beach, CA"
}
```

**Required tags:**
- `d` - Unique course identifier (URL-friendly)
- `name` - Full course name
- `location` - City, State/Country
- `t` - Must include `golf-course`
- `hole1`–`hole18` - Par values (3, 4, or 5)
- `alt` - Human-readable description (NIP-31)

**Files:** `useGolfCourses.ts`, `useDiscoverCourses.ts`, `NIP.md`

---

### Kind 30382: Golf Profile
Player golf profile with stats, handicap, badges, and achievements.

**Structure:**
```json
{
  "kind": 30382,
  "tags": [
    ["d", "golf-profile"],
    ["name", "John Doe"],
    ["handicap", "12"],
    ["home_course", "Augusta National"],
    ["stats", "<JSON stats object>"],
    ["badges", "<JSON badges array>"],
    ["achievements", "<JSON achievements array>"],
    ["t", "golf-profile"]
  ],
  "content": ""
}
```

**Stats object fields:**
- `roundsPlayed`, `averageScore`, `bestScore`, `worstScore`
- `fairwayHitPercentage`, `greenInRegulationPercentage`
- `averagePutts`, `holesInOne`, `eagles`, `birdies`, `pars`, `bogeys`

**Files:** `useGolfProfile.ts`, `social.ts`

---

### Kind 31924: Golf Round
Complete round event with participants, scores, and course data.

**Structure:**
```json
{
  "kind": 31924,
  "tags": [
    ["d", "<round-id>"],
    ["title", "Saturday Round at Pebble"],
    ["start", "<unix-timestamp>"],
    ["end", "<unix-timestamp>"],
    ["location", "Pebble Beach, CA"],
    ["participants", "<pubkey1>", "<pubkey2>"],
    ["scores", "<JSON scores>"],
    ["course_data", "<JSON course info>"],
    ["t", "golf"],
    ["t", "round"]
  ],
  "content": ""
}
```

**Files:** `social.ts`

---

## Authentication Methods

| Method | NIP | Description |
|--------|-----|-------------|
| Browser Extension | NIP-07 | Uses `window.nostr` for signing (Alby, nos2x, etc.) |
| Nostr Connect | NIP-46 | Remote signer via `bunker://` URI |
| Email Fallback | — | Email-based accounts with derived Nostr keys |

**Files:** `useCurrentUser.ts`, `useLoginActions.ts`, `LoginDialog.tsx`

---

## Relay Configuration

The app uses a **Grain relay** as the primary relay, with a fallback for discovery:

**Primary Relay:**
- `wss://relay.pinseekr.golf` - Self-hosted Grain relay on Umbrel

**Fallback Relay:**
- `wss://relay.nostr.band` - Backup for discovery

### Relay Discovery

1. Fetches `/pyramid-relays.json` from the app's origin
2. Falls back to preset relays if discovery fails
3. Queries multiple relays simultaneously (capped at 6)
4. Publishes to multiple relays (capped at 5)

### Grain Relay Deployment

The Grain relay is deployed via Docker on Umbrel with:
- **Grain**: Nostr relay with MongoDB backend
- **MongoDB**: Event storage
- **Caddy**: Reverse proxy with auto-SSL

See `deploy/umbrel/README.md` for deployment instructions.

### Kind Whitelist (Grain Config)

The relay only accepts these event kinds:
- `0` - User metadata
- `1` - Short text notes
- `3` - Contacts
- `4` - Encrypted DMs (invites)
- `5` - Event deletion
- `6` - Repost
- `7` - Reaction
- `1111` - NIP-22 comments
- `30005` - Settlement
- `30007` - Tournament
- `30010` - Player score
- `30011` - Invite accept
- `30100` - Golf course
- `30382` - Golf profile
- `31924` - Golf round

**Files:** `NostrProvider.tsx`, `pyramid-relays.json`, `deploy/umbrel/`

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/components/NostrProvider.tsx` | Relay pool management and discovery |
| `src/hooks/useNostr.ts` | Re-exports `useNostr` from `@nostrify/react` |
| `src/hooks/useAuthor.ts` | Fetch user metadata (kind 0) |
| `src/hooks/useCurrentUser.ts` | Current logged-in user context |
| `src/hooks/useNostrPublish.ts` | Publish events to relays |
| `src/hooks/useComments.ts` | Query NIP-22 comments |
| `src/hooks/usePostComment.ts` | Post NIP-22 comments |
| `src/hooks/useGolfCourses.ts` | Query/create golf courses |
| `src/hooks/useGolfProfile.ts` | Query/update golf profiles |
| `src/hooks/useContacts.ts` | Query user contacts |
| `src/lib/golf/social.ts` | Golf-specific types and constants |
| `NIP.md` | Custom NIP documentation |

---

## Dependencies

- **@nostrify/nostrify** - Core Nostr protocol implementation
- **@nostrify/react** - React hooks and context for Nostr
- **nostr-tools** - NIP-19 encoding/decoding utilities
- **@tanstack/react-query** - Data fetching and caching

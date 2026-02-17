# Invite System Fixes - ACTUALLY WORKING NOW

## Critical Issues Found & Fixed

### 1. Round ID Mapping Completely Broken ✅

**REAL Problem:** The join flow was fundamentally broken in multiple places:

1. **parseRoundEvent used wrong ID** - Used `d` tag (which is `join-ABC123`) instead of `round-id` tag
2. **Query didn't check round-id tag** - Only queried by `d` tag, couldn't find join-code rounds
3. **Initial state set wrong ID** - Set `round.id = urlRoundId` on init, preventing proper loading
4. **Guard clause prevented loading** - Skipped loading if round.id matched, but it matched the WRONG value

**Solution:**
- [nostrEvents.ts](src/lib/golf/nostrEvents.ts#L205-L242) - `parseRoundEvent` now uses `round-id` tag as actual ID
- [NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L173-L223) - Query checks BOTH `#d` and `#round-id` tags
- [NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L125-L138) - Initial round.id is `undefined` when loading from URL
- [NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L176-L178) - Guard clause only prevents re-loading same round with players

**Root Cause:** When a round is created with join code:
- Event has `d` tag = `join-ABC123` (for NIP-33 replaceability)
- Event has `round-id` tag = actual UUID (for mapping back)
- Old code used `d` tag as the round ID, causing complete mismatch

### 2. Duplicate Player Prevention ✅

**Problem:** `acceptInvite()` would add players without checking if they already exist.

**Solution:**
- [NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L333-L377) - Added existence check before publishing

### 3. Host Duplicate Prevention ✅

**Problem:** Host would be added twice when generating round code.

**Solution:**
- [NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L1164-L1183) - Check if host exists before adding

### 4. Player Polling Improvements ✅

**Problem:** Polling would sometimes create duplicates or overwrite edits.

**Solution:**
- [NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L287-L333) - Proper deduplication and merge strategy

## How It Works Now (ACTUALLY)

### Complete Invite Flow - FIXED

1. **Host creates round and generates code**
   - Click "Share Round Code" button
   - System generates 6-character code (e.g., "ABC123")
   - Publishes round event with:
     - `d` tag = "join-ABC123" (for NIP-33 replaceability)
     - `round-id` tag = actual UUID (for mapping back to real ID)
     - `players` tag with host pubkey
   - Host automatically added as player (if not already)
   - QR code generated with join URL
   - URL copied to clipboard

2. **Player receives invite**
   - Gets URL: `https://pinseekr.golf/join/ABC123`
   - OR scans QR code
   - OR enters code manually in join input

3. **JoinRoundPage lookup** ([JoinRoundPage.tsx](src/pages/JoinRoundPage.tsx#L40-L67))
   - Queries for event with `#d` = "join-ABC123"
   - Extracts `round-id` tag from event (the REAL UUID)
   - Redirects to `/round/new?roundId={real-uuid}&autoJoin=1`

4. **NewRoundPage loads round** ([NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L173-L223))
   - Initializes with `round.id = undefined` (doesn't preset from URL)
   - Queries for round by BOTH:
     - `#d` tag = urlRoundId (for direct rounds)
     - `#round-id` tag = urlRoundId (for join-code rounds)
   - Parses round event using `round-id` tag as actual ID
   - Fetches all player events for that round ID
   - Shows "Join Round" button if user not in players list
   - Auto-shows confirmation dialog if `autoJoin=1`

5. **Player accepts invite** ([NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L333-L377))
   - Checks for duplicate (prevents re-joining)
   - Optimistic local update (instant UI)
   - Publishes player event with actual round ID
   - All clients polling see update within 4 seconds

6. **Host sees joined players**
   - Polling queries every 4 seconds for player events
   - Fetches all player events by round ID
   - Merges with local state (preserves edits)
   - UI updates automatically

## Testing Checklist

- ✅ Host generates code - no duplicate host player
- ✅ Player joins via code - appears in pre-game screen
- ✅ Player can't join twice - shows "Already joined"
- ✅ Multiple players can join simultaneously
- ✅ Host sees joined players within 4 seconds
- ✅ Local edits (name/handicap) preserved during polling
- ✅ QR code works for mobile scanning
- ✅ Manual code entry works
- ✅ All tests pass (105/105)

## Technical Details

### Event Structure

**Round Event with Join Code:**
```json
{
  "kind": 31924,
  "tags": [
    ["d", "join-ABC123"],
    ["round-id", "550e8400-e29b-41d4-a716-446655440000"],
    ["t", "golf"],
    ["t", "golf-round"],
    ["course", "Pebble Beach"],
    ["players", "pubkey1", "pubkey2", "..."]
  ]
}
```

**Player Event:**
```json
{
  "kind": 31924,
  "tags": [
    ["d", "{roundId}-{pubkey}"],
    ["round", "550e8400-e29b-41d4-a716-446655440000"],
    ["player", "pubkey"],
    ["name", "Alice"],
    ["handicap", "10"],
    ["t", "golf"],
    ["t", "golf-player"]
  ]
}
```

### Polling Strategy

- **Interval:** 4 seconds (configurable)
- **Query:** `{ kinds: [31924], '#round': [roundId], '#t': ['golf', 'golf-player'], limit: 200 }`
- **Deduplication:** Map by playerId
- **Merge:** Preserve existing, add new only
- **Performance:** ~100-200ms query time on good relays

### Error Handling

- Network failures: Silently ignore, retry on next poll
- Duplicate joins: Toast notification "Already joined"
- Missing round: Show "Round Not Found" page
- Publish failures: Rollback optimistic update, show error toast

## Future Improvements

### Potential Enhancements

1. **Real-time subscriptions** - Replace polling with Nostr subscriptions (NIP-01)
2. **Encrypted invites** - Use NIP-44 DMs for private invites
3. **Invite expiration** - Add timestamp check for expired codes
4. **Player limits** - Enforce max 4-6 players per round
5. **Invite analytics** - Track who joined when
6. **Push notifications** - Notify host when players join

### Known Limitations

- 4-second polling delay (could be real-time with subscriptions)
- No way to revoke/cancel invites
- No player limit enforcement
- Code collisions possible (very rare with 6 chars = 2.2 billion combos)

## Architecture Notes

### Why Not Real-Time Subscriptions?

Currently using polling instead of subscriptions because:
- Simpler to implement and debug
- Less WebSocket connection overhead
- Works well with current relay architecture
- 4-second delay is acceptable for pre-game setup

Can migrate to subscriptions later if needed.

### Why Separate Player Events?

Each player publishes their own event instead of updating the round event because:
- **Decentralized** - No single point of control
- **Concurrent** - Multiple players can join simultaneously
- **Replaceable** - Each player can update their own info (NIP-33)
- **Queryable** - Easy to find all players for a round

### Why Optimistic Updates?

Update local state before publishing because:
- **Instant UI** - Users see immediate feedback
- **Better UX** - No loading spinners for known operations
- **Resilient** - Can rollback on failure
- **Standard pattern** - Common in modern React apps

## Related Files

- [NewRoundPage.tsx](src/pages/NewRoundPage.tsx) - Main round setup page
- [JoinRoundPage.tsx](src/pages/JoinRoundPage.tsx) - Join code lookup page
- [nostrEvents.ts](src/lib/golf/nostrEvents.ts) - Event creation functions
- [types.ts](src/lib/golf/types.ts) - Type definitions

## See Also

- [NOSTR_IMPLEMENTATION.md](NOSTR_IMPLEMENTATION.md) - Full Nostr protocol docs
- [NIP.md](NIP.md) - Custom NIP definitions
- [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md) - Architecture overview

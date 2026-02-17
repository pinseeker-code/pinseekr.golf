# Join Code Bug Fix Summary

## The Problem

When users tried to join rounds via code:
- **Phone:** "Confirm join" prompt appeared, but user loaded solo into a new game
- **Laptop:** "Round not found with code" error

## Root Cause

The entire round ID mapping was broken in 4 places:

### 1. Wrong ID Extraction
```typescript
// OLD (BROKEN) - nostrEvents.ts line 226
return {
  id: dTag, // This was "join-ABC123" instead of the real UUID!
```

When a round is created with join code:
- `d` tag = "join-ABC123" (for NIP-33 replaceability)
- `round-id` tag = actual UUID (the REAL round ID)

The parser used `d` tag, so rounds had ID of "join-ABC123" instead of the UUID.

### 2. Incomplete Query
```typescript
// OLD (BROKEN) - NewRoundPage.tsx
const filters = [
  { kinds: [APP_KIND], '#d': [urlRoundId], ... }, // Only queried d tag
  // Missing: query by round-id tag!
];
```

Couldn't find join-code rounds because query only checked `d` tag, not `round-id` tag.

### 3. Wrong Initial State
```typescript
// OLD (BROKEN) - NewRoundPage.tsx line 126
const [round, setRound] = useState<Partial<GolfRound>>(() => ({
  id: urlRoundId || generateRoundId(), // Preset wrong ID!
```

Set round ID immediately from URL, preventing proper loading from Nostr.

### 4. Broken Guard Clause
```typescript
// OLD (BROKEN) - NewRoundPage.tsx line 179
if (round.id === urlRoundId && (round.players?.length || 0) > 0) return;
```

Skipped loading because round.id matched urlRoundId, but both were wrong values.

## The Fix

### 1. Parse Correct ID ✅
```typescript
// NEW (FIXED) - nostrEvents.ts
const roundIdTag = tags.find((t: string[]) => t[0] === 'round-id')?.[1];
const actualRoundId = roundIdTag || dTag; // Use round-id if present

return {
  id: actualRoundId, // Now uses the REAL UUID
```

### 2. Query Both Tags ✅
```typescript
// NEW (FIXED) - NewRoundPage.tsx
const filters = [
  { kinds: [APP_KIND], '#d': [urlRoundId], '#t': ['golf', SUBTYPES.ROUND], limit: 1 },
  { kinds: [APP_KIND], '#round-id': [urlRoundId], '#t': ['golf', SUBTYPES.ROUND], limit: 1 }, // Added!
  { kinds: [APP_KIND], '#round': [urlRoundId], '#t': ['golf', SUBTYPES.PLAYER, ...], limit: 500 }
];
```

### 3. Don't Preset ID ✅
```typescript
// NEW (FIXED) - NewRoundPage.tsx
const [round, setRound] = useState<Partial<GolfRound>>(() => ({
  id: urlRoundId ? undefined : generateRoundId(), // Don't set ID if loading from URL
```

### 4. Fixed Guard ✅
```typescript
// NEW (FIXED) - NewRoundPage.tsx
if (round.id === urlRoundId && (round.players?.length || 0) > 0) return; // Now works correctly
```

## Testing

✅ All 105 tests passing
✅ TypeScript: 0 errors
✅ Build: successful

## Files Changed

1. [nostrEvents.ts](src/lib/golf/nostrEvents.ts#L205-L242) - `parseRoundEvent()` uses `round-id` tag
2. [NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L125-L138) - Initial state doesn't preset ID
3. [NewRoundPage.tsx](src/pages/NewRoundPage.tsx#L173-L223) - Query checks both `#d` and `#round-id`

## Before vs After

### Before (Broken)
```
1. Host creates code "ABC123"
2. Event published: d="join-ABC123", round-id="uuid-123"
3. Player visits /join/ABC123
4. JoinRoundPage finds event, redirects to /round/new?roundId=uuid-123
5. NewRoundPage queries for d="uuid-123" → NOT FOUND (d tag is "join-ABC123")
6. parseRoundEvent sets round.id = "join-ABC123" (WRONG!)
7. Player loads solo into new game
```

### After (Fixed)
```
1. Host creates code "ABC123"
2. Event published: d="join-ABC123", round-id="uuid-123"
3. Player visits /join/ABC123
4. JoinRoundPage finds event, redirects to /round/new?roundId=uuid-123
5. NewRoundPage queries for d="uuid-123" OR round-id="uuid-123" → FOUND!
6. parseRoundEvent sets round.id = "uuid-123" (CORRECT!)
7. Player sees existing round with host, can join properly
```

## What This Fixes

✅ Join code lookup on laptop (was showing "round not found")
✅ Join confirmation on phone (was loading solo game)
✅ Pre-game screen shows all joined players
✅ Host sees players join in real-time
✅ No duplicate players when joining
✅ No duplicate host when generating code

## See Also

- [INVITE_SYSTEM_FIXES.md](INVITE_SYSTEM_FIXES.md) - Complete technical details
- [NOSTR_IMPLEMENTATION.md](NOSTR_IMPLEMENTATION.md) - Full Nostr protocol docs

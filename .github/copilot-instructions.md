# Pinseekr Golf - AI Agent Instructions

Pinseekr is a **Nostr-based golf scoring and social app** built with React 18, Vite, TailwindCSS, shadcn/ui, and Nostrify. It uses decentralized data storage via Nostr relays for rounds, courses, profiles, and social interactions.

## Architecture Overview

### Core Data Flow
- **Nostr relays** store all data as events (rounds, courses, profiles, scores)
- **TanStack Query** caches and manages Nostr event fetching
- **Custom hooks** (`src/hooks/`) wrap `useNostr` + `useQuery` for domain-specific queries
- **Scoring engines** (`src/lib/golf/*Engine.ts`) calculate game results locally

### Key Nostr Event Kinds
| Kind | Purpose | Key File |
|------|---------|----------|
| 36908 | Golf courses | `useGolfCourses.ts` |
| 30382 | Golf profiles | `useGolfProfile.ts` |
| 31924 | Golf rounds | `social.ts` |
| 1111 | Comments (NIP-22) | `useComments.ts` |

### Golf Game Engines
Each game mode has a dedicated engine in `src/lib/golf/`:
- `scoringEngine.ts` - Core scoring/settlement logic
- `matchEngine.ts` - Match play calculations
- `sixesEngine.ts`, `snakeEngine.ts`, `dotsEngine.ts` - Side games
- All engines have `.test.ts` files; extend existing patterns when adding games

## Development Commands

```bash
npm run dev      # Start dev server (localhost:8080)
npm run test     # TypeScript + ESLint + Vitest + build
npm run build    # Production build
```

**CRITICAL**: Always run `npm run test` after code changes. The task is incomplete until tests pass.

---

## NIPs Implemented (Full Reference)

### NIP-01: Basic Protocol
Core event structure, filters, and relay communication. All Nostr events follow `{ kind, content, tags, pubkey, sig, id, created_at }`.

### NIP-05: DNS-based Verification
Profile verification via `nip05` field in kind 0 metadata. Format: `user@domain.com`. Used in `EditProfileForm.tsx`.

### NIP-07: Browser Extension Signing
Login via browser extensions (Alby, nos2x, etc.). The signer is accessed via `user.signer` from `useCurrentUser()`. Never request private keys directly.

### NIP-10: Text Notes & Threads
Event references and threading using `e` and `p` tags. Uppercase tags (`E`, `P`) mark root references.

### NIP-19: Bech32 Entities
Encoding/decoding for `npub`, `nsec`, `note`, `nevent`, `naddr`, `nprofile`. **Always decode before using in filters:**
```typescript
import { nip19 } from 'nostr-tools';
const decoded = nip19.decode(naddr);
// Use decoded.data in filters, not the raw bech32 string
```
Handle NIP-19 identifiers at **root URL level** (`/npub1...`, not `/profile/npub1...`). See `NIP19Page.tsx`.

### NIP-22: Comments (Kind 1111)
Threaded comments attachable to any event or URL. Tag structure:
- `E`/`e` - Event ID (uppercase=root, lowercase=parent)
- `A`/`a` - Addressable event reference (`kind:pubkey:d-tag`)
- `K`/`k` - Kind of referenced event
- `P`/`p` - Author pubkey

Files: `useComments.ts`, `usePostComment.ts`, `CommentsSection.tsx`

### NIP-31: Alt Tags
Human-readable `alt` tag for event descriptions. **Required on all custom kinds:**
```typescript
tags: [["alt", "Golf course information for Pebble Beach"]]
```

### NIP-44: Encrypted Payloads
Used for round invites via encrypted DMs. Access via signer:
```typescript
const encrypted = await user.signer.nip44.encrypt(recipientPubkey, message);
const decrypted = await user.signer.nip44.decrypt(senderPubkey, ciphertext);
```

### NIP-46: Nostr Connect (Bunker)
Remote signer connections via `bunker://` URIs. Enables signing without exposing private keys.

### NIP-47: Nostr Wallet Connect (NWC)
Lightning payments via wallet connection strings. See "Lightning Payments" section below.

---

## NostrProvider & Relay Architecture

The `NostrProvider` (`src/components/NostrProvider.tsx`) manages relay connections using `NPool` from Nostrify.

### How Relays Work
- **Primary relay**: `config.relayUrl` from `useAppContext()` (default: `wss://relay.pinseekr.golf`)
- **Preset relays**: Hardcoded fallbacks in `App.tsx` (Primal, Nostr.Band)
- **Query routing**: Queries go to primary + up to 6 total relays
- **Publish routing**: Events publish to primary + up to 5 total relays

### Relay Configuration (App.tsx)
```typescript
const defaultConfig: AppConfig = {
  theme: "light",
  relayUrl: "wss://relay.pinseekr.golf",
};

const presetRelays = [
  { url: 'wss://relay.pinseekr.golf', name: 'Pinseekr (Primary)' },
  { url: 'wss://relay.primal.net', name: 'Primal (Fallback)' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band (Fallback)' },
];
```

---

## Lightning Payments (NWC)

Pinseekr uses **Nostr Wallet Connect (NWC)** for Lightning payments. This is the preferred wallet integration.

### NWC Architecture
- `NWCProvider` wraps the app (`src/contexts/NWCContext.tsx`)
- `useNWC()` hook provides wallet operations (`src/hooks/useNWC.ts`)
- Connection strings: `nostr+walletconnect://...` or `nostrwalletconnect://...`
- Uses `@getalby/sdk` for the LN client

### Using NWC
```typescript
import { useNWCContext } from '@/hooks/useNWCContext';

function PaymentComponent() {
  const { getActiveConnection, sendPayment, addConnection } = useNWCContext();
  
  // Add wallet connection
  await addConnection('nostr+walletconnect://...', 'My Wallet');
  
  // Send payment
  const connection = getActiveConnection();
  if (connection) {
    const { preimage } = await sendPayment(connection, invoice);
  }
}
```

### Key NWC Functions
- `addConnection(uri, alias)` - Connect a wallet
- `removeConnection(connectionString)` - Disconnect
- `getActiveConnection()` - Get current wallet
- `sendPayment(connection, invoice)` - Pay Lightning invoice
- `connections` - Array of all connected wallets

---

## Code Patterns

### Querying Nostr Data
```typescript
// ✅ Correct: Custom hook combining useNostr + useQuery
function useGolfRounds() {
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['golf-rounds'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      return nostr.query([{ kinds: [31924], '#t': ['golf'], limit: 50 }], { signal });
    },
  });
}

// ✅ Efficient: Combine multiple kinds in one query, filter in JS
const events = await nostr.query([{ kinds: [1, 6, 16], '#e': [id] }], { signal });
const notes = events.filter((e) => e.kind === 1);
```

### Publishing Events
```typescript
const { mutate: createEvent } = useNostrPublish();
createEvent({
  kind: 36908,
  content: "Course description",
  tags: [["d", "course-id"], ["t", "golf-course"], ["name", "My Course"], ["alt", "Golf course"]]
});
```

### Component Patterns
- Use `@/` path alias for imports
- Wrap tests in `<TestApp>` for context providers
- Use `cn()` for class merging, shadcn/ui components from `@/components/ui/`
- Use `Skeleton` for loading states, not spinners

---

## Nostr Protocol Rules

### Before Creating Custom Event Kinds:
1. Research existing NIPs using `mcp_nostr_read_nips_index` and `mcp_nostr_read_nip`
2. Prefer extending existing kinds with domain-specific tags over new kinds
3. If new kind needed, use `mcp_nostr_generate_kind` and document in `NIP.md`
4. Always include NIP-31 `alt` tag with human-readable description

### Tag Design
```json
// ✅ Correct: Single-letter tags for relay-indexed filtering
["t", "golf"], ["t", "golf-course"]

// ❌ Wrong: Multi-letter tags aren't relay-queryable
["product_type", "electronics"]
```

---

## Files to Reference

| Purpose | Location |
|---------|----------|
| Full Nostr implementation docs | `NOSTR_IMPLEMENTATION.md` |
| Golf game types & interfaces | `src/lib/golf/types.ts` |
| Custom NIP definitions | `NIP.md` |
| Game framework for new games | `GOLF_GAMES_FRAMEWORK.md` |
| ESLint custom rules | `eslint-rules/README.md` |

## Testing

- **Only write tests when explicitly requested** - don't auto-create tests
- **Always run the test suite** after changes via `npm run test`
- Use `TestApp` wrapper for component tests
- Engine tests follow `*.test.ts` pattern in `src/lib/golf/`

## TypeScript Rules

- **Never use `any`** - use proper types
- Golf types defined in `src/lib/golf/types.ts` and `src/lib/golf/nostrTypes.ts`
- Nostr types from `@nostrify/nostrify`

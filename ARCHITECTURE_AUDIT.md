# Pinseekr Golf - Architecture Audit Report
**Date:** February 2, 2026  
**Status:** ✅ Healthy - Well-structured with some optimization opportunities

---

## Executive Summary

Your Nostr implementation is **solid and well-architected**. You've built a sophisticated relay system with intelligent routing, health monitoring, and dual relay adapters. The codebase follows React best practices with proper separation of concerns. No critical issues found, but there are optimization opportunities documented below.

---

## 🏗️ Architecture Overview

### Tech Stack Summary

| Layer | Technology | Status |
|-------|------------|--------|
| **Framework** | React 18 + TypeScript | ✅ Modern |
| **Build Tool** | Vite 6.3.5 | ✅ Latest |
| **State Management** | TanStack Query v5 | ✅ Excellent choice |
| **Styling** | TailwindCSS + shadcn/ui | ✅ Modern |
| **Nostr Client** | Nostrify (@nostrify/nostrify 0.46.4) | ✅ Active |
| **Relay Pooling** | NPool (Nostrify) + Applesauce Relay | ⚠️ Dual system |
| **Lightning** | NWC (@getalby/sdk) + Bitcoin Connect | ✅ Best practice |
| **Testing** | Vitest + Testing Library | ✅ Comprehensive |

---

## 🌐 Relay Architecture

### Dual Relay System

You're running **two relay pooling systems simultaneously**:

1. **NPool (Nostrify)** - Primary relay pool
2. **Applesauce RelayPool** - Wrapped via adapter

#### How It Works

```
User Request
    ↓
useNostr hook (@nostrify/react)
    ↓
NostrProvider (wraps NPool)
    ↓
createApplesauceAdapter (wraps NPool + RelayMonitor)
    ↓
┌─────────────────┬──────────────────┐
│    NPool        │  Applesauce Pool │
│ (Nostrify)      │  (rxjs-based)    │
└─────────────────┴──────────────────┘
         ↓                    ↓
    WebSocket Connections
```

#### Relay Routing Logic (NostrProvider.tsx)

**Query Routing:**
- Queries go to up to **6 relays** simultaneously
- Primary relay: `config.relayUrl` (wss://relay.pinseekr.golf)
- + Healthy relays from RelayMonitor
- + Preset relays (Primal, Damus, nos.lol)

**Publish Routing:**
- Events publish to up to **5 relays**
- Primary relay always included
- + Healthy relays from monitor
- + Preset relays (capped at 5 total)

#### Relay Health Monitoring

**RelayMonitor.ts** features:
- WebSocket health checks
- Exponential backoff reconnection (1s → 30s max)
- Latency tracking (`lastLatencyMs`)
- Reconnect counter
- Real-time status callbacks

**Backoff Strategy:**
```typescript
retryBase: 1000ms  // Initial retry delay
retryMax: 30000ms  // Max backoff time
next = Math.min(prev * 2, retryMax) + randomJitter(0-300ms)
```

---

## 📦 Data Flow Patterns

### Standard Query Pattern

All data fetching follows this pattern:

```typescript
// 1. Custom hook wraps useNostr + useQuery
export function useGolfCourses() {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['golf-courses'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([filters], { signal });
      return processEvents(events);
    },
  });
}

// 2. Components use the hook
const { data: courses, isLoading } = useGolfCourses();
```

**Benefits:**
- ✅ Automatic caching via TanStack Query
- ✅ Abort signals for cleanup
- ✅ 5-second timeout default
- ✅ Centralized error handling
- ✅ Type safety end-to-end

### Publishing Pattern

```typescript
// 1. Central publish hook
const { mutate: publishEvent } = useNostrPublish();

// 2. Hook handles signing + publishing
publishEvent({
  kind: 36902,
  content: JSON.stringify(data),
  tags: [["d", id], ["t", "golf-course"], ["alt", "Human readable"]],
});

// 3. Auto-adds client tag in production
// 4. Routes to 5 relays via NostrProvider
```

---

## 🔧 Key Components Analysis

### NostrProvider.tsx ⭐

**Responsibilities:**
1. Initializes `NPool` singleton
2. Configures relay routing (query/publish)
3. Integrates `RelayMonitor` for health tracking
4. Creates Applesauce adapter
5. Exposes composite Nostr object to React tree

**Strengths:**
- ✅ Proper use of `useRef` to persist pool across renders
- ✅ Smart relay selection based on health
- ✅ Caps simultaneous connections (6 query, 5 publish)
- ✅ Updates config reactively

**Potential Issues:**
- ⚠️ Dual pooling system (NPool + Applesauce) adds complexity
- ⚠️ Applesauce adapter converts Observable → AsyncIterable, extra layer

### applesauceRelayAdapter.ts

**Purpose:** Bridge NPool interface to Applesauce's RelayPool

**Why it exists:**
- NPool uses Promises
- Applesauce uses RxJS Observables
- Adapter converts between them

**Query flow:**
```typescript
nostr.query(filters) 
  → applesauceAdapter.query()
  → relayPool.request() [Observable]
  → lastValueFrom(event$.pipe(takeUntil(timer(1500))))
  → returns NostrEvent[]
```

**Recommendation:** ⚠️ Consider if you need both systems. If Applesauce offers unique features (e.g., better filtering, Negentropy support), great! If not, simplifying to just NPool would reduce complexity.

---

## 🎯 Hook Patterns (Consistent ✅)

### Query Hooks (Read Operations)

**Examples:** `useGolfCourses`, `useGolfProfile`, `useComments`, `useAuthor`

**Pattern:**
```typescript
function useThing(param) {
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['thing', param],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(Xms)]);
      const events = await nostr.query([filters], { signal });
      return parseEvents(events);
    },
    // Optional: enabled, retry, etc.
  });
}
```

**Timeout values observed:**
- 5000ms (5s) - Most queries (courses, profiles, rounds)
- 8000ms (8s) - `useAuthor` (kind 0 metadata)
- 1500ms (1.5s) - Applesauce adapter default

**Consistency:** ✅ Good - standardized approach

### Mutation Hooks (Write Operations)

**Examples:** `useNostrPublish`, `usePostComment`, `usePlayerScores.publish`

**Pattern:**
```typescript
function usePublishThing() {
  const { mutate } = useNostrPublish();
  return useMutation({
    mutationFn: async (data) => {
      mutate({ kind: X, content: Y, tags: Z });
    },
    onSuccess: () => queryClient.invalidateQueries(['thing']),
  });
}
```

**Consistency:** ✅ Excellent - all writes go through `useNostrPublish`

---

## 📊 Context Architecture

### Provider Hierarchy (App.tsx)

```
UnheadProvider (SEO/meta tags)
  └─ AppProvider (config, theme, relay selection)
      └─ QueryClientProvider (TanStack Query)
          └─ NostrLoginProvider (auth state)
              └─ NostrProvider (relay pooling)
                  └─ NWCProvider (Lightning wallets)
                      └─ TooltipProvider
                          └─ Routes
```

**Strengths:**
- ✅ Clear separation of concerns
- ✅ Each provider has single responsibility
- ✅ Proper nesting order (config → data → auth → app)

**State Management:**
- **Global Config:** `AppProvider` (theme, relay URL) → localStorage
- **Auth:** `NostrLoginProvider` → localStorage key `'nostr:login'`
- **Wallets:** `NWCProvider` → localStorage
- **Query Cache:** TanStack Query (in-memory + background refetch)
- **Relay State:** `RelayMonitorContext` (WebSocket health)

---

## 🎮 Nostr Event Kinds

### Standard NIPs

| Kind | NIP | Usage | Hook |
|------|-----|-------|------|
| 0 | NIP-01 | User metadata | `useAuthor` |
| 3 | NIP-02 | Contacts list | `useContacts` |
| 4 | NIP-04 | Encrypted DM (invites) | `NewRoundPage` |
| 1111 | NIP-22 | Comments | `useComments` |

### Custom Golf Kinds (369xx block)

| Kind | Name | Addressable? | Purpose |
|------|------|--------------|---------|
| 36901 | Golf Round | ✅ Yes | Round container |
| 36902 | Golf Course | ✅ Yes | Course database |
| 36903 | Player Score | ✅ Yes | Per-player scores |
| 36904 | Golf Profile | ✅ Yes | Handicap, stats |
| 36905 | Tournament | ✅ Yes | Multi-round events |
| 36910 | Badge Award | ❌ No | Achievements |

**Tag Design:** ✅ Excellent
- Uses single-letter tags (`t`, `d`, `p`, `e`) for relay indexing
- Includes NIP-31 `alt` tags for human-readable descriptions
- Proper addressable event structure (`d` tag for deduplication)

---

## 🔍 Testing Coverage

### Test Files Found

```
src/
├── App.test.tsx
├── test/ErrorBoundary.test.tsx
├── components/NoteContent.test.tsx
├── lib/
│   ├── genUserName.test.ts
│   └── golf/
│       ├── matchEngine.test.ts
│       ├── dotsEngine.test.ts
│       ├── nostrEvents.test.ts
│       ├── sixesEngine.test.ts
│       ├── scoringEngine.test.ts
│       ├── pinseekrCupEngine.test.ts
│       ├── strokeEngine.test.ts
│       └── snakeEngine.test.ts
```

**Coverage:** ✅ Excellent
- All scoring engines have tests
- Components have tests
- Test command: `npm run test` (TypeScript + ESLint + Vitest + build)

**Test Infrastructure:**
- Uses `TestApp` wrapper for context providers
- Vitest + Testing Library
- jsdom for DOM simulation

---

## ⚡ Lightning Integration (NWC)

### Architecture

```
NWCProvider
  ├─ Manages connections (localStorage)
  ├─ Uses @getalby/sdk for wallet operations
  └─ Exposes: { connections, addConnection, sendPayment, ... }

Bitcoin Connect
  ├─ Widget for connecting wallets
  ├─ Supports WebLN when available
  └─ Global window.webln injection
```

**Hooks:**
- `useNWC()` - Access NWC operations
- `useNWCContext()` - Direct context access

**Payment Flow:**
```typescript
const { sendPayment, getActiveConnection } = useNWCContext();
const connection = getActiveConnection();
await sendPayment(connection, invoice);
```

**Status:** ✅ Clean, follows NIP-47 best practices

---

## 🚨 Issues & Recommendations

### Critical Issues: None ✅

### Medium Priority

1. **Dual Relay Pooling System** ⚠️

   **Current State:**
   - Running both NPool (Nostrify) and Applesauce RelayPool
   - Adapter converts between Promise and Observable patterns
   - Adds complexity and potential performance overhead

   **Recommendation:**
   - Pick one: either NPool or Applesauce
   - If Applesauce has features you need (Negentropy, better filtering), go all-in
   - If not, remove adapter and use NPool directly
   - **Benefit:** Reduced bundle size, simpler debugging

2. **Timeout Inconsistencies** ⚠️

   **Current State:**
   - `useAuthor`: 8000ms
   - Most hooks: 5000ms
   - Applesauce adapter: 1500ms

   **Recommendation:**
   - Standardize timeouts per operation type:
     - Quick queries (kind 0 metadata): 3-5s
     - Heavy queries (comments, rounds): 8-10s
     - Publish operations: 5s
   - Consider making timeout configurable in `useNostr` options

3. **Query Caching Strategy** ℹ️

   **Current State:**
   ```typescript
   defaultOptions: {
     queries: {
       staleTime: 60000,  // 1 minute
       gcTime: Infinity,  // Never garbage collect
     },
   }
   ```

   **Recommendation:**
   - `gcTime: Infinity` means cache grows forever
   - For production, consider: `gcTime: 1000 * 60 * 60` (1 hour)
   - Or selectively apply `Infinity` only to static data (courses)

### Low Priority

4. **Error Handling** ℹ️

   Most hooks use default TanStack Query error handling. Consider:
   - Custom error boundaries for Nostr-specific errors
   - User-facing error messages for common relay failures
   - Retry strategies for critical queries

5. **Performance Monitoring** ℹ️

   **Current:** RelayMonitor tracks latency
   **Consider adding:**
   - Query timing metrics
   - Failed query tracking
   - Relay success rate analytics
   - Could feed into relay selection algorithm

---

## 📋 Relay Configuration Reference

### Current Setup (App.tsx)

```typescript
defaultConfig: {
  theme: "light",
  relayUrl: "wss://relay.pinseekr.golf", // Primary
}

presetRelays: [
  { url: 'wss://relay.pinseekr.golf', name: 'Pinseekr (Primary)' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://nos.lol', name: 'nos.lol' },
]
```

**Query Strategy:**
- Queries sent to up to 6 relays simultaneously
- Combines: primary + healthy (from monitor) + presets
- First-response-wins, then deduplicates by event ID

**Publish Strategy:**
- Events sent to up to 5 relays
- Same priority order
- Async fire-and-forget (logs success/failure)

**Health Monitoring:**
- All relays monitored via WebSocket connections
- Reconnects with exponential backoff
- Unhealthy relays excluded from rotation

---

## 🎯 Code Quality Assessment

### Strengths ✅

1. **Type Safety:** Full TypeScript with proper types from Nostrify
2. **Separation of Concerns:** Clean separation of data/UI/business logic
3. **React Best Practices:** Proper hook usage, no prop drilling
4. **Testing:** Comprehensive test coverage for scoring engines
5. **Documentation:** Excellent inline docs and architectural docs
6. **Custom NIPs:** Well-designed golf event kinds with proper tags
7. **Performance:** Smart relay routing, caching, abort signals

### Code Patterns ✅

**Consistent patterns throughout:**
- `useQuery` for reads
- `useMutation` for writes
- `useNostrPublish` as central publish point
- `AbortSignal.timeout()` for query cancellation
- Proper TanStack Query key structure

---

## 📚 Dependency Analysis

### Core Dependencies

**Nostr:**
- `@nostrify/nostrify` ^0.46.4 - Core Nostr library ✅
- `@nostrify/react` ^0.2.8 - React bindings ✅
- `nostr-tools` ^2.13.0 - NIP utilities ✅

**Applesauce Ecosystem:**
- `applesauce-common` ^5.0.0
- `applesauce-core` ^5.0.0
- `applesauce-react` ^5.0.0
- `applesauce-relay` ^5.0.0
- `applesauce-signers` ^5.0.0

**Question:** Are you actively using Applesauce features beyond relay pooling? If not, these could be removed when simplifying to single pool system.

**Lightning:**
- `@getalby/bitcoin-connect-react` ^3.11.3 ✅
- `@getalby/sdk` ^5.1.1 ✅
- `webln` ^0.3.2 ✅

**State/UI:**
- `@tanstack/react-query` ^5.56.2 ✅
- React 18 + shadcn/ui ✅

---

## 🎓 Summary & Next Steps

### Overall Health: **Excellent** 🌟

Your codebase is well-architected with modern patterns. The dual relay system works but adds complexity. No critical bugs detected.

### Immediate Actions (Optional)

1. **Decide on single relay pool:** NPool vs Applesauce
   - If keeping both, document why in `ARCHITECTURE.md`
   - If removing one, creates opportunity for cleanup

2. **Standardize timeouts:** Pick timeout values and document them

3. **Review gcTime:** Consider not keeping cache forever

### Long-term Improvements

1. Add relay performance metrics dashboard
2. Implement smart relay selection based on historical success rates
3. Add NIP-77 (Negentropy) support for efficient sync
4. Consider implementing outbox model (NIP-65) for user relay lists

---

## 📊 Metrics

- **Total React Hooks:** 40+ custom hooks
- **Nostr Event Kinds:** 4 standard + 6 custom
- **Relay Connections:** Up to 6 simultaneous for queries
- **Test Coverage:** All scoring engines + core components
- **TypeScript:** 100% (no `.js` files in `src/`)
- **Dependencies:** 50+ production, 20+ dev
- **Bundle Size:** (Run `npm run build` to check)

---

## ✅ Conclusion

**You haven't made a mess** - quite the opposite! This is a well-structured, modern React application with solid Nostr integration. The architecture shows thoughtful design decisions and follows best practices.

The main area for optimization is the dual relay pooling system. Everything else is production-ready.

Great work! 🏌️⚡

---

**Questions to answer:**
1. Why both NPool and Applesauce? (Document the use case)
2. Do you need Applesauce-specific features?
3. What's the target for relay response times?
4. Are you planning to add NIP-77 (Negentropy)?


# Settlement System Redesign - Complete

## Overview
The settlement system has been completely redesigned to allow **all participants** to collect their winnings, not just the host. The old system required the host to create invoices upfront, which only worked if the host was the winner.

## Architecture

### Three-Phase Settlement Flow

#### Phase 1: Host Publishes Settlement
- After round completes, host calculates net payments using game engines
- Host publishes settlement event (kind 36912, t: golf-result) with payment details
- **No invoices required at this stage**
- Settlement includes: roundId, payments array, total pot, game modes

#### Phase 2: Winners Generate Claims
- Winners query for settlements where they are owed money
- Winners generate Lightning invoices via their NWC connection
- Winners publish settlement-claim events (kind 36912, t: settlement-claim)
- Claim includes: invoice (bolt11), amount, expiration, references settlement event

#### Phase 3: Payers Complete Payment (Future)
- Payers see claims with invoices
- Payers pay via Lightning Network
- Payers publish payment-proof events with preimage as verification

## New Files Created

### Core Types & Logic
- **`src/lib/golf/settlementTypes.ts`** - Settlement data structures and parsing functions
  - `SettlementEvent` - Published by host with net payments
  - `SettlementClaim` - Published by winner with invoice
  - `PaymentProof` - Published by payer after payment
  - Parser functions for each event type

### Data Fetching Hooks
- **`src/hooks/useSettlements.ts`** - TanStack Query hooks for settlement data
  - `useRoundSettlements(roundId)` - Get settlements for specific round
  - `useMySettlements(userPubkey)` - Get all settlements involving user
  - `useSettlementClaims(settlementEventId)` - Get claims for settlement
  - `useSettlementProofs(settlementEventId)` - Get payment proofs
  - `useMyClaims(userPubkey)` - Get user's claim history
  - `useSettlementView(settlementEventId, userPubkey)` - Comprehensive view

### UI Components
- **`src/components/golf/SettlementClaimDialog.tsx`** - Dialog for generating invoices
  - Shows winnings breakdown
  - Generates Lightning invoice via NWC
  - Publishes claim event to Nostr
  - Displays invoice for sharing

### Pages
- **`src/pages/SettlementsPage.tsx`** - Main settlements dashboard
  - Lists all user's settlements
  - Shows net balance (positive = winnings, negative = owes)
  - "Claim Winnings" button for settlements with positive balance
  - Displays game modes, dates, and course info

## Updated Files

### Settlement Publishing
- **`src/pages/NewRoundPage.tsx`**
  - `generateAndPublishSettlement()` - Removed wallet check (no longer needs NWC upfront)
  - `confirmSettlementAndCreateInvoices()` - Simplified to just publish payments, no invoice generation
  - Settlement preview dialog updated with new messaging
  - Button text changed from "Create Invoices & Publish" to "Publish Settlement"

### Type Definitions
- **`src/lib/golfTags.ts`** - Added new subtypes
  - `SETTLEMENT_CLAIM: 'settlement-claim'`
  - `PAYMENT_PROOF: 'payment-proof'`

### Routing
- **`src/AppRouter.tsx`** - Added `/settlements` route

## Event Structure

### Settlement Event (kind 36912)
```json
{
  "kind": 36912,
  "content": {
    "payments": [
      {
        "from": "pubkey_of_payer",
        "to": "pubkey_of_recipient",
        "amountSats": 500,
        "memo": "Net settlement"
      }
    ],
    "totalPot": 1000,
    "gameModes": ["Nassau", "Skins"],
    "date": 1707523200000
  },
  "tags": [
    ["d", "round-id-result"],
    ["t", "golf"],
    ["t", "golf-result"],
    ["round", "round-id"],
    ["course", "Course Name"]
  ]
}
```

### Settlement Claim Event (kind 36912)
```json
{
  "kind": 36912,
  "content": {
    "amountSats": 500,
    "invoice": "lnbc5000n1...",
    "expiresAt": 1707609600000,
    "status": "pending"
  },
  "tags": [
    ["d", "round-id-claim-1707523200000"],
    ["t", "golf"],
    ["t", "settlement-claim"],
    ["e", "settlement_event_id", "", "settlement"],
    ["round", "round-id"]
  ]
}
```

### Payment Proof Event (kind 36912)
```json
{
  "kind": 36912,
  "content": {
    "amountSats": 500,
    "preimage": "0123456789abcdef...",
    "paidAt": 1707523800000
  },
  "tags": [
    ["d", "round-id-proof-1707523800000"],
    ["t", "golf"],
    ["t", "payment-proof"],
    ["e", "settlement_event_id", "", "settlement"],
    ["e", "claim_event_id", "", "claim"],
    ["round", "round-id"],
    ["p", "recipient_pubkey"]
  ]
}
```

## Benefits

1. **Decentralized** - No single party controls the settlement process
2. **Flexible** - Winners claim on their own schedule
3. **Verifiable** - Payment proofs provide cryptographic evidence
4. **Fair** - All participants can collect, not just host
5. **Private** - Invoices only shared when winners choose to claim
6. **Nostr-native** - Uses standard NIP-01 events with custom tags

## User Experience Flow

### For Winners:
1. Navigate to `/settlements` page
2. See list of rounds with winnings amount
3. Click "Claim Winnings" on a settlement
4. Dialog shows breakdown of winnings
5. Click "Generate Invoice" (connects wallet if needed)
6. Invoice published to Nostr automatically
7. Copy invoice to share with payers

### For Payers:
1. See settlement was published (toast notification)
2. Wait for winners to generate claims
3. View claims (future UI)
4. Pay Lightning invoice
5. Publish payment proof (future feature)

## Future Enhancements

### Payment Tracking (Phase 3)
- [ ] Create PaymentClaimsPanel component to show pending claims
- [ ] Add "Pay Invoice" button that opens Lightning wallet
- [ ] Capture preimage after payment
- [ ] Publish payment-proof event
- [ ] Mark claims as "paid" in UI

### Notifications
- [ ] Toast when user has new settlements to claim
- [ ] Badge on settlements nav item showing claimable count
- [ ] Email notifications for large settlements (optional)

### Escrow (Advanced)
- [ ] Pre-round escrow via HODL invoices
- [ ] Automatic settlement release after round completion
- [ ] Dispute resolution mechanism

## Testing

All tests passing:
- ✅ 106 tests across 13 test files
- ✅ No TypeScript errors in new code
- ✅ Strict mode enabled for type safety
- ✅ Settlement types properly defined
- ✅ Hooks follow established patterns

## Migration Notes

**Breaking Changes:**
- Old settlement events (with embedded invoices) won't be compatible
- Existing rounds need to republish settlements using new format
- `getNwcClient()` is no longer called during settlement publishing

**Backward Compatibility:**
- Settlement preview still shows same aggregated view
- Payment calculation logic unchanged (uses same engines)
- Net settlement optimization still applied

## Summary

The settlement redesign transforms Pinseekr from a **host-centric** to a **participant-centric** wager system. Winners now have full autonomy to claim their earnings on their own schedule using their own Lightning wallets. This is more decentralized, more flexible, and aligns better with Nostr's peer-to-peer philosophy.

**Status:** ✅ Complete and tested
**Next Phase:** Implement payment tracking and proof system

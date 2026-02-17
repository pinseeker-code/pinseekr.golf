import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { APP_KIND } from '@/lib/golf/types';
import { SUBTYPES } from '@/lib/golfTags';

import {
  type SettlementEvent,
  type SettlementClaim,
  type PaymentProof,
  type SettlementView,
  parseSettlementEvent,
  parseSettlementClaim,
  parsePaymentProof,
  calculateNetBalance,
  getPaymentsOwed,
  getPaymentsOwedTo,
} from '@/lib/golf/settlementTypes';

/**
 * Query all settlements for a specific round
 */
export function useRoundSettlements(roundId?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['round-settlements', roundId],
    queryFn: async ({ signal }) => {
      if (!roundId) return [];

      const events = await nostr.query([
        {
          kinds: [APP_KIND],
          '#t': ['golf', SUBTYPES.RESULT],
          '#round': [roundId],
          limit: 10,
        }
      ], { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });

      const settlements = events
        .map(parseSettlementEvent)
        .filter((s): s is SettlementEvent => s !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      return settlements;
    },
    enabled: !!roundId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Query all settlements where the user is involved (owes or is owed money)
 */
export function useMySettlements(userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['my-settlements', userPubkey],
    queryFn: async ({ signal }) => {
      if (!userPubkey) return [];

      // Query settlements where user is tagged as participant
      const events = await nostr.query([
        {
          kinds: [APP_KIND],
          '#t': ['golf', SUBTYPES.RESULT],
          limit: 50,
        }
      ], { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });

      const settlements = events
        .map(parseSettlementEvent)
        .filter((s): s is SettlementEvent => {
          if (!s) return false;
          // Check if user is involved in any payment
          return s.payments.some(p => p.from === userPubkey || p.to === userPubkey);
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      return settlements;
    },
    enabled: !!userPubkey,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Query all claims for a specific settlement
 */
export function useSettlementClaims(settlementEventId?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['settlement-claims', settlementEventId],
    queryFn: async ({ signal }) => {
      if (!settlementEventId) return [];

      const events = await nostr.query([
        {
          kinds: [APP_KIND],
          '#t': ['settlement-claim'],
          '#e': [settlementEventId],
          limit: 20,
        }
      ], { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });

      const claims = events
        .map(parseSettlementClaim)
        .filter((c): c is SettlementClaim => c !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      return claims;
    },
    enabled: !!settlementEventId,
    staleTime: 60 * 1000,
  });
}

/**
 * Query all payment proofs for a specific settlement
 */
export function useSettlementProofs(settlementEventId?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['settlement-proofs', settlementEventId],
    queryFn: async ({ signal }) => {
      if (!settlementEventId) return [];

      const events = await nostr.query([
        {
          kinds: [APP_KIND],
          '#t': ['payment-proof'],
          '#e': [settlementEventId],
          limit: 50,
        }
      ], { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });

      const proofs = events
        .map(parsePaymentProof)
        .filter((p): p is PaymentProof => p !== null)
        .sort((a, b) => b.paidAt - a.paidAt);

      return proofs;
    },
    enabled: !!settlementEventId,
    staleTime: 60 * 1000,
  });
}

/**
 * Query claims made by a specific user
 */
export function useMyClaims(userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['my-claims', userPubkey],
    queryFn: async ({ signal }) => {
      if (!userPubkey) return [];

      const events = await nostr.query([
        {
          kinds: [APP_KIND],
          authors: [userPubkey],
          '#t': ['settlement-claim'],
          limit: 50,
        }
      ], { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });

      const claims = events
        .map(parseSettlementClaim)
        .filter((c): c is SettlementClaim => c !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      return claims;
    },
    enabled: !!userPubkey,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Comprehensive settlement view for a single settlement
 * Combines settlement, claims, and proofs into unified view
 */
export function useSettlementView(settlementEventId?: string, userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['settlement-view', settlementEventId, userPubkey],
    queryFn: async ({ signal }) => {
      if (!settlementEventId) return null;

      const timeout = AbortSignal.timeout(8000);
      const combinedSignal = AbortSignal.any([signal, timeout]);

      // Query settlement, claims, and proofs in parallel
      const [settlementEvents, claimEvents, proofEvents] = await Promise.all([
        nostr.query([
          {
            kinds: [APP_KIND],
            ids: [settlementEventId],
            limit: 1,
          }
        ], { signal: combinedSignal }),
        nostr.query([
          {
            kinds: [APP_KIND],
            '#t': ['settlement-claim'],
            '#e': [settlementEventId],
            limit: 20,
          }
        ], { signal: combinedSignal }),
        nostr.query([
          {
            kinds: [APP_KIND],
            '#t': ['payment-proof'],
            '#e': [settlementEventId],
            limit: 50,
          }
        ], { signal: combinedSignal }),
      ]);

      const settlement = settlementEvents.length > 0 && settlementEvents[0]
        ? parseSettlementEvent(settlementEvents[0])
        : null;

      if (!settlement) return null;

      const claims = claimEvents
        .map(parseSettlementClaim)
        .filter((c): c is SettlementClaim => c !== null);

      const proofs = proofEvents
        .map(parsePaymentProof)
        .filter((p): p is PaymentProof => p !== null);

      const view: SettlementView = {
        settlement,
        myPayments: userPubkey ? getPaymentsOwed(settlement, userPubkey) : [],
        myWinnings: userPubkey ? getPaymentsOwedTo(settlement, userPubkey) : [],
        claims,
        proofs,
        myNetBalance: userPubkey ? calculateNetBalance(settlement, userPubkey) : 0,
      };

      return view;
    },
    enabled: !!settlementEventId,
    staleTime: 60 * 1000,
  });
}

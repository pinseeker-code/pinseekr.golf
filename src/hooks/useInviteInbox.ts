import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';
import type { InvitePayload } from '@/hooks/useSendInvite';

export interface InviteItem {
  id: string; // DM event id
  roundId: string;
  joinUrl: string;
  code: string;
  fromPubkey: string;
  fromName: string;
  courseName?: string;
  date?: string;
  receivedAt: number; // unix ms
}

const DISMISSED_KEY = 'pinseekr:dismissed-invites';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

function setDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function useInviteInbox() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const query = useQuery<InviteItem[]>({
    queryKey: ['invite-inbox', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey || !user.signer) return [];

      let events: NostrEvent[] = [];
      try {
        events = await nostr.query(
          [{ kinds: [4], '#p': [user.pubkey], limit: 100 }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) }
        ) as NostrEvent[];
      } catch {
        return [];
      }

      const invites: InviteItem[] = [];

      for (const event of events) {
        try {
          let plaintext: string | null = null;

          // Try NIP-44 first (used by useSendInvite)
          if (user.signer.nip44?.decrypt) {
            try {
              plaintext = await user.signer.nip44.decrypt(event.pubkey, event.content);
            } catch {
              // fall through to NIP-04
            }
          }

          if (!plaintext) continue;

          const payload = JSON.parse(plaintext) as InvitePayload;
          if (payload.type !== 'round-invite') continue;

          invites.push({
            id: event.id,
            roundId: payload.roundId,
            joinUrl: payload.joinUrl,
            code: payload.code,
            fromPubkey: event.pubkey,
            fromName: payload.fromName,
            courseName: payload.meta?.course,
            date: payload.meta?.date,
            receivedAt: event.created_at * 1000,
          });
        } catch {
          // skip malformed events
        }
      }

      // Deduplicate by roundId (keep most recent per round)
      const byRound = new Map<string, InviteItem>();
      for (const invite of invites) {
        const existing = byRound.get(invite.roundId);
        if (!existing || invite.receivedAt > existing.receivedAt) {
          byRound.set(invite.roundId, invite);
        }
      }

      return [...byRound.values()].sort((a, b) => b.receivedAt - a.receivedAt);
    },
    enabled: !!user?.pubkey && !!user?.signer,
    staleTime: 30 * 1000, // refresh every 30s
  });

  const allInvites = query.data ?? [];
  const dismissed = getDismissed();
  const activeInvites = allInvites.filter(inv => !dismissed.has(inv.roundId));

  const dismiss = (roundId: string) => {
    const next = getDismissed();
    next.add(roundId);
    setDismissed(next);
    // Force re-render by invalidating the query
    queryClient.invalidateQueries({ queryKey: ['invite-inbox', user?.pubkey] });
  };

  return {
    invites: activeInvites,
    allInvites,
    count: activeInvites.length,
    isLoading: query.isLoading,
    dismiss,
  };
}

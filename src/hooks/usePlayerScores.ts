import { useQuery, useMutation } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { GOLF_KINDS, OLD_GOLF_KINDS } from '@/lib/golf/types';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

type PlayerScorePayload = {
  scores: Record<string, number>;
  total?: number;
  updatedAt?: number;
  meta?: Record<string, unknown>;
};

/**
 * Hook to read and publish per-player scores for a round.
 * - Subscribes (query) to `GOLF_KINDS.PLAYER_SCORE` events for the given `roundId`.
 * - Provides `publishScore` which requires the current user to be the player author.
 */
export function usePlayerScores(roundId: string, playerPubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const publishMutation = useNostrPublish();

  const query = useQuery({
    queryKey: ['player-scores', roundId, playerPubkey],
    queryFn: async (ctx) => {
      if (!roundId) return {} as Record<string, PlayerScorePayload>;

      const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(5000)]);

      const filter = {
        kinds: [GOLF_KINDS.PLAYER_SCORE, OLD_GOLF_KINDS.PLAYER_SCORE],
        '#d': [roundId],
        limit: 200,
      } as unknown as NostrFilter;

      if (playerPubkey) filter.authors = [playerPubkey];

      const events = await nostr.query([filter], { signal });

      // Keep the most recent event per author (pubkey)
      const byAuthor = new Map<string, NostrEvent>();
      for (const ev of events as NostrEvent[]) {
        const existing = byAuthor.get(ev.pubkey);
        if (!existing || (ev.created_at || 0) > (existing.created_at || 0)) {
          byAuthor.set(ev.pubkey, ev);
        }
      }

      const result: Record<string, PlayerScorePayload> = {};
      for (const [author, ev] of byAuthor.entries()) {
        try {
          const parsed = JSON.parse(ev.content || '{}');
          result[author] = {
            scores: parsed.scores || {},
            total: parsed.total,
            updatedAt: parsed.updatedAt || (ev.created_at ? ev.created_at * 1000 : Date.now()),
            meta: parsed.meta || {},
          };
        } catch (err) {
          console.warn('Failed to parse player-score content', err);
        }
      }

      return result;
    },
    enabled: !!roundId,
    staleTime: 5 * 1000,
    refetchInterval: 5000, // poll for updates (simple approach)
  });

  const publish = useMutation({
    mutationFn: async (payload: { playerPubkey: string; data: PlayerScorePayload }) => {
      if (!user) throw new Error('Must be logged in to publish scores');
      if (user.pubkey !== payload.playerPubkey) throw new Error('Can only publish your own scores');
      const content = JSON.stringify({ ...payload.data, updatedAt: Date.now() });

      const eventPayload: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'> = {
        kind: GOLF_KINDS.PLAYER_SCORE,
        content,
        tags: [['d', roundId], ['player', payload.playerPubkey]],
        created_at: Math.floor(Date.now() / 1000),
      };

      const event = await publishMutation.mutateAsync(eventPayload);

      return event;
    },
  });

  return {
    ...query,
    publishScore: publish.mutateAsync,
    isPublishing: publish.status === 'pending',
  };
}

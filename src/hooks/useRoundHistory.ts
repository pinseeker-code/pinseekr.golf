import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { APP_KIND } from '@/lib/golf/types';
import { SUBTYPES } from '@/lib/golfTags';
import type { NostrEvent } from '@nostrify/nostrify';

export interface RoundHistoryItem {
  roundId: string;
  courseName: string;
  date: number;
  playerCount: number;
  gameMode: string;
  status: string;
  topGross?: number;
  topNet?: number;
  settlementPublished?: boolean;
  eventId?: string;
}

export function useRoundHistory(userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery<RoundHistoryItem[]>({
    queryKey: ['round-history', userPubkey],
    queryFn: async ({ signal }) => {
      if (!userPubkey) return [];

      const events = await nostr.query([
        {
          kinds: [APP_KIND],
          authors: [userPubkey],
          '#t': ['golf', SUBTYPES.ROUND],
          limit: 100,
        }
      ], { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) });

      const rounds = events.map((event: NostrEvent) => {
        const tags = event.tags as string[][];
        const dTag = tags.find(t => t[0] === 'd')?.[1];
        const roundIdTag = tags.find(t => t[0] === 'round-id')?.[1];
        const courseTag = tags.find(t => t[0] === 'course')?.[1];
        const titleTag = tags.find(t => t[0] === 'title')?.[1];
        const dateTag = tags.find(t => t[0] === 'date')?.[1];
        const gameModeTag = tags.find(t => t[0] === 'game-mode')?.[1];
        const statusTag = tags.find(t => t[0] === 'status')?.[1];
        const playersTag = tags.find(t => t[0] === 'players');

        const dateMs = dateTag ? new Date(dateTag).getTime() : event.created_at * 1000;
        const players = playersTag ? Math.max(0, playersTag.length - 1) : 0;

        return {
          roundId: roundIdTag || dTag || event.id,
          courseName: courseTag || titleTag || 'Unknown Course',
          date: dateMs,
          playerCount: players,
          gameMode: gameModeTag || 'stroke-play',
          status: statusTag || 'active',
          eventId: event.id,
        } satisfies RoundHistoryItem;
      });

      const roundIds = rounds.map(r => r.roundId).filter(Boolean);

      if (roundIds.length === 0) {
        return rounds.sort((a, b) => b.date - a.date);
      }

      const [playerEvents, settlementEvents] = await Promise.all([
        nostr.query([
          {
            kinds: [APP_KIND],
            '#t': ['golf', SUBTYPES.PLAYER],
            '#round': roundIds,
            limit: 500,
          }
        ], { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) }) as Promise<NostrEvent[]>,
        nostr.query([
          {
            kinds: [APP_KIND],
            '#t': ['golf', SUBTYPES.RESULT],
            '#round': roundIds,
            limit: 100,
          }
        ], { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) }) as Promise<NostrEvent[]>,
      ]);

      const statsByRound = new Map<string, { topGross?: number; topNet?: number; playerCount: number }>();

      for (const event of playerEvents) {
        const tags = event.tags as string[][];
        const roundTag = tags.find(t => t[0] === 'round')?.[1];
        if (!roundTag) continue;

        const totalTag = tags.find(t => t[0] === 'total')?.[1];
        const netTotalTag = tags.find(t => t[0] === 'net-total')?.[1];
        const total = totalTag ? parseInt(totalTag, 10) : NaN;
        const netTotal = netTotalTag ? parseInt(netTotalTag, 10) : NaN;

        const existing = statsByRound.get(roundTag) || { playerCount: 0 };
        existing.playerCount += 1;

        if (!Number.isNaN(total)) {
          existing.topGross = typeof existing.topGross === 'number' ? Math.min(existing.topGross, total) : total;
        }
        if (!Number.isNaN(netTotal)) {
          existing.topNet = typeof existing.topNet === 'number' ? Math.min(existing.topNet, netTotal) : netTotal;
        }

        statsByRound.set(roundTag, existing);
      }

      const settlementByRound = new Set<string>();
      for (const event of settlementEvents) {
        const roundTag = (event.tags as string[][]).find(t => t[0] === 'round')?.[1];
        if (roundTag) settlementByRound.add(roundTag);
      }

      const hydrated = rounds.map((round) => {
        const stats = statsByRound.get(round.roundId);
        return {
          ...round,
          playerCount: stats?.playerCount ?? round.playerCount,
          topGross: stats?.topGross,
          topNet: stats?.topNet,
          settlementPublished: settlementByRound.has(round.roundId),
        } satisfies RoundHistoryItem;
      });

      return hydrated.sort((a, b) => b.date - a.date);
    },
    enabled: !!userPubkey,
    staleTime: 60 * 1000,
  });
}

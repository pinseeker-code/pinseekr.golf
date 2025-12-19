import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { GOLF_KINDS } from '@/lib/golf/types';
import {
  calculateDifferential,
  calculateHandicapIndex,
  DEFAULT_COURSE_RATING,
  DEFAULT_SLOPE,
  type RoundDifferential,
  type HandicapResult,
} from '@/lib/golf/handicapCalculator';

interface PlayerScoreContent {
  holes?: { hole: number; strokes: number; putts?: number }[];
  gross?: number;
  net?: number;
  thru?: number;
}

/**
 * Hook to calculate a user's handicap from their PLAYER_SCORE events
 * 
 * Queries the user's last 20 completed rounds and calculates their handicap index
 * using progressive thresholds (best 2 of 5, best 3 of 10, best 8 of 20).
 */
export function useHandicapCalculation(userPubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<HandicapResult>({
    queryKey: ['handicap-calculation', userPubkey],
    queryFn: async ({ signal }) => {
      if (!userPubkey) {
        return {
          index: null,
          roundsUsed: 0,
          roundsAvailable: 0,
          differentials: [],
          bestDifferentials: [],
          method: 'insufficient' as const,
          minimumRoundsNeeded: 5,
        };
      }

      // Query user's PLAYER_SCORE events (their scorecards)
      const scoreEvents = await nostr.query([{
        kinds: [GOLF_KINDS.PLAYER_SCORE],
        authors: [userPubkey],
        limit: 20,
      }], { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });

      // Also query for the courses to get ratings/slopes
      const courseEvents = await nostr.query([{
        kinds: [GOLF_KINDS.COURSE],
        '#t': ['golf-course'],
        limit: 100,
      }], { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });

      // Build course lookup by name/id
      const courseMap = new Map<string, { rating: number; slope: number; name: string }>();
      for (const ce of courseEvents) {
        try {
          const content = JSON.parse(ce.content || '{}');
          const name = content.name || ce.tags?.find(t => t[0] === 'name')?.[1] || '';
          const rating = parseFloat(ce.tags?.find(t => t[0] === 'rating')?.[1] || '') || DEFAULT_COURSE_RATING;
          const slope = parseInt(ce.tags?.find(t => t[0] === 'slope')?.[1] || '') || DEFAULT_SLOPE;
          const id = ce.tags?.find(t => t[0] === 'd')?.[1] || ce.id;
          
          if (name) courseMap.set(name.toLowerCase(), { rating, slope, name });
          if (id) courseMap.set(id, { rating, slope, name });
        } catch {
          // Skip invalid course events
        }
      }

      // Convert score events to differentials
      const differentials: RoundDifferential[] = [];

      for (const event of scoreEvents) {
        try {
          const content: PlayerScoreContent = JSON.parse(event.content || '{}');
          
          // Skip incomplete rounds (need gross score)
          if (!content.gross && (!content.holes || content.holes.length < 9)) {
            continue;
          }

          // Calculate gross from holes if not provided
          const gross = content.gross || 
            (content.holes?.reduce((sum, h) => sum + (h.strokes || 0), 0) || 0);

          if (gross < 40) continue; // Invalid score

          // Try to find course info from the round
          const roundTag = event.tags?.find(t => t[0] === 'round')?.[1];
          let courseRating = DEFAULT_COURSE_RATING;
          let slope = DEFAULT_SLOPE;
          let courseName = 'Unknown Course';

          // Look up course by various means
          const courseTag = event.tags?.find(t => t[0] === 'course')?.[1];
          if (courseTag) {
            const courseInfo = courseMap.get(courseTag.toLowerCase()) || courseMap.get(courseTag);
            if (courseInfo) {
              courseRating = courseInfo.rating;
              slope = courseInfo.slope;
              courseName = courseInfo.name;
            }
          }

          const differential = calculateDifferential(gross, courseRating, slope);

          differentials.push({
            roundId: event.id,
            date: event.created_at * 1000,
            gross,
            courseRating,
            slope,
            differential,
            courseName,
          });
        } catch {
          // Skip invalid events
        }
      }

      // Sort by date (most recent first) and take last 20
      differentials.sort((a, b) => b.date - a.date);
      const recent20 = differentials.slice(0, 20);

      return calculateHandicapIndex(recent20);
    },
    enabled: !!userPubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

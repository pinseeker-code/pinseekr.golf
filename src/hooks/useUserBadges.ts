import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { APP_KIND, type BadgeAward } from '@/lib/golf/types';
import { SUBTYPES } from '@/lib/golfTags';
import { parseBadgeEvent } from '@/lib/golf/nostrEvents';

/**
 * Hook to fetch user's earned badges from Nostr
 * @param pubkey - The user's public key (npub or hex)
 */
export function useUserBadges(pubkey?: string) {
  const { nostr } = useNostr();

  return useQuery<BadgeAward[], Error>({
    queryKey: ['user-badges', pubkey],
    enabled: !!pubkey && !!nostr,
    staleTime: 60000, // 1 minute
    queryFn: async (c) => {
      if (!pubkey || !nostr) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      try {
        // Query badge events for this user
        const events = await nostr.query(
          [
            {
              kinds: [APP_KIND],
              '#t': ['golf', SUBTYPES.BADGE],
              '#player': [pubkey],
              limit: 500,
            },
          ],
          { signal }
        );

        // Parse badge events
        const badges = events
          .map((event) => parseBadgeEvent(event as NostrEvent))
          .filter(Boolean) as BadgeAward[];

        // Sort by issuedAt descending (newest first)
        badges.sort((a, b) => b.issuedAt - a.issuedAt);

        return badges;
      } catch (error) {
        console.error('Failed to fetch user badges:', error);
        throw new Error('Failed to load badges');
      }
    },
  });
}

/**
 * Hook to check if user has earned a specific badge
 * @param pubkey - The user's public key
 * @param badgeId - The badge ID to check
 */
export function useHasBadge(pubkey?: string, badgeId?: string): boolean {
  const { data: badges } = useUserBadges(pubkey);
  
  if (!badges || !badgeId) return false;
  
  return badges.some((badge) => badge.badgeId === badgeId);
}

/**
 * Hook to get count of badges by rarity
 * @param pubkey - The user's public key
 */
export function useBadgeStats(pubkey?: string) {
  const { data: badges } = useUserBadges(pubkey);

  if (!badges) {
    return {
      total: 0,
      common: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };
  }

  return {
    total: badges.length,
    common: badges.filter((b) => b.metadata.rarity === 'common').length,
    rare: badges.filter((b) => b.metadata.rarity === 'rare').length,
    epic: badges.filter((b) => b.metadata.rarity === 'epic').length,
    legendary: badges.filter((b) => b.metadata.rarity === 'legendary').length,
  };
}

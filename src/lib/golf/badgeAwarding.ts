import { BadgeService } from './badgeSystem';
import { createBadgeEvent } from './nostrEvents';
import type { GolfRound, BadgeAward } from './types';

/**
 * Award badges to players after a round is completed
 * Returns badge events ready to be published to Nostr
 */
export async function awardBadgesForRound(
  round: GolfRound,
  userPubkey: string,
  existingBadges: BadgeAward[]
): Promise<Array<Omit<ReturnType<typeof createBadgeEvent>, 'pubkey' | 'sig'>>> {
  const badgeService = new BadgeService();
  const badgeEvents: Array<Omit<ReturnType<typeof createBadgeEvent>, 'pubkey' | 'sig'>> = [];

  // Find the current user in the round players
  const currentPlayer = round.players.find((p) => p.playerId === userPubkey);
  if (!currentPlayer) {
    return badgeEvents;
  }

  // Check for newly earned badges
  const earnedBadges: BadgeAward[] = badgeService.checkAchievements(round, currentPlayer);

  // Filter out badges that have already been awarded
  const existingBadgeIds = new Set(existingBadges.map((b) => b.badgeId));
  const newBadges = earnedBadges.filter((badge: BadgeAward) => !existingBadgeIds.has(badge.badgeId));

  // Create badge events for new badges
  for (const badgeAward of newBadges) {
    const badgeEvent = createBadgeEvent(badgeAward, userPubkey);
    badgeEvents.push(badgeEvent);
  }

  return badgeEvents;
}

/**
 * Check for participation-based badges (first round, 10 rounds, etc.)
 * These are checked based on total round count
 */
export function checkParticipationBadges(
  totalRounds: number,
  existingBadges: BadgeAward[],
  userPubkey: string
): Array<Omit<ReturnType<typeof createBadgeEvent>, 'pubkey' | 'sig'>> {
  const badgeEvents: Array<Omit<ReturnType<typeof createBadgeEvent>, 'pubkey' | 'sig'>> = [];
  const existingBadgeIds = new Set(existingBadges.map((b) => b.badgeId));

  // Define participation milestones
  const milestones = [
    { badgeId: 'first-round', threshold: 1, name: 'First Round', description: 'Complete your first golf round', icon: '🎉', rarity: 'common' as const },
    { badgeId: 'ten-rounds', threshold: 10, name: 'Dedicated Golfer', description: 'Complete 10 rounds', icon: '🏌️‍♂️', rarity: 'rare' as const },
    { badgeId: 'fifty-rounds', threshold: 50, name: 'Golf Enthusiast', description: 'Complete 50 rounds', icon: '🏌️‍♀️', rarity: 'epic' as const },
    { badgeId: 'century-round', threshold: 100, name: 'Century Round', description: 'Complete 100 rounds', icon: '💯', rarity: 'legendary' as const },
  ];

  for (const milestone of milestones) {
    // Check if user reached this milestone and hasn't earned the badge yet
    if (totalRounds >= milestone.threshold && !existingBadgeIds.has(milestone.badgeId)) {
      const badgeAward: BadgeAward = {
        id: `badge-${milestone.badgeId}-${Date.now()}`,
        badgeId: milestone.badgeId,
        playerId: userPubkey,
        issuedAt: Date.now(),
        metadata: {
          badgeName: milestone.name,
          description: milestone.description,
          icon: milestone.icon,
          rarity: milestone.rarity,
          category: 'participation',
        },
      };

      const badgeEvent = createBadgeEvent(badgeAward, userPubkey);
      badgeEvents.push(badgeEvent);
      
      // Add to existing set so we don't award multiple milestones in one check
      existingBadgeIds.add(milestone.badgeId);
    }
  }

  return badgeEvents;
}

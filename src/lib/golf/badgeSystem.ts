import { BadgeDefinition, BadgeAward, BadgeCategory, GolfRound, PlayerInRound, HoleScore } from './types';

export class BadgeService {
  private badgeDefinitions: Map<string, BadgeDefinition> = new Map();

  constructor() {
    this.initializeBadgeDefinitions();
  }

  /**
   * Initialize all badge definitions
   */
  private initializeBadgeDefinitions(): void {
    const badges: BadgeDefinition[] = [
      // Scoring badges
      {
        id: 'hole-in-one',
        category: BadgeCategory.SCORING,
        name: 'Hole in One',
        description: 'Score a hole in one',
        icon: '🏆',
        criteria: {
          type: 'hole-score',
          conditions: { strokes: 1 }
        },
        rarity: 'legendary'
      },
      {
        id: 'eagle-or-better',
        category: BadgeCategory.SCORING,
        name: 'Eagle or Better',
        description: 'Score eagle or better on any hole',
        icon: '🦅',
        criteria: {
          type: 'hole-score',
          conditions: { strokes: (par: number) => par - 2 }
        },
        rarity: 'rare'
      },
      {
        id: 'breaking-90',
        category: BadgeCategory.SCORING,
        name: 'Breaking 90',
        description: 'Shoot 89 or better in an 18-hole round',
        icon: '🎯',
        criteria: {
          type: 'round-score',
          conditions: { maxScore: 89, holes: 18 }
        },
        rarity: 'rare'
      },
      {
        id: 'breaking-80',
        category: BadgeCategory.SCORING,
        name: 'Breaking 80',
        description: 'Shoot 79 or better in an 18-hole round',
        icon: '⭐',
        criteria: {
          type: 'round-score',
          conditions: { maxScore: 79, holes: 18 }
        },
        rarity: 'epic'
      },
      {
        id: 'par-or-better',
        category: BadgeCategory.SCORING,
        name: 'Par or Better',
        description: 'Shoot par or better on all 18 holes',
        icon: '🏌️',
        criteria: {
          type: 'round-score',
          conditions: { maxScore: 'par', holes: 18 }
        },
        rarity: 'epic'
      },
      // Participation badges
      {
        id: 'first-round',
        category: BadgeCategory.PARTICIPATION,
        name: 'First Round',
        description: 'Complete your first golf round',
        icon: '🎉',
        criteria: {
          type: 'participation',
          conditions: { rounds: 1 }
        },
        rarity: 'common'
      },
      {
        id: 'ten-rounds',
        category: BadgeCategory.PARTICIPATION,
        name: 'Dedicated Golfer',
        description: 'Complete 10 rounds',
        icon: '🏌️‍♂️',
        criteria: {
          type: 'participation',
          conditions: { rounds: 10 }
        },
        rarity: 'rare'
      },
      {
        id: 'fifty-rounds',
        category: BadgeCategory.PARTICIPATION,
        name: 'Golf Enthusiast',
        description: 'Complete 50 rounds',
        icon: '🏌️‍♀️',
        criteria: {
          type: 'participation',
          conditions: { rounds: 50 }
        },
        rarity: 'epic'
      },
      // Social badges
      {
        id: 'social-butterfly',
        category: BadgeCategory.SOCIAL,
        name: 'Social Butterfly',
        description: 'Share 10 achievements',
        icon: '🦋',
        criteria: {
          type: 'participation',
          conditions: { shares: 10 }
        },
        rarity: 'common'
      },
      {
        id: 'achievement-master',
        category: BadgeCategory.SOCIAL,
        name: 'Achievement Master',
        description: 'Earn 25 different badges',
        icon: '👑',
        criteria: {
          type: 'participation',
          conditions: { badgeCount: 25 }
        },
        rarity: 'legendary'
      },
      // Milestone badges
      {
        id: 'century-round',
        category: BadgeCategory.MILESTONES,
        name: 'Century Round',
        description: 'Complete 100 rounds',
        icon: '💯',
        criteria: {
          type: 'participation',
          conditions: { rounds: 100 }
        },
        rarity: 'legendary'
      },
      {
        id: 'perfect-front-nine',
        category: BadgeCategory.SCORING,
        name: 'Perfect Front Nine',
        description: 'Shoot par or better on the front nine',
        icon: '🎪',
        criteria: {
          type: 'round-score',
          conditions: { maxScore: 'par', holes: 9 }
        },
        rarity: 'rare'
      },
      {
        id: 'perfect-back-nine',
        category: BadgeCategory.SCORING,
        name: 'Perfect Back Nine',
        description: 'Shoot par or better on the back nine',
        icon: '🎭',
        criteria: {
          type: 'round-score',
          conditions: { maxScore: 'par', holes: 9 }
        },
        rarity: 'rare'
      }
    ];

    badges.forEach(badge => {
      this.badgeDefinitions.set(badge.id, badge);
    });
  }

  /**
   * Check for new badge achievements
   */
  checkAchievements(round: GolfRound, player: PlayerInRound): BadgeAward[] {
    const awards: BadgeAward[] = [];

    // Check all badge definitions
    for (const [badgeId, badge] of this.badgeDefinitions) {
      if (this.isBadgeAchieved(badge, round, player)) {
        awards.push(this.createBadgeAward(badgeId, player));
      }
    }

    return awards;
  }

  /**
   * Check if a specific badge is achieved
   */
  private isBadgeAchieved(badge: BadgeDefinition, round: GolfRound, player: PlayerInRound): boolean {
    const { type, conditions } = badge.criteria;

    switch (type) {
      case 'hole-score':
        return this.checkHoleScoreBadge(conditions, round, player);

      case 'round-score':
        return this.checkRoundScoreBadge(conditions, round, player);

      case 'participation':
        return this.checkParticipationBadge(conditions);

      default:
        return false;
    }
  }

  /**
   * Check hole score based badges
   */
  private checkHoleScoreBadge(conditions: Record<string, unknown>, round: GolfRound, player: PlayerInRound): boolean {
    const playerIndex = round.players.findIndex(p => p.playerId === player.playerId);
    if (playerIndex === -1) return false;

    const playerHoles = round.holes.filter((_, index) => index < player.scores.length);

    for (const hole of playerHoles) {
      // Check for specific stroke count
      if (conditions.strokes === hole.strokes) {
        return true;
      }

      // Check for strokes relative to par
      if (typeof conditions.strokes === 'function') {
        const targetStrokes = conditions.strokes(hole.par);
        if (hole.strokes <= targetStrokes) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check round score based badges
   */
  private checkRoundScoreBadge(conditions: Record<string, unknown>, round: GolfRound, player: PlayerInRound): boolean {
    const playerIndex = round.players.findIndex(p => p.playerId === player.playerId);
    if (playerIndex === -1) return false;

    const { maxScore, holes = 18 } = conditions;

    // Check if we have enough holes
    const holesNum = holes as number;
    const relevantHoles = (round.holes || []).slice(0, holesNum);
    if (relevantHoles.length < holesNum) return false;

    // Calculate total for the specified number of holes
    const total = player.scores.slice(0, holesNum).reduce((sum, score) => sum + score, 0);
    const totalPar = relevantHoles.reduce((sum, hole) => sum + ((hole as HoleScore).par || 0), 0);

    if (maxScore === 'par') {
      return total <= totalPar;
    }

    if (typeof maxScore === 'number') {
      return total <= maxScore;
    }

    return false;
  }

  /**
   * Check participation based badges
   */
  private checkParticipationBadge(conditions: Record<string, unknown>): boolean {
    // This would typically check against historical data
    // For now, we'll implement basic checks
    if (conditions.rounds) {
      // TODO: Implement round history checking
      return false;
    }

    if (conditions.shares) {
      // TODO: Implement social sharing history checking
      return false;
    }

    if (conditions.badgeCount) {
      // TODO: Implement badge count checking
      return false;
    }

    return false;
  }

  /**
   * Create a badge award
   */
  private createBadgeAward(badgeId: string, player: PlayerInRound): BadgeAward {
    const badge = this.badgeDefinitions.get(badgeId);
    if (!badge) {
      throw new Error(`Badge not found: ${badgeId}`);
    }

    return {
      id: `award-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      badgeId,
      playerId: player.playerId,
      issuedAt: Date.now(),
      metadata: {
        badgeName: badge.name,
        description: badge.description,
        icon: badge.icon,
        rarity: badge.rarity
      }
    };
  }

  /**
   * Get all badge definitions
   */
  getBadgeDefinitions(): BadgeDefinition[] {
    return Array.from(this.badgeDefinitions.values());
  }

  /**
   * Get badge definition by ID
   */
  getBadgeDefinition(id: string): BadgeDefinition | undefined {
    return this.badgeDefinitions.get(id);
  }

  /**
   * Get badges by category
   */
  getBadgesByCategory(category: BadgeCategory): BadgeDefinition[] {
    return Array.from(this.badgeDefinitions.values()).filter(badge => badge.category === category);
  }

  /**
   * Get badges by rarity
   */
  getBadgesByRarity(rarity: 'common' | 'rare' | 'epic' | 'legendary'): BadgeDefinition[] {
    return Array.from(this.badgeDefinitions.values()).filter(badge => badge.rarity === rarity);
  }

  /**
   * Get rarity display info
   */
  getRarityInfo(rarity: string): { color: string; name: string } {
    const rarityMap: Record<string, { color: string; name: string }> = {
      common: { color: 'text-gray-600', name: 'Common' },
      rare: { color: 'text-blue-600', name: 'Rare' },
      epic: { color: 'text-purple-600', name: 'Epic' },
      legendary: { color: 'text-yellow-600', name: 'Legendary' }
    };

    return rarityMap[rarity] || rarityMap.common;
  }
}
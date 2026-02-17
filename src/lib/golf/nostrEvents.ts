import { GolfRound, HoleScore, PlayerInRound, GameMode, GameSettings, APP_KIND, type BadgeAward } from './types';
import { SUBTYPES } from '@/lib/golfTags';
import type { Expense, ExpenseCategory, Currency, SplitMode } from './expenseTypes';

// Nostr event type
interface NostrEvent {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  sig?: string;
}

/**
 * Create a golf round event
 * @param round - The golf round data
 * @param roundCode - Optional 6-character share code for joining
 */
export function createRoundEvent(round: GolfRound, roundCode?: string): NostrEvent {
  const playerPubkeys = round.players.map(p => p.playerId);
  
  // Use a predictable d tag format that includes the join code for queryability
  // Format: "join-CODE" when sharing, or the round.id otherwise
  const dTagValue = roundCode ? `join-${roundCode}` : round.id;

  // Build scorecard image tags
  const scorecardImageTags = (round.metadata.scorecardImages || [])
    .filter(Boolean)
    .map(url => ['scorecard-image', url]);

  return {
    kind: APP_KIND,
    pubkey: round.players[0]?.playerId || '', // First player as creator
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', dTagValue],
      ['round-id', round.id], // Store actual round ID separately
      ['t', 'golf'],
      ['t', SUBTYPES.ROUND],
      ['title', round.metadata.courseName],
      ['course', round.metadata.courseName],
      ['date', new Date(round.date).toISOString().split('T')[0]!],
      ['players', ...playerPubkeys],
      ['game-mode', round.gameMode],
      ['status', round.status],
      ['holes', String(round.holes.length || 18)],
      ...(round.metadata.courseLocation ? [['location', round.metadata.courseLocation]] : []),
      ...(round.metadata.teeBox ? [['tee-box', round.metadata.teeBox]] : []),
      ...(typeof round.metadata.teeYardage !== 'undefined' ? [['tee-yardage', String(round.metadata.teeYardage)]] : []),
      ...(round.metadata.weather ? [['weather', round.metadata.weather]] : []),
      ...(round.metadata.origin ? [['origin', round.metadata.origin]] : []),
      ...(round.metadata.visibility ? [['visibility', round.metadata.visibility]] : []),
      ...scorecardImageTags,
    ],
    content: round.metadata.notes || '',
  };
}

/**
 * Create a hole score event
 */
export function createHoleScoreEvent(
  hole: HoleScore,
  roundId: string,
  player: PlayerInRound
): NostrEvent {
  return {
    kind: APP_KIND,
    pubkey: player.playerId,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${roundId}-hole-${hole.holeNumber}`],
      ['t', 'golf'],
      ['t', SUBTYPES.HOLE],
      ['round', roundId],
      ['hole', hole.holeNumber.toString()],
      ['par', hole.par.toString()],
      ['strokes', hole.strokes.toString()],
      ['putts', hole.putts.toString()],
      ['player', player.playerId],
      ['player-name', player.name],
      ...(hole.fairways ? [['fairways', 'true']] : [['fairways', 'false']]),
      ...(hole.greens ? [['greens', 'true']] : [['greens', 'false']]),
      ...(hole.sandTraps > 0 ? [['sand-traps', hole.sandTraps.toString()]] : []),
      ...(hole.penalties > 0 ? [['penalties', hole.penalties.toString()]] : []),
    ],
    content: hole.notes || '',
  };
}

/**
 * Create a player profile event for a round
 */
export function createPlayerEvent(
  player: PlayerInRound,
  roundId: string
): NostrEvent {
  return {
    kind: APP_KIND,
    pubkey: player.playerId,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${roundId}-player-${player.playerId}`],
      ['t', 'golf'],
      ['t', SUBTYPES.PLAYER],
      ['round', roundId],
      ['player', player.playerId],
      ['name', player.name],
      ['handicap', player.handicap.toString()],
      ['total', player.total.toString()],
      ['net-total', player.netTotal.toString()],
    ],
    content: '',
  };
}

/**
 * Create a game configuration event
 */
export function createGameEvent(
  gameMode: GameMode,
  players: PlayerInRound[],
  roundId: string,
  settings?: GameSettings
): NostrEvent {
  const handicaps = players.map(p => [p.playerId, p.handicap.toString()]);

  const tags: string[][] = [
    ['d', `${roundId}-game`],
    ['t', 'golf'],
    ['t', SUBTYPES.GAME],
    ['round', roundId],
    ['mode', gameMode],
    ...handicaps.flatMap(([player, handicap]) => handicap ? [['handicap', String(player), handicap]] : []),
  ];

  // If stableford settings provided, add explicit tag
  if (settings && typeof settings.modifiedStableford !== 'undefined') {
    tags.push(['stableford', settings.modifiedStableford ? 'modified' : 'standard']);
  }

  return {
    kind: APP_KIND,
    pubkey: players[0]?.playerId || '', // First player as creator
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  };
}

/**
 * Create a result event
 */
export function createResultEvent(
  round: GolfRound,
  winners: PlayerInRound[]
): NostrEvent {
  const winnerPubkeys = winners.map(w => w.playerId);

  return {
    kind: APP_KIND,
    pubkey: round.players[0]?.playerId || '', // First player as creator
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${round.id}-result`],
      ['t', 'golf'],
      ['t', SUBTYPES.RESULT],
      ['round', round.id],
      ['winners', ...winnerPubkeys],
      ['game-mode', round.gameMode],
      ['status', 'completed'],
    ],
    content: `Round completed at ${round.metadata.courseName}. Winners: ${winners.map(w => w.name).join(', ')}`,
  };
}

/**
 * Create a badge award event
 */
export function createBadgeAwardEvent(
  badgeId: string,
  playerId: string,
  metadata: Record<string, unknown>
): NostrEvent {
  return {
    kind: APP_KIND,
    pubkey: playerId,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `badge-${badgeId}-${Date.now()}`],
      ['t', 'golf'],
      ['t', SUBTYPES.BADGE],
      ['badge', badgeId],
      ['player', playerId],
      ['rarity', (metadata.rarity as string) || 'common'],
      ['issued-at', Math.floor(Date.now() / 1000).toString()],
    ],
    content: (metadata.description as string) || '',
  };
}

/**
 * Create an expense event
 */
export function createExpenseEvent(
  expense: Expense,
  roundId: string
): NostrEvent {
  const tags: string[][] = [
    ['d', `${roundId}-expense-${expense.id}`],
    ['t', 'golf'],
    ['t', SUBTYPES.EXPENSE],
    ['round', roundId],
    ['expense-id', expense.id],
    ['category', expense.category],
    ['amount', expense.amount.toString()],
    ['currency', expense.currency],
    ['amount-sats', expense.amountSats.toString()],
    ['paid-by', expense.paidByPlayerId],
    ['split-mode', expense.splitMode],
    ['created-at', expense.createdAt.toString()],
  ];

  // Add split-between players
  expense.splitBetweenPlayerIds.forEach(playerId => {
    tags.push(['split-between', playerId]);
  });

  // Add custom splits if present
  if (expense.customSplits) {
    expense.customSplits.forEach(split => {
      tags.push(['custom-split', split.playerId, split.value.toString()]);
    });
  }

  return {
    kind: APP_KIND,
    pubkey: expense.paidByPlayerId,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: expense.description,
  };
}

/**
 * Parse an expense event
 */
export function parseExpenseEvent(event: NostrEvent): Expense | null {
  try {
    const tags = event.tags as string[][];
    const expenseId = tags.find(t => t[0] === 'expense-id')?.[1];
    const category = tags.find(t => t[0] === 'category')?.[1] as ExpenseCategory;
    const amount = parseFloat(tags.find(t => t[0] === 'amount')?.[1] || '0');
    const currency = tags.find(t => t[0] === 'currency')?.[1] as Currency;
    const amountSats = parseInt(tags.find(t => t[0] === 'amount-sats')?.[1] || '0', 10);
    const paidBy = tags.find(t => t[0] === 'paid-by')?.[1];
    const splitMode = tags.find(t => t[0] === 'split-mode')?.[1] as SplitMode;
    const createdAt = parseInt(tags.find(t => t[0] === 'created-at')?.[1] || '0', 10);

    if (!expenseId || !category || !paidBy || !splitMode) {
      return null;
    }

    const splitBetweenPlayerIds = tags
      .filter(t => t[0] === 'split-between')
      .map(t => t[1])
      .filter(Boolean) as string[];

    const customSplits = tags
      .filter(t => t[0] === 'custom-split')
      .map(t => ({
        playerId: t[1],
        value: parseFloat(t[2] || '0')
      }))
      .filter(split => Boolean(split.playerId)) as Array<{ playerId: string; value: number }>;

    return {
      id: expenseId,
      category,
      description: event.content,
      amount,
      currency,
      amountSats,
      paidByPlayerId: paidBy,
      splitBetweenPlayerIds,
      splitMode,
      customSplits: customSplits.length > 0 ? customSplits : undefined,
      createdAt: createdAt || event.created_at * 1000,
    };
  } catch (error) {
    console.error('Failed to parse expense event:', error);
    return null;
  }
}

/**
 * Parse a round event
 */
export function parseRoundEvent(event: NostrEvent): GolfRound | null {
  if (event.kind !== APP_KIND) return null;

  // Require subtype tags
  const tValues = event.tags.filter((t: string[]) => t[0] === 't').map(([, v]) => v);
  if (!tValues.includes('golf') || !tValues.includes(SUBTYPES.ROUND)) return null;

  const tags = event.tags;
  const dTag = tags.find((t: string[]) => t[0] === 'd')?.[1];
  const roundIdTag = tags.find((t: string[]) => t[0] === 'round-id')?.[1];
  const titleTag = tags.find((t: string[]) => t[0] === 'title')?.[1];
  const courseTag = tags.find((t: string[]) => t[0] === 'course')?.[1];
  const dateTag = tags.find((t: string[]) => t[0] === 'date')?.[1];
  const gameModeTag = tags.find((t: string[]) => t[0] === 'game-mode')?.[1] as GameMode;
  const statusTag = tags.find((t: string[]) => t[0] === 'status')?.[1] as 'active' | 'completed' | 'cancelled';

  if (!dTag || !titleTag || !courseTag || !dateTag || !gameModeTag || !statusTag) {
    return null;
  }

  // Use round-id tag if present (for join-code rounds), otherwise use d tag
  const actualRoundId = roundIdTag || dTag;

  return {
    id: actualRoundId,
    courseId: courseTag,
    date: new Date(dateTag).getTime(),
    players: [], // Players would be parsed from separate events
    gameMode: gameModeTag,
    holes: [], // Holes would be parsed from separate events
    status: statusTag,
    metadata: {
      courseName: titleTag,
      courseLocation: tags.find((t: string[]) => t[0] === 'location')?.[1],
      teeBox: tags.find((t: string[]) => t[0] === 'tee-box')?.[1],
      weather: tags.find((t: string[]) => t[0] === 'weather')?.[1],
      notes: event.content,
    },
  };
}

/**
 * Parse a hole score event
 */
export function parseHoleScoreEvent(event: NostrEvent): HoleScore | null {
  if (event.kind !== APP_KIND) return null;
  // ensure subtype
  if (!event.tags.some(t => t[0] === 't' && t[1] === SUBTYPES.HOLE)) return null;

  const tags = event.tags;
  const holeTag = tags.find((t: string[]) => t[0] === 'hole')?.[1];
  const parTag = tags.find((t: string[]) => t[0] === 'par')?.[1];
  const strokesTag = tags.find((t: string[]) => t[0] === 'strokes')?.[1];
  const puttsTag = tags.find((t: string[]) => t[0] === 'putts')?.[1];
  const fairwaysTag = tags.find((t: string[]) => t[0] === 'fairways')?.[1];
  const greensTag = tags.find((t: string[]) => t[0] === 'greens')?.[1];
  const sandTrapsTag = tags.find((t: string[]) => t[0] === 'sand-traps')?.[1];
  const penaltiesTag = tags.find((t: string[]) => t[0] === 'penalties')?.[1];

  if (!holeTag || !parTag || !strokesTag || !puttsTag) {
    return null;
  }

  return {
    holeNumber: parseInt(holeTag),
    par: parseInt(parTag),
    strokes: parseInt(strokesTag),
    putts: parseInt(puttsTag),
    fairways: fairwaysTag === 'true',
    greens: greensTag === 'true',
    chips: 0, // Initialize chips field
    sandTraps: sandTrapsTag ? parseInt(sandTrapsTag) : 0,
    penalties: penaltiesTag ? parseInt(penaltiesTag) : 0,
    notes: event.content,
  };
}

/**
 * Generate a unique round ID
 */
/**
 * Create a badge award event
 * Awards a badge to a player for achieving a milestone
 */
export function createBadgeEvent(
  badgeAward: BadgeAward,
  playerId: string
): Omit<NostrEvent, 'pubkey' | 'sig'> {
  const metadata = badgeAward.metadata as {
    badgeName: string;
    description: string;
    icon: string;
    rarity: string;
    category?: string;
    roundId?: string;
  };

  return {
    kind: APP_KIND,
    created_at: Math.floor(badgeAward.issuedAt / 1000),
    tags: [
      ['d', badgeAward.id],
      ['t', 'golf'],
      ['t', SUBTYPES.BADGE],
      ['badge', badgeAward.badgeId],
      ['player', playerId],
      ['issued-at', badgeAward.issuedAt.toString()],
      ['badge-name', metadata.badgeName],
      ['description', metadata.description],
      ['icon', metadata.icon],
      ['rarity', metadata.rarity],
      ...(metadata.category ? [['category', metadata.category]] : []),
      ...(metadata.roundId ? [['round', metadata.roundId]] : []),
      ['alt', `Badge award: ${metadata.badgeName} - ${metadata.description}`],
    ],
    content: JSON.stringify({
      badgeId: badgeAward.badgeId,
      badgeName: metadata.badgeName,
      description: metadata.description,
      icon: metadata.icon,
      rarity: metadata.rarity,
      category: metadata.category,
      roundId: metadata.roundId,
    }),
  };
}

/**
 * Parse a badge award event
 * Reconstructs BadgeAward from Nostr event
 */
export function parseBadgeEvent(event: NostrEvent): BadgeAward | null {
  try {
    const tags = event.tags as string[][];
    
    const dTag = tags.find(t => t[0] === 'd')?.[1];
    const badgeId = tags.find(t => t[0] === 'badge')?.[1];
    const playerId = tags.find(t => t[0] === 'player')?.[1];
    const issuedAtStr = tags.find(t => t[0] === 'issued-at')?.[1];
    const badgeName = tags.find(t => t[0] === 'badge-name')?.[1];
    const description = tags.find(t => t[0] === 'description')?.[1];
    const icon = tags.find(t => t[0] === 'icon')?.[1];
    const rarity = tags.find(t => t[0] === 'rarity')?.[1];
    const category = tags.find(t => t[0] === 'category')?.[1];
    const roundId = tags.find(t => t[0] === 'round')?.[1];

    if (!dTag || !badgeId || !playerId || !issuedAtStr) {
      console.warn('Badge event missing required tags');
      return null;
    }

    const issuedAt = parseInt(issuedAtStr, 10);
    if (isNaN(issuedAt)) {
      console.warn('Invalid issued-at timestamp');
      return null;
    }

    return {
      id: dTag,
      badgeId,
      playerId,
      issuedAt,
      metadata: {
        badgeName: badgeName || badgeId,
        description: description || '',
        icon: icon || '🏆',
        rarity: rarity || 'common',
        category,
        roundId,
      },
    };
  } catch (error) {
    console.error('Failed to parse badge event:', error);
    return null;
  }
}

export function generateRoundId(): string {
  return `round-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate golf event tags
 */
export function validateGolfEvent(event: NostrEvent): boolean {
  if (!event || !event.tags || !Array.isArray(event.tags)) {
    return false;
  }

  // All golf events should be published under APP_KIND with subtype tags
  if (event.kind !== APP_KIND) return false;

  const subtype = event.tags.find((t: string[]) => t[0] === 't' && t[1] !== 'golf')?.[1];
  const hasD = !!event.tags.find((t: string[]) => t[0] === 'd' && t[1]);

  switch (subtype) {
    case SUBTYPES.ROUND:
      return hasD;
    case SUBTYPES.HOLE:
      return hasD && !!event.tags.find((t: string[]) => t[0] === 'hole' && t[1]);
    case SUBTYPES.PLAYER:
      return hasD && !!event.tags.find((t: string[]) => t[0] === 'player' && t[1]);
    case SUBTYPES.GAME:
      return hasD && !!event.tags.find((t: string[]) => t[0] === 'mode' && t[1]);
    case SUBTYPES.RESULT:
      return hasD && !!event.tags.find((t: string[]) => t[0] === 'round' && t[1]);
    case SUBTYPES.BADGE:
      return hasD && !!event.tags.find((t: string[]) => t[0] === 'badge' && t[1]);
    default:
      return false;
  }
}
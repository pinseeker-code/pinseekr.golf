import { GOLF_KINDS, GolfRound, HoleScore, PlayerInRound, GameMode, GameSettings } from './types';

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

  return {
    kind: GOLF_KINDS.ROUND,
    pubkey: round.players[0]?.playerId || '', // First player as creator
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', dTagValue],
      ['round-id', round.id], // Store actual round ID separately
      ['t', 'golf'],
      ['t', 'round'],
      ['title', round.metadata.courseName],
      ['course', round.metadata.courseName],
      ['date', new Date(round.date).toISOString().split('T')[0]],
      ['players', ...playerPubkeys],
      ['game-mode', round.gameMode],
      ['status', round.status],
      ...(round.metadata.courseLocation ? [['location', round.metadata.courseLocation]] : []),
      ...(round.metadata.teeBox ? [['tee-box', round.metadata.teeBox]] : []),
      ...(typeof round.metadata.teeYardage !== 'undefined' ? [['tee-yardage', String(round.metadata.teeYardage)]] : []),
      ...(round.metadata.weather ? [['weather', round.metadata.weather]] : []),
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
    kind: GOLF_KINDS.HOLE,
    pubkey: player.playerId,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${roundId}-hole-${hole.holeNumber}`],
      ['t', 'golf'],
      ['t', 'hole-score'],
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
    kind: GOLF_KINDS.PLAYER,
    pubkey: player.playerId,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${roundId}-player-${player.playerId}`],
      ['t', 'golf'],
      ['t', 'player'],
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
    ['t', 'game'],
    ['round', roundId],
    ['mode', gameMode],
    ...handicaps.flatMap(([player, handicap]) => [['handicap', player, handicap]]),
  ];

  // If stableford settings provided, add explicit tag
  if (settings && typeof settings.modifiedStableford !== 'undefined') {
    tags.push(['stableford', settings.modifiedStableford ? 'modified' : 'standard']);
  }

  return {
    kind: GOLF_KINDS.GAME,
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
    kind: GOLF_KINDS.RESULT,
    pubkey: round.players[0]?.playerId || '', // First player as creator
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${round.id}-result`],
      ['t', 'golf'],
      ['t', 'result'],
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
    kind: GOLF_KINDS.BADGE_AWARD,
    pubkey: playerId,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `badge-${badgeId}-${Date.now()}`],
      ['t', 'golf'],
      ['t', 'badge'],
      ['badge', badgeId],
      ['player', playerId],
      ['rarity', (metadata.rarity as string) || 'common'],
      ['issued-at', Math.floor(Date.now() / 1000).toString()],
    ],
    content: (metadata.description as string) || '',
  };
}

/**
 * Parse a round event
 */
export function parseRoundEvent(event: NostrEvent): GolfRound | null {
  if (event.kind !== GOLF_KINDS.ROUND) return null;

  const tags = event.tags;
  const dTag = tags.find((t: string[]) => t[0] === 'd')?.[1];
  const titleTag = tags.find((t: string[]) => t[0] === 'title')?.[1];
  const courseTag = tags.find((t: string[]) => t[0] === 'course')?.[1];
  const dateTag = tags.find((t: string[]) => t[0] === 'date')?.[1];
  const gameModeTag = tags.find((t: string[]) => t[0] === 'game-mode')?.[1] as GameMode;
  const statusTag = tags.find((t: string[]) => t[0] === 'status')?.[1] as 'active' | 'completed' | 'cancelled';

  if (!dTag || !titleTag || !courseTag || !dateTag || !gameModeTag || !statusTag) {
    return null;
  }

  return {
    id: dTag,
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
  if (event.kind !== GOLF_KINDS.HOLE) return null;

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

  // Check required tags based on kind
  switch (event.kind) {
    case GOLF_KINDS.ROUND:
      return !!event.tags.find((t: string[]) => t[0] === 'd' && t[1]);

    case GOLF_KINDS.HOLE:
      return !!event.tags.find((t: string[]) => t[0] === 'd' && t[1]) &&
             !!event.tags.find((t: string[]) => t[0] === 'hole' && t[1]);

    case GOLF_KINDS.PLAYER:
      return !!event.tags.find((t: string[]) => t[0] === 'd' && t[1]) &&
             !!event.tags.find((t: string[]) => t[0] === 'player' && t[1]);

    case GOLF_KINDS.GAME:
      return !!event.tags.find((t: string[]) => t[0] === 'd' && t[1]) &&
             !!event.tags.find((t: string[]) => t[0] === 'mode' && t[1]);

    case GOLF_KINDS.RESULT:
      return !!event.tags.find((t: string[]) => t[0] === 'd' && t[1]) &&
             !!event.tags.find((t: string[]) => t[0] === 'round' && t[1]);

    case GOLF_KINDS.BADGE_AWARD:
      return !!event.tags.find((t: string[]) => t[0] === 'd' && t[1]) &&
             !!event.tags.find((t: string[]) => t[0] === 'badge' && t[1]);

    default:
      return false;
  }
}
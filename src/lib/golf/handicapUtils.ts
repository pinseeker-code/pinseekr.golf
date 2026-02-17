/**
 * Handicap Utilities
 * 
 * Format-specific handicap adjustments for competitive balance
 * Based on standard golf rules but simplified for decentralized use
 */

export type GameFormat = 
  | 'stroke-play'
  | 'match-play'
  | 'best-ball'
  | 'scramble'
  | 'sixes'
  | 'nassau'
  | 'skins'
  | 'dots'
  | 'snake';

/**
 * Get handicap percentage for a game format
 * 
 * Different formats require different handicap adjustments for fair play:
 * - Stroke Play: 100% (standard)
 * - Match Play: 100% (but uses differential between players)
 * - Best Ball: 90% (team format, slightly easier)
 * - Scramble: 35% of lowest + 15% of others (team picks best shot)
 * - Nassau: 100% (stroke play in 3 sections)
 * - Skins: 100% (hole-by-hole competition)
 * - Side games (Dots, Snake): 100% (piggyback on main format)
 */
export function getHandicapPercentage(format: GameFormat): number {
  switch (format) {
    case 'stroke-play':
    case 'match-play':
    case 'nassau':
    case 'skins':
    case 'dots':
    case 'snake':
    case 'sixes':
      return 1.0; // 100%
    
    case 'best-ball':
      return 0.9; // 90%
    
    case 'scramble':
      return 0.35; // 35% (for lowest handicap)
    
    default:
      return 1.0;
  }
}

/**
 * Calculate playing handicap for a format
 * 
 * @param courseHandicap - Player's handicap (can be raw handicap for simplified use)
 * @param format - Game format
 * @returns Adjusted handicap for the format
 */
export function calculatePlayingHandicap(
  courseHandicap: number,
  format: GameFormat
): number {
  const percentage = getHandicapPercentage(format);
  return Math.round(courseHandicap * percentage);
}

/**
 * Calculate playing handicaps for scramble team
 * 
 * Scramble has special rules: 35% of lowest, 15% of others
 * 
 * @param handicaps - Array of player handicaps in team
 * @returns Array of adjusted handicaps in same order
 */
export function calculateScrambleHandicaps(handicaps: number[]): number[] {
  if (handicaps.length === 0) return [];
  
  const sorted = [...handicaps].sort((a, b) => a - b);
  const lowest = sorted[0];
  
  return handicaps.map(hcp => {
    if (hcp === lowest) {
      return Math.round(hcp * 0.35); // 35% for lowest
    }
    return Math.round(hcp * 0.15); // 15% for others
  });
}

/**
 * Calculate match play handicap differential
 * 
 * In match play, only the difference in handicaps matters.
 * Lower handicap player plays scratch, higher gets strokes.
 * 
 * @param handicap1 - First player's handicap
 * @param handicap2 - Second player's handicap
 * @returns [player1Adjusted, player2Adjusted]
 */
export function calculateMatchPlayDifferential(
  handicap1: number,
  handicap2: number
): [number, number] {
  const diff = Math.abs(handicap1 - handicap2);
  
  if (handicap1 < handicap2) {
    return [0, diff]; // Player 1 plays scratch, Player 2 gets strokes
  } else if (handicap2 < handicap1) {
    return [diff, 0]; // Player 2 plays scratch, Player 1 gets strokes
  }
  
  return [0, 0]; // Equal handicaps
}

/**
 * Apply format-specific adjustments to multiple players
 * 
 * @param handicaps - Map of playerId to handicap
 * @param format - Game format
 * @param useMatchDifferential - For match play, use differential instead of raw handicaps
 * @returns Map of playerId to adjusted handicap
 */
export function adjustHandicapsForFormat(
  handicaps: Record<string, number>,
  format: GameFormat,
  useMatchDifferential: boolean = false
): Record<string, number> {
  const playerIds = Object.keys(handicaps);
  
  // Special handling for match play with differential
  if (format === 'match-play' && useMatchDifferential && playerIds.length === 2) {
    const player1Id = playerIds[0];
    const player2Id = playerIds[1];
    
    if (!player1Id || !player2Id) {
      return handicaps; // Fallback to original if somehow undefined
    }
    
    const [adj1, adj2] = calculateMatchPlayDifferential(
      handicaps[player1Id] ?? 0,
      handicaps[player2Id] ?? 0
    );
    return {
      [player1Id]: adj1,
      [player2Id]: adj2,
    };
  }
  
  // Special handling for scramble
  if (format === 'scramble') {
    const hcpArray = playerIds.map(id => handicaps[id] ?? 0);
    const adjusted = calculateScrambleHandicaps(hcpArray);
    const result: Record<string, number> = {};
    playerIds.forEach((id, idx) => {
      const adjustedValue = adjusted[idx];
      if (adjustedValue !== undefined) {
        result[id] = adjustedValue;
      }
    });
    return result;
  }
  
  // Standard percentage adjustment for other formats
  const percentage = getHandicapPercentage(format);
  const result: Record<string, number> = {};
  for (const [playerId, hcp] of Object.entries(handicaps)) {
    result[playerId] = Math.round(hcp * percentage);
  }
  
  return result;
}

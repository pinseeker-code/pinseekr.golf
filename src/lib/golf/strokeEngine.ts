// Core stroke play engine implementation
export interface CoreRoundData {
  players: string[];
  strokes: { [playerId: string]: { [hole: number]: number } };
  handicap?: {
    pops: { [playerId: string]: { [hole: number]: number } };
  };
  course: {
    holes: { [hole: number]: { par: number; strokeIndex: number } };
  };
}

export interface StrokeConfig {
  useNet: boolean;
  maxScoreRule?: MaxScoreRule;
}

export interface MaxScoreRule {
  type: 'double-bogey' | 'triple-bogey' | 'par-plus' | 'fixed';
  value?: number; // for 'par-plus' (e.g., par+2) or 'fixed' scoring
}

export interface PlayerTotals {
  gross: number;
  net: number;
}

export interface HoleBreakdown {
  gross: number;
  net: number;
}

export interface StrokeBreakdown {
  totals: { [playerId: string]: PlayerTotals };
  leaderboard: LeaderboardEntry[];
  holeByHole: { [playerId: string]: { [hole: number]: HoleBreakdown } };
}

export interface LeaderboardEntry {
  playerId: string;
  position: number;
  score: number;
  scoreType: 'gross' | 'net';
  totalStrokes: number;
  netStrokes: number;
}

export interface StrokeLayerResult {
  name: string;
  ledger: never[]; // stroke play has no payouts by default
  breakdown: StrokeBreakdown;
}

/**
 * Apply maximum score rules (e.g., double bogey max, ESC rules)
 */
export function applyMaxScore(netScore: number, rule: MaxScoreRule, hole: { par: number }): number {
  switch (rule.type) {
    case 'double-bogey':
      return Math.min(netScore, hole.par + 2);
    
    case 'triple-bogey':
      return Math.min(netScore, hole.par + 3);
    
    case 'par-plus': {
      const maxScore = hole.par + (rule.value || 2);
      return Math.min(netScore, maxScore);
    }
    
    case 'fixed':
      return Math.min(netScore, rule.value || 10);
    
    default:
      return netScore;
  }
}

/**
 * Rank players by their scores (ascending order - lower is better)
 */
export function rankPlayers(totals: { [playerId: string]: PlayerTotals }, useNet: boolean): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = Object.entries(totals).map(([playerId, scores]) => ({
    playerId,
    position: 0, // will be set below
    score: useNet ? scores.net : scores.gross,
    scoreType: useNet ? 'net' as const : 'gross' as const,
    totalStrokes: scores.gross,
    netStrokes: scores.net
  }));

  // Sort by score (ascending - lower scores are better)
  entries.sort((a, b) => a.score - b.score);

  // Assign positions (handle ties)
  let currentPosition = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].score !== entries[i - 1].score) {
      currentPosition = i + 1;
    }
    entries[i].position = currentPosition;
  }

  return entries;
}

/**
 * Calculate handicap "pops" (strokes received) for each hole
 */
export function calculatePops(playerHandicap: number, holes: { [hole: number]: { strokeIndex: number } }): { [hole: number]: number } {
  const pops: { [hole: number]: number } = {};
  
  // Standard 18-hole handicap distribution
  for (let hole = 1; hole <= 18; hole++) {
    const strokeIndex = holes[hole]?.strokeIndex || hole;
    
    // Player gets 1 stroke on holes where their handicap is >= stroke index
    // Plus additional strokes if handicap > 18
    const baseStrokes = playerHandicap >= strokeIndex ? 1 : 0;
    const extraStrokes = playerHandicap > 18 ? Math.floor((playerHandicap - strokeIndex) / 18) : 0;
    
    pops[hole] = baseStrokes + extraStrokes;
  }
  
  return pops;
}

/**
 * Main stroke play engine function
 */
export function strokeEngine(data: CoreRoundData, cfg: StrokeConfig): StrokeLayerResult {
  const totals: { [playerId: string]: PlayerTotals } = {};
  const holeByHole: { [playerId: string]: { [hole: number]: HoleBreakdown } } = {};

  for (const playerId of data.players) {
    let gross = 0;
    let net = 0;
    holeByHole[playerId] = {};

    for (let hole = 1; hole <= 18; hole++) {
      // Get gross score for this hole
      const score = data.strokes[playerId]?.[hole] || 0;
      gross += score;

      // Calculate net score
      const pops = cfg.useNet ? (data.handicap?.pops[playerId]?.[hole] || 0) : 0;
      let netScore = score - pops;

      // Apply maximum score rule if specified
      if (cfg.maxScoreRule && data.course.holes[hole]) {
        netScore = applyMaxScore(netScore, cfg.maxScoreRule, data.course.holes[hole]);
      }

      net += netScore;
      
      // Store hole breakdown
      holeByHole[playerId][hole] = {
        gross: score,
        net: netScore
      };
    }

    totals[playerId] = { gross, net };
  }

  // Generate leaderboard
  const leaderboard = rankPlayers(totals, cfg.useNet);

  return {
    name: "Stroke Play",
    ledger: [], // no payouts by default
    breakdown: {
      totals,
      leaderboard,
      holeByHole
    }
  };
}

/**
 * Helper function to convert existing PlayerInRound data to CoreRoundData format
 */
export function convertToRoundData(
  players: Array<{ playerId: string; scores: number[]; handicap: number }>,
  courseData?: { holes: { [hole: number]: { par: number; strokeIndex: number } } }
): CoreRoundData {
  const strokes: { [playerId: string]: { [hole: number]: number } } = {};
  const pops: { [playerId: string]: { [hole: number]: number } } = {};
  
  // Default course data if not provided
  const defaultCourse = {
    holes: Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [
        i + 1,
        { par: 4, strokeIndex: i + 1 } // Default: all par 4, stroke index = hole number
      ])
    )
  };

  const course = courseData || defaultCourse;

  for (const player of players) {
    // Convert scores array to hole-indexed object
    strokes[player.playerId] = {};
    for (let hole = 1; hole <= 18; hole++) {
      strokes[player.playerId][hole] = player.scores[hole - 1] || 0;
    }

    // Calculate handicap pops for each hole
    pops[player.playerId] = calculatePops(player.handicap, course.holes);
  }

  return {
    players: players.map(p => p.playerId),
    strokes,
    handicap: { pops },
    course
  };
}

/**
 * Utility function to format leaderboard display
 */
export function formatLeaderboard(leaderboard: LeaderboardEntry[]): string[] {
  return leaderboard.map(entry => {
    const position = entry.position === 1 ? '🏆' : `${entry.position}`;
    const scoreDisplay = entry.scoreType === 'net' ? `${entry.score} (net)` : `${entry.score}`;
    return `${position}. Player ${entry.playerId}: ${scoreDisplay}`;
  });
}

/**
 * Calculate statistics for a round
 */
export interface RoundStats {
  playerId: string;
  grossTotal: number;
  netTotal: number;
  birdiesOrBetter: number;
  pars: number;
  bogeys: number;
  doubleBogeyOrWorse: number;
  averageScore: number;
}

export function calculateRoundStats(
  playerId: string,
  holeData: { [hole: number]: HoleBreakdown },
  courseData: { holes: { [hole: number]: { par: number } } }
): RoundStats {
  let grossTotal = 0;
  let netTotal = 0;
  let birdiesOrBetter = 0;
  let pars = 0;
  let bogeys = 0;
  let doubleBogeyOrWorse = 0;

  for (let hole = 1; hole <= 18; hole++) {
    const holeBreakdown = holeData[hole];
    const holePar = courseData.holes[hole]?.par || 4;
    
    if (holeBreakdown) {
      grossTotal += holeBreakdown.gross;
      netTotal += holeBreakdown.net;

      // Score relative to par (using gross score)
      const scoreToPar = holeBreakdown.gross - holePar;
      
      if (scoreToPar <= -1) birdiesOrBetter++;
      else if (scoreToPar === 0) pars++;
      else if (scoreToPar === 1) bogeys++;
      else doubleBogeyOrWorse++;
    }
  }

  return {
    playerId,
    grossTotal,
    netTotal,
    birdiesOrBetter,
    pars,
    bogeys,
    doubleBogeyOrWorse,
    averageScore: grossTotal / 18
  };
}

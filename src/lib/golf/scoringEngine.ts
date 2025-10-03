import { GameMode, GameConfig, PlayerInRound, HoleScore } from './types';

// Payment and settlement interfaces
export interface Payable {
  from: string;
  to: string;
  amount: number;
  memo?: string;
}

export interface LayerResult {
  name: string;
  ledger: Payable[];
  breakdown: MatchBreakdown[] | SkinBreakdown[];
}

export interface MatchBreakdown {
  match: string;
  winner?: string;
  result?: string;
  totals?: { [playerId: string]: number };
}

export interface SkinBreakdown {
  hole: number;
  winner?: string;
  result?: string;
  skins?: number;
  skinsVoided?: number;
  scores?: { [playerId: string]: number };
}

export interface WagerConfig {
  useNet: boolean;
  unitSats: number;
  carryCap?: number;
}

export interface Match {
  name: string;
  holes: number[];
}

export interface ScoreData {
  [playerId: string]: {
    scores: number[];
    handicap: number;
    netScores?: number[];
  };
}

export class ScoringEngine {
  private gameConfig: GameConfig;

  constructor(gameConfig: GameConfig) {
    this.gameConfig = gameConfig;
  }

  /**
   * Calculate USGA handicap
   */
  calculateHandicap(playerStrokes: number, courseRating: number, slope: number): number {
    if (slope <= 0 || courseRating <= 0) {
      return 0;
    }
    return (playerStrokes - courseRating) * 113 / slope;
  }

  /**
   * Calculate net score from gross score and handicap
   */
  calculateNetScore(grossScore: number, handicap: number): number {
    return Math.max(0, grossScore - Math.floor(handicap));
  }

  /**
   * Calculate total score for a player
   */
  calculatePlayerTotal(player: PlayerInRound, holes: HoleScore[]): number {
    return holes
      .filter(hole => hole.holeNumber <= player.scores.length)
      .reduce((total, hole, index) => total + player.scores[index], 0);
  }

  /**
   * Calculate net total for a player
   */
  calculatePlayerNetTotal(player: PlayerInRound, holes: HoleScore[]): number {
    const grossTotal = this.calculatePlayerTotal(player, holes);
    const netScore = this.calculateNetScore(grossTotal, player.handicap);
    return netScore;
  }

  /**
   * Determine winners based on game mode
   */
  determineWinners(players: PlayerInRound[]): PlayerInRound[] {
    switch (this.gameConfig.mode) {
      case GameMode.STROKE_PLAY:
        return players.sort((a, b) => a.total - b.total);

      case GameMode.MATCH_PLAY:
        return this.calculateMatchPlayResults(players);

      case GameMode.SKINS:
        return this.calculateSkinsResults(players);

      case GameMode.NASSAU:
        return this.calculateNassauResults(players);

      case GameMode.POINTS:
        return this.calculatePointsResults(players);

      default:
        return players.sort((a, b) => a.total - b.total);
    }
  }

  /**
   * Calculate match play results
   */
  private calculateMatchPlayResults(players: PlayerInRound[]): PlayerInRound[] {
    // Simple match play: lowest score wins
    return players.sort((a, b) => a.total - b.total);
  }

  /**
   * Calculate skins game results
   */
  private calculateSkinsResults(players: PlayerInRound[]): PlayerInRound[] {
    // For skins, we need hole-by-hole comparison
    // This is a simplified version - full implementation would track individual hole wins
    return players.sort((a, b) => a.total - b.total);
  }

  /**
   * Calculate nassau game results
   */
  private calculateNassauResults(players: PlayerInRound[]): PlayerInRound[] {
    // Nassau is typically front 9, back 9, and total
    // Simplified: just sort by total
    return players.sort((a, b) => a.total - b.total);
  }

  /**
   * Calculate points game results
   */
  private calculatePointsResults(players: PlayerInRound[]): PlayerInRound[] {
    // Points system: lower scores get more points
    return players.sort((a, b) => a.total - b.total);
  }

  /**
   * Calculate course handicap
   */
  calculateCourseHandicap(playerHandicap: number, slope: number, courseRating: number): number {
    if (slope <= 0 || courseRating <= 0) {
      return playerHandicap;
    }

    const differential = (playerHandicap * 113) / slope;
    return Math.max(0, differential + (courseRating - 113));
  }

  /**
   * Calculate stroke index for handicapping
   */
  calculateStrokeIndex(holeNumber: number, holes: number): number {
    // Simplified stroke index calculation
    // In reality, this would be based on the specific course's stroke index table
    if (holes <= 18) {
      return Math.ceil(holes / 2) - Math.floor((holeNumber - 1) / 2);
    }
    return holeNumber; // Simplified for >18 holes
  }

  /**
   * Validate hole scores
   */
  validateHoleScore(hole: HoleScore, par: number): boolean {
    // Basic validation
    if (hole.strokes < 0 || hole.putts < 0) {
      return false;
    }

    if (hole.putts > hole.strokes) {
      return false;
    }

    // Check for reasonable maximum strokes (triple bogey + 2)
    const maxStrokes = par + 5;
    if (hole.strokes > maxStrokes) {
      return false;
    }

    return true;
  }

  /**
   * Calculate fairways hit percentage
   */
  calculateFairwaysHit(holes: HoleScore[]): number {
    const fairways = holes.filter(hole => hole.fairways).length;
    return holes.length > 0 ? (fairways / holes.length) * 100 : 0;
  }

  /**
   * Calculate greens in regulation percentage
   */
  calculateGreensInRegulation(holes: HoleScore[]): number {
    const greens = holes.filter(hole => hole.greens).length;
    return holes.length > 0 ? (greens / holes.length) * 100 : 0;
  }

  /**
   * Calculate sand saves percentage
   */
  calculateSandSaves(holes: HoleScore[]): number {
    const sandTraps = holes.filter(hole => hole.sandTraps > 0).length;
    const sandSaves = holes.filter(hole => hole.sandTraps > 0 && hole.putts <= 2).length;

    return sandTraps > 0 ? (sandSaves / sandTraps) * 100 : 0;
  }

  /**
   * Get game mode display name
   */
  getGameModeDisplayName(mode: GameMode): string {
    const modeNames: Record<GameMode, string> = {
      [GameMode.STROKE_PLAY]: 'Stroke Play',
      [GameMode.SKINS]: 'Skins',
      [GameMode.NASSAU]: 'Nassau',
      [GameMode.MATCH_PLAY]: 'Match Play',
      [GameMode.WOLF]: 'Wolf',
      [GameMode.POINTS]: 'Points',
      [GameMode.VEGAS]: 'Vegas',
      [GameMode.SIXES]: 'Sixes',
      [GameMode.DOTS]: 'Dots',
      [GameMode.ROLLING_STROKES]: 'Rolling Strokes',
      [GameMode.SNAKE]: 'Snake'
    };

    return modeNames[mode] || mode;
  }
}

// Wager Processing Engine - Based on your pseudocode

/**
 * Helper function to compute totals for a set of holes
 */
export function computeTotals(data: ScoreData, holes: number[], useNet: boolean): { [playerId: string]: number } {
  const totals: { [playerId: string]: number } = {};
  
  for (const [playerId, playerData] of Object.entries(data)) {
    let total = 0;
    for (const hole of holes) {
      const holeIndex = hole - 1; // Convert to 0-based index
      if (useNet && playerData.netScores) {
        total += playerData.netScores[holeIndex] || 0;
      } else {
        total += playerData.scores[holeIndex] || 0;
      }
    }
    totals[playerId] = total;
  }
  
  return totals;
}

/**
 * Find the winner from totals (null if tie)
 */
export function findWinner(totals: { [playerId: string]: number }): string | null {
  const playerIds = Object.keys(totals);
  if (playerIds.length === 0) return null;
  
  let winnerIds: string[] = [];
  let bestScore = Infinity;
  
  for (const [playerId, score] of Object.entries(totals)) {
    if (score < bestScore) {
      bestScore = score;
      winnerIds = [playerId];
    } else if (score === bestScore) {
      winnerIds.push(playerId);
    }
  }
  
  // Return null if tie (multiple winners)
  return winnerIds.length === 1 ? winnerIds[0] : null;
}

/**
 * Get hole scores for a specific hole
 */
export function holeScores(data: ScoreData, hole: number, useNet: boolean): { [playerId: string]: number } {
  const scores: { [playerId: string]: number } = {};
  const holeIndex = hole - 1; // Convert to 0-based index
  
  for (const [playerId, playerData] of Object.entries(data)) {
    if (useNet && playerData.netScores) {
      scores[playerId] = playerData.netScores[holeIndex] || 0;
    } else {
      scores[playerId] = playerData.scores[holeIndex] || 0;
    }
  }
  
  return scores;
}

/**
 * Find unique low score (null if tie)
 */
export function findUniqueLow(scores: { [playerId: string]: number }): string | null {
  const playerIds = Object.keys(scores);
  if (playerIds.length === 0) return null;
  
  let winnerIds: string[] = [];
  let bestScore = Infinity;
  
  for (const [playerId, score] of Object.entries(scores)) {
    if (score < bestScore) {
      bestScore = score;
      winnerIds = [playerId];
    } else if (score === bestScore) {
      winnerIds.push(playerId);
    }
  }
  
  // Return winner only if unique (no ties)
  return winnerIds.length === 1 ? winnerIds[0] : null;
}

/**
 * Nassau processor - Front 9, Back 9, Overall
 */
export function nassauProcessor(data: ScoreData, cfg: WagerConfig): LayerResult {
  const matches: Match[] = [
    { name: "Front 9", holes: Array.from({ length: 9 }, (_, i) => i + 1) },
    { name: "Back 9", holes: Array.from({ length: 9 }, (_, i) => i + 10) },
    { name: "Overall", holes: Array.from({ length: 18 }, (_, i) => i + 1) }
  ];
  
  const ledger: Payable[] = [];
  const breakdown: MatchBreakdown[] = [];
  const playerIds = Object.keys(data);

  for (const match of matches) {
    const totals = computeTotals(data, match.holes, cfg.useNet);
    const winnerId = findWinner(totals);
    
    if (!winnerId) {
      breakdown.push({ match: match.name, result: "Push", totals });
      continue;
    }

    // Each loser pays the winner
    for (const playerId of playerIds) {
      if (playerId !== winnerId) {
        ledger.push({
          from: playerId,
          to: winnerId,
          amount: cfg.unitSats,
          memo: `${match.name} - Nassau`
        });
      }
    }
    
    breakdown.push({ 
      match: match.name, 
      winner: winnerId,
      totals: totals
    });
  }

  return { name: "Nassau", ledger, breakdown };
}

/**
 * Skins processor - Hole by hole with carryovers
 */
export function skinsProcessor(data: ScoreData, cfg: WagerConfig): LayerResult {
  let carry = 0;
  const ledger: Payable[] = [];
  const breakdown: SkinBreakdown[] = [];
  const playerIds = Object.keys(data);

  for (let hole = 1; hole <= 18; hole++) {
    carry++;
    const scores = holeScores(data, hole, cfg.useNet);
    const winnerId = findUniqueLow(scores);
    
    if (winnerId) {
      const skinsWon = carry;
      const totalAmount = cfg.unitSats * skinsWon;
      
      // Each other player pays the winner their share
      for (const playerId of playerIds) {
        if (playerId !== winnerId) {
          ledger.push({
            from: playerId,
            to: winnerId,
            amount: totalAmount / (playerIds.length - 1), // Split evenly among losers
            memo: `Hole ${hole} - ${skinsWon} skin${skinsWon > 1 ? 's' : ''}`
          });
        }
      }
      
      breakdown.push({ 
        hole: hole, 
        winner: winnerId, 
        skins: skinsWon,
        scores: scores
      });
      carry = 0;
    } else {
      breakdown.push({
        hole: hole,
        result: "Tie - carry over",
        scores: scores
      });
      
      // Handle carry cap if specified
      if (cfg.carryCap && carry >= cfg.carryCap) {
        // Force payout - skins are voided (no payment)
        breakdown.push({
          hole: hole,
          result: `Carry cap reached (${cfg.carryCap}), skins voided`,
          skinsVoided: carry
        });
        carry = 0;
      }
    }
  }

  return { name: "Skins", ledger, breakdown };
}

/**
 * Netting function to optimize payments
 */
export function netting(ledger: Payable[]): Payable[] {
  const balances: { [playerId: string]: number } = {};
  
  // Calculate net balances
  for (const payment of ledger) {
    balances[payment.from] = (balances[payment.from] || 0) - payment.amount;
    balances[payment.to] = (balances[payment.to] || 0) + payment.amount;
  }

  // Separate creditors and debtors
  const creditors = Object.entries(balances)
    .filter(([_, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]); // Sort by amount descending
    
  const debtors = Object.entries(balances)
    .filter(([_, amount]) => amount < 0)
    .sort((a, b) => a[1] - b[1]); // Sort by amount ascending (most negative first)

  const result: Payable[] = [];

  // Create optimized payment list
  while (creditors.length && debtors.length) {
    const [debtorId, debtAmount] = debtors[0];
    const [creditorId, creditAmount] = creditors[0];

    const paymentAmount = Math.min(creditAmount, -debtAmount);
    
    result.push({
      from: debtorId,
      to: creditorId,
      amount: paymentAmount,
      memo: "Net settlement"
    });

    // Update balances
    const newDebtAmount = debtAmount + paymentAmount;
    const newCreditAmount = creditAmount - paymentAmount;

    if (newDebtAmount === 0) {
      debtors.shift();
    } else {
      debtors[0][1] = newDebtAmount;
    }

    if (newCreditAmount === 0) {
      creditors.shift();
    } else {
      creditors[0][1] = newCreditAmount;
    }
  }

  return result;
}

/**
 * Main wager processing function
 */
export function processRoundWagers(
  players: PlayerInRound[], 
  gameConfigs: { [gameName: string]: WagerConfig }
): { [gameName: string]: LayerResult } {
  // Convert player data to ScoreData format
  const data: ScoreData = {};
  
  for (const player of players) {
    // Calculate net scores if needed
    const netScores = player.scores.map(score => 
      Math.max(0, score - Math.floor(player.handicap / 18))
    );
    
    data[player.playerId] = {
      scores: player.scores || Array(18).fill(0),
      handicap: player.handicap || 0,
      netScores: netScores
    };
  }

  const results: { [gameName: string]: LayerResult } = {};

  // Process each configured game
  for (const [gameName, config] of Object.entries(gameConfigs)) {
    switch (gameName.toLowerCase()) {
      case 'nassau':
        results[gameName] = nassauProcessor(data, config);
        break;
      case 'skins':
        results[gameName] = skinsProcessor(data, config);
        break;
      default:
        console.warn(`Unknown wager type: ${gameName}`);
    }
  }

  return results;
}

/**
 * Utility function to get net settlement for all games
 */
export function getNetSettlement(results: { [gameName: string]: LayerResult }): Payable[] {
  const allPayments: Payable[] = [];
  
  // Combine all ledgers
  for (const result of Object.values(results)) {
    allPayments.push(...result.ledger);
  }
  
  // Return netted payments
  return netting(allPayments);
}
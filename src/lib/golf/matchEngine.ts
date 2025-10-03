import { type CoreRoundData } from './strokeEngine';

export interface MatchConfig {
  useNet: boolean;
  format?: 'head-to-head' | 'best-ball' | 'scramble';
}

export interface MatchHoleResult {
  hole: number;
  winner: string | null; // null for tie
  margin: number; // how many strokes difference
  scores: { [playerId: string]: number };
  netScores: { [playerId: string]: number };
}

export interface MatchStatus {
  leader: string | null;
  margin: number; // holes up
  holesRemaining: number;
  isComplete: boolean;
  winner: string | null;
}

export interface MatchTotals {
  [playerId: string]: {
    holesWon: number;
    holesLost: number;
    holesTied: number;
    currentStatus: 'up' | 'down' | 'tied';
    margin: number; // positive if up, negative if down
  };
}

export interface MatchResult {
  name: string;
  format: string;
  holeByHole: MatchHoleResult[];
  totals: MatchTotals;
  finalStatus: MatchStatus;
  matchSummary: string;
}

/**
 * Process a match play round between players
 */
export function matchEngine(data: CoreRoundData, config: MatchConfig): MatchResult {
  const { players, strokes, handicap } = data;
  
  if (players.length !== 2) {
    throw new Error('Match play requires exactly 2 players');
  }

  const [player1, player2] = players;
  const holeResults: MatchHoleResult[] = [];
  let player1HolesWon = 0;
  let player2HolesWon = 0;
  let tiedHoles = 0;

  // Process each hole
  for (let hole = 1; hole <= 18; hole++) {
    const player1Strokes = strokes[player1]?.[hole] || 0;
    const player2Strokes = strokes[player2]?.[hole] || 0;

    // Calculate net scores if using handicap
    let player1Net = player1Strokes;
    let player2Net = player2Strokes;
    
    if (config.useNet && handicap?.pops) {
      const player1Pops = handicap.pops[player1]?.[hole] || 0;
      const player2Pops = handicap.pops[player2]?.[hole] || 0;
      player1Net = player1Strokes - player1Pops;
      player2Net = player2Strokes - player2Pops;
    }

    // Determine hole winner
    let winner: string | null = null;
    let margin = 0;
    
    if (player1Net < player2Net) {
      winner = player1;
      margin = player2Net - player1Net;
      player1HolesWon++;
    } else if (player2Net < player1Net) {
      winner = player2;
      margin = player1Net - player2Net;
      player2HolesWon++;
    } else {
      // Tie
      tiedHoles++;
    }

    holeResults.push({
      hole,
      winner,
      margin,
      scores: { [player1]: player1Strokes, [player2]: player2Strokes },
      netScores: { [player1]: player1Net, [player2]: player2Net }
    });
  }

  // Calculate final status
  const player1Margin = player1HolesWon - player2HolesWon;
  const player2Margin = player2HolesWon - player1HolesWon;
  
  let finalWinner: string | null = null;
  const finalMargin = Math.abs(player1Margin);
  
  if (player1HolesWon > player2HolesWon) {
    finalWinner = player1;
  } else if (player2HolesWon > player1HolesWon) {
    finalWinner = player2;
  }

  // Create totals
  const totals: MatchTotals = {
    [player1]: {
      holesWon: player1HolesWon,
      holesLost: player2HolesWon,
      holesTied: tiedHoles,
      currentStatus: player1Margin > 0 ? 'up' : player1Margin < 0 ? 'down' : 'tied',
      margin: player1Margin
    },
    [player2]: {
      holesWon: player2HolesWon,
      holesLost: player1HolesWon,
      holesTied: tiedHoles,
      currentStatus: player2Margin > 0 ? 'up' : player2Margin < 0 ? 'down' : 'tied',
      margin: player2Margin
    }
  };

  // Create match summary
  let matchSummary: string;
  if (finalWinner) {
    const winnerName = finalWinner;
    if (finalMargin === 1) {
      matchSummary = `${winnerName} wins 1 up`;
    } else {
      const holesRemaining = 18 - Math.max(player1HolesWon, player2HolesWon) - tiedHoles;
      if (finalMargin > holesRemaining) {
        // Match ended early
        matchSummary = `${winnerName} wins ${finalMargin} & ${holesRemaining}`;
      } else {
        matchSummary = `${winnerName} wins ${finalMargin} up`;
      }
    }
  } else {
    matchSummary = 'Match tied';
  }

  const finalStatus: MatchStatus = {
    leader: finalWinner,
    margin: finalMargin,
    holesRemaining: 0,
    isComplete: true,
    winner: finalWinner
  };

  return {
    name: 'Match Play',
    format: config.format || 'head-to-head',
    holeByHole: holeResults,
    totals,
    finalStatus,
    matchSummary
  };
}

/**
 * Calculate match status at any point during the round
 */
export function calculateMatchStatus(
  holeResults: MatchHoleResult[], 
  currentHole: number,
  player1Id: string,
  player2Id: string
): MatchStatus {
  const player1Wins = holeResults.slice(0, currentHole).filter(h => h.winner === player1Id).length;
  const player2Wins = holeResults.slice(0, currentHole).filter(h => h.winner === player2Id).length;
  
  const margin = Math.abs(player1Wins - player2Wins);
  const holesRemaining = 18 - currentHole;
  const leader = player1Wins > player2Wins ? player1Id : 
                 player2Wins > player1Wins ? player2Id : null;
  
  // Check if match is decided (margin > holes remaining)
  const isComplete = margin > holesRemaining || currentHole >= 18;
  const winner = isComplete ? leader : null;

  return {
    leader,
    margin,
    holesRemaining,
    isComplete,
    winner
  };
}

/**
 * Format match status for display
 */
export function formatMatchStatus(status: MatchStatus, playerNames: { [id: string]: string }): string {
  if (status.winner) {
    const winnerName = playerNames[status.winner] || status.winner;
    if (status.margin === 0) {
      return 'Match tied';
    } else if (status.holesRemaining === 0) {
      return `${winnerName} wins ${status.margin} up`;
    } else {
      return `${winnerName} wins ${status.margin} & ${status.holesRemaining}`;
    }
  } else if (status.leader) {
    const leaderName = playerNames[status.leader] || status.leader;
    return `${leaderName} ${status.margin} up`;
  } else {
    return 'Match tied';
  }
}

/**
 * Convert stroke play data to match play format
 */
export function convertToMatchData(players: Array<{ playerId: string; scores: number[]; handicap?: number }>): CoreRoundData {
  if (players.length !== 2) {
    throw new Error('Match play requires exactly 2 players');
  }

  const playerIds = players.map(p => p.playerId);
  const strokes: { [playerId: string]: { [hole: number]: number } } = {};
  const handicapPops: { [playerId: string]: { [hole: number]: number } } = {};

  // Convert scores to hole-by-hole format
  players.forEach(player => {
    strokes[player.playerId] = {};
    handicapPops[player.playerId] = {};
    
    player.scores.forEach((score, index) => {
      const hole = index + 1;
      strokes[player.playerId][hole] = score;
      handicapPops[player.playerId][hole] = 0; // Will be calculated based on handicap
    });
  });

  // Basic course data (can be enhanced with real course data)
  const course = {
    holes: Object.fromEntries(
      Array.from({ length: 18 }, (_, i) => [
        i + 1,
        { par: 4, strokeIndex: i + 1 } // Default par 4, sequential stroke index
      ])
    )
  };

  return {
    players: playerIds,
    strokes,
    handicap: { pops: handicapPops },
    course
  };
}

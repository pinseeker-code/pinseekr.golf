import { type CoreRoundData } from './strokeEngine';

export interface SnakeConfig {
  penaltyAmount?: number; // sats penalty for holding snake at end
  threePuttThreshold?: number; // default 3
  distributeToGroup?: boolean; // if true, penalty goes to pot, if false, to other players
}

export interface SnakeHoleResult {
  hole: number;
  playerPutts: { [playerId: string]: number };
  threePutters: string[];
  snakeHolder: string | null;
}

export interface SnakeResult {
  name: string;
  holeByHole: SnakeHoleResult[];
  finalSnakeHolder: string | null;
  snakePasses: number;
  threePuttSummary: { [playerId: string]: number };
  penalty: {
    loser: string | null;
    amount: number;
    recipients: Array<{ playerId: string; amount: number }>;
  } | null;
}

export interface SnakeRoundData extends CoreRoundData {
  putts: {
    [playerId: string]: {
      [hole: number]: number;
    };
  };
}

/**
 * Process a snake game round
 */
export function snakeEngine(data: SnakeRoundData, config: SnakeConfig = {}): SnakeResult {
  const { players, putts } = data;
  
  const defaults = {
    penaltyAmount: config.penaltyAmount || 500, // sats
    threePuttThreshold: config.threePuttThreshold || 3,
    distributeToGroup: config.distributeToGroup || false
  };

  const holeResults: SnakeHoleResult[] = [];
  let currentSnakeHolder: string | null = null;
  let snakePasses = 0;
  const threePuttSummary: { [playerId: string]: number } = {};

  // Initialize three putt summary
  players.forEach(playerId => {
    threePuttSummary[playerId] = 0;
  });

  // Process each hole
  for (let hole = 1; hole <= 18; hole++) {
    const playerPutts: { [playerId: string]: number } = {};
    const threePutters: string[] = [];

    // Check each player's putts for this hole
    players.forEach(playerId => {
      const holePutts = putts[playerId]?.[hole] || 2; // Default 2 putts
      playerPutts[playerId] = holePutts;

      // Check for three-putt (or more)
      if (holePutts >= defaults.threePuttThreshold) {
        threePutters.push(playerId);
        threePuttSummary[playerId]++;
        
        // Snake passes to this player (last three-putter gets it if multiple)
        currentSnakeHolder = playerId;
        snakePasses++;
      }
    });

    holeResults.push({
      hole,
      playerPutts,
      threePutters,
      snakeHolder: currentSnakeHolder
    });
  }

  // Calculate penalty
  let penalty: SnakeResult['penalty'] = null;
  
  if (currentSnakeHolder && defaults.penaltyAmount > 0) {
    const recipients: Array<{ playerId: string; amount: number }> = [];
    
    if (defaults.distributeToGroup) {
      // Penalty goes to a pot (could be distributed equally or handled externally)
      recipients.push({
        playerId: 'pot',
        amount: defaults.penaltyAmount
      });
    } else {
      // Penalty is split among other players
      const otherPlayers = players.filter(p => p !== currentSnakeHolder);
      const amountPerPlayer = Math.floor(defaults.penaltyAmount / otherPlayers.length);
      
      otherPlayers.forEach(playerId => {
        recipients.push({
          playerId,
          amount: amountPerPlayer
        });
      });
    }

    penalty = {
      loser: currentSnakeHolder,
      amount: defaults.penaltyAmount,
      recipients
    };
  }

  return {
    name: 'Snake',
    holeByHole: holeResults,
    finalSnakeHolder: currentSnakeHolder,
    snakePasses,
    threePuttSummary,
    penalty
  };
}

/**
 * Convert stroke data to snake format with estimated putts
 */
export function convertToSnakeData(
  data: CoreRoundData,
  estimateConfig: {
    averagePuttsPerHole?: number;
    threePuttRate?: number;
    onePuttRate?: number;
  } = {}
): SnakeRoundData {
  const { players, strokes, course } = data;
  const putts: { [playerId: string]: { [hole: number]: number } } = {};

  const defaults = {
    averagePuttsPerHole: estimateConfig.averagePuttsPerHole || 2.1,
    threePuttRate: estimateConfig.threePuttRate || 0.15, // 15% chance
    onePuttRate: estimateConfig.onePuttRate || 0.05 // 5% chance
  };

  players.forEach(playerId => {
    putts[playerId] = {};
    
    for (let hole = 1; hole <= 18; hole++) {
      const holeStrokes = strokes[playerId]?.[hole] || 0;
      const par = course?.holes[hole]?.par || 4;
      
      // Estimate putts based on score relative to par
      let estimatedPutts = 2; // Default
      
      if (holeStrokes > 0) {
        const scoreRelativeToPar = holeStrokes - par;
        
        if (scoreRelativeToPar <= -2) {
          // Eagle or better - likely 1 putt
          estimatedPutts = Math.random() < 0.8 ? 1 : 2;
        } else if (scoreRelativeToPar === -1) {
          // Birdie - good chance of 1 putt
          estimatedPutts = Math.random() < 0.6 ? 1 : 2;
        } else if (scoreRelativeToPar === 0) {
          // Par - mostly 2 putts, some 1s and 3s
          const rand = Math.random();
          if (rand < defaults.onePuttRate) estimatedPutts = 1;
          else if (rand < (1 - defaults.threePuttRate)) estimatedPutts = 2;
          else estimatedPutts = 3;
        } else if (scoreRelativeToPar === 1) {
          // Bogey - more likely 3 putts
          const rand = Math.random();
          if (rand < 0.02) estimatedPutts = 1;
          else if (rand < 0.7) estimatedPutts = 2;
          else estimatedPutts = 3;
        } else {
          // Double bogey or worse - high chance of 3+ putts
          const rand = Math.random();
          if (rand < 0.01) estimatedPutts = 1;
          else if (rand < 0.5) estimatedPutts = 2;
          else if (rand < 0.9) estimatedPutts = 3;
          else estimatedPutts = 4;
        }
      }
      
      putts[playerId][hole] = estimatedPutts;
    }
  });

  return {
    ...data,
    putts
  };
}

/**
 * Get snake status summary for display
 */
export function getSnakeStatus(result: SnakeResult): string {
  if (!result.finalSnakeHolder) {
    return "No three-putts this round - no snake penalty!";
  }
  
  if (result.penalty) {
    const loser = result.finalSnakeHolder;
    const amount = result.penalty.amount;
    return `${loser} holds the snake and owes ${amount} sats!`;
  }
  
  return `${result.finalSnakeHolder} holds the snake`;
}

/**
 * Format three-putt summary for display
 */
export function formatThreePuttSummary(summary: { [playerId: string]: number }): string[] {
  return Object.entries(summary)
    .filter(([_, count]) => count > 0)
    .map(([playerId, count]) => `${playerId}: ${count} three-putt${count > 1 ? 's' : ''}`);
}

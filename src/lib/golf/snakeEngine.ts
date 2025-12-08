import { type CoreRoundData } from './strokeEngine';

export interface SnakeConfig {
  penaltyAmount?: number; // sats penalty for holding snake at end
  threePuttThreshold?: number; // default 3
  distributeToGroup?: boolean; // if true, penalty goes to pot, if false, to other players
  variant?: 'fixed' | 'progressive'; // Snake game variant
  progressiveMultiplier?: number; // Multiplier for progressive variant (default 1.1)
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
    baseAmount: number; // Original penalty amount
    multiplier: number; // Applied multiplier
    recipients: Array<{ playerId: string; amount: number }>;
  } | null;
  variant: 'fixed' | 'progressive';
  currentMultiplier: number; // Current multiplier based on snake passes
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
    distributeToGroup: config.distributeToGroup || false,
    variant: config.variant || 'fixed',
    progressiveMultiplier: config.progressiveMultiplier || 1.1
  };

  const holeResults: SnakeHoleResult[] = [];
  let currentSnakeHolder: string | null = null;
  let snakePasses = 0;
  const threePuttSummary: { [playerId: string]: number } = {};

  // Initialize three putt summary
  players.forEach(playerId => {
    threePuttSummary[playerId] = 0;
  });

  // Process each hole (only holes that have data)
  const holesWithData = new Set<number>();
  players.forEach(playerId => {
    Object.keys(putts[playerId] || {}).forEach(hole => {
      holesWithData.add(parseInt(hole));
    });
  });
  
  const sortedHoles = Array.from(holesWithData).sort((a, b) => a - b);
  
  for (const hole of sortedHoles) {
    const playerPutts: { [playerId: string]: number } = {};
    const threePutters: string[] = [];
    let holeSnakeHolder = currentSnakeHolder; // Start with current holder

    // Check each player's putts for this hole
    players.forEach(playerId => {
      const holePutts = putts[playerId]?.[hole] || 2; // Default 2 putts
      playerPutts[playerId] = holePutts;

      // Check for three-putt (or more) - snake passes to ANY player who 3-putts
      if (holePutts >= defaults.threePuttThreshold) {
        threePutters.push(playerId);
        threePuttSummary[playerId]++;
        
        // Snake passes to this player - if multiple players 3-putt on same hole,
        // the last one in player order gets the snake
        holeSnakeHolder = playerId;
        snakePasses++;
      }
    });

    // Update the current snake holder only if it changed on this hole
    if (holeSnakeHolder !== currentSnakeHolder) {
      currentSnakeHolder = holeSnakeHolder;
    }

    holeResults.push({
      hole,
      playerPutts,
      threePutters,
      snakeHolder: currentSnakeHolder
    });
  }

  // Calculate penalty with variant logic
  let penalty: SnakeResult['penalty'] = null;
  let currentMultiplier = 1;
  
  if (currentSnakeHolder && defaults.penaltyAmount > 0) {
    // Calculate multiplier based on variant
    if (defaults.variant === 'progressive') {
      // Progressive: multiplier increases with each snake pass
      currentMultiplier = Math.pow(defaults.progressiveMultiplier, snakePasses);
    } else {
      // Fixed: no multiplier
      currentMultiplier = 1;
    }
    
    const finalAmount = Math.round(defaults.penaltyAmount * currentMultiplier);
    const recipients: Array<{ playerId: string; amount: number }> = [];
    
    if (defaults.distributeToGroup) {
      // Penalty goes to a pot (could be distributed equally or handled externally)
      recipients.push({
        playerId: 'pot',
        amount: finalAmount
      });
    } else {
      // Penalty is split among other players
      const otherPlayers = players.filter(p => p !== currentSnakeHolder);
      const amountPerPlayer = Math.floor(finalAmount / otherPlayers.length);
      
      otherPlayers.forEach(playerId => {
        recipients.push({
          playerId,
          amount: amountPerPlayer
        });
      });
    }

    penalty = {
      loser: currentSnakeHolder,
      amount: finalAmount,
      baseAmount: defaults.penaltyAmount,
      multiplier: currentMultiplier,
      recipients
    };
  }

  return {
    name: `Snake (${defaults.variant === 'progressive' ? 'Progressive' : 'Fixed'})`,
    holeByHole: holeResults,
    finalSnakeHolder: currentSnakeHolder,
    snakePasses,
    threePuttSummary,
    penalty,
    variant: defaults.variant,
    currentMultiplier
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
    const baseAmount = result.penalty.baseAmount;
    const multiplier = result.penalty.multiplier;
    
    if (result.variant === 'progressive' && multiplier > 1) {
      return `${loser} holds the snake and owes ${amount} sats (${baseAmount} × ${multiplier.toFixed(1)}x)!`;
    } else {
      return `${loser} holds the snake and owes ${amount} sats!`;
    }
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

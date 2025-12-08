import { type CoreRoundData } from './strokeEngine';

export interface DotsConfig {
  wagerPerDot?: number; // sats per dot difference
  fairwayDots?: number; // default 1
  girDots?: number; // default 1
  onePuttDots?: number; // default 1
  birdieDots?: number; // default 2
  eagleDots?: number; // default 5
  doubleBogeyPenalty?: number; // default -1
}

export interface HoleDotsData {
  strokes: number;
  putts: number;
  fairwayHit: boolean;
  greenInRegulation: boolean;
  par: number;
}

export interface DotsHoleResult {
  hole: number;
  playerDots: { [playerId: string]: number };
  breakdown: { 
    [playerId: string]: {
      fairway: number;
      gir: number;
      onePutt: number;
      birdie: number;
      eagle: number;
      penalty: number;
      total: number;
    };
  };
}

export interface DotsTotals {
  [playerId: string]: {
    totalDots: number;
    fairwayDots: number;
    girDots: number;
    onePuttDots: number;
    birdieDots: number;
    eagleDots: number;
    penaltyDots: number;
  };
}

export interface DotsResult {
  name: string;
  holeByHole: DotsHoleResult[];
  totals: DotsTotals;
  leaderboard: Array<{ playerId: string; position: number; dots: number }>;
  payments: Array<{ from: string; to: string; amount: number; reason: string }>;
}

export interface ExtendedRoundData extends CoreRoundData {
  holeData: {
    [playerId: string]: {
      [hole: number]: HoleDotsData;
    };
  };
}

/**
 * Process a dots/points game round
 */
export function dotsEngine(data: ExtendedRoundData, config: DotsConfig = {}): DotsResult {
  const { players, holeData, course } = data;
  
  const defaults = {
    wagerPerDot: config.wagerPerDot || 100, // sats
    fairwayDots: config.fairwayDots || 1,
    girDots: config.girDots || 1,
    onePuttDots: config.onePuttDots || 1,
    birdieDots: config.birdieDots || 2,
    eagleDots: config.eagleDots || 5,
    doubleBogeyPenalty: config.doubleBogeyPenalty || -1
  };

  const holeResults: DotsHoleResult[] = [];
  const totals: DotsTotals = {};

  // Initialize totals
  players.forEach(playerId => {
    totals[playerId] = {
      totalDots: 0,
      fairwayDots: 0,
      girDots: 0,
      onePuttDots: 0,
      birdieDots: 0,
      eagleDots: 0,
      penaltyDots: 0
    };
  });

  // Process each hole (only holes that have data)
  const holesWithData = new Set<number>();
  players.forEach(playerId => {
    Object.keys(holeData[playerId] || {}).forEach(hole => {
      holesWithData.add(parseInt(hole));
    });
  });
  
  const sortedHoles = Array.from(holesWithData).sort((a, b) => a - b);
  
  for (const hole of sortedHoles) {
    const holeInfo = course?.holes[hole];
    const par = holeInfo?.par || 4;
    
    const playerDots: { [playerId: string]: number } = {};
    const breakdown: { [playerId: string]: {
      fairway: number;
      gir: number;
      onePutt: number;
      birdie: number;
      eagle: number;
      penalty: number;
      total: number;
    } } = {};

    players.forEach(playerId => {
      const holePlayerData = holeData[playerId]?.[hole];
      if (!holePlayerData) {
        playerDots[playerId] = 0;
        breakdown[playerId] = {
          fairway: 0, gir: 0, onePutt: 0, birdie: 0, eagle: 0, penalty: 0, total: 0
        };
        return;
      }

      const { strokes, putts, fairwayHit, greenInRegulation } = holePlayerData;
      let holeDots = 0;
      const holeBreakdown = {
        fairway: 0, gir: 0, onePutt: 0, birdie: 0, eagle: 0, penalty: 0, total: 0
      };

      // Fairway hit
      if (fairwayHit) {
        holeDots += defaults.fairwayDots;
        holeBreakdown.fairway = defaults.fairwayDots;
        totals[playerId].fairwayDots += defaults.fairwayDots;
      }

      // Green in regulation
      if (greenInRegulation) {
        holeDots += defaults.girDots;
        holeBreakdown.gir = defaults.girDots;
        totals[playerId].girDots += defaults.girDots;
      }

      // One putt
      if (putts === 1) {
        holeDots += defaults.onePuttDots;
        holeBreakdown.onePutt = defaults.onePuttDots;
        totals[playerId].onePuttDots += defaults.onePuttDots;
      }

      // Birdie
      if (strokes === par - 1) {
        holeDots += defaults.birdieDots;
        holeBreakdown.birdie = defaults.birdieDots;
        totals[playerId].birdieDots += defaults.birdieDots;
      }

      // Eagle or better
      if (strokes <= par - 2) {
        holeDots += defaults.eagleDots;
        holeBreakdown.eagle = defaults.eagleDots;
        totals[playerId].eagleDots += defaults.eagleDots;
      }

      // Double bogey or worse penalty
      if (strokes >= par + 2) {
        holeDots += defaults.doubleBogeyPenalty;
        holeBreakdown.penalty = defaults.doubleBogeyPenalty;
        totals[playerId].penaltyDots += defaults.doubleBogeyPenalty;
      }

      holeBreakdown.total = holeDots;
      playerDots[playerId] = holeDots;
      breakdown[playerId] = holeBreakdown;
      totals[playerId].totalDots += holeDots;
    });

    holeResults.push({
      hole,
      playerDots,
      breakdown
    });
  }

  // Create leaderboard (highest dots wins)
  const leaderboard = Object.entries(totals)
    .map(([playerId, total]) => ({
      playerId,
      position: 0, // Will be set below
      dots: total.totalDots
    }))
    .sort((a, b) => b.dots - a.dots); // Descending order

  // Set positions with tie handling
  let currentPosition = 1;
  for (let i = 0; i < leaderboard.length; i++) {
    if (i > 0 && leaderboard[i].dots < leaderboard[i - 1].dots) {
      currentPosition = i + 1;
    }
    leaderboard[i].position = currentPosition;
  }

  // Calculate payments (each player pays/receives based on dot difference)
  const payments: Array<{ from: string; to: string; amount: number; reason: string }> = [];
  
  if (defaults.wagerPerDot > 0) {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = players[i];
        const player2 = players[j];
        const dotDiff = totals[player1].totalDots - totals[player2].totalDots;
        
        if (dotDiff > 0) {
          // Player1 has more dots, Player2 pays Player1
          payments.push({
            from: player2,
            to: player1,
            amount: Math.abs(dotDiff) * defaults.wagerPerDot,
            reason: `Dots difference: ${Math.abs(dotDiff)}`
          });
        } else if (dotDiff < 0) {
          // Player2 has more dots, Player1 pays Player2
          payments.push({
            from: player1,
            to: player2,
            amount: Math.abs(dotDiff) * defaults.wagerPerDot,
            reason: `Dots difference: ${Math.abs(dotDiff)}`
          });
        }
      }
    }
  }

  return {
    name: 'Dots',
    holeByHole: holeResults,
    totals,
    leaderboard,
    payments
  };
}

/**
 * Convert basic round data to extended format with default hole data
 */
export function convertToDotsData(
  data: CoreRoundData, 
  assumptions: { 
    defaultFairwayHitRate?: number; 
    defaultGirRate?: number;
    estimatePuttsFromStrokes?: boolean;
  } = {}
): ExtendedRoundData {
  const { players, strokes, course } = data;
  const holeData: { [playerId: string]: { [hole: number]: HoleDotsData } } = {};

  const defaults = {
    defaultFairwayHitRate: assumptions.defaultFairwayHitRate || 0.6,
    defaultGirRate: assumptions.defaultGirRate || 0.4,
    estimatePuttsFromStrokes: assumptions.estimatePuttsFromStrokes !== false
  };

  players.forEach(playerId => {
    holeData[playerId] = {};

    // Only generate hole data for holes where we have stroke entries for this player.
    // This prevents creating 18 holes of estimated random data when no strokes were recorded.
    const playerStrokes = strokes[playerId] || {};
    const holesToProcess = Object.keys(playerStrokes).length > 0
      ? Object.keys(playerStrokes).map(h => parseInt(h, 10)).sort((a, b) => a - b)
      : [];

    if (holesToProcess.length === 0) {
      // No stroke data for this player; leave holeData[playerId] empty
      return;
    }

    for (const hole of holesToProcess) {
      const holeStrokes = strokes[playerId]?.[hole] || 0;
      const par = course?.holes?.[hole]?.par || 4;
      
      // Estimate putts (rough approximation)
      let putts = 2; // Default 2 putts
      if (defaults.estimatePuttsFromStrokes && holeStrokes > 0) {
        if (holeStrokes <= par - 2) putts = 1; // Eagle - likely 1 putt
        else if (holeStrokes === par - 1) putts = Math.random() < 0.7 ? 1 : 2; // Birdie
        else if (holeStrokes === par) putts = 2; // Par
        else if (holeStrokes === par + 1) putts = Math.random() < 0.3 ? 2 : 3; // Bogey
        else putts = Math.random() < 0.2 ? 2 : 3; // Worse than bogey
      }

      // Random fairway hit and GIR based on rates
      const fairwayHit = Math.random() < defaults.defaultFairwayHitRate;
      const greenInRegulation = Math.random() < defaults.defaultGirRate;

      holeData[playerId][hole] = {
        strokes: holeStrokes,
        putts: Math.round(putts),
        fairwayHit,
        greenInRegulation,
        par
      };
    }
  });

  return {
    ...data,
    holeData
  };
}

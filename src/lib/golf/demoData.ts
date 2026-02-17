/**
 * Demo round data for the interactive demo feature.
 * Pre-populated 9-hole round between 4 players with randomized scores.
 */

import { GolfRound, GameMode, PlayerInRound, HoleScore } from './types';

// Demo course: 9-hole par data (realistic mix of par 3, 4, 5)
export const DEMO_COURSE_PARS: { [hole: number]: number } = {
  1: 4,
  2: 3,
  3: 5,
  4: 4,
  5: 4,
  6: 3,
  7: 5,
  8: 4,
  9: 4,
};

/**
 * Generate a realistic score for a hole based on par and handicap.
 * Lower handicap = scores closer to par
 * Higher handicap = more variance and higher scores
 */
function generateScore(par: number, handicap: number): number {
  // Base score tends toward par + (handicap factor)
  const handicapFactor = handicap / 18; // 0 to 1 scale
  const baseScore = par + (handicapFactor * 2); // Low handicap ~par, high handicap ~par+2
  
  // Add randomness: ±1 or ±2 strokes
  const variance = Math.random() < 0.7 ? 
    (Math.random() < 0.5 ? -1 : 1) : // 70% chance of ±1
    (Math.random() < 0.5 ? -2 : 2);  // 30% chance of ±2
  
  let score = Math.round(baseScore + variance);
  
  // Clamp to reasonable values (min = par-2 for eagle, max depends on par)
  const minScore = Math.max(par - 2, 2);
  const maxScore = par + 4 + Math.floor(handicap / 10);
  score = Math.max(minScore, Math.min(maxScore, score));
  
  return score;
}

/**
 * Generate putts based on score and handicap
 */
function generatePutts(score: number, par: number, handicap: number): number {
  if (score <= par - 2) return 1; // Eagle or better = 1 putt
  if (score === par - 1) return Math.random() < 0.7 ? 2 : 1; // Birdie usually 2
  if (score === par) return Math.random() < 0.8 ? 2 : 3; // Par mostly 2
  // Higher scores = more putts for high handicappers
  const basePutts = 2;
  const extraPutts = handicap > 12 && Math.random() < 0.3 ? 1 : 0;
  return Math.min(4, basePutts + extraPutts);
}

/**
 * Generate fairway hit probability based on handicap
 */
function generateFairway(par: number, handicap: number): boolean {
  if (par === 3) return false; // Par 3s don't have fairways
  const hitRate = 1 - (handicap / 36); // 0 handicap = 100%, 18 handicap = 50%
  return Math.random() < hitRate;
}

/**
 * Generate green in regulation based on par, score, and handicap
 */
function generateGreen(par: number, score: number, handicap: number): boolean {
  if (score <= par - 1) return true; // Birdie or better = GIR
  const girRate = Math.max(0.2, 0.8 - (handicap / 20));
  return Math.random() < girRate;
}

/**
 * Creates a fresh demo round with randomized scores.
 * Call this each time the demo page loads to get varied results.
 */
export function createDemoRound(): GolfRound {
  const holes: HoleScore[] = [];

  // Create all 9 holes
  for (let i = 1; i <= 9; i++) {
    const par = DEMO_COURSE_PARS[i] ?? 4; // Default to par 4 if undefined

    holes.push({
      holeNumber: i,
      par,
      strokes: 0, // Will be set per-player
      putts: 0,
      fairways: false,
      greens: false,
      chips: 0,
      sandTraps: 0,
      penalties: 0,
      notes: '',
    });
  }

  // Generate random scores for each player
  const mackenzieScores = Object.keys(DEMO_COURSE_PARS).map(h => generateScore(DEMO_COURSE_PARS[Number(h)] ?? 4, 5));
  const vanceScores = Object.keys(DEMO_COURSE_PARS).map(h => generateScore(DEMO_COURSE_PARS[Number(h)] ?? 4, 12));
  const newtonScores = Object.keys(DEMO_COURSE_PARS).map(h => generateScore(DEMO_COURSE_PARS[Number(h)] ?? 4, 18));
  const jungScores = Object.keys(DEMO_COURSE_PARS).map(h => generateScore(DEMO_COURSE_PARS[Number(h)] ?? 4, 15));

  // Create players with their scores
  const mackenzie: PlayerInRound = {
    playerId: 'demo-mackenzie',
    name: 'Alister Mackenzie',
    handicap: 5,
    scores: mackenzieScores,
    total: mackenzieScores.reduce((a, b) => a + b, 0),
    netTotal: 0, // Will be calculated
    holeDetails: {},
  };

  const vance: PlayerInRound = {
    playerId: 'demo-vance',
    name: 'Bagger Vance',
    handicap: 12,
    scores: vanceScores,
    total: vanceScores.reduce((a, b) => a + b, 0),
    netTotal: 0,
    holeDetails: {},
  };

  const newton: PlayerInRound = {
    playerId: 'demo-newton',
    name: 'Isaac Newton',
    handicap: 18,
    scores: newtonScores,
    total: newtonScores.reduce((a, b) => a + b, 0),
    netTotal: 0,
    holeDetails: {},
  };

  const jung: PlayerInRound = {
    playerId: 'demo-jung',
    name: 'Carl Jung',
    handicap: 15,
    scores: jungScores,
    total: jungScores.reduce((a, b) => a + b, 0),
    netTotal: 0,
    holeDetails: {},
  };

  // Populate hole details for each player with generated data
  for (let i = 0; i < 9; i++) {
    const par = DEMO_COURSE_PARS[i + 1] ?? 4;
    const mackScore = mackenzieScores[i] ?? par;
    const vanceScore = vanceScores[i] ?? par;
    const newtonScore = newtonScores[i] ?? par;
    const jungScore = jungScores[i] ?? par;
    
    mackenzie.holeDetails![i] = {
      putts: generatePutts(mackScore, par, 5),
      fairways: generateFairway(par, 5),
      greens: generateGreen(par, mackScore, 5),
      chips: 0,
      sandTraps: 0,
      penalties: 0,
    };

    vance.holeDetails![i] = {
      putts: generatePutts(vanceScore, par, 12),
      fairways: generateFairway(par, 12),
      greens: generateGreen(par, vanceScore, 12),
      chips: 0,
      sandTraps: 0,
      penalties: 0,
    };

    newton.holeDetails![i] = {
      putts: generatePutts(newtonScore, par, 18),
      fairways: generateFairway(par, 18),
      greens: generateGreen(par, newtonScore, 18),
      chips: 0,
      sandTraps: 0,
      penalties: 0,
    };

    jung.holeDetails![i] = {
      putts: generatePutts(jungScore, par, 15),
      fairways: generateFairway(par, 15),
      greens: generateGreen(par, jungScore, 15),
      chips: 0,
      sandTraps: 0,
      penalties: 0,
    };
  }

  const round: GolfRound = {
    id: 'demo-round-' + Date.now(),
    courseId: 'demo-course',
    date: Date.now(),
    players: [mackenzie, vance, newton, jung],
    gameMode: GameMode.STROKE_PLAY, // Primary mode
    gameModes: ['stroke', 'nassau', 'snake'], // All active modes for demo
    holes,
    status: 'active',
    metadata: {
      courseName: 'Pinseekr Demo Course',
      courseLocation: 'Demo City, USA',
      teeBox: 'White Tees',
      weather: 'Sunny, 72°F',
      notes: 'Interactive 9-hole demo round with 4 legendary players!',
    },
  };

  return round;
}

/**
 * Demo course object for ScoreCard component
 */
export const DEMO_COURSE = {
  id: 'demo-course',
  name: 'Pinseekr Demo Course',
  location: 'Demo City, USA',
  holes: DEMO_COURSE_PARS,
  sections: {
    0: 'Front 9',
  },
  tees: [
    { name: 'White Tees', yardage: 3200 },
  ],
  totalPar: Object.values(DEMO_COURSE_PARS).reduce((a, b) => a + b, 0),
};

/**
 * Active game modes for the demo
 */
export const DEMO_GAME_MODES = ['stroke', 'nassau', 'snake'] as const;

/**
 * Snake transfer record
 */
export interface SnakeTransfer {
  holeNumber: number;
  playerName: string;
}

/**
 * Calculate demo round statistics for the summary
 */
export interface DemoRoundStats {
  player1: PlayerStats;
  player2: PlayerStats;
  matchPlayStatus: string;
  snakeHolder: string;
  snakeTransfers: number;
  snakeTransferHoles: SnakeTransfer[];
  totalHoles: number;
}

export interface PlayerStats {
  name: string;
  grossTotal: number;
  netTotal: number;
  holesPlayed: number;
  totalHoles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  avgPutts: number;
  fairwayHitPct: number;
  girPct: number;
  toPar: number;
}

export function calculateDemoStats(round: GolfRound): DemoRoundStats {
  const calcPlayerStats = (player: PlayerInRound, _playerIndex: number): PlayerStats => {
    let birdies = 0, pars = 0, bogeys = 0, doublePlus = 0;
    let totalPutts = 0, fairwayHits = 0, girHits = 0;
    let holesPlayed = 0;
    let grossTotal = 0;

    for (let i = 0; i < round.holes.length; i++) {
      const score = player.scores[i];
      if (score && score > 0) {
        holesPlayed++;
        grossTotal += score;
        const par = round.holes[i]?.par ?? 4;
        const diff = score - par;

        if (diff <= -1) birdies++;
        else if (diff === 0) pars++;
        else if (diff === 1) bogeys++;
        else doublePlus++;

        const details = player.holeDetails?.[i];
        if (details) {
          totalPutts += details.putts || 0;
          if (details.fairways && par >= 4) fairwayHits++;
          if (details.greens) girHits++;
        }
      }
    }

    const fairwayHoles = round.holes.filter((h, i) => h.par >= 4 && (player.scores[i] ?? 0) > 0).length;
    const coursePar = round.holes.reduce((sum, h) => sum + h.par, 0);

    return {
      name: player.name,
      grossTotal,
      netTotal: grossTotal - Math.floor(player.handicap / 2), // simplified 9-hole net
      holesPlayed,
      totalHoles: round.holes.length,
      birdies,
      pars,
      bogeys,
      doublePlus,
      avgPutts: holesPlayed > 0 ? totalPutts / holesPlayed : 0,
      fairwayHitPct: fairwayHoles > 0 ? (fairwayHits / fairwayHoles) * 100 : 0,
      girPct: holesPlayed > 0 ? (girHits / holesPlayed) * 100 : 0,
      toPar: grossTotal - coursePar,
    };
  };

  const player1Stats = calcPlayerStats(round.players[0]!, 0);
  const player2Stats = calcPlayerStats(round.players[1]!, 1);

  // Calculate match play status
  let p1Holes = 0, p2Holes = 0;
  for (let i = 0; i < round.holes.length; i++) {
    const s1 = round.players[0]!.scores[i];
    const s2 = round.players[1]!.scores[i];
    if (typeof s1 === 'number' && typeof s2 === 'number' && s1 > 0 && s2 > 0) {
      if (s1 < s2) p1Holes++;
      else if (s2 < s1) p2Holes++;
    }
  }
  
  let matchPlayStatus: string;
  if (p1Holes > p2Holes) {
    matchPlayStatus = `Player 1 leads ${p1Holes - p2Holes} UP`;
  } else if (p2Holes > p1Holes) {
    matchPlayStatus = `Player 2 leads ${p2Holes - p1Holes} UP`;
  } else {
    matchPlayStatus = 'All Square';
  }

  // Calculate snake (who has it based on 3-putts)
  let snakeHolder = 'None';
  const snakeTransferHoles: SnakeTransfer[] = [];
  
  for (let i = 0; i < round.holes.length; i++) {
    for (const player of round.players) {
      const details = player.holeDetails?.[i];
      if (details && details.putts !== undefined && details.putts >= 3) {
        snakeHolder = player.name;
        snakeTransferHoles.push({
          holeNumber: i + 1,
          playerName: player.name,
        });
      }
    }
  }

  return {
    player1: player1Stats,
    player2: player2Stats,
    matchPlayStatus,
    snakeHolder,
    snakeTransfers: snakeTransferHoles.length,
    snakeTransferHoles,
    totalHoles: round.holes.length,
  };
}

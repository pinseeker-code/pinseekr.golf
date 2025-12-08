/**
 * Demo round data for the interactive demo feature.
 * Pre-populated 9-hole round between 2 players with holes 1-8 filled in.
 * Hole 9 is left for user interaction.
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

// Pre-populated scores for holes 1-8 (realistic amateur scores)
// Player 1: slightly better player
const PLAYER_1_SCORES = [4, 4, 6, 5, 4, 3, 5, 5]; // holes 1-8
const PLAYER_1_PUTTS = [2, 2, 2, 2, 1, 2, 2, 2];
const PLAYER_1_FAIRWAYS = [true, false, true, false, true, false, true, true]; // N/A for par 3s but included
const PLAYER_1_GREENS = [true, true, false, true, true, true, false, true];

// Player 2: slightly higher handicap player
const PLAYER_2_SCORES = [5, 4, 7, 5, 5, 4, 6, 5]; // holes 1-8
const PLAYER_2_PUTTS = [2, 2, 3, 2, 2, 2, 2, 2];
const PLAYER_2_FAIRWAYS = [false, false, true, true, false, false, true, false];
const PLAYER_2_GREENS = [false, true, false, true, false, true, false, false];

/**
 * Creates a fresh demo round with pre-populated data.
 * Call this each time the demo page loads to get a clean copy.
 */
export function createDemoRound(): GolfRound {
  const holes: HoleScore[] = [];

  // Create all 9 holes
  for (let i = 1; i <= 9; i++) {
    const par = DEMO_COURSE_PARS[i];

    if (i <= 8) {
      // Pre-populated holes 1-8
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
    } else {
      // Hole 9 - empty for user input
      holes.push({
        holeNumber: i,
        par,
        strokes: 0,
        putts: 0,
        fairways: false,
        greens: false,
        chips: 0,
        sandTraps: 0,
        penalties: 0,
        notes: '',
      });
    }
  }

  // Create players with their scores
  const player1: PlayerInRound = {
    playerId: 'demo-player-1',
    name: 'Player 1',
    handicap: 12,
    scores: [...PLAYER_1_SCORES, 0], // 8 pre-filled + hole 9 empty
    total: PLAYER_1_SCORES.reduce((a, b) => a + b, 0),
    netTotal: 0, // Will be calculated
    holeDetails: {},
  };

  const player2: PlayerInRound = {
    playerId: 'demo-player-2',
    name: 'Player 2',
    handicap: 18,
    scores: [...PLAYER_2_SCORES, 0], // 8 pre-filled + hole 9 empty
    total: PLAYER_2_SCORES.reduce((a, b) => a + b, 0),
    netTotal: 0,
    holeDetails: {},
  };

  // Populate hole details for each player
  for (let i = 0; i < 8; i++) {
    player1.holeDetails![i] = {
      putts: PLAYER_1_PUTTS[i],
      fairways: PLAYER_1_FAIRWAYS[i],
      greens: PLAYER_1_GREENS[i],
      chips: 0,
      sandTraps: 0,
      penalties: 0,
    };

    player2.holeDetails![i] = {
      putts: PLAYER_2_PUTTS[i],
      fairways: PLAYER_2_FAIRWAYS[i],
      greens: PLAYER_2_GREENS[i],
      chips: 0,
      sandTraps: 0,
      penalties: 0,
    };
  }

  // Initialize hole 9 details (empty)
  player1.holeDetails![8] = {
    putts: 0,
    fairways: false,
    greens: false,
    chips: 0,
    sandTraps: 0,
    penalties: 0,
  };

  player2.holeDetails![8] = {
    putts: 0,
    fairways: false,
    greens: false,
    chips: 0,
    sandTraps: 0,
    penalties: 0,
  };

  const round: GolfRound = {
    id: 'demo-round-' + Date.now(),
    courseId: 'demo-course',
    date: Date.now(),
    players: [player1, player2],
    gameMode: GameMode.STROKE_PLAY, // Primary mode
    gameModes: ['stroke', 'match', 'snake'], // All active modes for demo
    holes,
    status: 'active',
    metadata: {
      courseName: 'Pinseekr Demo Course',
      courseLocation: 'Demo City, USA',
      teeBox: 'White Tees',
      weather: 'Sunny, 72°F',
      notes: 'Interactive demo round - try entering scores for Hole 9!',
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
export const DEMO_GAME_MODES = ['stroke', 'match', 'snake'] as const;

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
      if (score > 0) {
        holesPlayed++;
        grossTotal += score;
        const par = round.holes[i].par;
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

    const fairwayHoles = round.holes.filter((h, i) => h.par >= 4 && player.scores[i] > 0).length;
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

  const player1Stats = calcPlayerStats(round.players[0], 0);
  const player2Stats = calcPlayerStats(round.players[1], 1);

  // Calculate match play status
  let p1Holes = 0, p2Holes = 0;
  for (let i = 0; i < round.holes.length; i++) {
    const s1 = round.players[0].scores[i];
    const s2 = round.players[1].scores[i];
    if (s1 > 0 && s2 > 0) {
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

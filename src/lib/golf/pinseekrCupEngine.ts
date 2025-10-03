import { strokeEngine, type CoreRoundData } from './strokeEngine';
import { matchEngine } from './matchEngine';
import { dotsEngine, type ExtendedRoundData } from './dotsEngine';
import { snakeEngine, type SnakeRoundData } from './snakeEngine';

export interface PinseekrCupPlayer {
  id: string;
  name: string;
  handicap: number;
  team: 'Team A' | 'Team B';
}

export interface PinseekrCupRound {
  id: string;
  name: string;
  gameMode: 'stroke' | 'match' | 'dots' | 'snake';
  format: 'individual' | 'pairs' | 'team';
  pointsAvailable: number;
  completed: boolean;
  results?: PinseekrCupRoundResult;
}

export interface PinseekrCupRoundResult {
  roundId: string;
  gameMode: string;
  pointsAwarded: {
    'Team A': number;
    'Team B': number;
  };
  individualResults: unknown; // Specific to each game mode
  summary: string;
}

export interface PinseekrCupConfig {
  name: string;
  players: PinseekrCupPlayer[];
  rounds: PinseekrCupRound[];
  totalPointsToWin?: number;
}

export interface PinseekrCupResults {
  tournament: PinseekrCupConfig;
  completedRounds: PinseekrCupRoundResult[];
  currentStandings: {
    'Team A': number;
    'Team B': number;
  };
  leaderboard: {
    team: 'Team A' | 'Team B';
    points: number;
    roundsWon: number;
  }[];
  isComplete: boolean;
  winner?: 'Team A' | 'Team B';
  mvpPlayer?: {
    playerId: string;
    name: string;
    pointsContributed: number;
  };
}

// Default Pinseekr Cup tournament structure (simplified version)
export const DEFAULT_PINSEEKR_CUP: PinseekrCupConfig = {
  name: "Pinseekr Cup 2025",
  players: [], // Will be populated when setting up tournament
  rounds: [
    // Day 1: Team Stroke Play
    {
      id: "round-1",
      name: "Team Stroke Play Championship",
      gameMode: "stroke",
      format: "team",
      pointsAvailable: 4,
      completed: false
    },
    // Day 2: Head-to-Head Matches
    {
      id: "round-2", 
      name: "Singles Match Play",
      gameMode: "match",
      format: "individual",
      pointsAvailable: 6,
      completed: false
    },
    // Day 3: Skills Challenges
    {
      id: "round-3",
      name: "Dots Championship",
      gameMode: "dots",
      format: "individual",
      pointsAvailable: 4,
      completed: false
    },
    {
      id: "round-4",
      name: "Snake Challenge",
      gameMode: "snake", 
      format: "team",
      pointsAvailable: 2,
      completed: false
    }
  ],
  totalPointsToWin: 9 // First team to 9 points wins (out of 16 total)
};

export function createPinseekrCup(players: PinseekrCupPlayer[]): PinseekrCupConfig {
  if (players.length < 4 || players.length % 2 !== 0) {
    throw new Error("Pinseekr Cup requires an even number of players (minimum 4)");
  }

  // Automatically assign teams if not already assigned
  const playersWithTeams = players.map((player, index) => ({
    ...player,
    team: (index % 2 === 0 ? 'Team A' : 'Team B') as 'Team A' | 'Team B'
  }));

  return {
    ...DEFAULT_PINSEEKR_CUP,
    players: playersWithTeams,
    // Create a deep copy of the rounds to avoid shared references
    rounds: DEFAULT_PINSEEKR_CUP.rounds.map(round => ({ ...round }))
  };
}

export function playPinseekrCupRound(
  tournament: PinseekrCupConfig,
  roundId: string,
  scores: Record<string, number[]>
): PinseekrCupRoundResult {
  const round = tournament.rounds.find(r => r.id === roundId);
  if (!round) {
    throw new Error(`Round ${roundId} not found`);
  }

  if (round.completed) {
    throw new Error(`Round ${roundId} has already been completed`);
  }

  // Note: We don't mark the round as completed here since this function 
  // should be pure and not modify the input tournament object
  
  const teamAPlayers = tournament.players.filter(p => p.team === 'Team A');
  const teamBPlayers = tournament.players.filter(p => p.team === 'Team B');

  let pointsAwarded = { 'Team A': 0, 'Team B': 0 };
  let individualResults: unknown;
  let summary: string;

  // Create the data structure that engines expect
  const players = tournament.players.map(p => p.id);
  const strokes: { [playerId: string]: { [hole: number]: number } } = {};
  
  // Convert scores array to hole-by-hole format
  players.forEach(playerId => {
    strokes[playerId] = {};
    const playerScores = scores[playerId] || [];
    playerScores.forEach((score, index) => {
      strokes[playerId][index + 1] = score;
    });
  });

  // Create handicap data
  const handicap = {
    pops: {} as { [playerId: string]: { [hole: number]: number } }
  };
  
  tournament.players.forEach(player => {
    handicap.pops[player.id] = {};
    for (let hole = 1; hole <= 18; hole++) {
      handicap.pops[player.id][hole] = Math.floor(player.handicap / 18) + (hole <= (player.handicap % 18) ? 1 : 0);
    }
  });

  // Create course data
  const course = {
    holes: {} as { [hole: number]: { par: number; strokeIndex: number } }
  };
  
  for (let hole = 1; hole <= 18; hole++) {
    course.holes[hole] = { par: 4, strokeIndex: hole }; // Default par 4 for all holes
  }

  const coreData: CoreRoundData = { players, strokes, handicap, course };

  switch (round.gameMode) {
    case 'stroke':
      individualResults = strokeEngine(coreData, { useNet: true });
      pointsAwarded = calculateStrokePlayPoints(individualResults, tournament.players, round);
      summary = `Stroke Play: ${getTeamWithMorePoints(pointsAwarded)} dominated with superior team scoring`;
      break;

    case 'match':
      if (round.format === 'individual') {
        // Singles matches - pair up players from opposite teams
        pointsAwarded = calculateSinglesMatchPoints(teamAPlayers, teamBPlayers, coreData);
        summary = `Singles Matches: Team A ${pointsAwarded['Team A']} - ${pointsAwarded['Team B']} Team B`;
      } else {
        // Simplified match play for pairs
        pointsAwarded = calculateTeamMatchPoints(teamAPlayers, teamBPlayers, coreData);
        summary = `Match Play: ${getTeamWithMorePoints(pointsAwarded)} won the team battle`;
      }
      individualResults = { pointsAwarded };
      break;

    case 'dots': {
      // Create extended data for dots engine
      const holeData: { [hole: number]: { par: number; strokeIndex: number; yardage?: number } } = {};
      for (let hole = 1; hole <= 18; hole++) {
        holeData[hole] = { par: 4, strokeIndex: hole, yardage: 400 };
      }
      
      const extendedData: ExtendedRoundData = { ...coreData, holeData };
      individualResults = dotsEngine(extendedData);
      pointsAwarded = calculateDotsPoints(individualResults, tournament.players);
      summary = `Dots Championship: ${getTeamWithMorePoints(pointsAwarded)} accumulated more achievement points`;
      break;
    }

    case 'snake': {
      // Create snake data with putting information
      const putts: { [playerId: string]: { [hole: number]: number } } = {};
      players.forEach(playerId => {
        putts[playerId] = {};
        for (let hole = 1; hole <= 18; hole++) {
          // Estimate putts based on score (simplified)
          const score = strokes[playerId][hole] || 4;
          const par = 4;
          putts[playerId][hole] = Math.max(1, Math.min(4, score - par + 2));
        }
      });
      
      const snakeData: SnakeRoundData = { ...coreData, putts };
      individualResults = snakeEngine(snakeData);
      pointsAwarded = calculateSnakePoints(individualResults, tournament.players);
      summary = `Snake Challenge: ${getTeamWithMorePoints(pointsAwarded)} avoided the three-putt penalties`;
      break;
    }

    default:
      throw new Error(`Unsupported game mode: ${round.gameMode}`);
  }

  return {
    roundId,
    gameMode: round.gameMode,
    pointsAwarded,
    individualResults,
    summary
  };
}

export function getPinseekrCupResults(
  tournament: PinseekrCupConfig,
  completedRounds: PinseekrCupRoundResult[]
): PinseekrCupResults {
  const currentStandings = { 'Team A': 0, 'Team B': 0 };
  
  completedRounds.forEach(round => {
    currentStandings['Team A'] += round.pointsAwarded['Team A'];
    currentStandings['Team B'] += round.pointsAwarded['Team B'];
  });

  const leaderboard = [
    { team: 'Team A' as const, points: currentStandings['Team A'], roundsWon: countRoundsWon(completedRounds, 'Team A') },
    { team: 'Team B' as const, points: currentStandings['Team B'], roundsWon: countRoundsWon(completedRounds, 'Team B') }
  ].sort((a, b) => b.points - a.points);

  const totalPointsToWin = tournament.totalPointsToWin || 9;
  const isComplete = currentStandings['Team A'] >= totalPointsToWin || currentStandings['Team B'] >= totalPointsToWin;
  
  let winner: 'Team A' | 'Team B' | undefined;
  if (isComplete) {
    winner = currentStandings['Team A'] > currentStandings['Team B'] ? 'Team A' : 'Team B';
  }

  const mvpPlayer = calculateMVP(tournament, completedRounds);

  return {
    tournament,
    completedRounds,
    currentStandings,
    leaderboard,
    isComplete,
    winner,
    mvpPlayer
  };
}

// Helper functions
function getTeamWithMorePoints(pointsAwarded: { 'Team A': number; 'Team B': number }): string {
  if (pointsAwarded['Team A'] > pointsAwarded['Team B']) return 'Team A';
  if (pointsAwarded['Team B'] > pointsAwarded['Team A']) return 'Team B';
  return 'Teams tied';
}

function calculateStrokePlayPoints(results: unknown, players: PinseekrCupPlayer[], round: PinseekrCupRound): { 'Team A': number; 'Team B': number } {
  // Calculate team totals from stroke play results
  let teamATotal = 0;
  let teamBTotal = 0;
  let teamACount = 0;
  let teamBCount = 0;

  const strokeResults = results as { breakdown: { leaderboard: Array<{ playerId: string; netStrokes: number }> } };
  strokeResults.breakdown.leaderboard.forEach((entry) => {
    const player = players.find(p => p.id === entry.playerId);
    if (player?.team === 'Team A') {
      teamATotal += entry.netStrokes;
      teamACount++;
    } else if (player?.team === 'Team B') {
      teamBTotal += entry.netStrokes;
      teamBCount++;
    }
  });

  const teamAAverage = teamACount > 0 ? teamATotal / teamACount : 999;
  const teamBAverage = teamBCount > 0 ? teamBTotal / teamBCount : 999;

  if (teamAAverage < teamBAverage) return { 'Team A': round.pointsAvailable, 'Team B': 0 };
  if (teamBAverage < teamAAverage) return { 'Team A': 0, 'Team B': round.pointsAvailable };
  return { 'Team A': round.pointsAvailable / 2, 'Team B': round.pointsAvailable / 2 };
}

function calculateSinglesMatchPoints(teamAPlayers: PinseekrCupPlayer[], teamBPlayers: PinseekrCupPlayer[], data: CoreRoundData): { 'Team A': number; 'Team B': number } {
  let teamAPoints = 0;
  let teamBPoints = 0;

  // Pair up players for singles matches
  const maxMatches = Math.min(teamAPlayers.length, teamBPlayers.length);
  
  for (let i = 0; i < maxMatches; i++) {
    const playerA = teamAPlayers[i];
    const playerB = teamBPlayers[i];
    
    // Create a match between these two players
    const matchData: CoreRoundData = {
      players: [playerA.id, playerB.id],
      strokes: {
        [playerA.id]: data.strokes[playerA.id],
        [playerB.id]: data.strokes[playerB.id]
      },
      handicap: data.handicap,
      course: data.course
    };

    const matchResult = matchEngine(matchData, { useNet: true });

    // Check who won the match
    if (matchResult.finalStatus.winner === playerA.id) teamAPoints++;
    else if (matchResult.finalStatus.winner === playerB.id) teamBPoints++;
    else {
      // Tie - each team gets 0.5 points
      teamAPoints += 0.5;
      teamBPoints += 0.5;
    }
  }

  return { 'Team A': teamAPoints, 'Team B': teamBPoints };
}

function calculateTeamMatchPoints(teamAPlayers: PinseekrCupPlayer[], teamBPlayers: PinseekrCupPlayer[], data: CoreRoundData): { 'Team A': number; 'Team B': number } {
  // For simplified team match, just compare average scores
  const teamAAvg = calculateTeamAverage(teamAPlayers, data.strokes);
  const teamBAvg = calculateTeamAverage(teamBPlayers, data.strokes);

  if (teamAAvg < teamBAvg) return { 'Team A': 2, 'Team B': 0 };
  if (teamBAvg < teamAAvg) return { 'Team A': 0, 'Team B': 2 };
  return { 'Team A': 1, 'Team B': 1 };
}

function calculateDotsPoints(results: unknown, players: PinseekrCupPlayer[]): { 'Team A': number; 'Team B': number } {
  let teamAPoints = 0;
  let teamBPoints = 0;

  const dotsResults = results as { results: Array<{ playerId: string; totalPoints: number }> };
  dotsResults.results?.forEach((playerResult) => {
    const player = players.find(p => p.id === playerResult.playerId);
    if (player?.team === 'Team A') teamAPoints += playerResult.totalPoints || 0;
    else if (player?.team === 'Team B') teamBPoints += playerResult.totalPoints || 0;
  });

  // Convert to tournament points (team with more dots gets the points)
  if (teamAPoints > teamBPoints) return { 'Team A': 4, 'Team B': 0 };
  if (teamBPoints > teamAPoints) return { 'Team A': 0, 'Team B': 4 };
  return { 'Team A': 2, 'Team B': 2 };
}

function calculateSnakePoints(results: unknown, players: PinseekrCupPlayer[]): { 'Team A': number; 'Team B': number } {
  // Snake game: team that avoids the final snake gets the points
  const snakeResults = results as { currentSnakeHolder: string };
  const snakeHolder = snakeResults.currentSnakeHolder;
  const snakeHolderPlayer = players.find(p => p.id === snakeHolder);
  
  if (snakeHolderPlayer?.team === 'Team A') return { 'Team A': 0, 'Team B': 2 };
  if (snakeHolderPlayer?.team === 'Team B') return { 'Team A': 2, 'Team B': 0 };
  return { 'Team A': 1, 'Team B': 1 };
}

function calculateTeamAverage(teamPlayers: PinseekrCupPlayer[], strokes: { [playerId: string]: { [hole: number]: number } }): number {
  let totalScore = 0;
  let totalHoles = 0;

  teamPlayers.forEach(player => {
    Object.values(strokes[player.id] || {}).forEach(score => {
      totalScore += score;
      totalHoles++;
    });
  });
  
  return totalHoles > 0 ? totalScore / totalHoles : 999;
}

function countRoundsWon(completedRounds: PinseekrCupRoundResult[], team: 'Team A' | 'Team B'): number {
  return completedRounds.filter(round => 
    round.pointsAwarded[team] > round.pointsAwarded[team === 'Team A' ? 'Team B' : 'Team A']
  ).length;
}

function calculateMVP(tournament: PinseekrCupConfig, completedRounds: PinseekrCupRoundResult[]): { playerId: string; name: string; pointsContributed: number } | undefined {
  const playerContributions: Record<string, number> = {};

  // Calculate each player's contribution to team points (simplified)
  tournament.players.forEach(player => {
    playerContributions[player.id] = completedRounds.reduce((sum, round) => {
      // Simplified: equal contribution from all team members
      const teamSize = tournament.players.filter(p => p.team === player.team).length;
      return sum + (round.pointsAwarded[player.team] / teamSize);
    }, 0);
  });

  const mvpId = Object.keys(playerContributions).reduce((a, b) => 
    playerContributions[a] > playerContributions[b] ? a : b
  );

  const mvpPlayer = tournament.players.find(p => p.id === mvpId);
  
  return mvpPlayer ? {
    playerId: mvpId,
    name: mvpPlayer.name,
    pointsContributed: Math.round(playerContributions[mvpId] * 10) / 10
  } : undefined;
}

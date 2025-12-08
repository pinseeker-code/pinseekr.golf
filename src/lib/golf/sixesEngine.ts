import { PlayerInRound } from './types';

export interface SixesResult {
  segments: SixesSegment[];
  playerTotals: { [playerId: string]: number };
  winners: string[];
}

export interface SixesSegment {
  holes: number[];
  teams: SixesTeam[];
  winner?: string;
  points: { [playerId: string]: number };
}

export interface SixesTeam {
  players: string[];
  totalScore: number;
  bestBallScore: number;
}

/**
 * Sixes Engine - Rotating partnerships every 6 holes with best ball scoring
 */
export class SixesEngine {
  /**
   * Calculate Sixes results for a round
   */
  calculateSixes(players: PlayerInRound[]): SixesResult {
    if (players.length < 3) {
      throw new Error('Sixes requires at least 3 players');
    }

    const segments: SixesSegment[] = [];
    const playerTotals: { [playerId: string]: number } = {};

    // Initialize player totals
    players.forEach(player => {
      playerTotals[player.playerId] = 0;
    });

    // Define segments (every 6 holes)
    const segmentRanges = [
      { start: 1, end: 6 },
      { start: 7, end: 12 },
      { start: 13, end: 18 }
    ];

    for (const segment of segmentRanges) {
      const segmentResult = this.calculateSegment(players, segment.start, segment.end);
      segments.push(segmentResult);

      // Add points to player totals
      Object.entries(segmentResult.points).forEach(([playerId, points]) => {
        playerTotals[playerId] += points;
      });
    }

    // Determine overall winners (highest total points)
    const winners = Object.entries(playerTotals)
      .sort(([, a], [, b]) => b - a)
      .filter(([, score], index, arr) => score === arr[0][1])
      .map(([playerId]) => playerId);

    return {
      segments,
      playerTotals,
      winners
    };
  }

  /**
   * Calculate results for a single 6-hole segment
   */
  private calculateSegment(players: PlayerInRound[], startHole: number, endHole: number): SixesSegment {
    const holes = Array.from({ length: endHole - startHole + 1 }, (_, i) => startHole + i);
    const teams = this.createTeamsForSegment(players, startHole);

    // Calculate team scores for this segment
    const teamScores = teams.map(team => ({
      ...team,
      segmentScore: this.calculateTeamSegmentScore(team, players, startHole, endHole)
    }));

    // Determine winning team
    const winningTeam = teamScores.reduce((best, current) =>
      current.segmentScore < best.segmentScore ? current : best
    );

    // Award points (winners get 1 point each, losers get 0)
    const points: { [playerId: string]: number } = {};
    players.forEach(player => {
      points[player.playerId] = winningTeam.players.includes(player.playerId) ? 1 : 0;
    });

    return {
      holes,
      teams: teamScores,
      winner: winningTeam.players.join(' & '),
      points
    };
  }

  /**
   * Create teams for a segment based on player count and segment number
   */
  private createTeamsForSegment(players: PlayerInRound[], startHole: number): SixesTeam[] {
    const playerCount = players.length;
    const segmentIndex = Math.floor((startHole - 1) / 6); // 0, 1, or 2

    if (playerCount === 3) {
      // Classic 3-player rotation
      const rotations = [
        // Segment 0 (holes 1-6): A&B vs C
        [['A', 'B'], ['C']],
        // Segment 1 (holes 7-12): A&C vs B
        [['A', 'C'], ['B']],
        // Segment 2 (holes 13-18): B&C vs A
        [['B', 'C'], ['A']]
      ];

      return rotations[segmentIndex].map(playerNames =>
        this.createTeamFromNames(playerNames, players)
      );
    } else if (playerCount === 4) {
      // 4-player rotation
      const rotations = [
        // Segment 0: A&B vs C&D
        [['A', 'B'], ['C', 'D']],
        // Segment 1: A&C vs B&D
        [['A', 'C'], ['B', 'D']],
        // Segment 2: A&D vs B&C
        [['A', 'D'], ['B', 'C']]
      ];

      return rotations[segmentIndex].map(playerNames =>
        this.createTeamFromNames(playerNames, players)
      );
    } else {
      // For 5+ players, create balanced teams
      return this.createBalancedTeams(players, segmentIndex);
    }
  }

  /**
   * Create a team from player name abbreviations
   */
  private createTeamFromNames(names: string[], allPlayers: PlayerInRound[]): SixesTeam {
    const teamPlayers = names.map(name => {
      // Map A, B, C, D to actual player IDs based on order
      const index = name.charCodeAt(0) - 'A'.charCodeAt(0);
      return allPlayers[index]?.playerId;
    }).filter(Boolean);

    return {
      players: teamPlayers,
      totalScore: 0,
      bestBallScore: 0
    };
  }

  /**
   * Create balanced teams for 5+ players
   */
  private createBalancedTeams(players: PlayerInRound[], segmentIndex: number): SixesTeam[] {
    const playerCount = players.length;
    const teamSize = Math.floor(playerCount / 2);
    const remainder = playerCount % 2;

    // Rotate team assignments
    const rotatedPlayers = [...players];
    for (let i = 0; i < segmentIndex; i++) {
      rotatedPlayers.push(rotatedPlayers.shift()!);
    }

    const teams: SixesTeam[] = [];
    let currentIndex = 0;

    // Create teams
    for (let i = 0; i < 2; i++) {
      const teamPlayerCount = teamSize + (i === 0 && remainder ? 1 : 0);
      const teamPlayers = rotatedPlayers
        .slice(currentIndex, currentIndex + teamPlayerCount)
        .map(p => p.playerId);

      teams.push({
        players: teamPlayers,
        totalScore: 0,
        bestBallScore: 0
      });

      currentIndex += teamPlayerCount;
    }

    return teams;
  }

  /**
   * Calculate a team's score for a segment using best ball
   */
  private calculateTeamSegmentScore(team: SixesTeam, allPlayers: PlayerInRound[], startHole: number, endHole: number): number {
    let totalScore = 0;

    for (let hole = startHole; hole <= endHole; hole++) {
      const holeIndex = hole - 1;
      const teamScores = team.players
        .map(playerId => {
          const player = allPlayers.find(p => p.playerId === playerId);
          return player?.scores[holeIndex] || 0;
        })
        .filter(score => score > 0);

      if (teamScores.length > 0) {
        // Best ball: lowest score on the hole
        const bestBallScore = Math.min(...teamScores);
        totalScore += bestBallScore;
      }
    }

    return totalScore;
  }
}

/**
 * Convenience function to calculate Sixes results
 */
export function sixesEngine(players: PlayerInRound[]): SixesResult {
  const engine = new SixesEngine();
  return engine.calculateSixes(players);
}
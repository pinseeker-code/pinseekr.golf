import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createPinseekrCup, 
  playPinseekrCupRound, 
  getPinseekrCupResults,
  type PinseekrCupPlayer,
  DEFAULT_PINSEEKR_CUP 
} from './pinseekrCupEngine';

describe('PinseekrCupEngine', () => {
  const mockPlayers: PinseekrCupPlayer[] = [
    { id: 'player1', name: 'Alice', handicap: 10, team: 'Team A' },
    { id: 'player2', name: 'Bob', handicap: 15, team: 'Team B' },
    { id: 'player3', name: 'Charlie', handicap: 8, team: 'Team A' },
    { id: 'player4', name: 'Diana', handicap: 12, team: 'Team B' }
  ];

  const mockScores: Record<string, number[]> = {
    'player1': [4, 5, 3, 4, 6, 4, 3, 5, 4, 4, 3, 5, 4, 4, 6, 3, 4, 5], // Total: 76
    'player2': [5, 6, 4, 5, 7, 5, 4, 6, 5, 5, 4, 6, 5, 5, 7, 4, 5, 6], // Total: 94
    'player3': [3, 4, 4, 3, 5, 3, 4, 4, 3, 3, 4, 4, 3, 3, 5, 4, 3, 4], // Total: 66
    'player4': [4, 5, 5, 4, 6, 4, 5, 5, 4, 4, 5, 5, 4, 4, 6, 5, 4, 5]  // Total: 83
  };

  describe('createPinseekrCup', () => {
    it('should create a tournament with correct structure', () => {
      const tournament = createPinseekrCup(mockPlayers);
      
      expect(tournament.name).toBe('Pinseekr Cup 2025');
      expect(tournament.players).toHaveLength(4);
      expect(tournament.rounds).toHaveLength(4);
      expect(tournament.totalPointsToWin).toBe(9);
    });

    it('should auto-assign teams if not provided', () => {
      const playersWithoutTeams = mockPlayers.map(p => ({ ...p, team: 'Team A' as const }));
      const tournament = createPinseekrCup(playersWithoutTeams);
      
      const teamACount = tournament.players.filter(p => p.team === 'Team A').length;
      const teamBCount = tournament.players.filter(p => p.team === 'Team B').length;
      
      expect(teamACount).toBe(2);
      expect(teamBCount).toBe(2);
    });

    it('should throw error for invalid player count', () => {
      expect(() => createPinseekrCup([mockPlayers[0]])).toThrow('Pinseekr Cup requires an even number of players');
      expect(() => createPinseekrCup(mockPlayers.slice(0, 3))).toThrow('Pinseekr Cup requires an even number of players');
    });
  });

  describe('playPinseekrCupRound', () => {
    let tournament: ReturnType<typeof createPinseekrCup>;

    beforeEach(() => {
      tournament = createPinseekrCup(mockPlayers);
    });

    it('should play a stroke play round correctly', () => {
      const result = playPinseekrCupRound(tournament, 'round-1', mockScores);
      
      expect(result.roundId).toBe('round-1');
      expect(result.gameMode).toBe('stroke');
      expect(result.pointsAwarded).toHaveProperty('Team A');
      expect(result.pointsAwarded).toHaveProperty('Team B');
      expect(result.summary).toContain('Stroke Play');
      
      // Team A should win (Alice: 76, Charlie: 66 = avg 71) vs Team B (Bob: 94, Diana: 83 = avg 88.5)
      expect(result.pointsAwarded['Team A']).toBeGreaterThan(result.pointsAwarded['Team B']);
    });

    it('should play a match play round correctly', () => {
      const result = playPinseekrCupRound(tournament, 'round-2', mockScores);
      
      expect(result.roundId).toBe('round-2');
      expect(result.gameMode).toBe('match');
      expect(result.summary).toContain('Singles Matches');
    });

    it('should play a dots round correctly', () => {
      const result = playPinseekrCupRound(tournament, 'round-3', mockScores);
      
      expect(result.roundId).toBe('round-3');
      expect(result.gameMode).toBe('dots');
      expect(result.summary).toContain('Dots Championship');
    });

    it('should play a snake round correctly', () => {
      const result = playPinseekrCupRound(tournament, 'round-4', mockScores);
      
      expect(result.roundId).toBe('round-4');
      expect(result.gameMode).toBe('snake');
      expect(result.summary).toContain('Snake Challenge');
    });

    it('should throw error for invalid round ID', () => {
      expect(() => playPinseekrCupRound(tournament, 'invalid-round', mockScores))
        .toThrow('Round invalid-round not found');
    });

    it('should throw error for already completed round', () => {
      tournament.rounds[0].completed = true;
      expect(() => playPinseekrCupRound(tournament, 'round-1', mockScores))
        .toThrow('Round round-1 has already been completed');
    });
  });

  describe('getPinseekrCupResults', () => {
    it('should calculate tournament standings correctly', () => {
      const tournament = createPinseekrCup(mockPlayers);
      const round1Result = playPinseekrCupRound(tournament, 'round-1', mockScores);
      const round2Result = playPinseekrCupRound(tournament, 'round-2', mockScores);
      
      const results = getPinseekrCupResults(tournament, [round1Result, round2Result]);
      
      expect(results.currentStandings).toHaveProperty('Team A');
      expect(results.currentStandings).toHaveProperty('Team B');
      expect(results.leaderboard).toHaveLength(2);
      expect(results.completedRounds).toHaveLength(2);
      expect(results.isComplete).toBe(false); // Should not be complete yet
    });

    it('should determine winner when threshold is reached', () => {
      const tournament = createPinseekrCup(mockPlayers);
      // Play all rounds to reach winning threshold
      const round1Result = playPinseekrCupRound(tournament, 'round-1', mockScores);
      const round2Result = playPinseekrCupRound(tournament, 'round-2', mockScores);
      const round3Result = playPinseekrCupRound(tournament, 'round-3', mockScores);
      const round4Result = playPinseekrCupRound(tournament, 'round-4', mockScores);
      
      const results = getPinseekrCupResults(tournament, [
        round1Result, 
        round2Result, 
        round3Result, 
        round4Result
      ]);
      
      const totalPoints = results.currentStandings['Team A'] + results.currentStandings['Team B'];
      expect(totalPoints).toBeGreaterThan(0);
      
      // Check if a winner is declared when appropriate
      if (results.currentStandings['Team A'] >= 9 || results.currentStandings['Team B'] >= 9) {
        expect(results.isComplete).toBe(true);
        expect(results.winner).toBeDefined();
      }
    });

    it('should calculate MVP correctly', () => {
      const tournament = createPinseekrCup(mockPlayers);
      const round1Result = playPinseekrCupRound(tournament, 'round-1', mockScores);
      const results = getPinseekrCupResults(tournament, [round1Result]);
      
      expect(results.mvpPlayer).toBeDefined();
      expect(results.mvpPlayer?.playerId).toBeDefined();
      expect(results.mvpPlayer?.name).toBeDefined();
      expect(results.mvpPlayer?.pointsContributed).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty completed rounds', () => {
      const tournament = createPinseekrCup(mockPlayers);
      const results = getPinseekrCupResults(tournament, []);
      
      expect(results.currentStandings['Team A']).toBe(0);
      expect(results.currentStandings['Team B']).toBe(0);
      expect(results.isComplete).toBe(false);
      expect(results.winner).toBeUndefined();
    });
  });

  describe('DEFAULT_PINSEEKR_CUP', () => {
    it('should have correct default structure', () => {
      expect(DEFAULT_PINSEEKR_CUP.name).toBe('Pinseekr Cup 2025');
      expect(DEFAULT_PINSEEKR_CUP.players).toHaveLength(0);
      expect(DEFAULT_PINSEEKR_CUP.rounds).toHaveLength(4);
      expect(DEFAULT_PINSEEKR_CUP.totalPointsToWin).toBe(9);
      
      // Check round structure
      const rounds = DEFAULT_PINSEEKR_CUP.rounds;
      expect(rounds[0].gameMode).toBe('stroke');
      expect(rounds[1].gameMode).toBe('match');
      expect(rounds[2].gameMode).toBe('dots');
      expect(rounds[3].gameMode).toBe('snake');
      
      // Check total points available
      const totalPointsAvailable = rounds.reduce((sum, round) => sum + round.pointsAvailable, 0);
      expect(totalPointsAvailable).toBe(16);
    });
  });
});

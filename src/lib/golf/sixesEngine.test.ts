import { describe, it, expect } from 'vitest';
import { sixesEngine } from './sixesEngine';
import { PlayerInRound } from './types';

describe('SixesEngine', () => {
  describe('calculateSixes', () => {
    it('should throw error for less than 3 players', () => {
      const players: PlayerInRound[] = [
        {
          playerId: 'player1',
          name: 'Player 1',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player2',
          name: 'Player 2',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 72,
          netTotal: 72
        }
      ];

      expect(() => sixesEngine(players)).toThrow('Sixes requires at least 3 players');
    });

    it('should calculate results for 3 players', () => {
      const players: PlayerInRound[] = [
        {
          playerId: 'player1',
          name: 'Player 1',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], // All pars
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player2',
          name: 'Player 2',
          handicap: 0,
          scores: [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], // Birdies first 6, pars rest
          total: 66,
          netTotal: 66
        },
        {
          playerId: 'player3',
          name: 'Player 3',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4], // Pars first 6, birdies middle 6
          total: 66,
          netTotal: 66
        }
      ];

      const result = sixesEngine(players);

      expect(result.segments).toHaveLength(3);
      expect(result.winners).toContain('player2'); // Should have most points
      expect(result.playerTotals.player1).toBe(2); // Won segments 1 and 2
      expect(result.playerTotals.player2).toBeGreaterThan(0);
      expect(result.playerTotals.player3).toBeGreaterThan(0);
    });

    it('should handle 4 players correctly', () => {
      const players: PlayerInRound[] = [
        {
          playerId: 'player1',
          name: 'Player 1',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player2',
          name: 'Player 2',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player3',
          name: 'Player 3',
          handicap: 0,
          scores: [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 66,
          netTotal: 66
        },
        {
          playerId: 'player4',
          name: 'Player 4',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4],
          total: 66,
          netTotal: 66
        }
      ];

      const result = sixesEngine(players);

      expect(result.segments).toHaveLength(3);
      expect(result.segments[0].teams).toHaveLength(2); // Two teams in each segment
      expect(result.segments[0].teams[0].players).toHaveLength(2); // Two players per team
      expect(result.segments[0].teams[1].players).toHaveLength(2);
    });

    it('should handle 5+ players with balanced teams', () => {
      const players: PlayerInRound[] = [
        {
          playerId: 'player1',
          name: 'Player 1',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player2',
          name: 'Player 2',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player3',
          name: 'Player 3',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player4',
          name: 'Player 4',
          handicap: 0,
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player5',
          name: 'Player 5',
          handicap: 0,
          scores: [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          total: 66,
          netTotal: 66
        }
      ];

      const result = sixesEngine(players);

      expect(result.segments).toHaveLength(3);
      // For 5 players, teams should be balanced (3 vs 2, or 2 vs 3 depending on rotation)
      result.segments.forEach(segment => {
        expect(segment.teams.length).toBe(2);
        expect(segment.teams[0].players.length + segment.teams[1].players.length).toBe(5);
      });
    });
  });

  describe('basic functionality', () => {
    it('should handle different player counts', () => {
      // Test that the engine works with 3, 4, and 5+ players
      const basePlayers: PlayerInRound[] = [
        {
          playerId: 'player1',
          name: 'Player 1',
          handicap: 0,
          scores: Array(18).fill(4),
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player2',
          name: 'Player 2',
          handicap: 0,
          scores: Array(18).fill(4),
          total: 72,
          netTotal: 72
        },
        {
          playerId: 'player3',
          name: 'Player 3',
          handicap: 0,
          scores: Array(18).fill(4),
          total: 72,
          netTotal: 72
        }
      ];

      // Test 3 players
      const result3 = sixesEngine(basePlayers);
      expect(result3.segments).toHaveLength(3);
      expect(result3.winners).toHaveLength(3); // All tied

      // Test 4 players
      const players4 = [...basePlayers, {
        playerId: 'player4',
        name: 'Player 4',
        handicap: 0,
        scores: Array(18).fill(4),
        total: 72,
        netTotal: 72
      }];
      const result4 = sixesEngine(players4);
      expect(result4.segments).toHaveLength(3);
      expect(result4.segments[0].teams).toHaveLength(2);

      // Test 5 players
      const players5 = [...players4, {
        playerId: 'player5',
        name: 'Player 5',
        handicap: 0,
        scores: Array(18).fill(4),
        total: 72,
        netTotal: 72
      }];
      const result5 = sixesEngine(players5);
      expect(result5.segments).toHaveLength(3);
      result5.segments.forEach(segment => {
        expect(segment.teams.length).toBe(2);
        expect(segment.teams[0].players.length + segment.teams[1].players.length).toBe(5);
      });
    });
  });
});
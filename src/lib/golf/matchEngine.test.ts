import { describe, it, expect } from 'vitest';
import {
  matchEngine,
  calculateMatchStatus,
  formatMatchStatus,
  convertToMatchData,
  type MatchConfig
} from './matchEngine';
import { type CoreRoundData } from './strokeEngine';

describe('Match Play Engine', () => {
  const sampleCourse = {
    holes: {
      1: { par: 4, strokeIndex: 10 },
      2: { par: 4, strokeIndex: 6 },
      3: { par: 3, strokeIndex: 16 },
      4: { par: 5, strokeIndex: 2 },
      5: { par: 4, strokeIndex: 14 },
      6: { par: 3, strokeIndex: 18 },
      7: { par: 4, strokeIndex: 8 },
      8: { par: 5, strokeIndex: 4 },
      9: { par: 4, strokeIndex: 12 },
      10: { par: 4, strokeIndex: 9 },
      11: { par: 4, strokeIndex: 5 },
      12: { par: 3, strokeIndex: 15 },
      13: { par: 5, strokeIndex: 1 },
      14: { par: 4, strokeIndex: 13 },
      15: { par: 3, strokeIndex: 17 },
      16: { par: 4, strokeIndex: 7 },
      17: { par: 5, strokeIndex: 3 },
      18: { par: 4, strokeIndex: 11 }
    }
  };

  const sampleMatchData: CoreRoundData = {
    players: ['alice', 'bob'],
    strokes: {
      'alice': { 1: 4, 2: 5, 3: 3, 4: 6, 5: 4, 6: 2, 7: 4, 8: 5, 9: 4, 10: 4, 11: 5, 12: 3, 13: 5, 14: 4, 15: 3, 16: 4, 17: 5, 18: 4 },
      'bob': { 1: 5, 2: 4, 3: 4, 4: 5, 5: 5, 6: 3, 7: 3, 8: 6, 9: 5, 10: 5, 11: 4, 12: 4, 13: 6, 14: 3, 15: 4, 16: 5, 17: 4, 18: 5 }
    },
    handicap: {
      pops: {
        'alice': { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0, 6: 0, 7: 0, 8: 1, 9: 0, 10: 0, 11: 0, 12: 0, 13: 1, 14: 0, 15: 0, 16: 0, 17: 1, 18: 0 },
        'bob': { 1: 1, 2: 1, 3: 0, 4: 1, 5: 0, 6: 0, 7: 1, 8: 1, 9: 0, 10: 1, 11: 1, 12: 0, 13: 1, 14: 0, 15: 0, 16: 1, 17: 1, 18: 0 }
      }
    },
    course: sampleCourse
  };

  describe('Basic Match Play', () => {
    it('should process match play correctly with gross scores', () => {
      const config: MatchConfig = { useNet: false };
      const result = matchEngine(sampleMatchData, config);

      expect(result.name).toBe('Match Play');
      expect(result.format).toBe('head-to-head');
      expect(result.holeByHole).toHaveLength(18);
      
      // Check some specific hole results
      const hole1 = result.holeByHole[0];
      expect(hole1.hole).toBe(1);
      expect(hole1.scores.alice).toBe(4);
      expect(hole1.scores.bob).toBe(5);
      expect(hole1.winner).toBe('alice'); // Alice wins hole 1
      expect(hole1.margin).toBe(1);
    });

    it('should process match play correctly with net scores', () => {
      const config: MatchConfig = { useNet: true };
      const result = matchEngine(sampleMatchData, config);

      // Check hole 1 with handicap strokes
      const hole1 = result.holeByHole[0];
      expect(hole1.netScores.alice).toBe(4); // 4 - 0 pops
      expect(hole1.netScores.bob).toBe(4); // 5 - 1 pop
      expect(hole1.winner).toBe(null); // Tie after handicap adjustment
    });

    it('should calculate match totals correctly', () => {
      const config: MatchConfig = { useNet: false };
      const result = matchEngine(sampleMatchData, config);

      const aliceTotals = result.totals.alice;
      const bobTotals = result.totals.bob;

      expect(aliceTotals.holesWon + aliceTotals.holesLost + aliceTotals.holesTied).toBe(18);
      expect(bobTotals.holesWon + bobTotals.holesLost + bobTotals.holesTied).toBe(18);
      
      // Alice's wins should equal Bob's losses
      expect(aliceTotals.holesWon).toBe(bobTotals.holesLost);
      expect(bobTotals.holesWon).toBe(aliceTotals.holesLost);
    });

    it('should determine match winner correctly', () => {
      const config: MatchConfig = { useNet: false };
      const result = matchEngine(sampleMatchData, config);

      expect(result.finalStatus.isComplete).toBe(true);
      expect(result.finalStatus.winner).toBeDefined();
      expect(result.matchSummary).toContain('wins');
    });

    it('should handle tied matches', () => {
      const tiedMatchData: CoreRoundData = {
        ...sampleMatchData,
        strokes: {
          'alice': Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, 4])),
          'bob': Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, 4]))
        }
      };

      const config: MatchConfig = { useNet: false };
      const result = matchEngine(tiedMatchData, config);

      expect(result.finalStatus.winner).toBe(null);
      expect(result.matchSummary).toBe('Match tied');
      expect(result.totals.alice.holesTied).toBe(18);
      expect(result.totals.bob.holesTied).toBe(18);
    });
  });

  describe('Match Status Calculation', () => {
    it('should calculate ongoing match status', () => {
      const config: MatchConfig = { useNet: false };
      const result = matchEngine(sampleMatchData, config);
      
      // Test status after 9 holes
      const status = calculateMatchStatus(result.holeByHole, 9, 'alice', 'bob');
      
      expect(status.holesRemaining).toBe(9);
      expect(status.isComplete).toBe(false);
      expect(['alice', 'bob', null]).toContain(status.leader);
    });

    it('should detect when match is decided early', () => {
      // Create a scenario where one player is way ahead
      const dominantMatchData: CoreRoundData = {
        ...sampleMatchData,
        strokes: {
          'alice': Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, 3])), // All birdies
          'bob': Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, 6]))    // All bogeys
        }
      };

      const config: MatchConfig = { useNet: false };
      const result = matchEngine(dominantMatchData, config);
      
      // Alice should win decisively
      expect(result.finalStatus.winner).toBe('alice');
      expect(result.finalStatus.margin).toBeGreaterThan(10);
    });
  });

  describe('Match Formatting', () => {
    it('should format match status correctly', () => {
      const playerNames = { 'alice': 'Alice Cooper', 'bob': 'Bob Wilson' };
      
      const status1 = {
        leader: 'alice',
        margin: 2,
        holesRemaining: 5,
        isComplete: false,
        winner: null
      };
      
      expect(formatMatchStatus(status1, playerNames)).toBe('Alice Cooper 2 up');

      const status2 = {
        leader: 'alice',
        margin: 3,
        holesRemaining: 0,
        isComplete: true,
        winner: 'alice'
      };
      
      expect(formatMatchStatus(status2, playerNames)).toBe('Alice Cooper wins 3 up');

      const status3 = {
        leader: null,
        margin: 0,
        holesRemaining: 5,
        isComplete: false,
        winner: null
      };
      
      expect(formatMatchStatus(status3, playerNames)).toBe('Match tied');
    });
  });

  describe('Data Conversion', () => {
    it('should convert player data to match format', () => {
      const players = [
        { playerId: 'alice', scores: [4, 5, 3, 6, 4, 2, 4, 5, 4, 4, 5, 3, 5, 4, 3, 4, 5, 4], handicap: 4 },
        { playerId: 'bob', scores: [5, 6, 4, 7, 5, 4, 5, 6, 5, 5, 6, 4, 6, 5, 4, 5, 6, 5], handicap: 10 }
      ];

      const converted = convertToMatchData(players);

      expect(converted.players).toEqual(['alice', 'bob']);
      expect(converted.strokes.alice[1]).toBe(4);
      expect(converted.strokes.alice[18]).toBe(4);
      expect(converted.strokes.bob[1]).toBe(5);
    });

    it('should reject invalid player counts', () => {
      const players = [
        { playerId: 'alice', scores: [4, 5, 3], handicap: 4 }
      ];

      expect(() => convertToMatchData(players)).toThrow('Match play requires exactly 2 players');
    });

    it('should reject invalid player counts in engine', () => {
      const invalidData = {
        ...sampleMatchData,
        players: ['alice', 'bob', 'charlie']
      };

      const config: MatchConfig = { useNet: false };
      expect(() => matchEngine(invalidData, config)).toThrow('Match play requires exactly 2 players');
    });
  });
});

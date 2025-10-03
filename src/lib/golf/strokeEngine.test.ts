import { describe, it, expect } from 'vitest';
import {
  strokeEngine,
  applyMaxScore,
  calculatePops,
  convertToRoundData,
  type CoreRoundData,
  type StrokeConfig,
  type MaxScoreRule
} from './strokeEngine';

describe('Stroke Play Engine', () => {
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

  const sampleRoundData: CoreRoundData = {
    players: ['alice', 'bob', 'charlie'],
    strokes: {
      'alice': { 1: 4, 2: 5, 3: 3, 4: 6, 5: 4, 6: 2, 7: 4, 8: 5, 9: 4, 10: 4, 11: 5, 12: 3, 13: 5, 14: 4, 15: 3, 16: 4, 17: 5, 18: 4 },
      'bob': { 1: 5, 2: 6, 3: 4, 4: 7, 5: 5, 6: 4, 7: 5, 8: 6, 9: 5, 10: 5, 11: 6, 12: 4, 13: 6, 14: 5, 15: 4, 16: 5, 17: 6, 18: 5 },
      'charlie': { 1: 3, 2: 4, 3: 2, 4: 5, 5: 3, 6: 3, 7: 3, 8: 4, 9: 3, 10: 3, 11: 4, 12: 2, 13: 4, 14: 3, 15: 2, 16: 3, 17: 4, 18: 3 }
    },
    handicap: {
      pops: {
        'alice': { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0, 6: 0, 7: 0, 8: 1, 9: 0, 10: 0, 11: 0, 12: 0, 13: 1, 14: 0, 15: 0, 16: 0, 17: 1, 18: 0 },
        'bob': { 1: 1, 2: 1, 3: 0, 4: 1, 5: 0, 6: 0, 7: 1, 8: 1, 9: 0, 10: 1, 11: 1, 12: 0, 13: 1, 14: 0, 15: 0, 16: 1, 17: 1, 18: 0 },
        'charlie': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0 }
      }
    },
    course: sampleCourse
  };

  describe('Basic Stroke Engine', () => {
    it('should calculate gross scores correctly', () => {
      const config: StrokeConfig = { useNet: false };
      const result = strokeEngine(sampleRoundData, config);

      expect(result.name).toBe('Stroke Play');
      expect(result.ledger).toEqual([]);
      
      expect(result.breakdown.totals.alice.gross).toBe(73);
      expect(result.breakdown.totals.bob.gross).toBe(93);
      expect(result.breakdown.totals.charlie.gross).toBe(58);

      expect(result.breakdown.leaderboard[0].playerId).toBe('charlie');
      expect(result.breakdown.leaderboard[0].position).toBe(1);
      expect(result.breakdown.leaderboard[1].playerId).toBe('alice');
      expect(result.breakdown.leaderboard[2].playerId).toBe('bob');
    });

    it('should calculate net scores correctly', () => {
      const config: StrokeConfig = { useNet: true };
      const result = strokeEngine(sampleRoundData, config);

      expect(result.breakdown.totals.alice.net).toBe(69);
      expect(result.breakdown.totals.bob.net).toBe(83);
      expect(result.breakdown.totals.charlie.net).toBe(58);

      expect(result.breakdown.leaderboard[0].playerId).toBe('charlie');
      expect(result.breakdown.leaderboard[0].score).toBe(58);
      expect(result.breakdown.leaderboard[0].scoreType).toBe('net');
    });
  });

  describe('Maximum Score Rules', () => {
    it('should apply double bogey maximum', () => {
      const rule: MaxScoreRule = { type: 'double-bogey' };
      expect(applyMaxScore(8, rule, { par: 4 })).toBe(6);
      expect(applyMaxScore(5, rule, { par: 4 })).toBe(5);
    });

    it('should apply par-plus maximum', () => {
      const rule: MaxScoreRule = { type: 'par-plus', value: 3 };
      expect(applyMaxScore(9, rule, { par: 4 })).toBe(7);
      expect(applyMaxScore(6, rule, { par: 4 })).toBe(6);
    });

    it('should apply fixed maximum', () => {
      const rule: MaxScoreRule = { type: 'fixed', value: 8 };
      expect(applyMaxScore(12, rule, { par: 4 })).toBe(8);
      expect(applyMaxScore(7, rule, { par: 4 })).toBe(7);
    });
  });

  describe('Handicap Calculations', () => {
    it('should calculate pops correctly for various handicaps', () => {
      const holes = sampleCourse.holes;
      
      const pops10 = calculatePops(10, holes);
      const strokeCount = Object.values(pops10).reduce((sum, strokes) => sum + strokes, 0);
      expect(strokeCount).toBe(10);

      expect(pops10[13]).toBe(1);
      expect(pops10[4]).toBe(1);
      expect(pops10[15]).toBe(0);
    });

    it('should handle scratch players', () => {
      const pops0 = calculatePops(0, sampleCourse.holes);
      const strokeCount = Object.values(pops0).reduce((sum, strokes) => sum + strokes, 0);
      expect(strokeCount).toBe(0);
    });
  });

  describe('Data Conversion', () => {
    it('should convert PlayerInRound format to CoreRoundData', () => {
      const players = [
        { playerId: 'alice', scores: [4, 5, 3, 6, 4, 2, 4, 5, 4, 4, 5, 3, 5, 4, 3, 4, 5, 4], handicap: 4 },
        { playerId: 'bob', scores: [5, 6, 4, 7, 5, 4, 5, 6, 5, 5, 6, 4, 6, 5, 4, 5, 6, 5], handicap: 10 }
      ];

      const converted = convertToRoundData(players);

      expect(converted.players).toEqual(['alice', 'bob']);
      expect(converted.strokes.alice[1]).toBe(4);
      expect(converted.strokes.alice[18]).toBe(4);
      expect(converted.handicap?.pops.alice).toBeDefined();
    });
  });
});

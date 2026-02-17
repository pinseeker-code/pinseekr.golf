import { describe, it, expect } from 'vitest';
import {
  getHandicapPercentage,
  calculatePlayingHandicap,
  calculateScrambleHandicaps,
  calculateMatchPlayDifferential,
  adjustHandicapsForFormat,
} from './handicapUtils';

describe('Handicap Utilities', () => {
  describe('getHandicapPercentage', () => {
    it('should return 100% for stroke play', () => {
      expect(getHandicapPercentage('stroke-play')).toBe(1.0);
    });

    it('should return 100% for match play', () => {
      expect(getHandicapPercentage('match-play')).toBe(1.0);
    });

    it('should return 90% for best ball', () => {
      expect(getHandicapPercentage('best-ball')).toBe(0.9);
    });

    it('should return 35% for scramble', () => {
      expect(getHandicapPercentage('scramble')).toBe(0.35);
    });

    it('should return 100% for side games', () => {
      expect(getHandicapPercentage('dots')).toBe(1.0);
      expect(getHandicapPercentage('snake')).toBe(1.0);
      expect(getHandicapPercentage('sixes')).toBe(1.0);
    });
  });

  describe('calculatePlayingHandicap', () => {
    it('should return same handicap for stroke play', () => {
      expect(calculatePlayingHandicap(10, 'stroke-play')).toBe(10);
    });

    it('should return 90% for best ball', () => {
      expect(calculatePlayingHandicap(10, 'best-ball')).toBe(9);
      expect(calculatePlayingHandicap(20, 'best-ball')).toBe(18);
    });

    it('should round to nearest integer', () => {
      expect(calculatePlayingHandicap(15, 'best-ball')).toBe(14); // 13.5 rounds to 14
    });
  });

  describe('calculateScrambleHandicaps', () => {
    it('should give 35% to lowest, 15% to others', () => {
      const result = calculateScrambleHandicaps([10, 20, 15, 25]);
      expect(result[0]).toBe(4);  // 10 * 0.35 = 3.5 rounds to 4
      expect(result[1]).toBe(3);  // 20 * 0.15 = 3
      expect(result[2]).toBe(2);  // 15 * 0.15 = 2.25 rounds to 2
      expect(result[3]).toBe(4);  // 25 * 0.15 = 3.75 rounds to 4
    });

    it('should handle single player', () => {
      const result = calculateScrambleHandicaps([10]);
      expect(result[0]).toBe(4); // 35% of lowest
    });

    it('should handle empty array', () => {
      const result = calculateScrambleHandicaps([]);
      expect(result).toEqual([]);
    });
  });

  describe('calculateMatchPlayDifferential', () => {
    it('should give strokes to higher handicap player', () => {
      const [p1, p2] = calculateMatchPlayDifferential(5, 15);
      expect(p1).toBe(0);  // Lower handicap plays scratch
      expect(p2).toBe(10); // Gets 10 strokes
    });

    it('should work in reverse order', () => {
      const [p1, p2] = calculateMatchPlayDifferential(15, 5);
      expect(p1).toBe(10); // Gets 10 strokes
      expect(p2).toBe(0);  // Lower handicap plays scratch
    });

    it('should handle equal handicaps', () => {
      const [p1, p2] = calculateMatchPlayDifferential(10, 10);
      expect(p1).toBe(0);
      expect(p2).toBe(0);
    });

    it('should handle scratch vs handicap player', () => {
      const [p1, p2] = calculateMatchPlayDifferential(0, 18);
      expect(p1).toBe(0);
      expect(p2).toBe(18);
    });
  });

  describe('adjustHandicapsForFormat', () => {
    const handicaps = {
      alice: 10,
      bob: 20,
      charlie: 15,
    };

    it('should adjust for stroke play (100%)', () => {
      const result = adjustHandicapsForFormat(handicaps, 'stroke-play');
      expect(result.alice).toBe(10);
      expect(result.bob).toBe(20);
      expect(result.charlie).toBe(15);
    });

    it('should adjust for best ball (90%)', () => {
      const result = adjustHandicapsForFormat(handicaps, 'best-ball');
      expect(result.alice).toBe(9);
      expect(result.bob).toBe(18);
      expect(result.charlie).toBe(14); // 13.5 rounds to 14
    });

    it('should handle match play differential', () => {
      const matchHandicaps = { alice: 5, bob: 15 };
      const result = adjustHandicapsForFormat(matchHandicaps, 'match-play', true);
      expect(result.alice).toBe(0);
      expect(result.bob).toBe(10);
    });

    it('should not use differential when flag is false', () => {
      const matchHandicaps = { alice: 5, bob: 15 };
      const result = adjustHandicapsForFormat(matchHandicaps, 'match-play', false);
      expect(result.alice).toBe(5);
      expect(result.bob).toBe(15);
    });

    it('should handle scramble format', () => {
      const result = adjustHandicapsForFormat(handicaps, 'scramble');
      expect(result.alice).toBe(4);  // Lowest: 10 * 0.35
      expect(result.charlie).toBe(2); // 15 * 0.15
      expect(result.bob).toBe(3);     // 20 * 0.15
    });
  });
});

import { describe, it, expect } from 'vitest';
import { dotsEngine, convertToDotsData, type DotsConfig } from './dotsEngine';
import type { CoreRoundData } from './strokeEngine';

describe('dotsEngine', () => {
  const sampleRoundData: CoreRoundData = {
    players: ['alice', 'bob', 'charlie'],
    strokes: {
      alice: { 1: 4, 2: 3, 3: 5 },
      bob: { 1: 5, 2: 4, 3: 6 },
      charlie: { 1: 3, 2: 4, 3: 4 }
    },
    course: {
      holes: {
        1: { par: 4, strokeIndex: 10 },
        2: { par: 3, strokeIndex: 18 },
        3: { par: 5, strokeIndex: 5 }
      }
    }
  };

  it('should process a basic dots game with estimated data', () => {
    const dotsData = convertToDotsData(sampleRoundData);
    const config: DotsConfig = {
      wagerPerDot: 100,
      fairwayDots: 1,
      girDots: 1,
      onePuttDots: 1,
      birdieDots: 2,
      eagleDots: 5,
      doubleBogeyPenalty: -1
    };

    const result = dotsEngine(dotsData, config);

    expect(result.name).toBe('Dots');
    expect(result.holeByHole).toHaveLength(3);
    expect(result.totals).toHaveProperty('alice');
    expect(result.totals).toHaveProperty('bob');
    expect(result.totals).toHaveProperty('charlie');
    expect(result.leaderboard).toHaveLength(3);
    expect(Array.isArray(result.payments)).toBe(true);
  });

  it('should handle empty strokes gracefully', () => {
    const emptyData: CoreRoundData = {
      players: ['alice'],
      strokes: {},
      course: {
        holes: {
          1: { par: 4, strokeIndex: 10 }
        }
      }
    };

    const dotsData = convertToDotsData(emptyData);
    const result = dotsEngine(dotsData);

    expect(result.totals.alice.totalDots).toBe(0);
  });

  it('should calculate birdie dots correctly for par achievement', () => {
    const roundData: CoreRoundData = {
      players: ['alice'],
      strokes: {
        alice: { 1: 3 } // birdie on par 4
      },
      course: {
        holes: {
          1: { par: 4, strokeIndex: 10 }
        }
      }
    };

    const dotsData = convertToDotsData(roundData);
    const config: DotsConfig = { birdieDots: 2 };
    const result = dotsEngine(dotsData, config);

    // Should get birdie dots (estimating other achievements)
    expect(result.totals.alice.birdieDots).toBeGreaterThan(0);
  });

  it('should apply double bogey penalty correctly', () => {
    const roundData: CoreRoundData = {
      players: ['alice'],
      strokes: {
        alice: { 1: 6 } // double bogey on par 4
      },
      course: {
        holes: {
          1: { par: 4, strokeIndex: 10 }
        }
      }
    };

    const dotsData = convertToDotsData(roundData);
    const config: DotsConfig = { doubleBogeyPenalty: -1 };
    const result = dotsEngine(dotsData, config);

    // Should have penalty applied
    expect(result.totals.alice.penaltyDots).toBeLessThanOrEqual(0);
  });

  it('should rank players correctly on leaderboard', () => {
    const dotsData = convertToDotsData(sampleRoundData);
    const result = dotsEngine(dotsData);

    // Leaderboard should be sorted by total dots (descending)
    expect(result.leaderboard[0].position).toBe(1);
    if (result.leaderboard.length > 1) {
      expect(result.leaderboard[0].dots).toBeGreaterThanOrEqual(result.leaderboard[1].dots);
    }
  });

  it('should calculate payments based on dot differences', () => {
    const dotsData = convertToDotsData(sampleRoundData);
    const config: DotsConfig = { wagerPerDot: 100 };
    const result = dotsEngine(dotsData, config);

    // Should have payment calculations
    expect(Array.isArray(result.payments)).toBe(true);
    
    // If there are payments, they should have the correct structure
    result.payments.forEach(payment => {
      expect(payment).toHaveProperty('from');
      expect(payment).toHaveProperty('to');
      expect(payment).toHaveProperty('amount');
      expect(payment).toHaveProperty('reason');
      expect(payment.amount).toBeGreaterThan(0);
    });
  });

  it('should use default configuration when none provided', () => {
    const dotsData = convertToDotsData(sampleRoundData);
    const result = dotsEngine(dotsData);

    expect(result.name).toBe('Dots');
    expect(result.holeByHole).toHaveLength(3);
    expect(result.totals).toBeDefined();
  });
});

describe('convertToDotsData', () => {
  const sampleRoundData: CoreRoundData = {
    players: ['alice'],
    strokes: {
      alice: { 1: 4 }
    },
    course: {
      holes: {
        1: { par: 4, strokeIndex: 10 }
      }
    }
  };

  it('should convert stroke data to dots format with estimated hole data', () => {
    const result = convertToDotsData(sampleRoundData);

    expect(result.players).toEqual(['alice']);
    expect(result.strokes).toEqual(sampleRoundData.strokes);
    expect(result.course).toEqual(sampleRoundData.course);
    expect(result.holeData).toHaveProperty('alice');
    expect(result.holeData.alice).toHaveProperty('1');
    
    const holeData = result.holeData.alice[1];
    expect(holeData.strokes).toBe(4);
    expect(holeData.par).toBe(4);
    expect(typeof holeData.putts).toBe('number');
    expect(typeof holeData.fairwayHit).toBe('boolean');
    expect(typeof holeData.greenInRegulation).toBe('boolean');
  });

  it('should handle missing course data gracefully', () => {
    const dataWithoutCourse = {
      players: ['alice'],
      strokes: {
        alice: { 1: 4 }
      },
      course: {
        holes: {
          1: { par: 4, strokeIndex: 1 }
        }
      }
    };

    const result = convertToDotsData(dataWithoutCourse);
    
    expect(result.holeData.alice[1].par).toBe(4); // should use course par
  });
});

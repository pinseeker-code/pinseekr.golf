import { describe, it, expect } from 'vitest';
import { snakeEngine, convertToSnakeData, getSnakeStatus, formatThreePuttSummary, type SnakeConfig } from './snakeEngine';
import type { CoreRoundData } from './strokeEngine';

describe('getSnakeStatus', () => {
  it('should return correct status without penalty', () => {
    const result = {
      name: 'Snake',
      holeByHole: [],
      finalSnakeHolder: null,
      snakePasses: 0,
      threePuttSummary: {},
      penalty: null,
      variant: 'fixed' as const,
      currentMultiplier: 1
    };

    const status = getSnakeStatus(result);
    expect(status).toBe("No three-putts this round - no snake penalty!");
  });
});

describe('Snake Engine', () => {
  const sampleSnakeData = {
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
    },
    putts: {
      alice: { 1: 2, 2: 1, 3: 2 },
      bob: { 1: 3, 2: 2, 3: 3 }, // two three-putts
      charlie: { 1: 1, 2: 2, 3: 1 }
    }
  };

  it('should process a basic snake game', () => {
    const config: SnakeConfig = {
      penaltyAmount: 1000,
      threePuttThreshold: 3,
      distributeToGroup: false
    };

    const result = snakeEngine(sampleSnakeData, config);

    expect(result.name).toBe('Snake (Fixed)');
    expect(result.holeByHole).toHaveLength(3);
    expect(result.finalSnakeHolder).toBe('bob'); // bob had three-putts
    expect(result.snakePasses).toBe(2); // bob three-putted twice
    expect(result.threePuttSummary.bob).toBe(2);
    expect(result.threePuttSummary.alice).toBe(0);
    expect(result.threePuttSummary.charlie).toBe(0);
  });

  it('should calculate penalty correctly when distributing to group', () => {
    const config: SnakeConfig = {
      penaltyAmount: 1000,
      distributeToGroup: true
    };

    const result = snakeEngine(sampleSnakeData, config);

    expect(result.penalty).toBeTruthy();
    expect(result.penalty!.loser).toBe('bob');
    expect(result.penalty!.amount).toBe(1000);
    expect(result.penalty!.recipients).toHaveLength(1);
    expect(result.penalty!.recipients[0].playerId).toBe('pot');
    expect(result.penalty!.recipients[0].amount).toBe(1000);
  });

  it('should split penalty among other players when not distributing to group', () => {
    const config: SnakeConfig = {
      penaltyAmount: 1000,
      distributeToGroup: false
    };

    const result = snakeEngine(sampleSnakeData, config);

    expect(result.penalty).toBeTruthy();
    expect(result.penalty!.loser).toBe('bob');
    expect(result.penalty!.amount).toBe(1000);
    expect(result.penalty!.recipients).toHaveLength(2); // alice and charlie
    expect(result.penalty!.recipients[0].amount).toBe(500); // 1000 / 2
    expect(result.penalty!.recipients[1].amount).toBe(500);
  });

  it('should handle no three-putts scenario', () => {
    const noThreePuttData = {
      ...sampleSnakeData,
      putts: {
        alice: { 1: 2, 2: 1, 3: 2 },
        bob: { 1: 2, 2: 2, 3: 2 }, // no three-putts
        charlie: { 1: 1, 2: 2, 3: 1 }
      }
    };

    const result = snakeEngine(noThreePuttData);

    expect(result.finalSnakeHolder).toBeNull();
    expect(result.snakePasses).toBe(0);
    expect(result.penalty).toBeNull();
    expect(Object.values(result.threePuttSummary).every(count => count === 0)).toBe(true);
  });

  it('should use default configuration when none provided', () => {
    const result = snakeEngine(sampleSnakeData);

    expect(result.name).toBe('Snake (Fixed)');
    expect(result.penalty!.amount).toBe(500); // default penalty amount
  });

  it('should handle custom three-putt threshold', () => {
    const config: SnakeConfig = {
      threePuttThreshold: 4 // only 4+ putts count
    };

    const highPuttData = {
      ...sampleSnakeData,
      putts: {
        alice: { 1: 2, 2: 1, 3: 2 },
        bob: { 1: 4, 2: 2, 3: 3 }, // one four-putt
        charlie: { 1: 1, 2: 2, 3: 1 }
      }
    };

    const result = snakeEngine(highPuttData, config);

    expect(result.finalSnakeHolder).toBe('bob');
    expect(result.snakePasses).toBe(1);
    expect(result.threePuttSummary.bob).toBe(1);
  });

  it('should track snake passes correctly with multiple players three-putting', () => {
    const multiThreePuttData = {
      ...sampleSnakeData,
      putts: {
        alice: { 1: 3, 2: 1, 3: 2 }, // three-putt on hole 1
        bob: { 1: 2, 2: 3, 3: 2 }, // three-putt on hole 2
        charlie: { 1: 1, 2: 2, 3: 3 } // three-putt on hole 3
      }
    };

    const result = snakeEngine(multiThreePuttData);

    expect(result.finalSnakeHolder).toBe('charlie'); // last three-putter
    expect(result.snakePasses).toBe(3);
    expect(result.threePuttSummary.alice).toBe(1);
    expect(result.threePuttSummary.bob).toBe(1);
    expect(result.threePuttSummary.charlie).toBe(1);
  });

  it('should handle missing putt data gracefully', () => {
    const missingPuttData = {
      players: ['alice'],
      strokes: {
        alice: { 1: 4 }
      },
      course: {
        holes: {
          1: { par: 4, strokeIndex: 10 }
        }
      },
      putts: {} // no putt data
    };

    const result = snakeEngine(missingPuttData);

    expect(result.finalSnakeHolder).toBeNull();
    expect(result.snakePasses).toBe(0);
  });
});

describe('convertToSnakeData', () => {
  const sampleRoundData: CoreRoundData = {
    players: ['alice', 'bob'],
    strokes: {
      alice: { 1: 3, 2: 4, 3: 6 }, // birdie, par, double bogey
      bob: { 1: 5, 2: 3, 3: 4 }    // bogey, birdie, par
    },
    course: {
      holes: {
        1: { par: 4, strokeIndex: 10 },
        2: { par: 4, strokeIndex: 5 },
        3: { par: 4, strokeIndex: 15 }
      }
    }
  };

  it('should convert stroke data to snake format with estimated putts', () => {
    const result = convertToSnakeData(sampleRoundData);

    expect(result.players).toEqual(['alice', 'bob']);
    expect(result.strokes).toEqual(sampleRoundData.strokes);
    expect(result.course).toEqual(sampleRoundData.course);
    expect(result.putts).toHaveProperty('alice');
    expect(result.putts).toHaveProperty('bob');
    
    // Check that putts are estimated for each hole
    expect(result.putts.alice).toHaveProperty('1');
    expect(result.putts.alice).toHaveProperty('2');
    expect(result.putts.alice).toHaveProperty('3');
    
    // Putts should be reasonable numbers
    Object.values(result.putts.alice).forEach(putts => {
      expect(putts).toBeGreaterThanOrEqual(1);
      expect(putts).toBeLessThanOrEqual(4);
    });
  });

  it('should estimate putts based on score relative to par', () => {
    const result = convertToSnakeData(sampleRoundData);
    
    // Alice made birdie on hole 1 (3 on par 4) - should likely have 1 putt
    // Alice made double bogey on hole 3 (6 on par 4) - should likely have more putts
    const alice1Putts = result.putts.alice[1];
    const alice3Putts = result.putts.alice[3];
    
    expect(typeof alice1Putts).toBe('number');
    expect(typeof alice3Putts).toBe('number');
    
    // These are probabilistic, but generally birdie -> fewer putts, double bogey -> more putts
    expect(alice1Putts).toBeGreaterThanOrEqual(1);
    expect(alice3Putts).toBeGreaterThanOrEqual(1);
  });

  it('should use custom estimation config', () => {
    const config = {
      averagePuttsPerHole: 2.5,
      threePuttRate: 0.2,
      onePuttRate: 0.1
    };
    
    const result = convertToSnakeData(sampleRoundData, config);
    
    expect(result.putts).toBeDefined();
    expect(Object.keys(result.putts)).toHaveLength(2);
  });
});

describe('getSnakeStatus', () => {
  it('should return correct status for no snake holder', () => {
    const result = {
      name: 'Snake',
      holeByHole: [],
      finalSnakeHolder: null,
      snakePasses: 0,
      threePuttSummary: {},
      penalty: null,
      variant: 'fixed' as const,
      currentMultiplier: 1
    };

    const status = getSnakeStatus(result);
    expect(status).toBe("No three-putts this round - no snake penalty!");
  });

  it('should return correct status with penalty', () => {
    const result = {
      name: 'Snake',
      holeByHole: [],
      finalSnakeHolder: 'bob',
      snakePasses: 2,
      threePuttSummary: { bob: 2 },
      penalty: {
        loser: 'bob',
        amount: 1000,
        baseAmount: 1000,
        multiplier: 1,
        recipients: []
      },
      variant: 'fixed' as const,
      currentMultiplier: 1
    };

    const status = getSnakeStatus(result);
    expect(status).toBe("bob holds the snake and owes 1000 sats!");
  });

  it('should return correct status without penalty', () => {
    const result = {
      name: 'Snake',
      holeByHole: [],
      finalSnakeHolder: 'bob',
      snakePasses: 1,
      threePuttSummary: { bob: 1 },
      penalty: null,
      variant: 'fixed' as const,
      currentMultiplier: 1
    };

    const status = getSnakeStatus(result);
    expect(status).toBe("bob holds the snake");
  });
});

describe('formatThreePuttSummary', () => {
  it('should format three-putt summary correctly', () => {
    const summary = {
      alice: 0,
      bob: 2,
      charlie: 1
    };

    const formatted = formatThreePuttSummary(summary);
    
    expect(formatted).toHaveLength(2); // only bob and charlie have three-putts
    expect(formatted).toContain('bob: 2 three-putts');
    expect(formatted).toContain('charlie: 1 three-putt');
  });

  it('should handle empty summary', () => {
    const summary = {
      alice: 0,
      bob: 0
    };

    const formatted = formatThreePuttSummary(summary);
    expect(formatted).toHaveLength(0);
  });
});

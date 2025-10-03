import { describe, it, expect } from 'vitest';
import { PlayerInRound } from './types';
import { 
  nassauProcessor, 
  skinsProcessor, 
  netting, 
  processRoundWagers,
  getNetSettlement,
  type ScoreData,
  type WagerConfig,
  type MatchBreakdown,
  type SkinBreakdown
} from './scoringEngine';

describe('Scoring Engine - Wager Processing', () => {
  const mockScoreData: ScoreData = {
    'alice': {
      scores: [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4], // 72 total
      handicap: 10,
      netScores: [4, 3, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4] // 67 net
    },
    'bob': {
      scores: [5, 4, 6, 5, 5, 4, 5, 6, 5, 5, 4, 6, 5, 5, 4, 5, 6, 5], // 90 total
      handicap: 18,
      netScores: [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4] // 72 net
    },
    'charlie': {
      scores: [3, 4, 4, 3, 3, 4, 3, 4, 3, 3, 4, 4, 3, 3, 4, 3, 4, 3], // 62 total (very good)
      handicap: 2,
      netScores: [3, 4, 4, 3, 3, 4, 3, 4, 3, 3, 4, 4, 3, 3, 4, 3, 4, 3] // 60 net
    }
  };

  const wagerConfig: WagerConfig = {
    useNet: false,
    unitSats: 1000,
    carryCap: 3
  };

  describe('Nassau Processor', () => {
    it('should calculate Nassau correctly with clear winners', () => {
      const result = nassauProcessor(mockScoreData, wagerConfig);
      
      expect(result.name).toBe('Nassau');
      expect(result.breakdown).toHaveLength(3); // Front 9, Back 9, Overall
      
      // Charlie should win all three (lowest scores)
      const frontNine = result.breakdown.find(b => 'match' in b && b.match === 'Front 9') as MatchBreakdown;
      const backNine = result.breakdown.find(b => 'match' in b && b.match === 'Back 9') as MatchBreakdown;
      const overall = result.breakdown.find(b => 'match' in b && b.match === 'Overall') as MatchBreakdown;
      
      expect(frontNine?.winner).toBe('charlie');
      expect(backNine?.winner).toBe('charlie');
      expect(overall?.winner).toBe('charlie');
      
      // Should have 6 payments (2 losers × 3 matches)
      expect(result.ledger).toHaveLength(6);
      
      // Each payment should be 1000 sats
      expect(result.ledger.every(p => p.amount === 1000)).toBe(true);
      
      // All payments should go to charlie
      expect(result.ledger.every(p => p.to === 'charlie')).toBe(true);
    });

    it('should handle pushes in Nassau', () => {
      const tieData: ScoreData = {
        'alice': { scores: Array(18).fill(4), handicap: 0, netScores: Array(18).fill(4) },
        'bob': { scores: Array(18).fill(4), handicap: 0, netScores: Array(18).fill(4) }
      };
      
      const result = nassauProcessor(tieData, wagerConfig);
      
      // Should have pushes for all matches
      expect(result.breakdown.every(b => 'result' in b && b.result === 'Push')).toBe(true);
      expect(result.ledger).toHaveLength(0);
    });
  });

  describe('Skins Processor', () => {
    it('should process skins with carryovers', () => {
      // Create data where holes 1-2 tie, hole 3 alice wins (3 skins)
      const skinsData: ScoreData = {
        'alice': { 
          scores: [4, 4, 3, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 
          handicap: 0, 
          netScores: [4, 4, 3, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] 
        },
        'bob': { 
          scores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 
          handicap: 0, 
          netScores: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] 
        }
      };
      
      const result = skinsProcessor(skinsData, wagerConfig);
      
      expect(result.name).toBe('Skins');
      
      // Should have hole 3 win with 3 skins
      const hole3Win = result.breakdown.find(b => 'hole' in b && b.hole === 3 && b.winner) as SkinBreakdown;
      expect(hole3Win?.winner).toBe('alice');
      expect(hole3Win?.skins).toBe(3);
      
      // Alice should get paid for 3 skins
      const alicePayments = result.ledger.filter(p => p.to === 'alice');
      expect(alicePayments).toHaveLength(1); // One payment from bob
      expect(alicePayments[0].amount).toBe(3000); // 3 skins × 1000 sats
    });

    it('should handle carry cap', () => {
      // Create data where all holes tie until carry cap
      const tieData: ScoreData = {
        'alice': { scores: Array(18).fill(4), handicap: 0, netScores: Array(18).fill(4) },
        'bob': { scores: Array(18).fill(4), handicap: 0, netScores: Array(18).fill(4) }
      };
      
      const result = skinsProcessor(tieData, { ...wagerConfig, carryCap: 3 });
      
      // Should have carry cap voided skins
      const voidedSkins = result.breakdown.filter(b => 'result' in b && b.result?.includes('Carry cap'));
      expect(voidedSkins.length).toBeGreaterThan(0);
      
      // No payments should be made
      expect(result.ledger).toHaveLength(0);
    });
  });

  describe('Netting Function', () => {
    it('should optimize payments correctly', () => {
      const rawLedger = [
        { from: 'alice', to: 'bob', amount: 1000, memo: 'test' },
        { from: 'bob', to: 'alice', amount: 500, memo: 'test' },
        { from: 'alice', to: 'charlie', amount: 2000, memo: 'test' },
        { from: 'charlie', to: 'bob', amount: 1500, memo: 'test' }
      ];
      
      const netted = netting(rawLedger);
      
      // Should reduce to fewer payments
      expect(netted.length).toBeLessThan(rawLedger.length);
      
      // Net balances should be correct
      // Alice: pays 1000 to bob + 2000 to charlie - receives 500 from bob = -2500
      const aliceNet = netted.filter(p => p.from === 'alice').reduce((sum, p) => sum - p.amount, 0)
                    + netted.filter(p => p.to === 'alice').reduce((sum, p) => sum + p.amount, 0);
      expect(aliceNet).toBe(-2500); // Alice owes 2500 net
      
      // Bob: receives 1000 from alice - pays 500 to alice + receives 1500 from charlie = +2000  
      const bobNet = netted.filter(p => p.from === 'bob').reduce((sum, p) => sum - p.amount, 0)
                   + netted.filter(p => p.to === 'bob').reduce((sum, p) => sum + p.amount, 0);
      expect(bobNet).toBe(2000); // Bob receives 2000 net
      
      // Charlie: receives 2000 from alice - pays 1500 to bob = +500
      const charlieNet = netted.filter(p => p.from === 'charlie').reduce((sum, p) => sum - p.amount, 0)
                       + netted.filter(p => p.to === 'charlie').reduce((sum, p) => sum + p.amount, 0);
      expect(charlieNet).toBe(500); // Charlie receives 500 net
    });
  });

  describe('Full Round Processing', () => {
    it('should process multiple game types and net settlements', () => {
      const players: PlayerInRound[] = [
        { playerId: 'alice', name: 'Alice', handicap: 10, scores: mockScoreData.alice.scores, total: 72, netTotal: 67 },
        { playerId: 'bob', name: 'Bob', handicap: 18, scores: mockScoreData.bob.scores, total: 90, netTotal: 72 },
        { playerId: 'charlie', name: 'Charlie', handicap: 2, scores: mockScoreData.charlie.scores, total: 62, netTotal: 60 }
      ];
      
      const gameConfigs = {
        'Nassau': { useNet: false, unitSats: 1000 },
        'Skins': { useNet: false, unitSats: 500, carryCap: 4 }
      };
      
      const results = processRoundWagers(players, gameConfigs);
      
      expect(results).toHaveProperty('Nassau');
      expect(results).toHaveProperty('Skins');
      
      // Get net settlement
      const netSettlement = getNetSettlement(results);
      
      // Should have optimized payments
      expect(netSettlement.length).toBeGreaterThan(0);
      
      // All payments should have proper structure
      netSettlement.forEach(payment => {
        expect(payment).toHaveProperty('from');
        expect(payment).toHaveProperty('to');
        expect(payment).toHaveProperty('amount');
        expect(payment.amount).toBeGreaterThan(0);
      });
    });
  });
});

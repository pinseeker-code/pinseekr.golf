import { GolfRound } from '@/lib/golf/types';
import { useLocalStorage } from './useLocalStorage';

export const useRoundPersistence = (roundId: string) => {
  const [savedRounds, setSavedRounds] = useLocalStorage<Record<string, GolfRound>>('golf-rounds', {});
  
  const saveRound = (round: GolfRound) => {
    setSavedRounds(prev => ({
      ...prev,
      [roundId]: round
    }));
  };

  const loadRound = (): GolfRound | null => {
    return savedRounds[roundId] || null;
  };

  const deleteRound = () => {
    setSavedRounds(prev => {
      const { [roundId]: removed, ...rest } = prev;
      return rest;
    });
  };

  const getAllRounds = (): GolfRound[] => {
    return Object.values(savedRounds);
  };

  return {
    saveRound,
    loadRound,
    deleteRound,
    getAllRounds,
    savedRound: savedRounds[roundId]
  };
};
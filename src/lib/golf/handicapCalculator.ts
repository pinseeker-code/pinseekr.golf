/**
 * Handicap Calculator
 * 
 * Implements progressive handicap calculation based on available rounds:
 * - 5-9 rounds: Best 2 differentials
 * - 10-19 rounds: Best 3 differentials
 * - 20+ rounds: Best 8 differentials (USGA/WHS standard)
 * 
 * Formula: Handicap Differential = (Gross Score - Course Rating) × 113 / Slope Rating
 * Handicap Index = Average of best differentials × 0.96 (soft cap)
 */

export interface RoundDifferential {
  roundId: string;
  date: number;
  gross: number;
  courseRating: number;
  slope: number;
  differential: number;
  courseName?: string;
}

export interface HandicapResult {
  index: number | null;
  roundsUsed: number;
  roundsAvailable: number;
  differentials: RoundDifferential[];
  bestDifferentials: RoundDifferential[];
  method: 'best-2-of-5' | 'best-3-of-10' | 'best-8-of-20' | 'insufficient';
  minimumRoundsNeeded: number;
}

/**
 * Calculate a single round's handicap differential
 */
export function calculateDifferential(
  gross: number,
  courseRating: number,
  slope: number
): number {
  if (slope <= 0 || courseRating <= 0) {
    return 0;
  }
  return ((gross - courseRating) * 113) / slope;
}

/**
 * Get the calculation method based on number of rounds
 */
export function getCalculationMethod(roundCount: number): {
  method: HandicapResult['method'];
  bestCount: number;
  minimumRoundsNeeded: number;
} {
  if (roundCount >= 20) {
    return { method: 'best-8-of-20', bestCount: 8, minimumRoundsNeeded: 0 };
  } else if (roundCount >= 10) {
    return { method: 'best-3-of-10', bestCount: 3, minimumRoundsNeeded: 20 - roundCount };
  } else if (roundCount >= 5) {
    return { method: 'best-2-of-5', bestCount: 2, minimumRoundsNeeded: 10 - roundCount };
  } else {
    return { method: 'insufficient', bestCount: 0, minimumRoundsNeeded: 5 - roundCount };
  }
}

/**
 * Calculate handicap index from round differentials
 */
export function calculateHandicapIndex(differentials: RoundDifferential[]): HandicapResult {
  const roundCount = differentials.length;
  const { method, bestCount, minimumRoundsNeeded } = getCalculationMethod(roundCount);

  if (method === 'insufficient' || bestCount === 0) {
    return {
      index: null,
      roundsUsed: 0,
      roundsAvailable: roundCount,
      differentials,
      bestDifferentials: [],
      method,
      minimumRoundsNeeded,
    };
  }

  // Sort by differential (lowest first = best rounds)
  const sorted = [...differentials].sort((a, b) => a.differential - b.differential);
  
  // Take the best N differentials
  const bestDifferentials = sorted.slice(0, bestCount);
  
  // Calculate average
  const sum = bestDifferentials.reduce((acc, d) => acc + d.differential, 0);
  const average = sum / bestCount;
  
  // Apply 96% soft cap (USGA/WHS standard)
  const index = Math.round(average * 0.96 * 10) / 10; // Round to 1 decimal

  return {
    index,
    roundsUsed: bestCount,
    roundsAvailable: roundCount,
    differentials,
    bestDifferentials,
    method,
    minimumRoundsNeeded,
  };
}

/**
 * Get human-readable description of the calculation method
 */
export function getMethodDescription(method: HandicapResult['method']): string {
  switch (method) {
    case 'best-2-of-5':
      return 'Best 2 of your last 5 rounds';
    case 'best-3-of-10':
      return 'Best 3 of your last 10 rounds';
    case 'best-8-of-20':
      return 'Best 8 of your last 20 rounds (USGA/WHS standard)';
    case 'insufficient':
      return 'Not enough rounds to calculate';
  }
}

/**
 * Default course rating and slope when not available
 * These are "average" values used when a course doesn't have official ratings
 */
export const DEFAULT_COURSE_RATING = 72.0;
export const DEFAULT_SLOPE = 113; // Standard slope rating

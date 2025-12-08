import { NostrMetadata } from '@nostrify/nostrify';

// Extended Nostr metadata for golf applications
export interface GolfNostrMetadata extends NostrMetadata {
  /** Golf handicap index for the player */
  golf_handicap?: number;
  /** Preferred golf tee box (e.g., 'white', 'blue', 'black') */
  golf_tee_preference?: string;
  /** Player's home golf course */
  golf_home_course?: string;
  /** Years playing golf */
  golf_experience?: number;
  /** Preferred golf format (stroke play, match play, etc.) */
  golf_preferred_format?: string;
}

// Helper function to get golf handicap from Nostr metadata
export function getGolfHandicap(metadata?: NostrMetadata): number | undefined {
  if (!metadata) return undefined;
  
  const golfMetadata = metadata as GolfNostrMetadata;
  return golfMetadata.golf_handicap;
}

// Helper function to set golf handicap in metadata
export function setGolfHandicap(metadata: NostrMetadata, handicap: number): GolfNostrMetadata {
  return {
    ...metadata,
    golf_handicap: handicap
  } as GolfNostrMetadata;
}

// Calculate net score for a hole
export function calculateNetScore(grossScore: number, playerHandicap: number, holeHandicap: number): number {
  // Determine how many strokes the player gets on this hole
  let strokesReceived = 0;
  
  if (playerHandicap >= holeHandicap) {
    strokesReceived = 1;
  }
  
  // For handicaps > 18, players get additional strokes on harder holes
  if (playerHandicap > 18) {
    const extraStrokes = playerHandicap - 18;
    if (extraStrokes >= holeHandicap) {
      strokesReceived += 1;
    }
  }
  
  // For handicaps > 36, players get more additional strokes
  if (playerHandicap > 36) {
    const doubleExtraStrokes = playerHandicap - 36;
    if (doubleExtraStrokes >= holeHandicap) {
      strokesReceived += 1;
    }
  }
  
  return grossScore - strokesReceived;
}

// Calculate total net score for a round
export function calculateTotalNetScore(scores: number[], playerHandicap: number, holeHandicaps: number[]): number {
  return scores.reduce((total, score, index) => {
    const holeHandicap = holeHandicaps[index] || 18; // Default to easiest if not provided
    const netScore = calculateNetScore(score, playerHandicap, holeHandicap);
    return total + netScore;
  }, 0);
}
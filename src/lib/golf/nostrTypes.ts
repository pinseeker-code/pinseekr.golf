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
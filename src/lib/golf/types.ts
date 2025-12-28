// Golf Game Modes
export enum GameMode {
  STROKE_PLAY = 'stroke-play',
  SKINS = 'skins',
  NASSAU = 'nassau',
  MATCH_PLAY = 'match-play',
  WOLF = 'wolf',
  POINTS = 'points',
  VEGAS = 'vegas',
  SIXES = 'sixes',
  DOTS = 'dots',
  SNAKE = 'snake'
}

// Badge Categories
export enum BadgeCategory {
  SCORING = 'scoring',
  PARTICIPATION = 'participation',
  SOCIAL = 'social',
  MILESTONES = 'milestones'
}

// Custom Nostr Event Kinds for Golf (v2 - streamlined)
export const GOLF_KINDS = {
  // Core event types (clean sequence)
  ROUND: 36901,           // Round container (who, where, when, scorecard images)
  COURSE: 36902,          // Course definition (holes, pars, yardages)
  PLAYER_SCORE: 36903,    // Per-player scores for a round (addressable, updates in place)
  GOLF_PROFILE: 36904,    // User's handicap, preferences, visibility
  TOURNAMENT: 36905,      // Multi-round competition container
  
  // Legacy kinds (for backward compatibility reading only)
  /** @deprecated Use PLAYER_SCORE instead */
  HOLE: 36802,            // Individual hole scores (deprecated)
  /** @deprecated Info now in ROUND + PLAYER_SCORE */
  PLAYER: 36803,          // Player profile in round (deprecated)
  /** @deprecated Merged into ROUND tags */
  GAME: 36804,            // Game mode configuration (deprecated)
  /** @deprecated Use ROUND status tag */
  RESULT: 36805,          // Final round results (deprecated)
  /** @deprecated */
  INVITE_ACCEPT: 36806,   // player invite accept proof (deprecated)
  
  // Optional features
  BADGE_AWARD: 36910,     // Badge achievement awards
} as const;

// Player in a round
export interface PlayerInRound {
  playerId: string;
  name: string;
  handicap: number;
  scores: number[];
  total: number;
  netTotal: number;
  // Optional invitation/verification state
  invited?: boolean;
  verified?: boolean;
  // Per-player, per-hole detailed stats (putts, fairways, greens, etc.)
  holeDetails?: Record<number, {
    putts?: number;
    fairways?: boolean;
    fairwayMissDepth?: MissDepth;
    fairwayMissSide?: MissSide;
    greens?: boolean;
    greenMissDepth?: MissDepth;
    greenMissSide?: MissSide;
    chips?: number;
    sandTraps?: number;
    penalties?: number;
    notes?: string;
  }>;
}

// Miss direction types
export type MissDepth = 'long' | 'short' | null;
export type MissSide = 'left' | 'right' | null;

// Individual hole score
export interface HoleScore {
  holeNumber: number;
  par: number;
  strokes: number;
  putts: number;
  fairways: boolean;
  fairwayMissDepth?: MissDepth;
  fairwayMissSide?: MissSide;
  greens: boolean;
  greenMissDepth?: MissDepth;
  greenMissSide?: MissSide;
  chips: number;
  sandTraps: number;
  penalties: number;
  notes?: string;
}

// Golf round
export interface GolfRound {
  id: string;
  courseId: string;
  date: number;
  players: PlayerInRound[];
  gameMode: GameMode;
  gameModes?: string[]; // Multiple active game modes (stroke, match, snake, etc.)
  holes: HoleScore[];
  status: 'active' | 'completed' | 'cancelled';
  metadata: RoundMetadata;
}

// Round metadata
export interface RoundMetadata {
  courseName: string;
  courseLocation?: string;
  teeBox?: string;
  teeYardage?: number;
  weather?: string;
  notes?: string;
  selectedSection?: string; // Selected 9-hole section index
  scorecardImages?: string[]; // Blossom URLs of uploaded scorecard photos
  origin?: 'real' | 'simulator'; // Where the round was played
  visibility?: 'public' | 'social' | 'private'; // Discoverability
}

// Badge definition
export interface BadgeDefinition {
  id: string;
  category: BadgeCategory;
  name: string;
  description: string;
  icon: string;
  criteria: BadgeCriteria;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

// Badge criteria
export interface BadgeCriteria {
  type: 'hole-score' | 'round-score' | 'streak' | 'participation';
  conditions: Record<string, unknown>;
}

// Badge award
export interface BadgeAward {
  id: string;
  badgeId: string;
  playerId: string;
  issuedAt: number;
  metadata: Record<string, unknown>;
}

// Game configuration
export interface GameConfig {
  mode: GameMode;
  players: PlayerInRound[];
  handicaps: Record<string, number>;
  settings: GameSettings;
}

// Game settings
export interface GameSettings {
  useHandicaps: boolean;
  netScoring: boolean;
  allowWagers?: boolean;
  maxHoles?: number;
  modifiedStableford?: boolean; // if true, use modified Stableford table
}
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

// App-level canonical kind for Pinseekr.golf (single-kind migration target)
export const APP_KIND = 36912;

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
    greens?: boolean | 'unreachable';
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
  greens: boolean | 'unreachable';
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
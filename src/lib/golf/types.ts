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

// Custom Nostr Event Kinds for Golf
export const GOLF_KINDS = {
  ROUND: 36901,           // Golf round metadata
  HOLE: 36902,            // Individual hole scores
  PLAYER: 36903,          // Player profile in round
  GAME: 36904,           // Game mode configuration
  RESULT: 36905,         // Final round results
  BADGE_AWARD: 36906,    // Badge achievement awards
  TOURNAMENT: 36907,     // Tournament events
  COURSE: 36908,         // Golf course metadata
  // Additional project kinds
  PLAYER_SCORE: 36909,   // per-player score updates (addressable)
  INVITE_ACCEPT: 36910,  // player invite accept proof
} as const;

// Backwards-compatibility map for previously used numeric kinds
export const OLD_GOLF_KINDS = {
  ROUND: 30001,
  HOLE: 30002,
  PLAYER: 30003,
  GAME: 30004,
  RESULT: 30005,
  BADGE_AWARD: 30006,
  TOURNAMENT: 30007,
  COURSE: 30100,
  PLAYER_SCORE: 30010,
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
    greens?: boolean;
    chips?: number;
    sandTraps?: number;
    penalties?: number;
    notes?: string;
  }>;
}

// Individual hole score
export interface HoleScore {
  holeNumber: number;
  par: number;
  strokes: number;
  putts: number;
  fairways: boolean;
  greens: boolean;
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
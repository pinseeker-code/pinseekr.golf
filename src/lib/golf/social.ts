import type { NostrEvent } from '@nostrify/nostrify';

// Golf Profile Types
export interface GolfStats {
  roundsPlayed: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  totalStrokes: number;
  fairwayHitPercentage: number;
  greenInRegulationPercentage: number;
  averagePutts: number;
  holesInOne: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  tripleBogeyOrWorse: number;
  lastUpdated: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: number;
  category: 'achievement' | 'milestone' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface Achievement {
  id: string;
  type: 'score' | 'consistency' | 'improvement' | 'participation' | 'social' | 'achievement';
  name: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  completedAt?: number;
}

export interface GolfProfile {
  pubkey: string;
  name?: string;
  displayName?: string;
  bio?: string;
  handicap: number;
  homeCourse?: string;
  homeLocation?: string;
  joinedAt: number;
  stats: GolfStats;
  badges: Badge[];
  achievements: Achievement[];
  preferences: {
    preferredTees: string;
    favoriteFormat: string;
    privacyLevel: 'public' | 'friends' | 'private';
    shareScores: boolean;
    shareAchievements: boolean;
  };
  socialStats: {
    followers: number;
    following: number;
    roundsWithFriends: number;
    matchesWon: number;
    matchesLost: number;
  };
}

// Golf Round/Match Types
export interface GolfRound {
  id: string;
  eventId?: string; // Nostr event ID
  createdBy: string;
  title: string;
  courseId?: string;
  courseName: string;
  courseLocation: string;
  startTime: number;
  endTime?: number;
  teeTime?: number;
  participants: GolfRoundParticipant[];
  gameMode: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  weather?: string;
  conditions?: string;
  notes?: string;
  isPrivate: boolean;
  tags: string[];
}

export interface GolfRoundParticipant {
  pubkey: string;
  name: string;
  handicap: number;
  scores?: number[];
  totalScore?: number;
  netScore?: number;
  status: 'confirmed' | 'pending' | 'declined';
  position?: number;
}

// Social Feed Types
export interface GolfPost {
  id: string;
  eventId: string;
  author: string;
  content: string;
  type: 'score_share' | 'round_complete' | 'achievement' | 'course_review' | 'general';
  metadata?: {
    roundId?: string;
    score?: number;
    course?: string;
    achievement?: string;
    photos?: string[];
  };
  timestamp: number;
  tags: string[];
  reactions?: {
    likes: number;
    comments: number;
    reposts: number;
  };
}

// Match Invitation Types
export interface MatchInvitation {
  id: string;
  fromUser: string;
  toUser: string;
  roundDetails: Partial<GolfRound>;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: number;
  expiresAt: number;
}

// Course Types
export interface GolfCourse {
  id: string;
  name: string;
  location: string;
  address?: string;
  rating?: number;
  slope?: number;
  par: number;
  holes: GolfHole[];
  teeBoxes: TeeBox[];
  photos?: string[];
  reviews?: CourseReview[];
}

export interface GolfHole {
  number: number;
  par: number;
  yardage: { [teeBox: string]: number };
  handicap: number;
  description?: string;
}

export interface TeeBox {
  name: string;
  color: string;
  rating: number;
  slope: number;
  totalYardage: number;
}

export interface CourseReview {
  author: string;
  rating: number;
  comment: string;
  timestamp: number;
}

// Nostr Event Mapping Types
export interface GolfProfileEvent extends NostrEvent {
  kind: 30382;
  tags: [
    ['d', 'golf-profile'],
    ['name', string],
    ['handicap', string],
    ['home_course', string],
    ['stats', string], // JSON stringified GolfStats
    ['badges', string], // JSON stringified Badge[]
    ['achievements', string], // JSON stringified Achievement[]
    ...string[][]
  ];
}

export interface GolfRoundEvent extends NostrEvent {
  kind: 31924;
  tags: [
    ['d', string], // unique round identifier
    ['title', string],
    ['start', string], // unix timestamp
    ['end', string], // unix timestamp
    ['location', string],
    ['participants', ...string[]], // pubkeys
    ['scores', string], // JSON stringified scores
    ['course_data', string], // JSON stringified course info
    ['t', 'golf'],
    ['t', 'round'],
    ...string[][]
  ];
}

// Utility Types
export type GolfEventFilter = {
  authors?: string[];
  since?: number;
  until?: number;
  tags?: { [key: string]: string[] };
  kinds?: number[];
  limit?: number;
};

export type ProfileUpdateData = Partial<Omit<GolfProfile, 'pubkey'>>;

// Constants
export const NOSTR_KINDS = {
  GOLF_PROFILE: 30382,
  GOLF_ROUND: 31924,
  GOLF_INVITATION: 1059,
  GOLF_POST: 1,
  GOLF_REACTION: 7,
} as const;

export const BADGE_CATEGORIES = {
  ACHIEVEMENT: 'achievement',
  MILESTONE: 'milestone',
  SPECIAL: 'special',
} as const;

export const BADGE_RARITIES = {
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
} as const;

// Predefined Achievements
export const DEFAULT_ACHIEVEMENTS: Omit<Achievement, 'progress' | 'completed' | 'completedAt'>[] = [
  {
    id: 'first-round',
    type: 'participation',
    name: 'First Round',
    description: 'Complete your first round on Pinseekr',
    target: 1,
  },
  {
    id: 'ten-rounds',
    type: 'participation',
    name: 'Getting Started',
    description: 'Complete 10 rounds',
    target: 10,
  },
  {
    id: 'fifty-rounds',
    type: 'participation',
    name: 'Regular Player',
    description: 'Complete 50 rounds',
    target: 50,
  },
  {
    id: 'hundred-rounds',
    type: 'participation',
    name: 'Dedicated Golfer',
    description: 'Complete 100 rounds',
    target: 100,
  },
  {
    id: 'hole-in-one',
    type: 'achievement',
    name: 'Hole in One',
    description: 'Record your first hole in one',
    target: 1,
  },
  {
    id: 'eagle',
    type: 'achievement',
    name: 'Eagle Eye',
    description: 'Score your first eagle',
    target: 1,
  },
  {
    id: 'under-par',
    type: 'score',
    name: 'Under Par',
    description: 'Shoot under par for a round',
    target: 1,
  },
  {
    id: 'personal-best',
    type: 'improvement',
    name: 'Personal Best',
    description: 'Set a new personal best score',
    target: 1,
  },
  {
    id: 'consistency',
    type: 'consistency',
    name: 'Mr. Consistent',
    description: 'Play 5 rounds within 3 strokes of each other',
    target: 5,
  },
  {
    id: 'social-butterfly',
    type: 'social',
    name: 'Social Butterfly',
    description: 'Play rounds with 10 different people',
    target: 10,
  },
];

// Predefined Badges
export const DEFAULT_BADGES: Omit<Badge, 'earnedAt'>[] = [
  {
    id: 'welcome',
    name: 'Welcome to Pinseekr',
    description: 'Joined the Pinseekr golf community',
    icon: '👋',
    category: 'milestone',
    rarity: 'common',
  },
  {
    id: 'first-round-badge',
    name: 'First Round Complete',
    description: 'Completed first round on Pinseekr',
    icon: '⛳',
    category: 'milestone',
    rarity: 'common',
  },
  {
    id: 'hole-in-one-badge',
    name: 'Ace!',
    description: 'Recorded a hole in one',
    icon: '🕳️',
    category: 'achievement',
    rarity: 'legendary',
  },
  {
    id: 'eagle-badge',
    name: 'Eagle',
    description: 'Scored an eagle',
    icon: '🦅',
    category: 'achievement',
    rarity: 'rare',
  },
  {
    id: 'under-par-badge',
    name: 'Under Par',
    description: 'Shot under par for a round',
    icon: '🎯',
    category: 'achievement',
    rarity: 'epic',
  },
  {
    id: 'hundred-rounds-badge',
    name: 'Century Club',
    description: 'Completed 100 rounds',
    icon: '💯',
    category: 'milestone',
    rarity: 'epic',
  },
];
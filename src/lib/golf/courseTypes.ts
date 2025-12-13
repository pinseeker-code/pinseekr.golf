// Golf Course Database Types

export interface GolfCourse {
  id: string;
  name: string;
  location: CourseLocation;
  website?: string;
  phone?: string;
  email?: string;
  description?: string;
  rating: number; // 1-5 stars
  reviewCount: number;
  holes: CourseHole[];
  teeBoxes: TeeBox[];
  amenities: CourseAmenity[];
  metadata: CourseMetadata;
  images: CourseImage[];
  createdAt: number;
  updatedAt: number;
}

export interface CourseLocation {
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
}

export interface CourseHole {
  number: number;
  par: number;
  handicap: number; // Stroke index (1-18)
  distances: Record<string, number>; // Distance from each tee box
  description?: string;
  tips?: string;
}

export interface TeeBox {
  id: string;
  name: string;
  color: string;
  gender: 'mens' | 'womens' | 'mixed';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'championship';
  totalDistance: number;
  courseRating: number;
  slopeRating: number;
  totalPar: number;
}

export interface CourseAmenity {
  type: AmenityType;
  name: string;
  available: boolean;
  description?: string;
  cost?: number;
  currency?: string;
}

export enum AmenityType {
  PRACTICE_RANGE = 'practice-range',
  PUTTING_GREEN = 'putting-green',
  CHIPPING_GREEN = 'chipping-green',
  PRO_SHOP = 'pro-shop',
  RESTAURANT = 'restaurant',
  BAR = 'bar',
  CART_RENTAL = 'cart-rental',
  CLUB_RENTAL = 'club-rental',
  LESSONS = 'lessons',
  LOCKER_ROOM = 'locker-room',
  PARKING = 'parking',
  WIFI = 'wifi',
  CADDIE_SERVICE = 'caddie-service',
  TOURNAMENT_FACILITIES = 'tournament-facilities'
}

export interface CourseMetadata {
  architect?: string;
  yearBuilt?: number;
  courseType: 'public' | 'private' | 'semi-private' | 'resort';
  style: 'links' | 'parkland' | 'desert' | 'mountain' | 'resort' | 'traditional';
  difficulty: 1 | 2 | 3 | 4 | 5; // 1 = beginner, 5 = championship
  layout: '9-hole' | '18-hole' | '27-hole' | '36-hole';
  greensType: 'bentgrass' | 'bermuda' | 'zoysia' | 'paspalum' | 'mixed';
  fairwaysType: 'bentgrass' | 'bermuda' | 'zoysia' | 'rye' | 'mixed';
  irrigation: boolean;
  drainage: 'excellent' | 'good' | 'fair' | 'poor';
  maintenance: 'excellent' | 'good' | 'fair' | 'poor';
  season: {
    openMonths: number[]; // Array of month numbers (1-12)
    peakMonths: number[];
    closedMonths: number[];
  };
  priceRange: '$' | '$$' | '$$$' | '$$$$' | '$$$$$';
  bookingRequired: boolean;
  walkingAllowed: boolean;
  caddieRequired: boolean;
  dressCode: 'casual' | 'golf-attire' | 'strict';
}

export interface CourseImage {
  id: string;
  url: string;
  type: 'course-overview' | 'hole' | 'clubhouse' | 'amenity' | 'aerial';
  title?: string;
  description?: string;
  holeNumber?: number; // If type is 'hole'
  isPrimary: boolean;
}

export interface CourseReview {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  title: string;
  content: string;
  categories: ReviewCategory[];
  playedDate: number;
  createdAt: number;
  helpful: number;
  reported: boolean;
}

export interface ReviewCategory {
  category: 'course-condition' | 'difficulty' | 'layout' | 'value' | 'service' | 'pace-of-play';
  rating: number; // 1-5
}

export interface CourseSearchFilters {
  location?: {
    center: { latitude: number; longitude: number };
    radius: number; // in miles/km
  };
  priceRange?: string[];
  courseType?: string[];
  difficulty?: number[];
  amenities?: AmenityType[];
  rating?: number; // minimum rating
  holes?: string[];
  availability?: {
    date: number;
    time?: string;
  };
}

export interface CourseSearchResult extends Omit<GolfCourse, 'holes'> {
  distance?: number; // from search center
  availability?: boolean;
  nextAvailableTime?: number;
  holeCount: number;
}

export interface TeeTimeSlot {
  id: string;
  courseId: string;
  date: number;
  time: string; // HH:MM format
  available: boolean;
  maxPlayers: number;
  currentBookings: number;
  pricePerPlayer: number;
  currency: string;
  restrictions?: string[];
}

// Nostr Event Kinds for Course Database
export const COURSE_KINDS = {
  COURSE: 36908,        // Golf course information (migrated to 369xx block)
  COURSE_REVIEW: 30101, // Course reviews
  TEE_TIME: 30102,      // Tee time availability
  COURSE_UPDATE: 30103, // Course condition updates
} as const;

// Popular Golf Course Categories
export const COURSE_CATEGORIES = {
  CHAMPIONSHIP: 'championship',
  RESORT: 'resort',
  MUNICIPAL: 'municipal',
  PRIVATE_CLUB: 'private-club',
  LINKS: 'links',
  PARKLAND: 'parkland',
  DESERT: 'desert',
  MOUNTAIN: 'mountain',
  EXECUTIVE: 'executive',
  PAR_3: 'par-3'
} as const;

// Distance units
export type DistanceUnit = 'yards' | 'meters';

// Golf course difficulty ratings
export const DIFFICULTY_LEVELS = {
  1: { name: 'Beginner', description: 'Great for new golfers', color: 'green' },
  2: { name: 'Easy', description: 'Forgiving course layout', color: 'blue' },
  3: { name: 'Moderate', description: 'Good challenge for average golfers', color: 'yellow' },
  4: { name: 'Difficult', description: 'Challenging for experienced players', color: 'orange' },
  5: { name: 'Championship', description: 'Tournament-level difficulty', color: 'red' }
} as const;

export type DifficultyLevel = keyof typeof DIFFICULTY_LEVELS;
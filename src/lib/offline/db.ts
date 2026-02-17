import Dexie from 'dexie';
import type { NostrEvent } from '@nostrify/nostrify';

export interface RoundRecord {
  id: string; // round-id
  createdAt: number;
  state: 'open' | 'closed';
  metadata: Record<string, unknown>;
}

export interface HoleScore {
  id?: number;
  roundId: string;
  playerPubkey: string;
  hole: number;
  strokes: number;
  timestamp: number; // ms
  deviceId: string;
}

export interface OutboxEvent {
  id?: number;
  eventId: string; // generated Nostr id or local UUID
  kind: number;
  payload: unknown; // raw event or data needed to build event
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: number;
}

export interface CachedCourse {
  id: string; // course address or d-tag
  name: string;
  location?: string;
  holes: number;
  par?: number;
  rating?: number;
  teeBoxes?: string[];
  event: NostrEvent; // full Nostr event
  cachedAt: number; // timestamp
  lastAccessedAt: number; // timestamp
}

export interface CachedProfile {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  nip05?: string;
  about?: string;
  event: NostrEvent; // full kind 0 metadata event
  cachedAt: number;
  lastAccessedAt: number;
}

export class OfflineDB extends Dexie {
  rounds!: Dexie.Table<RoundRecord, string>;
  holeScores!: Dexie.Table<HoleScore, number>;
  outbox!: Dexie.Table<OutboxEvent, number>;
  courses!: Dexie.Table<CachedCourse, string>;
  profiles!: Dexie.Table<CachedProfile, string>;

  constructor() {
    super('pinseekr_offline');
    // Version 1: original schema
    this.version(1).stores({
      rounds: 'id,createdAt,state',
      holeScores: '++id,roundId,playerPubkey,hole,timestamp',
      outbox: '++id,eventId,status,createdAt',
    });
    
    // Version 2: add courses and profiles for offline support
    this.version(2).stores({
      rounds: 'id,createdAt,state',
      holeScores: '++id,roundId,playerPubkey,hole,timestamp',
      outbox: '++id,eventId,status,createdAt',
      courses: 'id,name,cachedAt,lastAccessedAt',
      profiles: 'pubkey,cachedAt,lastAccessedAt',
    });
  }
}

export const db = new OfflineDB();

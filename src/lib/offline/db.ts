import Dexie from 'dexie';

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

export class OfflineDB extends Dexie {
  rounds!: Dexie.Table<RoundRecord, string>;
  holeScores!: Dexie.Table<HoleScore, number>;
  outbox!: Dexie.Table<OutboxEvent, number>;

  constructor() {
    super('pinseekr_offline');
    this.version(1).stores({
      rounds: 'id,createdAt,state',
      holeScores: '++id,roundId,playerPubkey,hole,timestamp',
      outbox: '++id,eventId,status,createdAt',
    });
  }
}

export const db = new OfflineDB();

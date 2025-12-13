import { useEffect, useState } from 'react';
import { db, HoleScore } from '@/lib/offline/db';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { enqueueOutboxEvent, publishOutboxOnce } from '@/lib/sync/outbox';
import { GOLF_KINDS } from '@/lib/golf/types';
import { v4 as uuidv4 } from 'uuid';

export function useOfflineRound() {
  const { nostr } = useNostr();
  const [connected, setConnected] = useState<boolean>(true);
  const [outboxCount, setOutboxCount] = useState<number>(0);

  useEffect(() => {
    // basic online detection
    const onOnline = () => setConnected(true);
    const onOffline = () => setConnected(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setConnected(navigator.onLine);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    // poll outbox count
    let mounted = true;
    (async () => {
      const count = await db.outbox.where('status').notEqual('sent').count();
      if (mounted) setOutboxCount(count);
    })();
    const t = setInterval(async () => {
      const count = await db.outbox.where('status').notEqual('sent').count();
      if (mounted) setOutboxCount(count);
    }, 3000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const { user } = useCurrentUser();

  useEffect(() => {
    // Try publish outbox when back online
    if (connected) {
      // run once
      publishOutboxOnce(nostr, user ?? null).catch(() => {});
    }
  }, [connected, nostr, user]);

  useEffect(() => {
    // listen for messages from service worker to trigger outbox sync
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
        if (data?.type === 'SYNC_OUTBOX') {
        publishOutboxOnce(nostr, user ?? null).catch(() => {});
      }
    };

    if (navigator && 'serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', onMessage);
    }

    return () => {
      if (navigator && 'serviceWorker' in navigator && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      }
    };
  }, [nostr, user]);

  const addHoleScore = async (roundId: string, playerPubkey: string, hole: number, strokes: number, deviceId: string) => {
    const timestamp = Date.now();
    const score: HoleScore = { roundId, playerPubkey, hole, strokes, timestamp, deviceId };
    await db.holeScores.add(score);

    // Create an outbox event - using GOLF_KINDS.PLAYER_SCORE as player score
    const eventId = uuidv4();
    const payload = {
      kind: GOLF_KINDS.PLAYER_SCORE,
      content: JSON.stringify({ roundId, playerPubkey, hole, strokes, timestamp, deviceId }),
      tags: [['d', roundId], ['player', playerPubkey]]
    };

    await enqueueOutboxEvent({ eventId, kind: GOLF_KINDS.PLAYER_SCORE, payload });
  };

  const getScoresForRound = async (roundId: string) => {
    return db.holeScores.where('roundId').equals(roundId).toArray();
  };

  const flushOutbox = async () => {
    await publishOutboxOnce(nostr, user ?? null);
  };

  return {
    connected,
    outboxCount,
    addHoleScore,
    getScoresForRound,
    flushOutbox,
  };
}

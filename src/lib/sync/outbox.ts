import { db, OutboxEvent } from '@/lib/offline/db';

interface NostrLike {
  event?: (payload: unknown, opts?: Record<string, unknown>) => Promise<unknown>;
}

interface UserLike {
  signer?: {
    signEvent?: (evt: Record<string, unknown>) => Promise<unknown>;
  } | null;
  pubkey?: string;
}

// Lightweight publish worker used by hook. Not a background service worker.
// If `user` is provided and has a signer, events will be signed before publishing.
export async function publishOutboxOnce(nostr: NostrLike | null, user?: UserLike | null) {
  // Get pending events
  const pending = await db.outbox.where('status').equals('pending').limit(20).toArray();

  for (const ev of pending) {
    try {
      await db.outbox.update(ev.id!, { status: 'sending', attempts: ev.attempts + 1 });

      // If we have a nostr client, attempt to publish
      if (nostr && typeof nostr.event === 'function') {
        // Payload expected shape: { kind, content, tags?, created_at? }
        const payload = ev.payload as Record<string, unknown> | null;

        // Add client tag on HTTPS if missing
        const tags = Array.isArray(payload?.tags) ? [...payload!.tags] : [];
        if (typeof location !== 'undefined' && location.protocol === 'https:') {
          if (!tags.some((t: unknown) => Array.isArray(t) && t[0] === 'client')) {
            tags.push(['client', location.hostname]);
          }
        }

        try {
          // If we have a signer, use it to produce a signed event
          if (user && user.signer && typeof user.signer.signEvent === 'function') {
            const eventToSign = {
              kind: payload?.kind,
              content: payload?.content ?? '',
              tags,
              created_at: payload?.created_at ?? Math.floor(Date.now() / 1000),
            } as Record<string, unknown>;

            const signed = await user.signer.signEvent(eventToSign);
            await nostr.event!(signed);
            await db.outbox.update(ev.id!, { status: 'sent' });
          } else if (payload && Object.prototype.hasOwnProperty.call(payload, 'sig')) {
            // Already-signed event object
            await nostr.event!(payload);
            await db.outbox.update(ev.id!, { status: 'sent' });
          } else if (payload) {
            // No signer available and not signed — attempt to publish raw payload (relay may reject)
            await nostr.event!(payload);
            await db.outbox.update(ev.id!, { status: 'sent' });
          } else {
            await db.outbox.update(ev.id!, { status: 'failed', lastError: 'invalid payload' });
          }
        } catch (publishErr: unknown) {
          const lastError = (publishErr as Error)?.message ?? String(publishErr);
          await db.outbox.update(ev.id!, { status: 'failed', lastError });
        }
      } else {
        // No nostr instance - keep pending for later
        await db.outbox.update(ev.id!, { status: 'pending' });
      }
    } catch (err: unknown) {
      // Log error (will appear in dev tools); avoid disabling ESLint inline
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('Error publishing outbox event', err);
      }
      await db.outbox.update(ev.id!, { status: 'failed', lastError: String(err) });
    }
  }
}

export async function enqueueOutboxEvent(event: Omit<OutboxEvent, 'id' | 'createdAt' | 'attempts' | 'status'>) {
  const toInsert: OutboxEvent = {
    ...event,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  } as OutboxEvent;

  return db.outbox.add(toInsert);
}

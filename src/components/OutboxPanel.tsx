import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db, OutboxEvent } from '@/lib/offline/db';
import { useOfflineRound } from '@/hooks/useOfflineRound';
import { GOLF_KINDS } from '@/lib/golf/types';

// Map kind numbers to friendly names
const kindLabels: Record<number, string> = {
  1: 'Note',
  [GOLF_KINDS.PLAYER_SCORE]: 'Score Update',
  [GOLF_KINDS.RESULT]: 'Round',
  [GOLF_KINDS.TOURNAMENT]: 'Round State',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  sending: 'bg-blue-500 animate-pulse',
  sent: 'bg-green-500',
  failed: 'bg-red-500',
};

export const OutboxPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const { flushOutbox, outboxCount } = useOfflineRound();

  const load = useCallback(async () => {
    const list = await db.outbox.orderBy('createdAt').reverse().toArray();
    setEvents(list as OutboxEvent[]);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const retry = async (id: number | undefined) => {
    if (!id) return;
    await db.outbox.update(id, { status: 'pending' });
    await load();
  };

  const remove = async (id: number | undefined) => {
    if (!id) return;
    await db.outbox.delete(id);
    await load();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await flushOutbox();
      // Give time for status updates
      await new Promise((r) => setTimeout(r, 500));
      await load();
    } finally {
      setSyncing(false);
    }
  };

  // Don't show button if nothing pending (clean UI)
  if (outboxCount === 0 && !open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          Outbox
          {outboxCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-[10px] text-white flex items-center justify-center">
              {outboxCount}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pending Events</DialogTitle>
          <DialogDescription>
            Events waiting to sync to the network
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {events.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              All caught up! No pending events.
            </div>
          )}

          {events.map((ev) => (
            <div key={ev.id ?? ev.eventId} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${statusColors[ev.status] ?? 'bg-gray-400'}`} />
                  <span className="text-sm font-medium">
                    {kindLabels[ev.kind] ?? `Kind ${ev.kind}`}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs capitalize">
                  {ev.status}
                </Badge>
              </div>

              {ev.lastError && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded p-2">
                  {ev.lastError}
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                {ev.attempts > 0 && `${ev.attempts} attempt${ev.attempts > 1 ? 's' : ''} · `}
                {new Date(ev.createdAt).toLocaleTimeString()}
              </div>

              <div className="flex gap-2 pt-1">
                {ev.status === 'failed' && (
                  <Button size="sm" variant="secondary" onClick={() => retry(ev.id)}>
                    Retry
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(ev.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={load}>
            Refresh
          </Button>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSync} disabled={syncing || events.length === 0}>
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OutboxPanel;

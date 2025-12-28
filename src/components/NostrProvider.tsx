import React, { useEffect, useRef } from 'react';
import { NostrEvent, NPool, NRelay1, type NostrFilter } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config, presetRelays } = useAppContext();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayUrl = useRef<string>(config.relayUrl);

  // Update refs when config changes
  useEffect(() => {
    relayUrl.current = config.relayUrl;
    queryClient.resetQueries();
  }, [config.relayUrl, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters: NostrFilter[]) {
        // Send queries to the primary configured relay plus preset fallback relays
        const allRelays = new Set<string>([relayUrl.current]);

        for (const { url } of (presetRelays ?? [])) {
          allRelays.add(url);
          if (allRelays.size >= 6) break; // cap to avoid too many simultaneous connections
        }

        const map = new Map<string, NostrFilter[]>();
        for (const r of allRelays) {
          map.set(r, filters);
        }

        return map;
      },
      eventRouter(_event: NostrEvent) {
        // Publish to the selected relay plus preset fallback relays
        const allRelays = new Set<string>([relayUrl.current]);

        for (const { url } of (presetRelays ?? [])) {
          allRelays.add(url);
          if (allRelays.size >= 5) break; // cap to 5 for publishing
        }

        const relayList = [...allRelays];
        console.log('[NostrProvider] Publishing to relays:', relayList);
        return relayList;
      },
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;
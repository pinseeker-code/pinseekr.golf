import React, { useEffect, useRef } from 'react';
import { NostrEvent, NPool, NRelay1, type NostrFilter } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import RelayMonitor from '@/lib/relayMonitor';
import { RelayMonitorProvider } from '@/contexts/RelayMonitorContext';

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config, presetRelays } = useAppContext();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);
  // Relay health monitor
  const relayMonitorRef = useRef<RelayMonitor | null>(null);

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
        // Prefer healthy relays from RelayMonitor when available
        const healthy = relayMonitorRef.current?.getHealthyRelays() || [];
        const allRelays = new Set<string>([relayUrl.current, ...healthy]);

        for (const { url } of (presetRelays ?? [])) {
          allRelays.add(url);
          if (allRelays.size >= 6) break; // cap to avoid too many simultaneous connections
        }

        const map = new Map<string, NostrFilter[]>();
        for (const r of allRelays) map.set(r, filters);
        return map;
      },
      eventRouter(_event: NostrEvent) {
        // Prefer healthy relays for publishing
        const healthy = relayMonitorRef.current?.getHealthyRelays() || [];
        const allRelays = new Set<string>([relayUrl.current, ...healthy]);
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

  useEffect(() => {
    const urls = [config.relayUrl, ...(presetRelays?.map(r => r.url) ?? [])];
    relayMonitorRef.current = new RelayMonitor(urls, { retryBase: 1000, retryMax: 30000 });
    relayMonitorRef.current.start();
    return () => {
      relayMonitorRef.current?.stop();
      relayMonitorRef.current = null;
    };
  }, [config.relayUrl, presetRelays]);

  return (
    <NostrContext.Provider value={{ nostr: pool.current as unknown as NPool }}>
      <RelayMonitorProvider value={{ monitor: relayMonitorRef.current }}>
        {children}
      </RelayMonitorProvider>
    </NostrContext.Provider>
  );
};

export default NostrProvider;
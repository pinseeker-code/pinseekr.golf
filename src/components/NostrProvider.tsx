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
  const discoveredRelays = useRef<string[]>([]);

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
        // Send queries to the primary configured relay plus a set of preset relays
        const allRelays = new Set<string>([relayUrl.current]);

        // Include any discovered pyramid sub-relays (if discovered)
        for (const r of discoveredRelays.current) {
          allRelays.add(r);
          if (allRelays.size >= 6) break;
        }

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
        // Publish to the selected relay
        const allRelays = new Set<string>([relayUrl.current]);

        // Prefer discovered relays for publishing when available
        for (const r of discoveredRelays.current) {
          allRelays.add(r);
          if (allRelays.size >= 5) break;
        }

        // Also publish to the preset relays, capped to 5
        for (const { url } of (presetRelays ?? [])) {
          allRelays.add(url);
          if (allRelays.size >= 5) break;
        }

        return [...allRelays];
      },
    });
  }

  // Attempt discovery on mount for the APP's host (not relay host). This populates discoveredRelays.
  // The pyramid-relays.json file should be hosted on the same origin as the app, not on the relay server.
  useEffect(() => {
    // Skip relay discovery in test environment
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return;
    }

    let mounted = true;
    (async () => {
      try {
        console.log('[NostrProvider] Attempting to fetch pyramid-relays.json');
        const response = await fetch('/pyramid-relays.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('[NostrProvider] Fetched pyramid-relays.json:', data);

        if (!mounted) return;

        const relays = Array.isArray(data.relays) ? data.relays : [];
        const discoveredRelayUrls = relays
          .filter((r: unknown) => r && typeof r === 'object' && (r as Record<string, unknown>).url)
          .map((r: unknown) => (r as Record<string, unknown>).url)
          .filter((url: unknown) => url && typeof url === 'string')
          .map((url: unknown) => url as string);

        if (discoveredRelayUrls.length > 0) {
          discoveredRelays.current = discoveredRelayUrls;
          console.log('[NostrProvider] Set discovered relays:', discoveredRelays.current);
        }
      } catch (err) {
        console.warn('[NostrProvider] Failed to fetch pyramid-relays.json:', err);
        // ignore discovery errors - fall back to preset relays
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;
/**
 * Lightweight relay discovery helper for Pyramid-style hosts.
 * Fetches a well-known JSON document from the host and returns an array of relay URLs.
 */
export type DiscoveredRelay = {
  url: string;
  role?: string;
  readable?: boolean;
  writable?: boolean;
  members_only?: boolean;
  priority?: number;
};

const CACHE_KEY_PREFIX = 'relay-discovery:';

async function fetchWithETag(url: string, existingEtag?: string | null): Promise<{ status: number; json?: unknown; etag?: string | null; headers?: Headers }> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (existingEtag) headers['If-None-Match'] = existingEtag;

  const res = await fetch(url, { method: 'GET', mode: 'cors', headers });
  const etag = res.headers.get('ETag');
  if (res.status === 304) {
    return { status: 304, etag, headers: res.headers };
  }
  if (!res.ok) {
    return { status: res.status, etag, headers: res.headers };
  }
  const json = await res.json();
  return { status: res.status, json, etag, headers: res.headers };
}

async function fetchWellKnown(host: string, existingEtag?: string | null): Promise<{ doc?: unknown; etag?: string | null; status: number; headers?: Headers }> {
  // Primary endpoint no longer uses ".well-known" — prefer a simple JSON file
  const primary = `https://${host}/pyramid-relays.json`;
  // Keep backwards-compatible fallbacks
  const fallback = `https://${host}/relay-info.json`;
  const legacy = `https://${host}/.well-known/pyramid-relays`;

  // try primary
  const first = await fetchWithETag(primary, existingEtag);
  if (first.status === 200) return { doc: first.json, etag: first.etag ?? null, status: 200, headers: first.headers };
  if (first.status === 304) return { status: 304, etag: first.etag ?? null, headers: first.headers };

  // try fallback
  const second = await fetchWithETag(fallback, existingEtag);
  if (second.status === 200) return { doc: second.json, etag: second.etag ?? null, status: 200, headers: second.headers };
  if (second.status === 304) return { status: 304, etag: second.etag ?? null, headers: second.headers };

  // last: legacy well-known path for older deployments
  const third = await fetchWithETag(legacy, existingEtag);
  if (third.status === 200) return { doc: third.json, etag: third.etag ?? null, status: 200, headers: third.headers };
  return { status: third.status, etag: third.etag ?? null, headers: third.headers };
}

export async function fetchRelayDiscovery(hostOrUrl: string): Promise<DiscoveredRelay[]> {
  // accept either full url or host
  let host = hostOrUrl;
  try {
    const u = new URL(hostOrUrl);
    host = u.host;
  } catch (e) {
    void e; // keep as-is when parsing fails
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${host}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { _fetchedAt?: number; cache_max_age?: number; relays?: unknown[]; etag?: string | null };
      const age = Date.now() - (parsed._fetchedAt || 0);
      // honor TTL if provided, default 10m
      const ttl = parsed.cache_max_age ? parsed.cache_max_age * 1000 : 10 * 60 * 1000;
      if (age < ttl && Array.isArray(parsed.relays)) {
        return parsed.relays.map((r) => {
          if (r && typeof r === 'object' && 'url' in (r as Record<string, unknown>)) {
            const obj = r as Record<string, unknown>;
            return {
              url: typeof obj.url === 'string' ? obj.url : '',
              role: typeof obj.role === 'string' ? obj.role : undefined,
              readable: typeof obj.readable === 'boolean' ? obj.readable : undefined,
              writable: typeof obj.writable === 'boolean' ? obj.writable : undefined,
              members_only: typeof obj.members_only === 'boolean' ? obj.members_only : undefined,
              priority: typeof obj.priority === 'number' ? obj.priority : undefined,
            } as DiscoveredRelay;
          }
          return null;
        }).filter(Boolean) as DiscoveredRelay[];
      }
    }
  } catch (err) {
    // ignore cache errors
    console.warn('relayDiscovery: cache read failed', err);
  }

  try {
    // read existing etag from cache to send If-None-Match
    let existingEtag: string | null = null;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { etag?: string | null };
        existingEtag = parsed.etag ?? null;
      }
    } catch (e) {
      void e;
    }

    const fetched = await fetchWellKnown(host, existingEtag);
    if (fetched.status === 304) {
      // Not modified — return cached relays if present
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { relays?: unknown[] };
        const rawRelays = Array.isArray(parsed.relays) ? parsed.relays : [];
        const relays: DiscoveredRelay[] = rawRelays.map((r) => {
          if (r && typeof r === 'object') {
            const obj = r as Record<string, unknown>;
            return {
              url: typeof obj.url === 'string' ? obj.url : '',
              role: typeof obj.role === 'string' ? obj.role : undefined,
              readable: typeof obj.readable === 'boolean' ? obj.readable : undefined,
              writable: typeof obj.writable === 'boolean' ? obj.writable : undefined,
              members_only: typeof obj.members_only === 'boolean' ? obj.members_only : undefined,
              priority: typeof obj.priority === 'number' ? obj.priority : undefined,
            };
          }
          return { url: '' } as DiscoveredRelay;
        }).filter(r => !!r.url);
        return relays;
      }
      return [];
    }

    const doc = fetched.doc;
    const docObj = (doc && typeof doc === 'object') ? doc as Record<string, unknown> : {};
    const rawRelays = Array.isArray(docObj.relays) ? docObj.relays as unknown[] : [];
    const relays: DiscoveredRelay[] = rawRelays.map((r) => {
      if (r && typeof r === 'object') {
        const obj = r as Record<string, unknown>;
        return {
          url: typeof obj.url === 'string' ? obj.url : '',
          role: typeof obj.role === 'string' ? obj.role : undefined,
          readable: typeof obj.readable === 'boolean' ? obj.readable : undefined,
          writable: typeof obj.writable === 'boolean' ? obj.writable : undefined,
          members_only: typeof obj.members_only === 'boolean' ? obj.members_only : undefined,
          priority: typeof obj.priority === 'number' ? obj.priority : undefined,
        };
      }
      return { url: '' } as DiscoveredRelay;
    }).filter(r => !!r.url);
    try {
      const cacheObj = { _fetchedAt: Date.now(), cache_max_age: typeof docObj.cache_max_age === 'number' ? docObj.cache_max_age : undefined, relays, etag: fetched.etag ?? null };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheObj));
    } catch (e) {
      void e; // ignore storage errors
    }
    return relays;
  } catch (err) {
    console.warn('relayDiscovery: fetch failed for', host, err);
    return [];
  }
}

export default { fetchRelayDiscovery };

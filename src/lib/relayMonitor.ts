type RelayStatus = {
  url: string;
  healthy: boolean;
  lastSeen?: number;
  reconnects?: number;
  lastLatencyMs?: number;
};

type RelayMonitorOptions = {
  retryBase?: number; // base milliseconds
  retryMax?: number; // max backoff
};

export class RelayMonitor {
  private relays: string[];
  private statuses: Map<string, RelayStatus> = new Map();
  private sockets: Map<string, WebSocket | null> = new Map();
  private backoffs: Map<string, number> = new Map();
  private reconnectCounts: Map<string, number> = new Map();
  private lastLatency: Map<string, number> = new Map();
  private opts: Required<RelayMonitorOptions>;
  private running = false;
  private onChangeCb?: (statuses: RelayStatus[]) => void;

  constructor(relays: string[], opts?: RelayMonitorOptions) {
    this.relays = Array.from(new Set(relays));
    this.opts = { retryBase: 1000, retryMax: 30_000, ...(opts || {}) };
    for (const r of this.relays) this.statuses.set(r, { url: r, healthy: false });
  }

  start() {
    if (this.running) return;
    this.running = true;
    for (const r of this.relays) this.connect(r);
  }

  stop() {
    this.running = false;
    for (const [r, ws] of this.sockets.entries()) {
      try { ws?.close(); } catch {
        // ignore close errors
      }
      this.sockets.set(r, null);
    }
  }

  onChange(cb: (statuses: RelayStatus[]) => void) {
    this.onChangeCb = cb;
  }

  getStatuses() {
    return Array.from(this.statuses.values());
  }

  getHealthyRelays() {
    return Array.from(this.statuses.values()).filter(s => s.healthy).map(s => s.url);
  }

  private connect(url: string) {
    if (!this.running) return;
    const startTs = performance.now?.() ?? Date.now();
    const ws = new WebSocket(url);
    this.sockets.set(url, ws);

    ws.addEventListener('open', () => {
      this.statuses.set(url, { url, healthy: true, lastSeen: Date.now(), reconnects: this.reconnectCounts.get(url) ?? 0 });
      this.backoffs.set(url, this.opts.retryBase);
      // measure open latency
      const now = performance.now?.() ?? Date.now();
      const latency = Math.max(0, Math.round(now - startTs));
      this.lastLatency.set(url, latency);
      const s = this.statuses.get(url);
      if (s) s.lastLatencyMs = latency;
      this.emitChange();
    });

    ws.addEventListener('message', () => {
      // update lastSeen and keep other tracked stats
      const prev = this.statuses.get(url) ?? { url, healthy: true };
      this.statuses.set(url, {
        url,
        healthy: true,
        lastSeen: Date.now(),
        reconnects: this.reconnectCounts.get(url) ?? prev.reconnects ?? 0,
        lastLatencyMs: this.lastLatency.get(url) ?? prev.lastLatencyMs,
      });
    });

    ws.addEventListener('close', () => {
      const prev = this.statuses.get(url) ?? { url, healthy: false };
      this.statuses.set(url, { ...prev, url, healthy: false, lastSeen: Date.now(), reconnects: this.reconnectCounts.get(url) ?? 0, lastLatencyMs: this.lastLatency.get(url) });
      this.emitChange();
      this.scheduleReconnect(url);
    });

    ws.addEventListener('error', () => {
      const prev = this.statuses.get(url) ?? { url, healthy: false };
      this.statuses.set(url, { ...prev, url, healthy: false, lastSeen: Date.now(), reconnects: this.reconnectCounts.get(url) ?? 0, lastLatencyMs: this.lastLatency.get(url) });
      this.emitChange();
      try { ws.close(); } catch {
        // ignore close errors
      }
      this.scheduleReconnect(url);
    });
  }

  private scheduleReconnect(url: string) {
    if (!this.running) return;
    const prev = this.backoffs.get(url) ?? this.opts.retryBase;
    const next = Math.min(prev * 2 || this.opts.retryBase, this.opts.retryMax);
    this.backoffs.set(url, next);
    // increment reconnect counter
    const rc = (this.reconnectCounts.get(url) ?? 0) + 1;
    this.reconnectCounts.set(url, rc);
    const s = this.statuses.get(url);
    if (s) s.reconnects = rc;
    setTimeout(() => {
      // Only reconnect if still running
      if (!this.running) return;
      this.connect(url);
    }, next + Math.floor(Math.random() * 300));
  }

  private emitChange() {
    if (this.onChangeCb) this.onChangeCb(this.getStatuses());
  }
}

export default RelayMonitor;

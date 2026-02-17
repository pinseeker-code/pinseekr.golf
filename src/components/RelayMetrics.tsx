import React, { useEffect, useState } from 'react';
import { useRelayMonitor } from '@/contexts/RelayMonitorContext';

type RelayStatus = {
  url: string;
  healthy: boolean;
  lastSeen?: number;
  reconnects?: number;
  lastLatencyMs?: number;
};

export const RelayMetrics: React.FC = () => {
  const { monitor } = useRelayMonitor();
  const [statuses, setStatuses] = useState<RelayStatus[]>([]);

  useEffect(() => {
    if (!monitor) return;
    // seed
    setStatuses(monitor.getStatuses());
    // subscribe
    monitor.onChange((s) => setStatuses(s));
    return () => {
      // no unsubscribe API — monitor replaces callback on next onChange
      // clear local state
      setStatuses([]);
    };
  }, [monitor]);

  if (!monitor) return null;

  const healthyCount = statuses.filter(s => s.healthy).length;

  return (
    <div className="hidden md:flex items-center gap-2 text-sm text-slate-700">
      <div className="px-2 py-1 rounded bg-slate-100 border">
        <strong>Relays:</strong> {healthyCount}/{statuses.length}
      </div>
      <div className="flex gap-2">
        {statuses.map(s => (
          <div key={s.url} className="flex items-center gap-2 px-2 py-1 border rounded bg-white">
            <span className={`h-2 w-2 rounded-full ${s.healthy ? 'bg-green-500' : 'bg-red-400'}`} />
            <div className="flex flex-col">
              <span className="max-w-xs truncate">{s.url.replace(/^wss?:\/\//, '')}</span>
              <span className="text-xs text-slate-500">
                {s.reconnects ? `reconnects: ${s.reconnects}` : ''}
                {s.lastLatencyMs ? ` • ${s.lastLatencyMs}ms` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RelayMetrics;

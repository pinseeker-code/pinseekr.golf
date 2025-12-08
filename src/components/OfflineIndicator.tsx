import React from 'react';
import { useOfflineRound } from '@/hooks/useOfflineRound';

export const OfflineIndicator: React.FC = () => {
  const { connected, outboxCount } = useOfflineRound();

  return (
    <div className="flex items-center space-x-1.5" role="status" aria-live="polite">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}
        aria-label={connected ? 'Connected' : 'Disconnected'}
      />
      <span className="text-xs font-medium hidden sm:inline">
        {connected ? 'Online' : 'Offline'}
      </span>
      {outboxCount > 0 && (
        <span className="text-xs px-1.5 py-0.5 bg-amber-600 text-white rounded-full font-medium">
          {outboxCount}
        </span>
      )}
    </div>
  );
};

export default OfflineIndicator;

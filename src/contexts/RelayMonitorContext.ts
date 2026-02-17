import { createContext, useContext } from 'react';
import RelayMonitor from '@/lib/relayMonitor';

type RelayMonitorContextValue = {
  monitor: RelayMonitor | null;
};

const RelayMonitorContext = createContext<RelayMonitorContextValue>({ monitor: null });

export const RelayMonitorProvider = RelayMonitorContext.Provider;

export function useRelayMonitor() {
  return useContext(RelayMonitorContext);
}

export { RelayMonitorContext };

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNWC } from '@/hooks/useNWCContext';
import type { WebLNProvider } from 'webln';
import { requestProvider as requestBitcoinConnectProvider, onConnected, onDisconnected } from '@getalby/bitcoin-connect-react';

export interface WalletStatus {
  hasWebLN: boolean;
  hasNWC: boolean;
  webln: WebLNProvider | null;
  activeNWC: ReturnType<typeof useNWC>['getActiveConnection'] extends () => infer T ? T : null;
  isDetecting: boolean;
  preferredMethod: 'nwc' | 'webln' | 'manual';
}

export function useWallet() {
  const [webln, setWebln] = useState<WebLNProvider | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasAttemptedDetection, setHasAttemptedDetection] = useState(false);
  const { connections, getActiveConnection } = useNWC();

  // Get the active connection directly - no memoization to avoid stale state
  const activeNWC = getActiveConnection();

  // Listen for Bitcoin Connect connection events
  useEffect(() => {
    const unsubConnected = onConnected((provider) => {
      setWebln(provider);
      setHasAttemptedDetection(true);
    });
    
    const unsubDisconnected = onDisconnected(() => {
      setWebln(null);
    });
    
    return () => {
      unsubConnected();
      unsubDisconnected();
    };
  }, []);

  // Detect WebLN using Bitcoin Connect's requestProvider
  const detectWebLN = useCallback(async () => {
    if (webln || isDetecting) return webln;

    setIsDetecting(true);
    try {
      // This will launch the Bitcoin Connect modal if no provider is connected
      const provider = await requestBitcoinConnectProvider();
      setWebln(provider);
      setHasAttemptedDetection(true);
      return provider;
    } catch (error) {
      // User cancelled the modal or no provider available
      if (error instanceof Error && !error.message.includes('cancelled')) {
        console.warn('WebLN detection error:', error);
      }
      setWebln(null);
      setHasAttemptedDetection(true);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, [webln, isDetecting]);

  // Check if we already have window.webln on mount (set by Bitcoin Connect onConnected)
  useEffect(() => {
    if (!hasAttemptedDetection && window.webln) {
      setWebln(window.webln);
      setHasAttemptedDetection(true);
    }
  }, [hasAttemptedDetection]);

  // Test WebLN connection
  const testWebLN = useCallback(async (): Promise<boolean> => {
    if (!webln) return false;

    try {
      await webln.enable();
      return true;
    } catch (error) {
      console.error('WebLN test failed:', error);
      return false;
    }
  }, [webln]);

  // Calculate status values reactively
  const hasNWC = useMemo(() => {
    return connections.length > 0 && connections.some(c => c.isConnected);
  }, [connections]);

  // Determine preferred payment method
  const preferredMethod: WalletStatus['preferredMethod'] = activeNWC
    ? 'nwc'
    : webln
    ? 'webln'
    : 'manual';

  const status: WalletStatus = {
    hasWebLN: !!webln,
    hasNWC,
    webln,
    activeNWC,
    isDetecting,
    preferredMethod,
  };

  return {
    ...status,
    hasAttemptedDetection,
    detectWebLN,
    testWebLN,
  };
}
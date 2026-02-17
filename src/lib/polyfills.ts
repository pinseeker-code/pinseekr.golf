/**
 * Polyfill for AbortSignal.any()
 * 
 * AbortSignal.any() creates an AbortSignal that will be aborted when any of the
 * provided signals are aborted. This is useful for combining multiple abort signals.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static
 */

// Extend global types so we can polyfill safely without `any`
declare global {
  interface AbortSignalConstructor {
    any?: (signals: AbortSignal[]) => AbortSignal;
    timeout?: (ms: number) => AbortSignal;
  }
}

// Check if AbortSignal.any is already available
if (!AbortSignal.any) {
  AbortSignal.any = function(signals: AbortSignal[]): AbortSignal {
    // If no signals provided, return a signal that never aborts
    if (signals.length === 0) {
      return new AbortController().signal;
    }

    // If only one signal, return it directly for efficiency
    if (signals.length === 1) {
      return signals[0]! as AbortSignal;
    }

    // Check if any signal is already aborted
    for (const signal of signals) {
      if (signal.aborted) {
        // Create an already-aborted signal with the same reason
        const controller = new AbortController();
        controller.abort(signal.reason);
        return controller.signal;
      }
    }

    // Create a new controller for the combined signal
    const controller = new AbortController();

    // Function to abort the combined signal
    const onAbort = (event: Event) => {
      const target = event.target as AbortSignal | null;
      if (target) controller.abort(target.reason);
    };

    // Listen for abort events on all input signals
    for (const signal of signals) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    // Clean up listeners when the combined signal is aborted
    controller.signal.addEventListener('abort', () => {
      for (const signal of signals) {
        signal.removeEventListener('abort', onAbort);
      }
    }, { once: true });

    return controller.signal;
  };
}


/**
 * Polyfill for AbortSignal.timeout()
 * 
 * AbortSignal.timeout() creates an AbortSignal that will be aborted after a
 * specified number of milliseconds.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
 */

// Check if AbortSignal.timeout is already available
if (!AbortSignal.timeout) {
  AbortSignal.timeout = function(milliseconds: number): AbortSignal {
    const controller = new AbortController();
    
    setTimeout(() => {
      controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    }, milliseconds);
    
    return controller.signal;
  };
}


/**
 * Polyfill for crypto.randomUUID()
 * 
 * crypto.randomUUID() generates a random UUID v4 string.
 * Required by Nostrify's NConnectSigner for NIP-46 connections.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
 */

// Check if crypto.randomUUID is already available
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = function(): `${string}-${string}-${string}-${string}-${string}` {
    // Generate 16 random bytes
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    
    // Set version (4) and variant (RFC4122)
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // Version 4
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // Variant RFC4122
    
    // Convert to hex string with dashes
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
}

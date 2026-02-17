import { useNostr } from '@nostrify/react';
import { NLogin, useNostrLogin } from '@nostrify/react/login';
import type { NostrSigner } from '@nostrify/nostrify';

// NOTE: This file should not be edited except for adding new login methods.

export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, removeLogin } = useNostrLogin();

  return {
    // Login with a Nostr secret key
    nsec(nsec: string): void {
      const login = NLogin.fromNsec(nsec);
      addLogin(login);
    },
    // Login with a NIP-46 "bunker://" URI
    async bunker(uri: string): Promise<void> {
      console.log('[NIP-46] useLoginActions.bunker() called with URI:', uri);
      console.log('[NIP-46] nostr pool instance:', nostr);
      try {
        console.log('[NIP-46] Calling NLogin.fromBunker...');
        const login = await NLogin.fromBunker(uri, nostr);
        console.log('[NIP-46] NLogin.fromBunker succeeded, login:', login);
        addLogin(login);
        console.log('[NIP-46] Login added successfully');
      } catch (error) {
        console.error('[NIP-46] NLogin.fromBunker failed:', error);
        throw error;
      }
    },
    // Login with an already-established NIP-46 signer (for QR code flow)
    fromSigner(pubkey: string, signer: NostrSigner): void {
      console.log('[NIP-46] useLoginActions.fromSigner() called with pubkey:', pubkey);
      // Create NLogin directly from existing signer - no new connection needed
      const login = new NLogin('x-nip46', pubkey, { signer });
      addLogin(login);
      console.log('[NIP-46] Login added from existing signer');
    },
    // Login with a NIP-07 browser extension
    async extension(): Promise<void> {
      const login = await NLogin.fromExtension();
      addLogin(login);
    },
    // Log out the current user
    async logout(): Promise<void> {
      const login = logins[0];
      if (login) {
        removeLogin(login.id);
      }
    }
  };
}

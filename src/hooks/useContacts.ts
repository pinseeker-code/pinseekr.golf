import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
// Hook to fetch and manage user's Nostr contacts

export interface Contact {
  pubkey: string;
  name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
}

/**
 * Hook to fetch user's contacts from their Kind 3 contact list
 * and enrich with profile metadata from Kind 0 events
 */
export function useContacts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['contacts', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      try {
        // Step 1: Get the user's contact list (Kind 3)
        const contactListEvents = await nostr.query([{
          kinds: [3],
          authors: [user.pubkey],
          limit: 1
        }], { signal });

        if (contactListEvents.length === 0) {
          return [];
        }

        // Extract pubkeys from the most recent contact list
        const contactList = contactListEvents[0];
        const contactPubkeys = contactList.tags
          .filter(tag => tag[0] === 'p' && tag[1])
          .map(tag => tag[1])
          .slice(0, 100); // Limit to first 100 contacts

        if (contactPubkeys.length === 0) {
          return [];
        }

        // Step 2: Get profile metadata for all contacts (Kind 0)
        const profileEvents = await nostr.query([{
          kinds: [0],
          authors: contactPubkeys
        }], { signal });

        // Step 3: Build contact objects with metadata
        const contactsMap = new Map<string, Contact>();

        // Initialize all contacts
        contactPubkeys.forEach(pubkey => {
          contactsMap.set(pubkey, { pubkey });
        });

        // Enrich with profile metadata
        profileEvents.forEach(event => {
          try {
            const metadata = JSON.parse(event.content);
            const existingContact = contactsMap.get(event.pubkey);
            if (existingContact) {
              contactsMap.set(event.pubkey, {
                ...existingContact,
                name: metadata.name || metadata.display_name,
                picture: metadata.picture,
                about: metadata.about,
                nip05: metadata.nip05
              });
            }
          } catch (err) {
            console.warn('Failed to parse profile metadata for', event.pubkey, err);
          }
        });

        return Array.from(contactsMap.values())
          .filter(contact => contact.name) // Only return contacts with names
          .sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Sort by name

      } catch (error) {
        console.error('Failed to fetch contacts:', error);
        return [];
      }
    },
    enabled: !!user?.pubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
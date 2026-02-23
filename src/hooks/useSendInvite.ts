import { useNostr } from "@nostrify/react";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import type { NostrEvent } from "@nostrify/nostrify";

export interface InvitePayload {
  type: "round-invite";
  roundId: string;
  joinUrl: string;
  code: string;
  fromName: string;
  meta?: {
    course?: string;
    date?: string;
  };
}

/**
 * Hook to send encrypted round invites via NIP-44 DM (kind 4)
 * 
 * Invites are sent as encrypted direct messages to notify players
 * they've been added to a round. The invite contains:
 * - Round ID
 * - Join URL with code
 * - Sender's name
 * - Course info
 */
export function useSendInvite() {
  const { nostr } = useNostr();
  const { user, metadata } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      recipientPubkey,
      roundId,
      joinCode,
      courseName,
    }: {
      recipientPubkey: string;
      roundId: string;
      joinCode: string;
      courseName?: string;
    }): Promise<NostrEvent | null> => {
      if (!user?.signer) {
        console.warn("[SendInvite] No signer available");
        return null;
      }

      try {
        const joinUrl = `${window.location.origin}/join/${joinCode}`;
        
        const invitePayload: InvitePayload = {
          type: "round-invite",
          roundId,
          joinUrl,
          code: joinCode,
          fromName: metadata?.name || metadata?.display_name || "A golfer",
          meta: {
            course: courseName,
            date: new Date().toISOString().split("T")[0],
          },
        };

        const plaintext = JSON.stringify(invitePayload);

        // Check if signer supports NIP-44 encryption
        if (!user.signer.nip44?.encrypt) {
          console.warn("[SendInvite] Signer does not support NIP-44 encryption");
          return null;
        }

        // Encrypt the invite message
        const ciphertext = await user.signer.nip44.encrypt(recipientPubkey, plaintext);

        // Create kind 4 DM event (encrypted direct message)
        const dmEvent = await user.signer.signEvent({
          kind: 4,
          content: ciphertext,
          tags: [["p", recipientPubkey]],
          created_at: Math.floor(Date.now() / 1000),
        });

        // Publish the DM
        await nostr.event(dmEvent, { signal: AbortSignal.timeout(5000) });
        
        console.log(`[SendInvite] Sent invite to ${recipientPubkey.slice(0, 8)}... for round ${roundId}`);
        return dmEvent;
      } catch (error) {
        console.error("[SendInvite] Failed to send invite:", error);
        // Don't throw - invites are optional/best-effort
        return null;
      }
    },
    onError: (error) => {
      console.error("[SendInvite] Mutation error:", error);
    },
  });
}

/**
 * Batch send invites to multiple players
 */
export function useSendInvites() {
  const { mutateAsync: sendInvite } = useSendInvite();

  return useMutation({
    mutationFn: async ({
      playerPubkeys,
      roundId,
      joinCode,
      courseName,
    }: {
      playerPubkeys: string[];
      roundId: string;
      joinCode: string;
      courseName?: string;
    }) => {
      const results = await Promise.allSettled(
        playerPubkeys.map((pubkey) =>
          sendInvite({ recipientPubkey: pubkey, roundId, joinCode, courseName })
        )
      );

      const successful = results.filter(
        (r): r is PromiseFulfilledResult<NostrEvent | null> =>
          r.status === "fulfilled" && r.value !== null
      ).length;

      console.log(`[SendInvites] Sent ${successful}/${playerPubkeys.length} invites`);
      return { sent: successful, total: playerPubkeys.length };
    },
  });
}

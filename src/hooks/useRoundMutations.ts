import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { APP_KIND } from '@/lib/golf/types';
import type { RoundHistoryItem } from '@/hooks/useRoundHistory';

/**
 * Build an updated round event by cloning rawTags and replacing the status tag.
 * Since APP_KIND events with a `d` tag are replaceable (NIP-33), publishing
 * this will overwrite the previous version on all relays.
 */
function buildUpdatedRoundTags(
  rawTags: string[][],
  newStatus: 'completed' | 'cancelled',
): string[][] {
  return rawTags.map((tag) =>
    tag[0] === 'status' ? ['status', newStatus] : tag,
  );
}

interface RoundStatusUpdate {
  round: RoundHistoryItem;
  ownerPubkey: string;
}

export function useRoundMutations() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  const invalidate = (pubkey: string) => {
    queryClient.invalidateQueries({ queryKey: ['round-history', pubkey] });
  };

  const endRound = useMutation({
    mutationFn: async ({ round, ownerPubkey }: RoundStatusUpdate) => {
      const tags = buildUpdatedRoundTags(round.rawTags, 'completed');
      await publishEvent({
        kind: APP_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
      });
      invalidate(ownerPubkey);
    },
  });

  const cancelRound = useMutation({
    mutationFn: async ({ round, ownerPubkey }: RoundStatusUpdate) => {
      const tags = buildUpdatedRoundTags(round.rawTags, 'cancelled');
      await publishEvent({
        kind: APP_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
      });
      invalidate(ownerPubkey);
    },
  });

  return {
    endRound: endRound.mutateAsync,
    cancelRound: cancelRound.mutateAsync,
    isEnding: endRound.isPending,
    isCancelling: cancelRound.isPending,
  };
}

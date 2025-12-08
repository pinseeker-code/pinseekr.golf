import { Button as BCButton } from '@getalby/bitcoin-connect-react';
import { useToast } from '@/hooks/useToast';

/**
 * Bitcoin Connect Button component that provides a unified wallet connection experience.
 * Supports multiple wallet types including:
 * - Browser extensions (Alby, etc.)
 * - Nostr Wallet Connect (NWC)
 * - Mobile wallets via deep links
 */
export function BitcoinConnectButton() {
  const { toast } = useToast();

  return (
    <BCButton
      onConnected={() => {
        toast({
          title: 'Wallet Connected',
          description: 'Your lightning wallet is now connected and ready for payments.',
        });
      }}
      onDisconnected={() => {
        toast({
          title: 'Wallet Disconnected',
          description: 'Your lightning wallet has been disconnected.',
        });
      }}
    />
  );
}

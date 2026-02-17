import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/useToast';
import { useNWC } from '@/hooks/useNWCContext';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { APP_KIND } from '@/lib/golf/types';
import type { NostrEvent } from '@nostrify/nostrify';
import { SUBTYPES } from '@/lib/golfTags';
import type { SettlementPayment } from '@/lib/golf/settlementTypes';
import { Zap, Copy, CheckCircle2, AlertCircle, Wallet } from 'lucide-react';
import { LN } from '@getalby/sdk';

interface SettlementClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settlementEventId: string;
  roundId: string;
  winnings: SettlementPayment[];
  totalWinnings: number;
}

export function SettlementClaimDialog({
  open,
  onOpenChange,
  settlementEventId,
  roundId,
  winnings,
  totalWinnings,
}: SettlementClaimDialogProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const nwc = useNWC();
  const { mutate: publishEvent } = useNostrPublish();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const handleGenerateInvoice = async () => {
    if (!user) {
      toast({ 
        title: 'Login required', 
        description: 'Please log in to generate invoice',
        variant: 'destructive' 
      });
      return;
    }

    const connection = nwc.getActiveConnection();
    if (!connection?.connectionString) {
      toast({
        title: 'Wallet not connected',
        description: 'Connect your Lightning wallet to generate invoice',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const client = new LN(connection.connectionString);
      
      // Try multiple method names for invoice creation
      const tryInvoice = async (): Promise<string> => {
        const maybeClient = client as unknown as Record<string, unknown>;

        // Attempt known method names safely (typed as unknown responses)
        if (typeof maybeClient.createInvoice === 'function') {
          const resp = await (maybeClient.createInvoice as (...args: unknown[]) => Promise<unknown>)({ amount: totalWinnings, memo: `Golf wager winnings: ${totalWinnings} sats` });
          const invoice = extractBolt11(resp);
          if (invoice) return invoice;
        }

        if (typeof maybeClient.invoice === 'function') {
          const resp = await (maybeClient.invoice as (...args: unknown[]) => Promise<unknown>)(totalWinnings, `Golf wager winnings: ${totalWinnings} sats`);
          const invoice = extractBolt11(resp);
          if (invoice) return invoice;
        }

        if (typeof maybeClient.requestInvoice === 'function') {
          const resp = await (maybeClient.requestInvoice as (...args: unknown[]) => Promise<unknown>)(totalWinnings, `Golf wager winnings: ${totalWinnings} sats`);
          const invoice = extractBolt11(resp);
          if (invoice) return invoice;
        }

        throw new Error('All invoice generation methods failed');
      };

      const bolt11 = await tryInvoice();
      
      if (!bolt11) {
        throw new Error('Failed to extract invoice from response');
      }

      setGeneratedInvoice(bolt11);

      // Publish settlement claim event
      const claimEvent: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'> = {
        kind: APP_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', `${roundId}-claim-${Date.now()}`],
          ['t', 'golf'],
          ['t', SUBTYPES.SETTLEMENT_CLAIM],
          ['e', settlementEventId, '', 'settlement'],
          ['round', roundId],
        ],
        content: JSON.stringify({
          amountSats: totalWinnings,
          invoice: bolt11,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hour expiry
          status: 'pending',
        }),
      };

      publishEvent(claimEvent);

      toast({
        title: 'Invoice generated',
        description: 'Your invoice has been created and published',
      });
    } catch (error) {
      console.error('Invoice generation failed:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Could not generate invoice',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyInvoice = async () => {
    if (!generatedInvoice) return;

    try {
      await navigator.clipboard.writeText(generatedInvoice);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Invoice copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy invoice to clipboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Claim Your Winnings
          </DialogTitle>
          <DialogDescription>
            Generate a Lightning invoice to collect your golf wager winnings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Winnings Summary */}
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Total Winnings</div>
            <div className="text-3xl font-bold text-green-700 dark:text-green-400">
              {totalWinnings.toLocaleString()} sats
            </div>
            
            {/* Breakdown */}
            <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 space-y-1">
              <div className="text-xs font-medium text-muted-foreground mb-2">From Players:</div>
              {winnings.map((w, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground truncate max-w-[200px]">
                    {w.from.slice(0, 8)}...
                  </span>
                  <span className="font-mono font-medium">
                    {w.amountSats.toLocaleString()} sats
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Wallet Status */}
          {!nwc.getActiveConnection() && (
            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertDescription>
                Connect your Lightning wallet to generate an invoice
              </AlertDescription>
            </Alert>
          )}

          {/* Generated Invoice */}
          {generatedInvoice && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Invoice Generated
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyInvoice}
                  disabled={copied}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="font-mono text-xs break-all bg-white dark:bg-gray-800 p-2 rounded border">
                {generatedInvoice}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Share this invoice with the players who owe you payment
              </div>
            </div>
          )}

          {/* Info Alert */}
          {!generatedInvoice && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Once you generate an invoice, it will be published to Nostr so payers can see it and send payment.
                The invoice expires in 24 hours.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!generatedInvoice && (
            <Button
              onClick={handleGenerateInvoice}
              disabled={isGenerating || !nwc.getActiveConnection()}
            >
              {isGenerating ? (
                <>
                  <Skeleton className="h-4 w-4 mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Invoice
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to extract bolt11 from various response formats
function extractBolt11(resp: unknown): string {
  if (!resp || typeof resp !== 'object') return '';
  const r = resp as Record<string, unknown>;
  const candidates = ['invoice', 'payment_request', 'pr', 'bolt11', 'paymentRequest'];
  for (const key of candidates) {
    const val = r[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return '';
}

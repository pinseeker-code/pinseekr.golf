import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { useNWC } from '@/hooks/useNWCContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Zap, AlertCircle, Wallet, Loader2 } from 'lucide-react';

interface ExpensePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settlement: {
    fromPlayerId: string;
    fromPlayerName: string;
    toPlayerId: string;
    toPlayerName: string;
    amountSats: number;
  };
  onPaymentSuccess?: () => void;
}

export function ExpensePaymentDialog({
  open,
  onOpenChange,
  settlement,
  onPaymentSuccess,
}: ExpensePaymentDialogProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const nwc = useNWC();
  
  const [invoice, setInvoice] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const handlePayInvoice = async () => {
    if (!user) {
      toast({ 
        title: 'Login required', 
        description: 'Please log in to make payment',
        variant: 'destructive' 
      });
      return;
    }

    if (!invoice.trim()) {
      toast({
        title: 'Invoice required',
        description: 'Please paste a Lightning invoice to pay',
        variant: 'destructive',
      });
      return;
    }

    const connection = nwc.getActiveConnection();
    if (!connection?.connectionString || !connection.isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Connect your Lightning wallet to make payment',
        variant: 'destructive',
      });
      return;
    }

    setIsPaying(true);

    try {
      await nwc.sendPayment(connection, invoice.trim());

      toast({
        title: 'Payment successful!',
        description: `You paid ${settlement.amountSats.toLocaleString()} sats to ${settlement.toPlayerName}`,
      });

      // Clear invoice and close dialog
      setInvoice('');
      onOpenChange(false);
      onPaymentSuccess?.();
    } catch (error) {
      console.error('Payment failed:', error);
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Could not complete payment',
        variant: 'destructive',
      });
    } finally {
      setIsPaying(false);
    }
  };

  const handleClose = () => {
    if (!isPaying) {
      setInvoice('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Pay Expense Settlement
          </DialogTitle>
          <DialogDescription>
            Pay {settlement.toPlayerName} {settlement.amountSats.toLocaleString()} sats via Lightning
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Settlement Details */}
          <div className="rounded-md bg-muted p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">From</span>
              <span className="font-medium">{settlement.fromPlayerName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">To</span>
              <span className="font-medium">{settlement.toPlayerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono font-bold text-lg">{settlement.amountSats.toLocaleString()} sats</span>
            </div>
          </div>

          {/* Wallet Status */}
          {!nwc.getActiveConnection()?.isConnected && (
            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertDescription>
                No Lightning wallet connected. Connect your wallet in settings to make payments.
              </AlertDescription>
            </Alert>
          )}

          {/* Invoice Input */}
          <div className="space-y-2">
            <Label htmlFor="invoice">
              Lightning Invoice
            </Label>
            <Input
              id="invoice"
              placeholder="lnbc..."
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              disabled={isPaying}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Request an invoice from {settlement.toPlayerName} for {settlement.amountSats.toLocaleString()} sats
            </p>
          </div>

          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>How to pay:</strong>
              <ol className="list-decimal ml-4 mt-1 space-y-1">
                <li>Ask {settlement.toPlayerName} to generate a Lightning invoice for {settlement.amountSats.toLocaleString()} sats</li>
                <li>Paste the invoice above</li>
                <li>Click Pay to complete the settlement</li>
              </ol>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isPaying}
          >
            Cancel
          </Button>
          <Button 
            onClick={handlePayInvoice}
            disabled={isPaying || !invoice.trim() || !nwc.getActiveConnection()?.isConnected}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            {isPaying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Paying...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Pay {settlement.amountSats.toLocaleString()} sats
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

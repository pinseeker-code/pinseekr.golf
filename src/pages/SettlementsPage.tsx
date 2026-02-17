import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMySettlements } from '@/hooks/useSettlements';
import { SettlementClaimDialog } from '@/components/golf/SettlementClaimDialog';
import { getPaymentsOwedTo, calculateNetBalance } from '@/lib/golf/settlementTypes';
import type { SettlementEvent } from '@/lib/golf/settlementTypes';
import { Zap, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';

export default function SettlementsPage() {
  const { user } = useCurrentUser();
  const { data: settlements, isLoading } = useMySettlements(user?.pubkey);
  
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementEvent | null>(null);
  const [showClaimDialog, setShowClaimDialog] = useState(false);

  const handleClaimWinnings = (settlement: SettlementEvent) => {
    setSelectedSettlement(settlement);
    setShowClaimDialog(true);
  };

  if (!user) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Alert>
            <AlertDescription>
              Please log in to view your settlements
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Wager Settlements</h1>
          <p className="text-muted-foreground">
            View and claim your golf wager winnings
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !settlements || settlements.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No settlements found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Settlements will appear here after rounds with wagers are completed
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {settlements.map((settlement) => {
              const netBalance = calculateNetBalance(settlement, user.pubkey);
              const winnings = getPaymentsOwedTo(settlement, user.pubkey);
              const isWinner = netBalance > 0;
              const date = new Date(settlement.date);

              return (
                <Card key={settlement.eventId} className={isWinner ? 'border-green-300 dark:border-green-800' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {isWinner ? (
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-600" />
                          )}
                          {settlement.courseName || 'Golf Round'}
                        </CardTitle>
                        <CardDescription className="mt-1 space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="h-3 w-3" />
                            {date.toLocaleDateString()}
                          </div>
                          {settlement.gameModes && settlement.gameModes.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {settlement.gameModes.join(', ')}
                            </div>
                          )}
                        </CardDescription>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${isWinner ? 'text-green-600' : 'text-red-600'}`}>
                          {isWinner ? '+' : ''}{netBalance.toLocaleString()} sats
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Total pot: {settlement.totalPot.toLocaleString()} sats
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {isWinner && winnings.length > 0 ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="text-sm font-medium mb-2">You won {netBalance.toLocaleString()} sats!</div>
                          <div className="space-y-1">
                            {winnings.map((w, idx) => (
                              <div key={idx} className="text-xs flex justify-between">
                                <span className="text-muted-foreground truncate max-w-[200px]">
                                  From: {w.from.slice(0, 12)}...
                                </span>
                                <span className="font-mono">{w.amountSats.toLocaleString()} sats</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full"
                          onClick={() => handleClaimWinnings(settlement)}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Claim Winnings
                        </Button>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border text-sm text-muted-foreground">
                        {netBalance < 0 ? (
                          <>You owe {Math.abs(netBalance).toLocaleString()} sats for this round</>
                        ) : (
                          <>No winnings from this round</>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Claim Dialog */}
        {selectedSettlement && (
          <SettlementClaimDialog
            open={showClaimDialog}
            onOpenChange={setShowClaimDialog}
            settlementEventId={selectedSettlement.eventId || ''}
            roundId={selectedSettlement.roundId}
            winnings={getPaymentsOwedTo(selectedSettlement, user.pubkey)}
            totalWinnings={calculateNetBalance(selectedSettlement, user.pubkey)}
          />
        )}
      </div>
    </Layout>
  );
}

import { Info, TrendingDown, Calculator, Target } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { HandicapResult } from '@/lib/golf/handicapCalculator';
import { getMethodDescription } from '@/lib/golf/handicapCalculator';

interface HandicapInfoDialogProps {
  handicapResult?: HandicapResult | null;
  trigger?: React.ReactNode;
}

export function HandicapInfoDialog({ handicapResult, trigger }: HandicapInfoDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Info className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            How Handicap is Calculated
          </DialogTitle>
          <DialogDescription>
            Understanding your golf handicap index
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Formula Section */}
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              The Formula
            </h4>
            <div className="font-mono text-xs bg-background p-2 rounded border">
              Differential = (Score − Rating) × 113 ÷ Slope
            </div>
            <p className="text-muted-foreground text-xs">
              Each round produces a "differential" that measures your performance 
              relative to the course difficulty.
            </p>
          </div>

          {/* Progressive Calculation */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Progressive Calculation
            </h4>
            <p className="text-muted-foreground">
              Your handicap becomes more accurate as you play more rounds:
            </p>
            
            <div className="space-y-1.5">
              <MethodRow 
                rounds="5-9 rounds" 
                method="Best 2 differentials" 
                isActive={handicapResult?.method === 'best-2-of-5'}
              />
              <MethodRow 
                rounds="10-19 rounds" 
                method="Best 3 differentials" 
                isActive={handicapResult?.method === 'best-3-of-10'}
              />
              <MethodRow 
                rounds="20+ rounds" 
                method="Best 8 differentials" 
                isActive={handicapResult?.method === 'best-8-of-20'}
                isStandard
              />
            </div>
          </div>

          {/* Current Status */}
          {handicapResult && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
              <h4 className="font-semibold">Your Status</h4>
              {handicapResult.method === 'insufficient' ? (
                <p className="text-muted-foreground">
                  You need <span className="font-semibold text-foreground">{handicapResult.minimumRoundsNeeded} more rounds</span> to 
                  calculate your handicap. Keep playing!
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    {getMethodDescription(handicapResult.method)}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary">
                      {handicapResult.index?.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      from {handicapResult.roundsAvailable} rounds
                    </span>
                  </div>
                  {handicapResult.minimumRoundsNeeded > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Play {handicapResult.minimumRoundsNeeded} more rounds to unlock the next tier.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Best Rounds */}
          {handicapResult && handicapResult.bestDifferentials.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                Your Best Rounds Used
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {handicapResult.bestDifferentials.map((d) => (
                  <div 
                    key={d.roundId} 
                    className="flex justify-between items-center text-xs py-1 px-2 bg-muted/50 rounded"
                  >
                    <span className="text-muted-foreground">
                      {d.courseName || 'Unknown'} • {new Date(d.date).toLocaleDateString()}
                    </span>
                    <span className="font-mono">
                      {d.gross} → <span className="font-semibold">{d.differential.toFixed(1)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Soft Cap Note */}
          <p className="text-xs text-muted-foreground border-t pt-3">
            <strong>Note:</strong> A 96% multiplier (soft cap) is applied to the average 
            of your best differentials, per USGA/WHS guidelines.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MethodRow({ 
  rounds, 
  method, 
  isActive, 
  isStandard 
}: { 
  rounds: string; 
  method: string; 
  isActive?: boolean;
  isStandard?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-1.5 px-2 rounded text-xs ${
      isActive ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
    }`}>
      <span className={isActive ? 'font-semibold' : ''}>{rounds}</span>
      <span className="flex items-center gap-1">
        {method}
        {isStandard && (
          <span className="text-[10px] bg-primary/20 text-primary px-1 rounded">USGA</span>
        )}
        {isActive && (
          <span className="text-[10px] bg-primary text-primary-foreground px-1 rounded">Active</span>
        )}
      </span>
    </div>
  );
}

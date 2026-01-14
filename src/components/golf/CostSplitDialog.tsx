import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  Receipt,
  ArrowRight,
  Zap,
  RefreshCw,
} from 'lucide-react';
import {
  Expense,
  ExpenseCategory,
  Currency,
  SplitMode,
  CustomSplit,
  CURRENCY_SYMBOLS,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_ICONS,
  calculateExpenseSplits,
} from '@/lib/golf/expenseTypes';
import { useExchangeRate } from '@/hooks/useExchangeRate';

interface CostSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: { playerId: string; name: string }[];
  expenses: Expense[];
  onExpensesChange: (expenses: Expense[]) => void;
}

const CURRENCIES: Currency[] = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'MXN', 'sats'];

export const CostSplitDialog: React.FC<CostSplitDialogProps> = ({
  open,
  onOpenChange,
  players,
  expenses,
  onExpensesChange,
}) => {
  const { convertToSats, formatCurrency, rates, loading: ratesLoading, refresh } = useExchangeRate();
  
  const [activeTab, setActiveTab] = useState<'add' | 'summary'>('add');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [customSplitCurrency, setCustomSplitCurrency] = useState<Currency>('USD');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [newExpense, setNewExpense] = useState({
    category: ExpenseCategory.FOOD as ExpenseCategory,
    description: '',
    amount: '',
    currency: 'USD' as Currency,
    paidByPlayerId: players[0]?.playerId || '',
    splitBetweenPlayerIds: players.map(p => p.playerId),
  });

  // Initialize custom splits when players change
  React.useEffect(() => {
    const initialSplits: Record<string, string> = {};
    players.forEach(p => {
      initialSplits[p.playerId] = splitMode === 'percentage' 
        ? String(Math.round(100 / players.length)) 
        : '';
    });
    setCustomSplits(initialSplits);
  }, [players.length, splitMode]);

  // Calculate splits
  const { splits, settlements } = useMemo(() => {
    return calculateExpenseSplits(expenses, players);
  }, [expenses, players]);

  // Total expenses in sats
  const totalSats = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amountSats, 0);
  }, [expenses]);

  const handleAddExpense = () => {
    if (!newExpense.amount || !newExpense.paidByPlayerId || newExpense.splitBetweenPlayerIds.length === 0) {
      return;
    }

    const amount = parseFloat(newExpense.amount);
    if (isNaN(amount) || amount <= 0) return;

    const amountSats = convertToSats(amount, newExpense.currency);

    // Build custom splits array if using custom mode
    let expenseCustomSplits: CustomSplit[] | undefined;
    if (splitMode !== 'equal') {
      expenseCustomSplits = newExpense.splitBetweenPlayerIds
        .filter(playerId => customSplits[playerId] && parseFloat(customSplits[playerId]) > 0)
        .map(playerId => {
          const value = parseFloat(customSplits[playerId]) || 0;
          // For fixed mode, convert the input currency to sats
          const finalValue = splitMode === 'fixed' 
            ? convertToSats(value, customSplitCurrency)
            : value;
          return { playerId, value: finalValue };
        });
    }

    const expense: Expense = {
      id: `expense-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      category: newExpense.category,
      description: newExpense.description || EXPENSE_CATEGORY_LABELS[newExpense.category],
      amount,
      currency: newExpense.currency,
      amountSats,
      paidByPlayerId: newExpense.paidByPlayerId,
      splitBetweenPlayerIds: newExpense.splitBetweenPlayerIds,
      splitMode,
      customSplits: expenseCustomSplits,
      createdAt: Date.now(),
    };

    onExpensesChange([...expenses, expense]);

    // Reset form
    setNewExpense({
      ...newExpense,
      description: '',
      amount: '',
    });
  };

  const handleRemoveExpense = (id: string) => {
    onExpensesChange(expenses.filter(e => e.id !== id));
  };

  const togglePlayerInSplit = (playerId: string) => {
    setNewExpense(prev => ({
      ...prev,
      splitBetweenPlayerIds: prev.splitBetweenPlayerIds.includes(playerId)
        ? prev.splitBetweenPlayerIds.filter(id => id !== playerId)
        : [...prev.splitBetweenPlayerIds, playerId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg mx-4 sm:mx-auto max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Split Costs
          </DialogTitle>
          <DialogDescription>
            Add expenses and split them among players. Settle with Lightning.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'add' | 'summary')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">Add Expense</TabsTrigger>
            <TabsTrigger value="summary">
              Summary
              {expenses.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {expenses.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="flex-1 overflow-auto space-y-4 mt-4">
            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newExpense.category}
                onValueChange={(v) => setNewExpense(prev => ({ ...prev, category: v as ExpenseCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ExpenseCategory).map(cat => (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2">
                        <span>{EXPENSE_CATEGORY_ICONS[cat]}</span>
                        <span>{EXPENSE_CATEGORY_LABELS[cat]}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder={EXPENSE_CATEGORY_LABELS[newExpense.category]}
                value={newExpense.description}
                onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Amount and Currency */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-2">
                <Label>Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {CURRENCY_SYMBOLS[newExpense.currency]}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={newExpense.currency}
                  onValueChange={(v) => setNewExpense(prev => ({ ...prev, currency: v as Currency }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(cur => (
                      <SelectItem key={cur} value={cur}>
                        {cur === 'sats' ? '₿ sats' : `${CURRENCY_SYMBOLS[cur]} ${cur}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sats conversion preview */}
            {newExpense.amount && newExpense.currency !== 'sats' && (
              <div className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                <span className="text-muted-foreground">≈ in sats:</span>
                <span className="font-mono font-medium">
                  {convertToSats(parseFloat(newExpense.amount) || 0, newExpense.currency).toLocaleString()} sats
                </span>
              </div>
            )}

            {/* Paid By */}
            <div className="space-y-2">
              <Label>Paid By</Label>
              <Select
                value={newExpense.paidByPlayerId}
                onValueChange={(v) => setNewExpense(prev => ({ ...prev, paidByPlayerId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select who paid" />
                </SelectTrigger>
                <SelectContent>
                  {players.map(p => (
                    <SelectItem key={p.playerId} value={p.playerId}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Split Between */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Split Between</Label>
                <div className="flex gap-1 bg-muted p-0.5 rounded-md">
                  <button
                    type="button"
                    onClick={() => setSplitMode('equal')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      splitMode === 'equal' 
                        ? 'bg-background shadow-sm font-medium' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Equal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode('percentage')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      splitMode === 'percentage' 
                        ? 'bg-background shadow-sm font-medium' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode('fixed')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      splitMode === 'fixed' 
                        ? 'bg-background shadow-sm font-medium' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Fixed
                  </button>
                </div>
              </div>

              {/* Currency selector for fixed mode */}
              {splitMode === 'fixed' && (
                <Select
                  value={customSplitCurrency}
                  onValueChange={(v) => setCustomSplitCurrency(v as Currency)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Player selection grid - equal mode */}
              {splitMode === 'equal' && (
                <div className="grid grid-cols-2 gap-2">
                  {players.map(p => (
                    <div
                      key={p.playerId}
                      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                        newExpense.splitBetweenPlayerIds.includes(p.playerId)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border hover:border-primary/50'
                      }`}
                      onClick={() => togglePlayerInSplit(p.playerId)}
                    >
                      <Checkbox
                        checked={newExpense.splitBetweenPlayerIds.includes(p.playerId)}
                        onCheckedChange={() => togglePlayerInSplit(p.playerId)}
                      />
                      <span className="text-sm">{p.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom split inputs - percentage or fixed mode */}
              {splitMode !== 'equal' && (
                <div className="space-y-2">
                  {players.map(p => (
                    <div key={p.playerId} className="flex items-center gap-2">
                      <Checkbox
                        checked={newExpense.splitBetweenPlayerIds.includes(p.playerId)}
                        onCheckedChange={() => togglePlayerInSplit(p.playerId)}
                      />
                      <span className="text-sm flex-1 min-w-0 truncate">{p.name}</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={customSplits[p.playerId] || ''}
                          onChange={(e) => setCustomSplits(prev => ({
                            ...prev,
                            [p.playerId]: e.target.value
                          }))}
                          onFocus={(e) => {
                            e.target.select();
                            // Auto-select this player if entering a value
                            if (!newExpense.splitBetweenPlayerIds.includes(p.playerId)) {
                              togglePlayerInSplit(p.playerId);
                            }
                          }}
                          placeholder="0"
                          className="w-16 h-8 text-right text-sm"
                        />
                        <span className="text-xs text-muted-foreground w-6">
                          {splitMode === 'percentage' ? '%' : customSplitCurrency === 'sats' ? '₿' : '$'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {splitMode === 'percentage' && (
                    <p className={`text-xs ${
                      (() => {
                        const total = Object.entries(customSplits)
                          .filter(([id]) => newExpense.splitBetweenPlayerIds.includes(id))
                          .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0);
                        return Math.abs(total - 100) < 0.01 ? 'text-green-600' : 'text-amber-600';
                      })()
                    }`}>
                      Total: {
                        Object.entries(customSplits)
                          .filter(([id]) => newExpense.splitBetweenPlayerIds.includes(id))
                          .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0)
                          .toFixed(1)
                      }%
                      {(() => {
                        const total = Object.entries(customSplits)
                          .filter(([id]) => newExpense.splitBetweenPlayerIds.includes(id))
                          .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0);
                        return Math.abs(total - 100) >= 0.01 ? ' (should equal 100%)' : '';
                      })()}
                    </p>
                  )}
                </div>
              )}

              {/* Summary text */}
              {newExpense.splitBetweenPlayerIds.length > 0 && newExpense.amount && splitMode === 'equal' && (
                <p className="text-xs text-muted-foreground">
                  Each pays: {formatCurrency(
                    parseFloat(newExpense.amount) / newExpense.splitBetweenPlayerIds.length,
                    newExpense.currency
                  )}
                </p>
              )}
            </div>

            {/* Add Button */}
            <Button onClick={handleAddExpense} className="w-full" disabled={!newExpense.amount || !newExpense.paidByPlayerId}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>

            {/* Recent Expenses */}
            {expenses.length > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Recent Expenses</Label>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {expenses.slice().reverse().map(expense => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span>{EXPENSE_CATEGORY_ICONS[expense.category]}</span>
                          <span className="truncate">{expense.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">
                            {formatCurrency(expense.amount, expense.currency)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveExpense(expense.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary" className="flex-1 overflow-auto space-y-4 mt-4">
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No expenses added yet</p>
                <p className="text-sm">Add expenses to see the split summary</p>
              </div>
            ) : (
              <>
                {/* Total */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total Expenses</span>
                      <div className="text-right">
                        <div className="font-bold text-lg">
                          {totalSats.toLocaleString()} sats
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ≈ {formatCurrency(totalSats / 100_000_000 * (rates?.btcToUsd || 100000), 'USD')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Player Balances */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Player Balances</Label>
                  {splits.map(split => (
                    <div
                      key={split.playerId}
                      className={`flex items-center justify-between p-3 rounded-md border ${
                        split.netBalance > 0
                          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                          : split.netBalance < 0
                          ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                          : 'bg-muted border-border'
                      }`}
                    >
                      <span className="font-medium">{split.playerName}</span>
                      <div className="text-right">
                        <div className={`font-mono font-medium ${
                          split.netBalance > 0
                            ? 'text-green-600 dark:text-green-400'
                            : split.netBalance < 0
                            ? 'text-red-600 dark:text-red-400'
                            : ''
                        }`}>
                          {split.netBalance > 0 ? '+' : ''}{split.netBalance.toLocaleString()} sats
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Paid: {split.totalPaid.toLocaleString()} • Owes: {split.totalOwed.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Settlements */}
                {settlements.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Settle Up with Lightning</Label>
                    {settlements.map((settlement, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{settlement.fromPlayerName}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{settlement.toPlayerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">
                            {settlement.amountSats.toLocaleString()} sats
                          </span>
                          <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black">
                            <Zap className="h-3 w-3 mr-1" />
                            Pay
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Exchange Rate Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground p-2 bg-muted rounded-md">
                  <span>
                    1 BTC ≈ ${rates?.btcToUsd.toLocaleString() || '...'} USD
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={refresh}
                    disabled={ratesLoading}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${ratesLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CostSplitDialog;

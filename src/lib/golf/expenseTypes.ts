// Expense and Cost Splitting Types

export type Currency = 'sats' | 'USD' | 'CAD' | 'EUR' | 'GBP' | 'AUD' | 'MXN';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  sats: '₿',
  USD: '$',
  CAD: 'C$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  MXN: 'MX$',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  sats: 'Sats',
  USD: 'US Dollar',
  CAD: 'Canadian Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  AUD: 'Australian Dollar',
  MXN: 'Mexican Peso',
};

export enum ExpenseCategory {
  GREEN_FEES = 'green-fees',
  CART_RENTAL = 'cart-rental',
  CLUB_RENTAL = 'club-rental',
  FOOD = 'food',
  DRINKS = 'drinks',
  PRO_SHOP = 'pro-shop',
  CADDIE = 'caddie',
  RANGE_BALLS = 'range-balls',
  OTHER = 'other',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.GREEN_FEES]: 'Green Fees',
  [ExpenseCategory.CART_RENTAL]: 'Cart Rental',
  [ExpenseCategory.CLUB_RENTAL]: 'Club Rental',
  [ExpenseCategory.FOOD]: 'Food',
  [ExpenseCategory.DRINKS]: 'Drinks',
  [ExpenseCategory.PRO_SHOP]: 'Pro Shop',
  [ExpenseCategory.CADDIE]: 'Caddie',
  [ExpenseCategory.RANGE_BALLS]: 'Range Balls',
  [ExpenseCategory.OTHER]: 'Other',
};

export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.GREEN_FEES]: '⛳',
  [ExpenseCategory.CART_RENTAL]: '🛒',
  [ExpenseCategory.CLUB_RENTAL]: '🏌️',
  [ExpenseCategory.FOOD]: '🍔',
  [ExpenseCategory.DRINKS]: '🍺',
  [ExpenseCategory.PRO_SHOP]: '🛍️',
  [ExpenseCategory.CADDIE]: '👤',
  [ExpenseCategory.RANGE_BALLS]: '🎯',
  [ExpenseCategory.OTHER]: '📝',
};

export type SplitMode = 'equal' | 'percentage' | 'fixed';

export interface CustomSplit {
  playerId: string;
  value: number; // percentage (0-100) or fixed amount in the expense currency
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: Currency;
  amountSats: number; // Converted amount in sats
  paidByPlayerId: string;
  splitBetweenPlayerIds: string[]; // Players who share this expense
  splitMode: SplitMode; // How the expense is split
  customSplits?: CustomSplit[]; // Custom split values (for percentage or fixed modes)
  createdAt: number;
}

export interface ExpenseSplit {
  playerId: string;
  playerName: string;
  totalPaid: number; // Total they paid in sats
  totalOwed: number; // Total they owe in sats
  netBalance: number; // Positive = they're owed, negative = they owe
}

export interface ExpenseSettlement {
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  amountSats: number;
}

// Calculate how to split expenses among players
export function calculateExpenseSplits(
  expenses: Expense[],
  players: { playerId: string; name: string }[]
): { splits: ExpenseSplit[]; settlements: ExpenseSettlement[] } {
  const _playerMap = new Map(players.map(p => [p.playerId, p.name]));
  const balances = new Map<string, { paid: number; owed: number }>();

  // Initialize balances
  players.forEach(p => {
    balances.set(p.playerId, { paid: 0, owed: 0 });
  });

  // Calculate what each player paid and owes
  expenses.forEach(expense => {
    const payer = balances.get(expense.paidByPlayerId);
    if (payer) {
      payer.paid += expense.amountSats;
    }

    // Handle different split modes
    if (expense.splitMode === 'percentage' && expense.customSplits) {
      // Percentage-based split
      expense.customSplits.forEach(split => {
        const bal = balances.get(split.playerId);
        if (bal) {
          bal.owed += (expense.amountSats * split.value) / 100;
        }
      });
    } else if (expense.splitMode === 'fixed' && expense.customSplits) {
      // Fixed amount split - customSplits values are in sats
      expense.customSplits.forEach(split => {
        const bal = balances.get(split.playerId);
        if (bal) {
          bal.owed += split.value;
        }
      });
    } else {
      // Equal split (default)
      const splitCount = expense.splitBetweenPlayerIds.length;
      if (splitCount > 0) {
        const perPerson = expense.amountSats / splitCount;
        expense.splitBetweenPlayerIds.forEach(playerId => {
          const bal = balances.get(playerId);
          if (bal) {
            bal.owed += perPerson;
          }
        });
      }
    }
  });

  // Create splits array
  const splits: ExpenseSplit[] = players.map(p => {
    const bal = balances.get(p.playerId) || { paid: 0, owed: 0 };
    return {
      playerId: p.playerId,
      playerName: p.name,
      totalPaid: Math.round(bal.paid),
      totalOwed: Math.round(bal.owed),
      netBalance: Math.round(bal.paid - bal.owed),
    };
  });

  // Calculate settlements (who pays whom)
  const settlements: ExpenseSettlement[] = [];
  
  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = splits.filter(s => s.netBalance > 0).sort((a, b) => b.netBalance - a.netBalance);
  const debtors = splits.filter(s => s.netBalance < 0).sort((a, b) => a.netBalance - b.netBalance);

  // Match debtors to creditors
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    
    const amount = Math.min(Math.abs(debtor.netBalance), creditor.netBalance);
    
    if (amount > 0) {
      settlements.push({
        fromPlayerId: debtor.playerId,
        fromPlayerName: debtor.playerName,
        toPlayerId: creditor.playerId,
        toPlayerName: creditor.playerName,
        amountSats: Math.round(amount),
      });
    }

    debtor.netBalance += amount;
    creditor.netBalance -= amount;

    if (Math.abs(debtor.netBalance) < 1) i++;
    if (creditor.netBalance < 1) j++;
  }

  return { splits, settlements };
}

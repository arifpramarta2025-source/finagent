import { Transaction, BudgetSettings, FinancialSummary, CategoryStat } from '../types';
import { CATEGORY_COLORS, getLocalDateString } from './constants';
import { recordedBy } from './members';

/** Uses the fallback only when no number was stored, so a saved 0 stays 0. */
export function readPercentage(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? NaN);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function calculateSummary(
  transactions: Transaction[],
  colorOf: (category: string) => string = (category) => CATEGORY_COLORS[category] || '#94A3B8'
): FinancialSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let needsTotal = 0;
  let wantsTotal = 0;
  let savingsTotal = 0;

  const categoryMap: Record<string, { amount: number; count: number }> = {};
  const dateMap: Record<string, { income: number; expense: number }> = {};

  for (const tx of transactions) {
    const d = tx.date;
    if (!dateMap[d]) {
      dateMap[d] = { income: 0, expense: 0 };
    }

    if (tx.type === 'income') {
      totalIncome += tx.amount;
      dateMap[d].income += tx.amount;
    } else {
      totalExpense += tx.amount;
      dateMap[d].expense += tx.amount;

      // Group by category
      if (!categoryMap[tx.category]) {
        categoryMap[tx.category] = { amount: 0, count: 0 };
      }
      categoryMap[tx.category].amount += tx.amount;
      categoryMap[tx.category].count += 1;

      // 50/30/20 classification
      if (tx.budgetClassification === 'needs') {
        needsTotal += tx.amount;
      } else if (tx.budgetClassification === 'wants') {
        wantsTotal += tx.amount;
      } else if (tx.budgetClassification === 'savings') {
        savingsTotal += tx.amount;
      }
    }
  }

  const netCashflow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  // Process category stats
  const topCategories: CategoryStat[] = Object.entries(categoryMap)
    .map(([cat, val]) => ({
      category: cat,
      amount: val.amount,
      count: val.count,
      percentage: totalExpense > 0 ? (val.amount / totalExpense) * 100 : 0,
      color: colorOf(cat),
    }))
    .sort((a, b) => b.amount - a.amount);

  // Process daily trends sorted by date
  const dailyTrends = Object.entries(dateMap)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, val]) => ({
      date,
      income: val.income,
      expense: val.expense,
      net: val.income - val.expense,
    }));

  return {
    totalBalance: netCashflow,
    totalIncome,
    totalExpense,
    netCashflow,
    savingsRate,
    needsTotal,
    wantsTotal,
    savingsTotal,
    topCategories,
    dailyTrends,
  };
}

/** Quotes a CSV cell and stops spreadsheets from running text as a formula. */
function toCsvCell(value: string | number): string {
  const text = String(value ?? '');
  const safeText = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function buildTransactionsCSV(transactions: Transaction[]): string {
  const headers = [
    'ID',
    'Tipe',
    'Tanggal',
    'Merchant / Sumber',
    'Kategori',
    'SubKategori',
    'Nominal',
    'Metode Pembayaran',
    'Klasifikasi',
    'Catatan',
    'Dicatat Oleh',
  ];
  const rows = transactions.map((t) => [
    t.id,
    t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    t.date,
    t.merchant || '',
    t.category || '',
    t.subCategory || '',
    t.amount,
    t.paymentMethod || '',
    t.budgetClassification,
    t.notes || '',
    recordedBy(t),
  ]);

  return [headers, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\r\n');
}

export function exportTransactionsCSV(transactions: Transaction[]): void {
  const blob = new Blob(['\uFEFF', buildTransactionsCSV(transactions)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `FINA_Transaksi_${getLocalDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

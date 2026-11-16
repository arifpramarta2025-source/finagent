import type { BudgetSettings, Transaction } from '../types';
import { formatIDR } from './constants.ts';

export type ActivityAction =
  'add' | 'edit' | 'delete' | 'delete_all' | 'restore' | 'import' | 'category' | 'budget';

export interface ActivityChange {
  label: string;
  from: string;
  to: string;
}

export interface ActivityDraft {
  action: ActivityAction;
  summary: string;
  changes?: ActivityChange[];
}

export interface ActivityEntry extends ActivityDraft {
  id: string;
  at: string;
  actorName: string;
}

type TransactionFields = Partial<Transaction>;

const TRANSACTION_FIELDS: Array<{
  key: keyof Transaction;
  label: string;
  format?: (value: unknown) => string;
}> = [
  {
    key: 'type',
    label: 'Jenis',
    format: (value) => (value === 'income' ? 'Pemasukan' : 'Pengeluaran'),
  },
  { key: 'amount', label: 'Nominal', format: (value) => formatIDR(Number(value) || 0) },
  { key: 'merchant', label: 'Merchant' },
  { key: 'category', label: 'Kategori' },
  { key: 'subCategory', label: 'Subkategori' },
  { key: 'date', label: 'Tanggal' },
  { key: 'paymentMethod', label: 'Metode bayar' },
  { key: 'budgetClassification', label: 'Alokasi' },
  { key: 'notes', label: 'Catatan' },
];

const BUDGET_FIELDS: Array<{ key: keyof BudgetSettings; label: string; isPercent?: boolean }> = [
  { key: 'monthlyIncomeTarget', label: 'Target pemasukan' },
  { key: 'emergencyFundTarget', label: 'Target dana darurat' },
  { key: 'currentEmergencyFund', label: 'Dana darurat terkumpul' },
  { key: 'needsPercentage', label: 'Needs', isPercent: true },
  { key: 'wantsPercentage', label: 'Wants', isPercent: true },
  { key: 'savingsPercentage', label: 'Savings', isPercent: true },
];

function display(value: unknown, format?: (value: unknown) => string): string {
  if (value === undefined || value === null || value === '') return '-';
  return format ? format(value) : String(value);
}

function label(tx: TransactionFields): string {
  return `"${tx.merchant || 'Transaksi'}" ${formatIDR(tx.amount ?? 0)}`;
}

/** Every field of the deleted record, so the log alone is enough to re-enter it. */
function snapshotChanges(tx: TransactionFields, side: 'from' | 'to'): ActivityChange[] {
  return TRANSACTION_FIELDS.flatMap(({ key, label: fieldLabel, format }) => {
    const value = display(tx[key], format);
    if (value === '-') return [];
    return [
      { label: fieldLabel, from: side === 'from' ? value : '-', to: side === 'to' ? value : '-' },
    ];
  });
}

export function describeAdd(tx: TransactionFields): ActivityDraft {
  return {
    action: 'add',
    summary: `Menambah transaksi ${label(tx)}`,
    changes: snapshotChanges(tx, 'to'),
  };
}

export function describeEdit(before: TransactionFields, after: TransactionFields): ActivityDraft {
  const changes = TRANSACTION_FIELDS.flatMap(({ key, label: fieldLabel, format }) => {
    const from = display(before[key], format);
    const to = display(key in after ? after[key] : before[key], format);
    return from === to ? [] : [{ label: fieldLabel, from, to }];
  });

  return { action: 'edit', summary: `Mengubah transaksi ${label(before)}`, changes };
}

export function describeDelete(tx: TransactionFields): ActivityDraft {
  return {
    action: 'delete',
    summary: `Menghapus transaksi ${label(tx)}`,
    changes: snapshotChanges(tx, 'from'),
  };
}

export function describeBudget(before: BudgetSettings, after: BudgetSettings): ActivityDraft {
  const format = (value: number, isPercent?: boolean) =>
    isPercent ? `${value}%` : formatIDR(value);
  const changes = BUDGET_FIELDS.flatMap(({ key, label: fieldLabel, isPercent }) =>
    before[key] === after[key]
      ? []
      : [
          {
            label: fieldLabel,
            from: format(before[key], isPercent),
            to: format(after[key], isPercent),
          },
        ]
  );

  return { action: 'budget', summary: 'Mengubah pengaturan anggaran', changes };
}

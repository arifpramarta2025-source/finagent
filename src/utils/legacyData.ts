/**
 * Transactions an older version may have left in this browser. The first version of the app
 * shipped sample rows, so those are kept apart and imported only on request.
 */

import type { BackupDoc, BackupDocData, RestoreWrite } from './backup';
import { FALLBACK_EXPENSE_CATEGORY, FALLBACK_INCOME_CATEGORY } from './constants';

export const LEGACY_TRANSACTIONS_KEY = 'fina_wpu_transactions_v1';
export const LEGACY_BUDGET_KEY = 'fina_wpu_budget_v1';

const SAMPLE_MERCHANTS = new Set([
  'PT Solusi Teknologi Indonesia',
  'Klien Web App Dashboard',
  'Kost Eksekutif Bandung',
]);

export interface LegacyRow {
  id?: unknown;
  date?: unknown;
  merchant?: unknown;
  amount?: unknown;
  type?: unknown;
  [key: string]: unknown;
}

export interface LegacySummary {
  rows: LegacyRow[];
  sampleCount: number;
  hasBudget: boolean;
  isUnreadable: boolean;
}

export function isSampleRow(row: LegacyRow): boolean {
  return (
    (typeof row.id === 'string' && /^tx-\d{1,3}$/.test(row.id)) ||
    (typeof row.merchant === 'string' && SAMPLE_MERCHANTS.has(row.merchant))
  );
}

function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // Browser storage can be blocked; that simply means nothing to report.
  }
}

export function inspectLegacyBrowserData(): LegacySummary {
  const hasBudget = readItem(LEGACY_BUDGET_KEY) !== null;
  const stored = readItem(LEGACY_TRANSACTIONS_KEY);
  if (stored === null) {
    return { rows: [], sampleCount: 0, hasBudget, isUnreadable: false };
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return { rows: [], sampleCount: 0, hasBudget, isUnreadable: true };
    }
    const rows = parsed.filter((row): row is LegacyRow => typeof row === 'object' && row !== null);
    return { rows, sampleCount: rows.filter(isSampleRow).length, hasBudget, isUnreadable: false };
  } catch {
    return { rows: [], sampleCount: 0, hasBudget, isUnreadable: true };
  }
}

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_CLASSIFICATIONS = ['needs', 'wants', 'savings'];

export interface LegacyImportPlan {
  writes: RestoreWrite[];
  transactionCount: number;
  duplicateCount: number;
  sampleCount: number;
  invalidCount: number;
  importsBudget: boolean;
}

function isImportable(row: LegacyRow): boolean {
  return (
    (row.type === 'income' || row.type === 'expense') &&
    typeof row.amount === 'number' &&
    Number.isFinite(row.amount) &&
    row.amount > 0 &&
    typeof row.date === 'string' &&
    VALID_DATE.test(row.date)
  );
}

function fingerprint(data: {
  date?: unknown;
  type?: unknown;
  amount?: unknown;
  merchant?: unknown;
}) {
  const merchant = typeof data.merchant === 'string' ? data.merchant.trim().toLowerCase() : '';
  return `${data.date}|${data.type}|${data.amount}|${merchant}`;
}

function hashText(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33 + text.charCodeAt(index)) % 4294967296;
  }
  return hash.toString(16);
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function toTransactionData(
  row: LegacyRow,
  id: string,
  userId: string,
  hasImage: boolean
): BackupDocData {
  const isIncome = row.type === 'income';
  const classification = row.budgetClassification as string;

  return {
    id,
    type: row.type,
    amount: row.amount,
    category: text(row.category, isIncome ? FALLBACK_INCOME_CATEGORY : FALLBACK_EXPENSE_CATEGORY),
    subCategory: text(row.subCategory, ''),
    merchant: text(row.merchant, 'Transaksi'),
    date: row.date,
    paymentMethod: text(row.paymentMethod, 'Tunai'),
    notes: text(row.notes, ''),
    budgetClassification: VALID_CLASSIFICATIONS.includes(classification) ? classification : 'needs',
    ...(Array.isArray(row.items) ? { items: row.items } : {}),
    hasReceiptImage: hasImage,
    createdAt: text(row.createdAt, `${row.date}T00:00:00.000Z`),
    userId,
  };
}

function toBudgetData(stored: string | null, userId: string): BackupDocData | null {
  if (stored === null) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const source = parsed as Record<string, unknown>;
    const fields = [
      'monthlyIncomeTarget',
      'emergencyFundTarget',
      'currentEmergencyFund',
      'needsPercentage',
      'wantsPercentage',
      'savingsPercentage',
    ];
    const budget: BackupDocData = { userId };
    for (const field of fields) {
      if (typeof source[field] !== 'number' || !Number.isFinite(source[field])) return null;
      budget[field] = source[field];
    }
    return budget;
  } catch {
    return null;
  }
}

/**
 * Compares by content, because old rows and Firestore records may carry different IDs. Two
 * identical purchases on one day are both real, so each stored record cancels one old row only.
 * IDs depend on the content, so running the import again can never create a second copy.
 */
export function planLegacyImport(
  rows: LegacyRow[],
  storedTransactions: BackupDoc[],
  options: {
    userId: string;
    includeSamples: boolean;
    storedBudgetExists: boolean;
    legacyBudget: string | null;
  }
): LegacyImportPlan {
  const remaining = new Map<string, number>();
  for (const { data } of storedTransactions) {
    const key = fingerprint(data);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  const occurrences = new Map<string, number>();
  const plan: LegacyImportPlan = {
    writes: [],
    transactionCount: 0,
    duplicateCount: 0,
    sampleCount: 0,
    invalidCount: 0,
    importsBudget: false,
  };

  for (const row of rows) {
    if (isSampleRow(row) && !options.includeSamples) {
      plan.sampleCount += 1;
      continue;
    }
    if (!isImportable(row)) {
      plan.invalidCount += 1;
      continue;
    }

    const key = fingerprint(row);
    const stored = remaining.get(key) ?? 0;
    if (stored > 0) {
      remaining.set(key, stored - 1);
      plan.duplicateCount += 1;
      continue;
    }

    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    const id = `legacy-${hashText(key)}-${occurrence}`;
    const image = typeof row.receiptImage === 'string' ? row.receiptImage : '';

    if (image) {
      plan.writes.push({
        collection: 'settings',
        id: `receipt_${id}`,
        data: { image, userId: options.userId },
      });
    }
    plan.writes.push({
      collection: 'transactions',
      id,
      data: toTransactionData(row, id, options.userId, Boolean(image)),
    });
    plan.transactionCount += 1;
  }

  const budget = options.storedBudgetExists
    ? null
    : toBudgetData(options.legacyBudget, options.userId);
  if (budget) {
    plan.writes.push({ collection: 'settings', id: 'budget', data: budget });
    plan.importsBudget = true;
  }

  return plan;
}

export function readLegacyBudget(): string | null {
  return readItem(LEGACY_BUDGET_KEY);
}

/** Removes only the old keys. Called solely after the owner confirms. */
export function clearLegacyBrowserData(): void {
  localStorage.removeItem(LEGACY_TRANSACTIONS_KEY);
  localStorage.removeItem(LEGACY_BUDGET_KEY);
}

/**
 * Backup file format and restore planning. Nothing here touches Firestore, so the rules that
 * protect existing data can be tested on their own.
 */

export const BACKUP_FORMAT = 'fina-backup';
export const BACKUP_VERSION = 1;

const VALID_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RECEIPT_PREFIX = 'receipt_';

/** Fields Firestore writes on every save. A different value here is not a different record. */
const VOLATILE_FIELDS = new Set(['updatedAt', 'userId']);

export type BackupDocData = Record<string, unknown>;

export interface BackupDoc {
  id: string;
  data: BackupDocData;
}

export interface FinaBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  transactions: BackupDoc[];
  settings: BackupDoc[];
}

export interface StoredDocs {
  transactions: BackupDoc[];
  settings: BackupDoc[];
}

export interface DocGroupPlan {
  toAdd: BackupDoc[];
  unchanged: BackupDoc[];
  different: BackupDoc[];
}

export interface RestorePlan {
  transactions: DocGroupPlan;
  settings: DocGroupPlan;
}

export interface RestoreChoices {
  overwriteTransactions: boolean;
  overwriteSettings: boolean;
}

export interface RestoreWrite {
  collection: 'transactions' | 'settings';
  id: string;
  data: BackupDocData;
}

export function buildBackup(docs: StoredDocs, exportedAt: Date = new Date()): FinaBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    transactions: docs.transactions,
    settings: docs.settings,
  };
}

export function countReceipts(settings: BackupDoc[]): number {
  return settings.filter((item) => item.id.startsWith(RECEIPT_PREFIX)).length;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDocs(value: unknown, label: string): BackupDoc[] {
  if (!Array.isArray(value)) {
    throw new Error(`File cadangan rusak: bagian ${label} tidak ditemukan.`);
  }

  return value.map((item, index) => {
    if (!isPlainObject(item) || typeof item.id !== 'string' || !isPlainObject(item.data)) {
      throw new Error(`File cadangan rusak: ${label} ke-${index + 1} tidak lengkap.`);
    }
    if (!VALID_ID.test(item.id)) {
      throw new Error(`File cadangan rusak: ID ${label} ke-${index + 1} tidak valid.`);
    }
    return { id: item.id, data: item.data };
  });
}

function assertValidTransaction({ id, data }: BackupDoc): void {
  const validType = data.type === 'income' || data.type === 'expense';
  const validAmount = typeof data.amount === 'number' && Number.isFinite(data.amount);
  const validDate = typeof data.date === 'string' && VALID_DATE.test(data.date);
  if (!validType || !validAmount || !validDate) {
    throw new Error(`File cadangan rusak: transaksi ${id} tidak valid.`);
  }
}

/** Rejects the whole file on the first bad record, so a damaged file writes nothing. */
export function parseBackup(text: string): FinaBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File ini bukan JSON yang valid.');
  }

  if (!isPlainObject(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new Error('File ini bukan cadangan Fina.');
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    throw new Error('Versi cadangan lebih baru dari aplikasi ini. Perbarui Fina lalu coba lagi.');
  }

  const transactions = readDocs(parsed.transactions, 'transaksi');
  const settings = readDocs(parsed.settings, 'pengaturan');
  transactions.forEach(assertValidTransaction);

  return {
    format: BACKUP_FORMAT,
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
    transactions,
    settings,
  };
}

/** Same content gives the same string, whatever order the keys were saved in. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function isSameRecord(left: BackupDocData, right: BackupDocData): boolean {
  const strip = (data: BackupDocData) =>
    Object.fromEntries(Object.entries(data).filter(([key]) => !VOLATILE_FIELDS.has(key)));
  return canonical(strip(left)) === canonical(strip(right));
}

function planGroup(incoming: BackupDoc[], stored: BackupDoc[]): DocGroupPlan {
  const storedById = new Map(stored.map((item) => [item.id, item.data]));
  const plan: DocGroupPlan = { toAdd: [], unchanged: [], different: [] };

  for (const item of incoming) {
    const existing = storedById.get(item.id);
    if (!existing) {
      plan.toAdd.push(item);
    } else if (isSameRecord(item.data, existing)) {
      plan.unchanged.push(item);
    } else {
      plan.different.push(item);
    }
  }

  return plan;
}

export function planRestore(backup: FinaBackup, stored: StoredDocs): RestorePlan {
  return {
    transactions: planGroup(backup.transactions, stored.transactions),
    settings: planGroup(backup.settings, stored.settings),
  };
}

/**
 * Lists the writes a restore will make. Records that differ are left alone unless the owner
 * chose to overwrite them, and restored documents always belong to the signed-in owner.
 * Settings come first so a restored transaction never points at a missing receipt.
 */
export function buildRestoreWrites(
  plan: RestorePlan,
  choices: RestoreChoices,
  userId: string
): RestoreWrite[] {
  const toWrites = (collection: RestoreWrite['collection'], docs: BackupDoc[]): RestoreWrite[] =>
    docs.map((item) => ({ collection, id: item.id, data: { ...item.data, userId } }));

  return [
    ...toWrites('settings', plan.settings.toAdd),
    ...(choices.overwriteSettings ? toWrites('settings', plan.settings.different) : []),
    ...toWrites('transactions', plan.transactions.toAdd),
    ...(choices.overwriteTransactions ? toWrites('transactions', plan.transactions.different) : []),
  ];
}

/** A backup can hold one person's Finn chat, which the other person may not read or overwrite. */
export function withoutOtherChats(backup: FinaBackup, chatDocumentId: string): FinaBackup {
  return {
    ...backup,
    settings: backup.settings.filter(
      (item) => !/^chat(_|$)/.test(item.id) || item.id === chatDocumentId
    ),
  };
}

export const MAX_BATCH_WRITES = 400;
export const MAX_BATCH_CHARS = 4_000_000;

/** Splits writes into batches that stay well under Firestore's per-request limits. */
export function chunkWrites<T extends { data: unknown }>(
  writes: T[],
  maxWrites: number = MAX_BATCH_WRITES,
  maxChars: number = MAX_BATCH_CHARS
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentChars = 0;

  for (const write of writes) {
    const size = JSON.stringify(write.data).length;
    if (current.length > 0 && (current.length >= maxWrites || currentChars + size > maxChars)) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(write);
    currentChars += size;
  }

  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

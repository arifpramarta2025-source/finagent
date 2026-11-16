import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BACKUP_FORMAT,
  BackupDoc,
  buildBackup,
  buildRestoreWrites,
  chunkWrites,
  isSameRecord,
  parseBackup,
  planRestore,
} from '../src/utils/backup.ts';
import { isSampleRow, planLegacyImport } from '../src/utils/legacyData.ts';
import { readPercentage } from '../src/utils/storage.ts';

const tx = (id: string, amount = 1000): BackupDoc => ({
  id,
  data: { type: 'expense', amount, date: '2026-11-01', merchant: 'Warung' },
});

const noOverwrite = { overwriteTransactions: false, overwriteSettings: false };

test('a backup survives a trip through its file format', () => {
  const backup = buildBackup(
    { transactions: [tx('tx-1')], settings: [{ id: 'budget', data: { needsPercentage: 50 } }] },
    new Date('2026-11-04T00:00:00Z')
  );

  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup);
});

test('files that are not a usable backup are refused', () => {
  const valid = buildBackup({ transactions: [], settings: [] });

  assert.throws(() => parseBackup('bukan json'), /JSON/);
  assert.throws(() => parseBackup('{"format":"lain"}'), /bukan cadangan/);
  assert.throws(() => parseBackup(JSON.stringify({ ...valid, version: 999 })), /lebih baru/);
  assert.throws(
    () => parseBackup(JSON.stringify({ ...valid, transactions: undefined })),
    /tidak ditemukan/
  );
  assert.throws(() => parseBackup(JSON.stringify({ ...valid, transactions: [tx('a/b')] })), /ID/);
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({
          ...valid,
          transactions: [
            { id: 'x', data: { type: 'expense', amount: 'seribu', date: '2026-11-01' } },
          ],
        })
      ),
    /tidak valid/
  );
});

test('one damaged transaction rejects the whole file', () => {
  const backup = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: '',
    transactions: [tx('ok'), { id: 'rusak', data: {} }],
    settings: [],
  };

  assert.throws(() => parseBackup(JSON.stringify(backup)));
});

test('records are compared by content, ignoring save metadata and key order', () => {
  assert.ok(
    isSameRecord(
      { a: 1, b: { x: 1, y: 2 }, updatedAt: 'kemarin', userId: 'lama' },
      { b: { y: 2, x: 1 }, a: 1, updatedAt: 'hari ini', userId: 'baru' }
    )
  );
  assert.equal(isSameRecord({ amount: 1000 }, { amount: 2000 }), false);
  assert.equal(isSameRecord({ tags: [1, 2] }, { tags: [2, 1] }), false);
});

test('the plan sorts records into new, unchanged and different', () => {
  const backup = buildBackup({
    transactions: [tx('baru'), tx('sama'), tx('beda', 5000)],
    settings: [{ id: 'budget', data: { needsPercentage: 60 } }],
  });

  const plan = planRestore(backup, {
    transactions: [tx('sama'), tx('beda', 1000), tx('hanya-di-server')],
    settings: [{ id: 'budget', data: { needsPercentage: 50 } }],
  });

  assert.deepEqual(
    plan.transactions.toAdd.map((d) => d.id),
    ['baru']
  );
  assert.deepEqual(
    plan.transactions.unchanged.map((d) => d.id),
    ['sama']
  );
  assert.deepEqual(
    plan.transactions.different.map((d) => d.id),
    ['beda']
  );
  assert.deepEqual(
    plan.settings.different.map((d) => d.id),
    ['budget']
  );
});

test('without consent a restore writes only new records', () => {
  const backup = buildBackup({ transactions: [tx('baru'), tx('beda', 5000)], settings: [] });
  const plan = planRestore(backup, { transactions: [tx('beda', 1000)], settings: [] });

  const writes = buildRestoreWrites(plan, noOverwrite, 'pemilik');

  assert.deepEqual(
    writes.map((w) => w.id),
    ['baru']
  );
});

test('overwriting needs consent for each group separately', () => {
  const backup = buildBackup({
    transactions: [tx('beda', 5000)],
    settings: [{ id: 'budget', data: { needsPercentage: 60 } }],
  });
  const plan = planRestore(backup, {
    transactions: [tx('beda', 1000)],
    settings: [{ id: 'budget', data: { needsPercentage: 50 } }],
  });

  const onlySettings = buildRestoreWrites(
    plan,
    { overwriteTransactions: false, overwriteSettings: true },
    'pemilik'
  );

  assert.deepEqual(
    onlySettings.map((w) => w.id),
    ['budget']
  );
});

test('restored records belong to the signed-in owner, and settings go first', () => {
  const stored = tx('baru');
  stored.data.userId = 'akun-lain';
  const backup = buildBackup({
    transactions: [stored],
    settings: [
      { id: 'receipt_baru', data: { image: 'data:image/jpeg;base64,AA', userId: 'akun-lain' } },
    ],
  });

  const writes = buildRestoreWrites(
    planRestore(backup, { transactions: [], settings: [] }),
    noOverwrite,
    'pemilik'
  );

  assert.deepEqual(
    writes.map((w) => w.collection),
    ['settings', 'transactions']
  );
  assert.ok(writes.every((w) => w.data.userId === 'pemilik'));
});

test('batches respect both the count and the size limit', () => {
  const writes = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, data: { image: 'x'.repeat(10) } }));

  assert.deepEqual(
    chunkWrites(writes, 2, 1000).map((b) => b.length),
    [2, 2, 1]
  );
  assert.deepEqual(
    chunkWrites(writes, 100, 50).map((b) => b.length),
    [2, 2, 1]
  );
  assert.deepEqual(chunkWrites([], 2, 1000), []);
});

test('one oversized record still gets its own batch', () => {
  const writes = [{ data: 'x'.repeat(100) }, { data: 'y' }];

  assert.deepEqual(
    chunkWrites(writes, 10, 50).map((b) => b.length),
    [1, 1]
  );
});

test('sample rows from the first version are recognised', () => {
  assert.equal(isSampleRow({ id: 'tx-1' }), true);
  assert.equal(isSampleRow({ id: 'x', merchant: 'Kost Eksekutif Bandung' }), true);
  assert.equal(isSampleRow({ id: 'tx-1762233445566-123', merchant: 'Warung' }), false);
});

test('a saved budget percentage of 0 is kept', () => {
  assert.equal(readPercentage(0, 30), 0);
  assert.equal(readPercentage('25', 30), 25);
  assert.equal(readPercentage(undefined, 30), 30);
  assert.equal(readPercentage('rusak', 30), 30);
});

const oldRow = (merchant: string, amount = 25000) => ({
  id: `lama-${merchant}`,
  type: 'expense',
  amount,
  date: '2025-01-05',
  merchant,
  category: 'Jajan',
});

const importOptions = {
  userId: 'pemilik',
  includeSamples: false,
  storedBudgetExists: true,
  legacyBudget: null,
};

test('old rows already in Firestore are not imported again, even under another ID', () => {
  const stored = [
    {
      id: 'tx-baru',
      data: { type: 'expense', amount: 25000, date: '2025-01-05', merchant: ' WARUNG ' },
    },
  ];

  const plan = planLegacyImport([oldRow('Warung'), oldRow('Toko')], stored, importOptions);

  assert.equal(plan.duplicateCount, 1);
  assert.equal(plan.transactionCount, 1);
  assert.equal(plan.writes[0].data.merchant, 'Toko');
  assert.equal(plan.writes[0].data.userId, 'pemilik');
});

test('two identical purchases on one day both survive', () => {
  const stored = [
    { id: 'a', data: { type: 'expense', amount: 25000, date: '2025-01-05', merchant: 'Warung' } },
  ];

  const plan = planLegacyImport(
    [oldRow('Warung'), oldRow('Warung'), oldRow('Warung')],
    stored,
    importOptions
  );

  assert.equal(plan.duplicateCount, 1);
  assert.equal(plan.transactionCount, 2);
  assert.notEqual(plan.writes[0].id, plan.writes[1].id);
});

test('running the import plan twice gives the same IDs', () => {
  const first = planLegacyImport([oldRow('Warung')], [], importOptions);
  const second = planLegacyImport([oldRow('Warung')], [], importOptions);

  assert.equal(first.writes[0].id, second.writes[0].id);
  assert.match(first.writes[0].id, /^[a-zA-Z0-9_-]{1,128}$/);
});

test('sample and damaged rows are left out', () => {
  const sample = { ...oldRow('Kost Eksekutif Bandung'), id: 'tx-3' };

  const plan = planLegacyImport([sample, { id: 'x', amount: 'seribu' }], [], importOptions);

  assert.equal(plan.sampleCount, 1);
  assert.equal(plan.invalidCount, 1);
  assert.equal(plan.writes.length, 0);
  assert.equal(
    planLegacyImport([sample], [], { ...importOptions, includeSamples: true }).transactionCount,
    1
  );
});

test('an old receipt photo moves to its own document', () => {
  const plan = planLegacyImport(
    [{ ...oldRow('Warung'), receiptImage: 'data:image/jpeg;base64,AA' }],
    [],
    importOptions
  );

  const [receipt, transaction] = plan.writes;
  assert.equal(receipt.id, `receipt_${transaction.id}`);
  assert.equal(transaction.data.hasReceiptImage, true);
  assert.equal('receiptImage' in transaction.data, false);
});

test('the old budget is used only when none exists', () => {
  const legacyBudget = JSON.stringify({
    monthlyIncomeTarget: 1,
    emergencyFundTarget: 2,
    currentEmergencyFund: 3,
    needsPercentage: 50,
    wantsPercentage: 30,
    savingsPercentage: 20,
  });

  assert.equal(planLegacyImport([], [], { ...importOptions, legacyBudget }).importsBudget, false);
  assert.equal(
    planLegacyImport([], [], { ...importOptions, legacyBudget, storedBudgetExists: false })
      .importsBudget,
    true
  );
  assert.equal(
    planLegacyImport([], [], {
      ...importOptions,
      legacyBudget: '{rusak',
      storedBudgetExists: false,
    }).importsBudget,
    false
  );
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeAdd,
  describeBudget,
  describeDelete,
  describeEdit,
} from '../src/utils/activityLog.ts';
import { buildBackup, withoutOtherChats } from '../src/utils/backup.ts';
import { buildTransactionsCSV } from '../src/utils/storage.ts';
import { chatDocumentId, findMember, recordedBy } from '../src/utils/members.ts';
import type { Transaction } from '../src/types/index.ts';

const tx = (overrides: Partial<Transaction> = {}) =>
  ({
    id: 'a',
    type: 'expense',
    amount: 25000,
    category: 'Jajan',
    merchant: 'Warung',
    date: '2026-11-05',
    paymentMethod: 'Tunai',
    budgetClassification: 'wants',
    createdAt: '',
    ...overrides,
  }) as Transaction;

test('only the two members are recognised, in any letter case', () => {
  assert.equal(findMember('PEMILIK@example.com')?.name, 'Andi');
  assert.equal(findMember('pasangan@example.com')?.name, 'Sari');
  assert.equal(findMember('orang.lain@gmail.com'), null);
  assert.equal(findMember(undefined), null);
});

test('older records count as Andi, newer ones show who saved them', () => {
  assert.equal(recordedBy(tx()), 'Andi');
  assert.equal(recordedBy(tx({ createdByName: 'Sari' })), 'Sari');
});

test('the CSV says who recorded each transaction', () => {
  const csv = buildTransactionsCSV([tx({ createdByName: 'Sari' })]);

  assert.match(csv, /"Dicatat Oleh"/);
  assert.match(csv, /"Sari"$/);
});

test('each person has their own Finn chat, and the owner keeps the old one', () => {
  assert.equal(chatDocumentId(findMember('pemilik@example.com')!, 'u1'), 'chat');
  assert.equal(chatDocumentId(findMember('pasangan@example.com')!, 'u2'), 'chat_u2');
});

test('a restore never touches the other person chat', () => {
  const backup = buildBackup({
    transactions: [],
    settings: [
      { id: 'chat', data: {} },
      { id: 'chat_u2', data: {} },
      { id: 'budget', data: {} },
    ],
  });

  assert.deepEqual(
    withoutOtherChats(backup, 'chat_u2').settings.map((d) => d.id),
    ['chat_u2', 'budget']
  );
  assert.deepEqual(
    withoutOtherChats(backup, 'chat').settings.map((d) => d.id),
    ['chat', 'budget']
  );
});

test('an edit logs only what changed, with old and new values', () => {
  const draft = describeEdit(tx(), { amount: 30000, merchant: 'Warung', notes: 'kopi' });

  assert.deepEqual(draft.changes, [
    { label: 'Nominal', from: 'Rp 25.000'.replace(' ', ' '), to: 'Rp 30.000'.replace(' ', ' ') },
    { label: 'Catatan', from: '-', to: 'kopi' },
  ]);
  assert.match(draft.summary, /Warung/);
});

test('a deleted record stays readable in the log', () => {
  const draft = describeDelete(tx({ notes: 'kopi susu' }));

  assert.equal(draft.action, 'delete');
  assert.ok(
    draft.changes?.some((change) => change.label === 'Catatan' && change.from === 'kopi susu')
  );
  assert.ok(draft.changes?.some((change) => change.label === 'Tanggal'));
});

test('an added record is described in full', () => {
  assert.ok(
    describeAdd(tx()).changes?.some(
      (change) => change.label === 'Merchant' && change.to === 'Warung'
    )
  );
});

test('a budget edit lists the changed fields', () => {
  const before = {
    monthlyIncomeTarget: 1000,
    emergencyFundTarget: 0,
    currentEmergencyFund: 0,
    needsPercentage: 50,
    wantsPercentage: 30,
    savingsPercentage: 20,
  };

  const draft = describeBudget(before, { ...before, needsPercentage: 60, wantsPercentage: 20 });

  assert.deepEqual(
    draft.changes?.map((change) => [change.label, change.to]),
    [
      ['Needs', '60%'],
      ['Wants', '20%'],
    ]
  );
});

test('the server accepts both members and refuses anyone else', async () => {
  const { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } = await import('jose');
  const { FIREBASE_PROJECT_ID, verifyOwnerToken } = await import('../server/auth.ts');
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: 'RS256' }] });
  const sign = (email: string, verified = true) =>
    new SignJWT({ email, email_verified: verified })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(`https://securetoken.google.com/${FIREBASE_PROJECT_ID}`)
      .setAudience(FIREBASE_PROJECT_ID)
      .setSubject('uid-1')
      .setExpirationTime('5m')
      .sign(privateKey);

  assert.equal((await verifyOwnerToken(await sign('pemilik@example.com'), keys)).uid, 'uid-1');
  assert.equal((await verifyOwnerToken(await sign('pasangan@example.com'), keys)).uid, 'uid-1');
  await assert.rejects(verifyOwnerToken(await sign('orang.lain@gmail.com'), keys));
  await assert.rejects(verifyOwnerToken(await sign('pasangan@example.com', false), keys));
});

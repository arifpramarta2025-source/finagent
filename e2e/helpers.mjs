import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Resolved through require so a globally installed Playwright works too.
export const { chromium } = createRequire(import.meta.url)('playwright');

export const APP_URL = 'http://localhost:5199/';
export const OUT = fileURLToPath(new URL('./.out', import.meta.url));
export const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });

/** Opens the app as the ledger owner and waits until it is signed in and loaded. */
export async function open(contextOptions = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    acceptDownloads: true,
    viewport: { width: 1100, height: 900 },
    ...contextOptions,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (error) => errs.push(error.message));

  await p.goto(APP_URL);
  await p.waitForFunction(() => window.__auth?.currentUser, null, { timeout: 60_000 });
  await p.getByText('Anggaran').first().waitFor({ timeout: 30_000 });
  return { b, ctx, p, errs };
}

/** Writes transactions and settings documents straight into the emulator. */
export function seed(p, transactions, settings = {}) {
  return p.evaluate(
    async ([transactions, settings]) => {
      const { doc, setDoc } = window.__fs;
      const uid = window.__auth.currentUser.uid;
      for (const transaction of transactions) {
        await setDoc(doc(window.__db, 'users', uid, 'transactions', transaction.id), {
          ...transaction,
          userId: uid,
        });
      }
      for (const [id, data] of Object.entries(settings)) {
        await setDoc(doc(window.__db, 'users', uid, 'settings', id), { ...data, userId: uid });
      }
    },
    [transactions, settings]
  );
}

/** Reads one document of the signed-in account from the server, or null. */
export function get(p, collectionName, id) {
  return p.evaluate(
    async ([collectionName, id]) => {
      const { doc, getDocFromServer } = window.__fs;
      const uid = window.__auth.currentUser.uid;
      const snapshot = await getDocFromServer(doc(window.__db, 'users', uid, collectionName, id));
      return snapshot.exists() ? snapshot.data() : null;
    },
    [collectionName, id]
  );
}

export function del(p, collectionName, id) {
  return p.evaluate(
    async ([collectionName, id]) => {
      const { doc, deleteDoc } = window.__fs;
      const uid = window.__auth.currentUser.uid;
      await deleteDoc(doc(window.__db, 'users', uid, collectionName, id));
    },
    [collectionName, id]
  );
}

/** Removes the signed-in account's transactions, receipts and core settings. */
export function wipe(p) {
  return p.evaluate(async () => {
    const { collection, getDocs, deleteDoc, doc } = window.__fs;
    const uid = window.__auth.currentUser.uid;
    const transactions = await getDocs(collection(window.__db, 'users', uid, 'transactions'));
    for (const transaction of transactions.docs) {
      await deleteDoc(doc(window.__db, 'users', uid, 'settings', `receipt_${transaction.id}`));
      await deleteDoc(transaction.ref);
    }
    for (const id of ['budget', 'chat', 'audit']) {
      await deleteDoc(doc(window.__db, 'users', uid, 'settings', id));
    }
  });
}

/** A plain expense, with any field overridable. */
export function tx(id, amount, date = '2026-11-02', overrides = {}) {
  return {
    id,
    type: 'expense',
    amount,
    category: 'Jajan',
    merchant: `Warung ${id}`,
    date,
    paymentMethod: 'Tunai',
    budgetClassification: 'wants',
    createdAt: '2026-11-02T01:00:00Z',
    ...overrides,
  };
}

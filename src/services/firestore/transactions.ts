/** Reading and writing transactions and their receipt photos. */
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  getCountFromServer,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Transaction } from '../../types';
import { describeAdd, describeDelete, describeEdit } from '../../utils/activityLog';
import { addActivityToBatch, getActor } from './activity';
import { RESTORE_BATCH_TIMEOUT_MS, confirmWrite, withoutUndefined } from './common';

const TRANSACTION_BATCH_SIZE = 400;

function receiptDocRef(userId: string, transactionId: string) {
  return doc(db, 'users', userId, 'settings', `receipt_${transactionId}`);
}

function toTransaction(id: string, data: Record<string, any>): Transaction {
  return {
    id,
    type: data.type || 'expense',
    amount: Number(data.amount) || 0,
    category: data.category || 'Lainnya',
    subCategory: data.subCategory || '',
    merchant: data.merchant || 'Transaksi',
    date: data.date || '',
    paymentMethod: data.paymentMethod || 'Tunai',
    notes: data.notes || '',
    budgetClassification: data.budgetClassification || 'needs',
    receiptImage: data.receiptImage || undefined,
    hasReceiptImage: Boolean(data.hasReceiptImage),
    items: data.items || undefined,
    createdAt: data.createdAt || new Date().toISOString(),
    createdByName: data.createdByName || undefined,
    updatedByName: data.updatedByName || undefined,
  };
}

/**
 * Real-time listener for transactions on or after sinceDate. Older history is read on request,
 * which keeps each app open within the daily read quota.
 */
export function subscribeToRecentTransactions(
  userId: string,
  sinceDate: string,
  callback: (transactions: Transaction[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'users', userId, 'transactions'),
    where('date', '>=', sinceDate),
    orderBy('date', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((docSnap) => toTransaction(docSnap.id, docSnap.data())));
    },
    (error) => {
      console.error('Firestore transactions snapshot error:', error);
      onError(error);
    }
  );
}

/** Reads transactions dated from `from` (empty for the very start) up to, not including, `before`. */
export async function fetchOlderTransactions(
  userId: string,
  from: string,
  before: string
): Promise<Transaction[]> {
  const constraints = [
    ...(from ? [where('date', '>=', from)] : []),
    where('date', '<', before),
    orderBy('date', 'desc'),
  ];
  const snapshot = await getDocsFromServer(
    query(collection(db, 'users', userId, 'transactions'), ...constraints)
  );
  return snapshot.docs.map((docSnap) => toTransaction(docSnap.id, docSnap.data()));
}

/** Costs one read per 1,000 records counted. */
export async function countOlderTransactions(userId: string, before: string): Promise<number> {
  const snapshot = await getCountFromServer(
    query(collection(db, 'users', userId, 'transactions'), where('date', '<', before))
  );
  return snapshot.data().count;
}

/** Every transaction, for actions that must never work on a partial list. */
export async function fetchEveryTransaction(userId: string): Promise<Transaction[]> {
  const snapshot = await getDocsFromServer(
    query(collection(db, 'users', userId, 'transactions'), orderBy('date', 'desc'))
  );
  return snapshot.docs.map((docSnap) => toTransaction(docSnap.id, docSnap.data()));
}

/**
 * Add or overwrite a transaction in user's subcollection
 */
export async function addTransactionToFirestore(
  userId: string,
  transaction: Transaction
): Promise<void> {
  const { receiptImage, ...transactionData } = transaction;
  const batch = writeBatch(db);

  // Photos live in their own document so the transaction list stays small.
  if (receiptImage) {
    batch.set(receiptDocRef(userId, transaction.id), { image: receiptImage, userId });
  }

  batch.set(
    doc(db, 'users', userId, 'transactions', transaction.id),
    withoutUndefined({
      ...transactionData,
      hasReceiptImage: Boolean(receiptImage),
      userId,
      createdByUid: getActor()?.uid,
      createdByName: getActor()?.name,
      updatedAt: new Date().toISOString(),
    })
  );
  addActivityToBatch(batch, userId, describeAdd(transaction));

  await batch.commit();
}

/**
 * Update an existing transaction in Firestore
 */
export async function updateTransactionInFirestore(
  userId: string,
  transactionId: string,
  updates: Partial<Transaction>,
  before: Transaction
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(
    doc(db, 'users', userId, 'transactions', transactionId),
    withoutUndefined({
      ...updates,
      userId,
      updatedByName: getActor()?.name,
      updatedAt: new Date().toISOString(),
    })
  );
  addActivityToBatch(batch, userId, describeEdit(before, updates));
  await batch.commit();
}

/**
 * Delete a transaction document from Firestore
 */
export async function deleteTransactionFromFirestore(
  userId: string,
  transaction: Transaction
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', userId, 'transactions', transaction.id));
  batch.delete(receiptDocRef(userId, transaction.id));
  addActivityToBatch(batch, userId, describeDelete(transaction));
  await batch.commit();
}

/** Sets the same fields on many transactions. Running it again after a failure is safe. */
export async function updateTransactionsInBatches(
  userId: string,
  transactionIds: string[],
  fields: Record<string, string>,
  onProgress: (updated: number) => void
): Promise<void> {
  const updatedAt = new Date().toISOString();
  const actor = getActor();

  for (let start = 0; start < transactionIds.length; start += TRANSACTION_BATCH_SIZE) {
    const ids = transactionIds.slice(start, start + TRANSACTION_BATCH_SIZE);
    const batch = writeBatch(db);
    for (const id of ids) {
      batch.update(doc(db, 'users', userId, 'transactions', id), {
        ...fields,
        userId,
        updatedAt,
        ...(actor ? { updatedByName: actor.name } : {}),
      });
    }
    await confirmWrite(() => batch.commit(), RESTORE_BATCH_TIMEOUT_MS);
    onProgress(start + ids.length);
  }
}

export async function fetchReceiptImage(
  userId: string,
  transactionId: string
): Promise<string | null> {
  const snapshot = await getDoc(receiptDocRef(userId, transactionId));
  const image = snapshot.data()?.image;
  return typeof image === 'string' ? image : null;
}

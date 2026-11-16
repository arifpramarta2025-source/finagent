/** Reading everything for a backup, and writing a restore back. */
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  chunkWrites,
  type BackupDoc,
  type RestoreWrite,
  type StoredDocs,
} from '../../utils/backup';
import { getActor } from './activity';
import { RESTORE_BATCH_TIMEOUT_MS, confirmWrite } from './common';

const SHARED_SETTING_IDS = ['budget', 'categories', 'audit'];

const SETTINGS_READ_CONCURRENCY = 8;

async function readTransactionsFromServer(userId: string): Promise<BackupDoc[]> {
  const snapshot = await getDocsFromServer(collection(db, 'users', userId, 'transactions'));
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));
}

/** Settings are read by ID because the security rules do not allow listing that collection. */
async function readSettingsFromServer(userId: string, ids: string[]): Promise<BackupDoc[]> {
  const found: BackupDoc[] = [];

  for (let start = 0; start < ids.length; start += SETTINGS_READ_CONCURRENCY) {
    const snapshots = await Promise.all(
      ids
        .slice(start, start + SETTINGS_READ_CONCURRENCY)
        .map((id) => getDocFromServer(doc(db, 'users', userId, 'settings', id)))
    );
    for (const snapshot of snapshots) {
      const data = snapshot.data();
      if (data) {
        found.push({ id: snapshot.id, data });
      }
    }
  }

  return found;
}

/**
 * Reads the owner's documents straight from the server. A cached read could silently return
 * a partial list, which would make a backup incomplete and a restore treat records as new.
 * extraSettingIds adds documents a backup file mentions, so a restore compares against them.
 */
export async function fetchAllUserDocs(
  userId: string,
  extraSettingIds: string[] = []
): Promise<StoredDocs> {
  const transactions = await readTransactionsFromServer(userId);
  const receiptIds = transactions
    .filter((item) => item.data.hasReceiptImage)
    .map((item) => `receipt_${item.id}`);
  const settingIds = [
    ...new Set([
      ...SHARED_SETTING_IDS,
      getActor()?.chatDocumentId ?? 'chat',
      ...receiptIds,
      ...extraSettingIds,
    ]),
  ];

  return { transactions, settings: await readSettingsFromServer(userId, settingIds) };
}

/** Applies restore writes in batches. Safe to run again if a batch fails midway. */
export async function applyRestoreWrites(
  userId: string,
  writes: RestoreWrite[],
  onProgress: (written: number) => void
): Promise<void> {
  let written = 0;

  for (const chunk of chunkWrites(writes)) {
    const batch = writeBatch(db);
    for (const write of chunk) {
      batch.set(doc(db, 'users', userId, write.collection, write.id), write.data);
    }
    await confirmWrite(() => batch.commit(), RESTORE_BATCH_TIMEOUT_MS);
    written += chunk.length;
    onProgress(written);
  }
}

/** Finds the shared ledger both members read and write. */
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type LedgerLookup =
  | { status: 'ready'; ledgerId: string; logEnabled: boolean }
  | { status: 'waiting_for_owner' }
  | { status: 'rules_not_updated' };

function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'permission-denied';
}

/** Finds the shared ledger. The owner publishes its location, because Sari cannot derive it. */
export async function resolveLedger(uid: string, isOwner: boolean): Promise<LedgerLookup> {
  const pointer = doc(db, 'ledger', 'main');

  try {
    const snapshot = await getDocFromServer(pointer);
    const ownerUid = snapshot.data()?.ownerUid;
    if (typeof ownerUid === 'string') {
      return { status: 'ready', ledgerId: ownerUid, logEnabled: true };
    }
    if (!isOwner) return { status: 'waiting_for_owner' };

    await setDoc(pointer, { ownerUid: uid });
    return { status: 'ready', ledgerId: uid, logEnabled: true };
  } catch (error) {
    if (!isPermissionDenied(error)) throw error;
    // With the old rules the owner keeps working, without the log, until the rules are applied.
    return isOwner
      ? { status: 'ready', ledgerId: uid, logEnabled: false }
      : { status: 'rules_not_updated' };
  }
}

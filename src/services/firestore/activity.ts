/** Who is writing, and the append-only activity log every change is recorded in. */
import {
  collection,
  doc,
  getDocsFromServer,
  limit,
  startAfter,
  setDoc,
  query,
  orderBy,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ActivityDraft, ActivityEntry } from '../../utils/activityLog';
import { confirmWrite, withoutUndefined } from './common';

const ACTIVITY_PAGE_SIZE = 30;

export interface Actor {
  uid: string;
  name: string;
  chatDocumentId: string;
}

let currentActor: Actor | null = null;

let isLogEnabled = false;

/** Set once the signed-in person is known. Every write below records this person. */
export function setActivityActor(actor: Actor | null, logEnabled: boolean): void {
  currentActor = actor;
  isLogEnabled = logEnabled;
}

/** The signed-in person, or null before sign-in. */
export function getActor(): Actor | null {
  return currentActor;
}

export function isActivityLogEnabled(): boolean {
  return isLogEnabled;
}

function activityPayload(userId: string, draft: ActivityDraft) {
  return withoutUndefined({
    ...draft,
    at: new Date().toISOString(),
    actorUid: currentActor?.uid,
    actorName: currentActor?.name,
    userId,
  });
}

/** Adding the log to the same batch means a change and its log succeed or fail together. */
export function addActivityToBatch(batch: WriteBatch, userId: string, draft: ActivityDraft): void {
  if (!isLogEnabled || !currentActor) return;
  batch.set(doc(collection(db, 'users', userId, 'activity')), activityPayload(userId, draft));
}

/** Logs a bulk action before it starts, so an interrupted run still leaves a trace. */
export async function recordActivity(userId: string, draft: ActivityDraft): Promise<void> {
  if (!isLogEnabled || !currentActor) return;
  await confirmWrite(() =>
    setDoc(doc(collection(db, 'users', userId, 'activity')), activityPayload(userId, draft))
  );
}

export interface ActivityPage {
  entries: ActivityEntry[];
  cursor: QueryDocumentSnapshot | null;
}

export async function fetchActivityPage(
  userId: string,
  after: QueryDocumentSnapshot | null
): Promise<ActivityPage> {
  const snapshot = await getDocsFromServer(
    query(
      collection(db, 'users', userId, 'activity'),
      orderBy('at', 'desc'),
      ...(after ? [startAfter(after)] : []),
      limit(ACTIVITY_PAGE_SIZE)
    )
  );

  return {
    entries: snapshot.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ActivityEntry
    ),
    cursor:
      snapshot.docs.length === ACTIVITY_PAGE_SIZE ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
}

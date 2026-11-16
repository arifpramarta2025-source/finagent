// Security rules: what each kind of account may read and write.
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import fs from 'fs';
const env = await initializeTestEnvironment({
  projectId: 'demo-rules2',
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
  },
});
const A = 'pemilik@example.com',
  N = 'pasangan@example.com';
const ctx = (u, t) => env.authenticatedContext(u, t).firestore();
const a = ctx('andi', { email: A, email_verified: true }),
  n = ctx('nov', { email: N, email_verified: true }),
  nUnv = ctx('nov', { email: N, email_verified: false }),
  o = ctx('x', { email: 'x@y.z', email_verified: true }),
  fakeUid = ctx('andi', { email: 'x@y.z', email_verified: true }),
  anon = env.unauthenticatedContext().firestore();
let c = 0;
const ok = async (p) => {
    c++;
    await assertSucceeds(p);
  },
  no = async (p) => {
    c++;
    await assertFails(p);
  };
await no(setDoc(doc(n, 'ledger/main'), { ownerUid: 'nov' }));
await no(setDoc(doc(a, 'ledger/main'), { ownerUid: 'lain' }));
await ok(setDoc(doc(a, 'ledger/main'), { ownerUid: 'andi' }));
await ok(getDoc(doc(n, 'ledger/main')));
await no(setDoc(doc(a, 'ledger/main'), { ownerUid: 'andi2' }));
await no(setDoc(doc(n, 'ledger/main'), { ownerUid: 'nov' }));
await no(deleteDoc(doc(a, 'ledger/main')));
const t = (d) => doc(d, 'users/andi/transactions/t1');
await ok(setDoc(t(n), { userId: 'andi', amount: 1, date: '2026-11-05' }));
await no(setDoc(doc(n, 'users/andi/transactions/t2'), { userId: 'nov' }));
await ok(getDoc(t(a)));
await ok(updateDoc(t(a), { amount: 2, userId: 'andi' }));
await ok(updateDoc(t(n), { amount: 3, userId: 'andi' }));
await ok(getDocs(collection(n, 'users/andi/transactions')));
await ok(
  getCountFromServer(
    query(collection(n, 'users/andi/transactions'), where('date', '<', '2026-09-01'))
  )
);
await ok(setDoc(doc(n, 'users/andi/settings/budget'), { x: 1 }));
await ok(getDoc(doc(a, 'users/andi/settings/budget')));
await ok(setDoc(doc(n, 'users/andi/settings/receipt_t1'), { image: 'x' }));
// chat privacy
await ok(setDoc(doc(a, 'users/andi/settings/chat'), { m: [] }));
await no(getDoc(doc(n, 'users/andi/settings/chat')));
await no(setDoc(doc(n, 'users/andi/settings/chat'), { m: [] }));
await no(deleteDoc(doc(n, 'users/andi/settings/chat')));
await ok(setDoc(doc(n, 'users/andi/settings/chat_nov'), { m: [] }));
await ok(getDoc(doc(n, 'users/andi/settings/chat_nov')));
await no(getDoc(doc(a, 'users/andi/settings/chat_nov')));
await no(setDoc(doc(a, 'users/andi/settings/chat_nov'), { m: [] }));
await no(getDocs(collection(a, 'users/andi/settings')));
// activity
const l = doc(n, 'users/andi/activity/l1');
await ok(setDoc(l, { actorUid: 'nov', actorName: 'Sari', at: 'x', summary: 's' }));
await no(setDoc(doc(n, 'users/andi/activity/l2'), { actorUid: 'andi', actorName: 'Andi' }));
await no(updateDoc(l, { summary: 'palsu' }));
await no(deleteDoc(l));
await no(updateDoc(doc(a, 'users/andi/activity/l1'), { summary: 'palsu' }));
await no(deleteDoc(doc(a, 'users/andi/activity/l1')));
await ok(getDocs(query(collection(a, 'users/andi/activity'), orderBy('at', 'desc'), limit(30))));
for (const d of [nUnv, o, fakeUid, anon]) {
  await no(getDoc(t(d)));
  await no(setDoc(t(d), { userId: 'andi' }));
  await no(getDoc(doc(d, 'users/andi/settings/budget')));
  await no(getDocs(collection(d, 'users/andi/activity')));
  await no(getDoc(doc(d, 'ledger/main')));
}
await ok(deleteDoc(t(n)));
await no(getDoc(doc(o, 'other/x')));
await no(setDoc(doc(n, 'other/x'), { a: 1 }));
console.log('rules ok', c, 'cek');
await env.cleanup();

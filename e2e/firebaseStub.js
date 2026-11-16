// Replaces src/services/firebase.ts during browser tests: same exports, but wired to the
// local emulators and signed in as a test account. Nothing here can reach the real project.
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  signInWithCredential,
} from 'firebase/auth';
import * as firestore from 'firebase/firestore';

const OWNER_EMAIL = 'pemilik@example.com';

export const app = initializeApp({
  projectId: 'demo-fina',
  apiKey: 'fake',
  authDomain: 'demo-fina.firebaseapp.com',
  appId: '1:1:web:1',
});

export const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

export const db = firestore.getFirestore(app, 'fina-e2e');
firestore.connectFirestoreEmulator(db, '127.0.0.1', 8080);

export const googleProvider = new GoogleAuthProvider();

// A test picks its account by setting e2e_email before the page loads.
const email = localStorage.getItem('e2e_email') || OWNER_EMAIL;
const uid = email === OWNER_EMAIL ? 'owner1' : 'sari1';
signInWithCredential(
  auth,
  GoogleAuthProvider.credential(JSON.stringify({ sub: uid, email, email_verified: true }))
);

// Lets tests seed and read Firestore directly from the page.
window.__db = db;
window.__auth = auth;
window.__fs = firestore;

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fakeAi } from './fakeAi.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const realFirebase = path.join(root, 'src/services/firebase');
const stubFirebase = path.join(here, 'firebaseStub.js');

/** Serves the real app, with Firebase pointed at the emulators and the AI routes faked. */
export default {
  root,
  cacheDir: path.join(root, 'node_modules/.vite-e2e'),
  // The stub lives in e2e/, which has its own Firebase for the rules test. The app and the
  // stub must share one copy, or documents made by one are rejected by the other.
  resolve: { dedupe: ['firebase'] },
  plugins: [
    {
      name: 'firebase-emulator-stub',
      enforce: 'pre',
      resolveId(source, importer) {
        if (!importer || !source.startsWith('.')) return null;
        const target = path.resolve(path.dirname(importer), source);
        return target === realFirebase ? stubFirebase : null;
      },
    },
    fakeAi(),
    react(),
    tailwindcss(),
  ],
  server: { port: 5199, strictPort: true, hmr: false },
};

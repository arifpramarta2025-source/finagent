// Starts the Firebase emulators and the test build of the app, runs every file in tests/
// against an empty database, then stops everything. Usage: node e2e/run.mjs [name-filter]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const filter = process.argv[2] ?? '';

const CLEAR_DATABASE_URL =
  'http://127.0.0.1:8080/emulator/v1/projects/demo-fina/databases/fina-e2e/documents';
const SERVICES = ['http://127.0.0.1:8080/', 'http://127.0.0.1:9099/', 'http://localhost:5199/'];
const START_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 240_000;

const RULES_COPY = path.join(here, '.out', 'firestore.rules');
const ANONYMOUS_READ_URL =
  'http://127.0.0.1:8080/v1/projects/demo-fina/databases/fina-e2e/documents/ledger/main';

const children = [];

/**
 * Without its rules file the emulator allows everything and says nothing, which would let
 * every test pass against an open database. An anonymous read must be refused.
 */
async function assertRulesEnforced() {
  const response = await fetch(ANONYMOUS_READ_URL);
  if (response.status !== 403) {
    throw new Error(
      `Emulator tidak memakai firestore.rules (baca tanpa login dibalas ${response.status}, bukan 403).`
    );
  }
}

function start(command, args, cwd) {
  // Own process group, so stopping it also stops the Java emulator it launches.
  const child = spawn(command, args, { cwd, detached: true, stdio: ['pipe', 'ignore', 'inherit'] });
  children.push(child);
  return child;
}

function stopAll() {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
}

async function isUp(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function waitForServices() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const up = await Promise.all(SERVICES.map(isUp));
    if (up.every(Boolean)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Emulator atau server uji tidak menyala dalam 2 menit.');
}

function runTest(file) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(here, 'tests', file)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    const timer = setTimeout(() => child.kill('SIGKILL'), TEST_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ passed: code === 0, output });
    });
  });
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});

let failed = 0;
try {
  if ((await Promise.all(SERVICES.map(isUp))).some(Boolean)) {
    throw new Error('Port 8080, 9099, atau 5199 sedang dipakai. Hentikan proses itu dulu.');
  }

  // The emulator only reads files inside e2e/, so it gets a fresh copy of the real rules.
  fs.mkdirSync(path.join(here, '.out'), { recursive: true });
  fs.copyFileSync(path.join(root, 'firestore.rules'), RULES_COPY);

  start(
    'npx',
    ['firebase', 'emulators:start', '--only', 'auth,firestore', '--project', 'demo-fina'],
    here
  );
  start('npx', ['vite', '--config', path.join(here, 'vite.config.mjs')], root);
  await waitForServices();
  await assertRulesEnforced();

  const files = fs
    .readdirSync(path.join(here, 'tests'))
    .filter((file) => file.endsWith('.mjs') && file.includes(filter))
    .sort();

  for (const file of files) {
    await fetch(CLEAR_DATABASE_URL, { method: 'DELETE' });
    const { passed, output } = await runTest(file);
    console.log(`${passed ? 'LOLOS' : 'GAGAL'}  ${file}`);
    if (!passed) {
      failed += 1;
      console.log(output.trim().split('\n').slice(-25).join('\n'));
    }
  }
  console.log(`\n${files.length - failed} dari ${files.length} lolos.`);
} catch (error) {
  failed += 1;
  console.error(error.message);
} finally {
  stopAll();
}
process.exit(failed ? 1 : 0);

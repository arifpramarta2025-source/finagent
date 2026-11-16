// Two accounts on one ledger: who recorded what, the activity log, and private chats.
import { chromium, tx, OUT } from '../helpers.mjs';
import assert from 'assert';
import fs from 'fs';
const S = OUT;
const b = await chromium.launch();
const N = 'pasangan@example.com';
const errs = [];
async function login(email, vp = { width: 1100, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true });
  await ctx.addInitScript(
    `if(${JSON.stringify(email || '')})localStorage.setItem('e2e_email',${JSON.stringify(email || '')})`
  );
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5199/');
  await p.waitForFunction(() => window.__auth?.currentUser, null, { timeout: 60000 });
  return p;
}
const clear = () =>
  fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-fina/databases/fina-e2e/documents', {
    method: 'DELETE',
  });
const nav = (p, n) => p.getByRole('button', { name: n }).first().click();
const addTx = async (p, m, amt) => {
  await p.getByRole('button', { name: 'Tambah Baru' }).click();
  await p.getByPlaceholder('0', { exact: true }).fill(String(amt));
  await p.getByPlaceholder('Contoh: Superindo, Starbucks, PLN').fill(m);
  await p.locator('button[type=submit]').last().click();
  await p.getByPlaceholder('Contoh: Superindo, Starbucks, PLN').waitFor({ state: 'detached' });
};
await clear();

const n0 = await login(N);
await n0.getByText('Minta Andi membuka Fina').waitFor({ timeout: 20000 });
await n0.close();
console.log('sari waits for owner');
const a = await login();
await nav(a, 'Riwayat');
await a.evaluate(
  async (t) => {
    const { doc, setDoc } = window.__fs;
    const u = window.__auth.currentUser.uid;
    await setDoc(doc(window.__db, 'users', u, 'transactions', t.id), { ...t, userId: u });
  },
  tx('lama', 1000)
);
await a.getByText(/dari 1 transaksi/).waitFor();
assert.match(await a.locator('tbody tr').first().innerText(), /Andi/);
await addTx(a, 'Warung Andi', 2000);
const n = await login(N);
await nav(n, 'Riwayat');
await n.getByText(/dari 2 transaksi/).waitFor({ timeout: 20000 });
console.log('sari sees shared ledger');
await addTx(n, 'Toko Sari', 3000);
await a.getByText(/dari 3 transaksi/).waitFor({ timeout: 8000 });
assert.match(await a.locator('tbody tr', { hasText: 'Toko Sari' }).innerText(), /Sari/);
assert.match(await a.locator('tbody tr', { hasText: 'Warung Andi' }).innerText(), /Andi/);
console.log('realtime + label ok');
// filter
await a.getByLabel('Filter pencatat').selectOption('Sari');
await a.getByText(/Menampilkan 1 dari 3/).waitFor();
await a.getByLabel('Filter pencatat').selectOption('Andi');
await a.getByText(/Menampilkan 2 dari 3/).waitFor();
await a.getByLabel('Filter pencatat').selectOption('all');
// sari edits andi's, label stays Andi
await n
  .locator('tbody tr', { hasText: 'Warung Andi' })
  .locator('button[title="Edit Transaksi"]')
  .click();
await n.getByPlaceholder('0', { exact: true }).fill('2500');
await n.locator('button[type=submit]').last().click();
await a.locator('tbody tr', { hasText: '2.500' }).waitFor({ timeout: 8000 });
assert.match(await a.locator('tbody tr', { hasText: 'Warung Andi' }).innerText(), /Andi/);
// sari deletes old
n.once('dialog', (d) => d.accept());
await n
  .locator('tbody tr', { hasText: 'Warung lama' })
  .locator('button[title="Hapus Transaksi"]')
  .click();
await a.getByText(/dari 2 transaksi/).waitFor({ timeout: 8000 });
console.log('sari edit/delete ok');
// log
await a.getByRole('button', { name: 'Log Aktivitas' }).click();
const log = a.locator('h3:has-text("Log Aktivitas")').locator('xpath=ancestor::div[1]');
await a.getByText(/Menghapus transaksi "Warung lama"/).waitFor();
const txt = await a.locator('li', { hasText: 'Menghapus transaksi' }).first().innerText();
assert.match(txt, /Sari/);
assert.match(await a.locator('li', { hasText: 'Mengubah transaksi' }).first().innerText(), /Sari/);
assert.match(
  await a.locator('li', { hasText: 'Menambah transaksi "Warung Andi"' }).first().innerText(),
  /Andi/
);
await a.locator('li', { hasText: 'Mengubah transaksi' }).first().locator('summary').click();
await a.getByText(/Nominal:.*2\.000.*→.*2\.500/).waitFor();
await a.screenshot({ path: S + '/shared-log.png' });
await a.getByRole('button', { name: 'Tutup Log' }).click();
console.log('log ok');
// tamper via client
const tamper = await n.evaluate(async () => {
  const { doc, collection, getDocs, updateDoc, deleteDoc, getDoc } = window.__fs;
  const led = (await getDoc(doc(window.__db, 'ledger', 'main'))).data().ownerUid;
  const ds = await getDocs(collection(window.__db, 'users', led, 'activity'));
  const r = {};
  try {
    await updateDoc(ds.docs[0].ref, { summary: 'x' });
    r.up = 'ok';
  } catch (e) {
    r.up = e.code;
  }
  try {
    await deleteDoc(ds.docs[0].ref);
    r.del = 'ok';
  } catch (e) {
    r.del = e.code;
  }
  try {
    await getDoc(doc(window.__db, 'users', led, 'settings', 'chat'));
    r.chat = 'ok';
  } catch (e) {
    r.chat = e.code;
  }
  return r;
});
console.log(tamper);
assert.deepEqual(tamper, {
  up: 'permission-denied',
  del: 'permission-denied',
  chat: 'permission-denied',
});
// chat separate
await nav(a, 'Finn AI');
const box = (p) => p.getByPlaceholder(/Tanyakan soal keuangan/);
await box(a).fill('rahasia andi');
await box(a).press('Enter');
await a.getByText('terkendali.').waitFor({ timeout: 8000 });
await nav(n, 'Finn AI');
await n.getByPlaceholder(/Tanyakan soal keuangan/).waitFor();
await n.waitForTimeout(800);
assert.equal(await n.getByText('rahasia andi').count(), 0);
await box(n).fill('rahasia sari');
await box(n).press('Enter');
await n.getByText('terkendali.').waitFor({ timeout: 8000 });
await a.waitForTimeout(800);
assert.equal(await a.getByText('rahasia sari').count(), 0);
console.log('chat separate ok');
// sari backup + restore + category
await nav(n, 'Anggaran');
const [dl] = await Promise.all([
  n.waitForEvent('download'),
  n.getByRole('button', { name: 'Unduh Cadangan' }).click(),
]);
await dl.saveAs(S + '/n.json');
const bk = JSON.parse(fs.readFileSync(S + '/n.json'));
assert.equal(bk.transactions.length, 2);
assert.ok(bk.settings.some((d) => d.id === 'chat_sari1' || d.id.startsWith('chat_')));
assert.ok(!bk.settings.some((d) => d.id === 'chat'));
await nav(a, 'Anggaran');
const [dl2] = await Promise.all([
  a.waitForEvent('download'),
  a.getByRole('button', { name: 'Unduh Cadangan' }).click(),
]);
await dl2.saveAs(S + '/a.json');
assert.ok(JSON.parse(fs.readFileSync(S + '/a.json')).settings.some((d) => d.id === 'chat'));
await n.setInputFiles('input[type=file]', S + '/a.json');
await n.getByText('Pratinjau cadangan').waitFor();
assert.equal(
  (await n.getByText('Tidak ada yang perlu dipulihkan').count()) +
    (await n.getByRole('button', { name: /Pulihkan/ }).count()) >
    0,
  true
);
await n.getByRole('button', { name: 'Batal' }).click();
await n.getByLabel('Nama kategori baru').fill('Keluarga');
await n.getByRole('button', { name: 'Tambah', exact: true }).click();
await n.getByRole('button', { name: 'Ganti nama Keluarga' }).waitFor();
await a.getByRole('button', { name: 'Ganti nama Keluarga' }).waitFor({ timeout: 8000 });
console.log('sari backup/restore/category ok; andi sees category');
// reset by sari, log survives
await nav(n, 'Riwayat');
n.once('dialog', (d) => d.accept('HAPUS'));
await n.locator('button[title="Hapus semua transaksi secara permanen"]').click();
await n.getByText(/dari 0 transaksi/).waitFor({ timeout: 15000 });
await nav(a, 'Riwayat');
await a.getByRole('button', { name: 'Log Aktivitas' }).click();
await a.getByText(/Menjalankan Hapus Semua untuk 2 transaksi/).waitFor();
assert.match(await a.locator('li', { hasText: 'Hapus Semua' }).first().innerText(), /Sari/);
console.log('reset logged', errs);
const m = await login(N, { width: 390, height: 844 });
await m.locator('nav button:visible', { hasText: 'Riwayat' }).first().waitFor();
await m.close();
await b.close();

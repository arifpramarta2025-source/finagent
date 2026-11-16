// Only recent months load on open; older history, CSV, backup and Hapus Semua stay complete.
import { open, get, wipe, tx, OUT } from '../helpers.mjs';
import assert from 'assert';
import fs from 'fs';
const S = OUT;
const { b, p, errs } = await open();
await wipe(p);
const rows = [];
for (let i = 0; i < 20; i++)
  rows.push(tx('r' + i, 1000, '2026-1' + (i % 2) + '-0' + ((i % 9) + 1)));
rows.push(tx('edgeIn', 1, '2026-09-01'));
rows.push(tx('edgeOut', 2, '2026-08-31', { merchant: 'Batas Agustus' }));
for (let i = 0; i < 30; i++) rows.push(tx('j' + i, 500, '2026-06-1' + (i % 9)));
rows.push(tx('tua', 9, '2024-02-02', { merchant: 'Toko Purba', hasReceiptImage: true }));
await p.evaluate(async (rows) => {
  const { doc, writeBatch } = window.__fs;
  const u = window.__auth.currentUser.uid;
  const w = writeBatch(window.__db);
  for (const t of rows)
    w.set(doc(window.__db, 'users', u, 'transactions', t.id), { ...t, userId: u });
  w.set(doc(window.__db, 'users', u, 'settings', 'receipt_tua'), { image: 'x' });
  await w.commit();
}, rows);
await p.reload();
await p.getByText('Riwayat').first().waitFor();
await p.getByText('Lihat Semua Transaksi (53)').waitFor();
console.log('dashboard total ok');
await p.getByText('Lihat Semua Transaksi (53)').click();
await p.getByText('32 transaksi lebih lama belum dimuat').waitFor();
assert.match(await p.getByText(/Menampilkan/).innerText(), /dari 21 transaksi/);
await p.setViewportSize({ width: 390, height: 844 });
await p.getByText('belum dimuat').scrollIntoViewIfNeeded();
await p.screenshot({ path: S + '/pr5-banner.png' });
await p.setViewportSize({ width: 1100, height: 900 });
await p.getByPlaceholder('Cari merchant').fill('Purba');
assert.match(await p.getByText(/Menampilkan/).innerText(), /Menampilkan 0 dari 21/);
await p.getByPlaceholder('Cari merchant').fill('');
await p.getByRole('button', { name: 'Muat 3 Bulan Sebelumnya' }).click();
await p.getByText('1 transaksi lebih lama belum dimuat').waitFor();
assert.match(await p.getByText(/Menampilkan/).innerText(), /dari 52 transaksi/);
await p.getByRole('button', { name: 'Muat Semua' }).click();
await p.getByText(/dari 53 transaksi/).waitFor();
assert.equal(await p.getByRole('button', { name: 'Muat Semua' }).count(), 0);
await p.getByPlaceholder('Cari merchant').fill('Purba');
await p.getByText(/Menampilkan 1 dari 53/).waitFor();
await p.getByPlaceholder('Cari merchant').fill('');
console.log('history ok');
await p.reload();
await p.getByText('Riwayat').first().waitFor();
await p.getByText('Lihat Semua Transaksi (53)').click();
const [dl] = await Promise.all([
  p.waitForEvent('download'),
  p.getByRole('button', { name: 'Ekspor CSV' }).click(),
]);
const f = S + '/x.csv';
await dl.saveAs(f);
const csv = fs.readFileSync(f, 'utf8');
assert.equal(csv.trim().split('\r\n').length, 54);
assert.ok(csv.includes('Toko Purba'));
console.log('csv complete with history unloaded ok');
// backdated add from the UI is counted even though the live list cannot see it
await p.getByRole('button', { name: 'Tambah Baru' }).click();
await p.getByPlaceholder('0', { exact: true }).fill('4321');
await p.getByPlaceholder('Contoh: Superindo, Starbucks, PLN').fill('Mundur');
await p.locator('input[type=date]').first().fill('2025-03-03');
await p.locator('button[type=submit]').last().click();
await p.getByText('33 transaksi lebih lama belum dimuat').waitFor();
console.log('backdated add counted ok');
await p.getByRole('button', { name: 'Muat Semua' }).click();
await p.getByText(/dari 54 transaksi/).waitFor();
await p.getByPlaceholder('Cari merchant').fill('Mundur');
await p.getByText(/Menampilkan 1 dari 54/).waitFor();
p.once('dialog', (d) => d.accept());
await p.locator('tbody tr').first().locator('button').last().click();
await p.getByText(/dari 53 transaksi/).waitFor({ timeout: 10000 });
await p.getByPlaceholder('Cari merchant').fill('');
console.log('delete older ok');
await p.getByRole('button', { name: 'Anggaran' }).first().click();
const [d2] = await Promise.all([
  p.waitForEvent('download'),
  p.getByRole('button', { name: 'Unduh Cadangan' }).click(),
]);
await d2.saveAs(S + '/b5.json');
const bk = JSON.parse(fs.readFileSync(S + '/b5.json'));
assert.equal(bk.transactions.length, 53);
assert.equal(bk.settings.length, 1);
console.log('backup complete ok');
await p.getByRole('button', { name: 'Riwayat' }).first().click();
let msg = '';
p.once('dialog', (d) => {
  msg = d.message();
  d.dismiss();
});
await p.locator('button[title="Hapus semua transaksi secara permanen"]').click();
await p.waitForTimeout(1200);
console.log('prompt:', msg.slice(0, 60));
assert.match(msg, /53 transaksi/);
p.once('dialog', (d) => d.accept('HAPUS'));
await p.locator('button[title="Hapus semua transaksi secara permanen"]').click();
await p.getByText(/dari 0 transaksi/).waitFor({ timeout: 40000 });
const left = await p.evaluate(
  async () =>
    (
      await window.__fs.getDocs(
        window.__fs.collection(window.__db, 'users', window.__auth.currentUser.uid, 'transactions')
      )
    ).size
);
assert.equal(left, 0);
assert.equal(await get(p, 'settings', 'receipt_tua'), null);
assert.equal(await p.getByText('belum dimuat').count(), 0);
console.log('reset deletes all history ok', errs);
await b.close();

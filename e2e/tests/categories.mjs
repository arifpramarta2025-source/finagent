// Adding, hiding and renaming categories, including the bulk rename of old transactions.
import { open, seed, get, wipe, tx, OUT } from '../helpers.mjs';
import assert from 'assert';
import fs from 'fs';
const S = OUT;
const { b, ctx, p, errs } = await open();
await wipe(p);
await seed(p, [
  tx('j1', 1000, '2026-11-02', { category: 'Jajan', subCategory: 'Minuman Ringan' }),
  tx('j2', 2000, '2026-10-02', { category: 'Jajan' }),
  tx('jOld', 3000, '2024-05-05', { category: 'Jajan', subCategory: 'Minuman Ringan' }),
  tx('h1', 4000, '2026-11-01', { category: 'Hobi' }),
  tx('inc', 5000, '2026-11-01', { type: 'income', category: 'Investasi' }),
  tx('exp', 6000, '2026-11-01', { category: 'Tabungan dan Investasi' }),
]);
await p.reload();
await p.getByRole('button', { name: 'Anggaran' }).first().click();
await p.getByRole('heading', { name: 'Kategori' }).waitFor();
// add + dup
await p.getByLabel('Nama kategori baru').fill('Olahraga');
await p.getByRole('button', { name: 'Tambah', exact: true }).click();
await p.getByRole('button', { name: 'Ganti nama Olahraga' }).waitFor();
await p.getByLabel('Nama kategori baru').fill('olahraga');
await p.getByRole('button', { name: 'Tambah', exact: true }).click();
await p.getByText('"olahraga" sudah ada').waitFor();
await p.getByLabel('Nama kategori baru').fill('');
console.log('add ok');
// locked
assert.equal(await p.getByRole('button', { name: 'Sembunyikan Lain-lain Primer' }).count(), 0);
// hide Hobi
await p.getByRole('button', { name: 'Sembunyikan Hobi' }).click();
await p.getByRole('button', { name: 'Munculkan Hobi' }).waitFor();
// sub add
await p
  .getByRole('button', { name: /^Olahraga/ })
  .first()
  .click();
await p.getByLabel('Subkategori baru untuk Olahraga').fill('Lari');
await p.getByRole('button', { name: 'Tambah subkategori ke Olahraga' }).click();
await p.getByRole('button', { name: 'Ganti nama Lari' }).waitFor();
// modal reflects
await p.getByRole('button', { name: 'Riwayat' }).first().click();
await p.getByRole('button', { name: 'Tambah Baru' }).click();
const opts = async () => p.locator('form select').first().locator('option').allInnerTexts();
let o = await opts();
assert.ok(o.includes('Olahraga'));
assert.ok(!o.includes('Hobi'));
await p.locator('form select').first().selectOption('Olahraga');
assert.ok(
  (await p.locator('form select').nth(1).locator('option').allInnerTexts()).includes('Lari') ||
    (await p.locator('form select option').allInnerTexts()).includes('Lari')
);
await p.keyboard.press('Escape');
await p.reload();
await p.getByRole('button', { name: 'Riwayat' }).first().click();
// hidden category still editable with its value
await p.getByPlaceholder('Cari merchant').fill('Warung h1');
await p.locator('table tbody tr').first().locator('button[title="Edit Transaksi"]').click();
o = await opts();
assert.ok(o.includes('Hobi'), 'kategori tersembunyi tetap terpilih saat edit');
await p.reload();
console.log('hide + modal ok');
// offline rename fails, config unchanged
await p.getByRole('button', { name: 'Anggaran' }).first().click();
await p.getByRole('button', { name: 'Ganti nama Jajan' }).click();
await p.getByLabel('Nama baru untuk Jajan').fill('Camilan');
await p.getByRole('button', { name: 'Lanjut' }).click();
await p.getByText('3 transaksi akan diubah dari "Jajan" ke "Camilan"').waitFor();
assert.equal(
  (await get(p, 'transactions', 'jOld')).category,
  'Jajan',
  'belum berubah sebelum Terapkan'
);
await p.setViewportSize({ width: 390, height: 844 });
await p.getByText('3 transaksi akan diubah').scrollIntoViewIfNeeded();
await p.screenshot({ path: S + '/cat-preview.png' });
await p.setViewportSize({ width: 1100, height: 900 });
await ctx.setOffline(true);
await p.getByRole('button', { name: 'Terapkan' }).click();
await p
  .getByText(/offline/)
  .first()
  .waitFor();
await ctx.setOffline(false);
await p.waitForTimeout(1500);
assert.equal((await get(p, 'transactions', 'j1')).category, 'Jajan');
assert.ok((await get(p, 'settings', 'categories')).expense.some((e) => e.name === 'Jajan'));
console.log('offline failure safe ok');
// real rename incl outside window
await p.getByRole('button', { name: 'Ganti nama Jajan' }).click();
await p.getByLabel('Nama baru untuk Jajan').fill('Camilan');
await p.getByRole('button', { name: 'Lanjut' }).click();
await p.getByRole('button', { name: 'Terapkan' }).click();
await p.getByText('3 transaksi ikut diperbarui').waitFor();
for (const id of ['j1', 'j2', 'jOld'])
  assert.equal((await get(p, 'transactions', id)).category, 'Camilan');
assert.equal((await get(p, 'transactions', 'h1')).category, 'Hobi');
const cfg = await get(p, 'settings', 'categories');
const cam = cfg.expense.find((e) => e.name === 'Camilan');
assert.deepEqual(cam.aliases, ['Jajan']);
assert.ok(cam.color);
console.log('rename ok');
// sub rename
await p
  .getByRole('button', { name: /^Camilan/ })
  .first()
  .click();
await p.getByRole('button', { name: 'Ganti nama Minuman Ringan' }).click();
await p.getByLabel('Nama baru untuk Minuman Ringan').fill('Kopi');
await p.getByRole('button', { name: 'Lanjut' }).click();
await p.getByText('2 transaksi akan diubah').waitFor();
await p.getByRole('button', { name: 'Terapkan' }).click();
await p.getByText('2 transaksi ikut diperbarui').waitFor();
assert.equal((await get(p, 'transactions', 'jOld')).subCategory, 'Kopi');
console.log('sub rename ok');
// no-transaction rename skips preview
await p.getByRole('tab', { name: 'Pemasukan' }).click();
await p.getByRole('button', { name: 'Ganti nama Penjualan' }).click();
await p.getByLabel('Nama baru untuk Penjualan').fill('Jualan');
await p.getByRole('button', { name: 'Lanjut' }).click();
await p.getByText('0 transaksi ikut diperbarui').waitFor();
await p.getByRole('button', { name: 'Ganti nama Investasi' }).click();
await p.getByLabel('Nama baru untuk Investasi').fill('Hasil Investasi');
await p.getByRole('button', { name: 'Lanjut' }).click();
await p.getByText('1 transaksi akan diubah').waitFor();
await p.getByRole('button', { name: 'Terapkan' }).click();
await p.getByText('1 transaksi ikut diperbarui').waitFor();
assert.equal((await get(p, 'transactions', 'inc')).category, 'Hasil Investasi');
assert.equal((await get(p, 'transactions', 'exp')).category, 'Tabungan dan Investasi');
console.log('type isolation ok');
// backup carries categories; reload persists
const [dl] = await Promise.all([
  p.waitForEvent('download'),
  p.getByRole('button', { name: 'Unduh Cadangan' }).click(),
]);
await dl.saveAs(S + '/c.json');
assert.ok(JSON.parse(fs.readFileSync(S + '/c.json')).settings.some((d) => d.id === 'categories'));
await p.reload();
await p.getByRole('button', { name: 'Anggaran' }).first().click();
await p.getByRole('button', { name: 'Ganti nama Camilan' }).waitFor();
console.log('persist + backup ok', errs);
await p.evaluate(() =>
  window.__fs.deleteDoc(
    window.__fs.doc(window.__db, 'users', window.__auth.currentUser.uid, 'settings', 'categories')
  )
);
await wipe(p);
await b.close();

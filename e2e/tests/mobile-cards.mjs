// Transactions show as cards on phones, with edit, delete and receipt detail working.
import { open, seed, get, wipe, tx, OUT } from '../helpers.mjs';
import assert from 'assert';
const S = OUT;
const { b, p, errs } = await open();
await wipe(p);
await seed(
  p,
  [
    tx('i1', 900000, '2026-11-03', {
      type: 'income',
      category: 'Insentif',
      merchant: 'Insentif Konsultan',
      paymentMethod: 'Transfer Bank',
      notes: 'Insentif bulan Oktober untuk proyek kajian dampak',
    }),
    tx('i2', 1650000, '2026-11-01', {
      type: 'income',
      category: 'Insentif',
      merchant: 'Honor',
      paymentMethod: 'Transfer Bank',
    }),
    tx('e1', 125000000, '2026-11-02', {
      merchant: 'Toko Dengan Nama Merchant Yang Sangat Panjang Sekali Sekali Bandung',
      category: 'Keuangan dan Administrasi',
      subCategory: 'Biaya Admin',
      paymentMethod: 'QRIS / E-Wallet',
      hasReceiptImage: true,
    }),
    tx('e2', 25000, '2026-11-02', { merchant: 'Kopi' }),
  ],
  { receipt_e1: { image: 'data:image/png;base64,iVBORw0KGgo=' } }
);
await p.evaluate(() => {
  document.documentElement.classList.add('dark');
  localStorage.setItem('fina_theme', 'dark');
});
for (const w of [320, 390]) {
  await p.setViewportSize({ width: w, height: 844 });
  await p.locator('nav button:visible', { hasText: 'Riwayat' }).first().click();
  await p.getByText(/dari 4 transaksi/).waitFor();
  const o = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  assert.ok(o[0] <= o[1], 'overflow riwayat ' + o);
  await p.locator('ul:visible li', { hasText: 'Honor' }).first().scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${S}/m-riwayat-${w}.png` });
  await p.locator('nav button:visible', { hasText: 'Dashboard' }).first().click();
  await p.getByText('Transaksi Terbaru').waitFor();
  const o2 = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  assert.ok(o2[0] <= o2[1], 'overflow dash ' + o2);
  await p.getByText('Transaksi Terbaru').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${S}/m-dash-${w}.png` });
}
assert.equal(await p.locator('table:visible').count(), 0);
await p.locator('nav button:visible', { hasText: 'Riwayat' }).first().click();
await p.getByRole('button', { name: 'Edit Kopi' }).click();
await p.getByPlaceholder('Contoh: Superindo, Starbucks, PLN').waitFor();
await p.locator('button[type=submit]').last().waitFor();
await p.keyboard.press('Escape');
const close = p.getByRole('button', { name: /batal|tutup/i }).first();
if (await close.count()) await close.click().catch(() => {});
await p.reload();
await p.locator('nav button:visible', { hasText: 'Riwayat' }).first().click();
p.once('dialog', (d) => d.accept());
await p.getByRole('button', { name: 'Hapus Kopi' }).click();
await p.getByText(/dari 3 transaksi/).waitFor();
assert.equal(await get(p, 'transactions', 'e2'), null);
await p.getByRole('button', { name: /Lihat detail Toko/ }).click();
await p.waitForTimeout(400);
await p.keyboard.press('Escape');
await p.reload();
await p.setViewportSize({ width: 1100, height: 900 });
await p.getByRole('button', { name: 'Riwayat' }).first().click();
await p.getByText(/dari 3 transaksi/).waitFor();
assert.equal(await p.locator('table:visible').count(), 1);
assert.equal(await p.locator('ul:visible li', { hasText: 'Honor' }).count(), 0);
await p.setViewportSize({ width: 768, height: 1000 });
assert.equal(await p.locator('table:visible').count(), 0);
const o3 = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
console.log('768', o3);
console.log('mobile ok', errs);
await wipe(p);
await b.close();

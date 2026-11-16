// The transaction table keeps its columns apart at desktop and tablet widths.
import { open, seed, wipe, tx, OUT } from '../helpers.mjs';
import assert from 'assert';
const S = OUT;
const { b, p, errs } = await open();
await wipe(p);
await seed(p, [
  tx('a', 155000, '2026-11-05', {
    type: 'income',
    category: 'Insentif',
    merchant: 'Fee Les Privat',
    notes: 'Fee les privat murid matematika',
    paymentMethod: 'Transfer Bank',
    createdByName: 'Sari',
  }),
  tx('b', 1800000, '2026-11-03', {
    category: 'Kebutuhan Tempat Tinggal',
    subCategory: 'Sewa Kontrakan',
    budgetClassification: 'needs',
    merchant: 'Sewa Kontrakan',
    notes: 'Sewa kontrakan bulan November',
    paymentMethod: 'Transfer Bank',
  }),
  tx('c', 38575, '2026-11-03', {
    category: 'Hiburan / Healing',
    merchant: 'Google',
    notes:
      'Youtube premium seharga 38.575 pada tanggal 3 November 2026 dengan catatan yang sangat panjang sekali sampai melewati lebar kolom yang tersedia',
    paymentMethod: 'QRIS / E-Wallet',
    hasReceiptImage: true,
  }),
  tx('d', 125000000, '2026-11-02', {
    type: 'income',
    category: 'Keuangan dan Administrasi',
    subCategory: 'Minuman Kesehatan',
    merchant: 'Toko Dengan Nama Merchant Yang Sangat Panjang Sekali Di Bandung',
    paymentMethod: 'QRIS / E-Wallet',
  }),
]);
await p.reload();
for (const w of [900, 940, 1024, 1280]) {
  await p.setViewportSize({ width: w, height: 900 });
  await p.waitForTimeout(200);
  await p.getByRole('button', { name: 'Riwayat' }).locator('visible=true').first().click();
  await p.locator('table:visible tbody tr').first().waitFor();
  const r = await p.evaluate(() => {
    const t = [...document.querySelectorAll('table')].find((x) => x.offsetParent);
    const bad = [];
    for (const td of t.querySelectorAll('td')) {
      for (const el of td.querySelectorAll('*')) {
        const a = el.getBoundingClientRect(),
          c = td.getBoundingClientRect();
        if (!el.classList.contains('truncate') && a.width && a.right > c.right + 0.5)
          bad.push(el.textContent.slice(0, 30));
      }
    }
    const rows = [...t.tBodies[0].rows].map((r) =>
      [...r.cells].map((c) => Math.round(c.getBoundingClientRect().width))
    );
    return {
      page: [document.documentElement.scrollWidth, innerWidth],
      table: [
        t.scrollWidth,
        t.clientWidth,
        t.parentElement.scrollWidth,
        t.parentElement.clientWidth,
      ],
      cols: rows[0],
      bad,
    };
  });
  console.log(w, JSON.stringify(r));
  assert.equal(r.bad.length, 0, JSON.stringify(r.bad));
  assert.ok(r.page[0] <= r.page[1]);
  assert.ok(r.table[2] <= r.table[3]);
  await p.locator('table:visible').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${S}/table-${w}.png` });
}
await p.getByRole('button', { name: 'Dashboard' }).locator('visible=true').first().click();
await p.getByText('Transaksi Terbaru').scrollIntoViewIfNeeded();
await p.waitForTimeout(300);
await p.screenshot({ path: `${S}/table-dash.png` });
console.log('ok', errs);
await wipe(p);
await b.close();

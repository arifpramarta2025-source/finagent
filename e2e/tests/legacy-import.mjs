// Importing transactions an older version left in the browser, without duplicates.
import { open, seed, get, wipe, tx } from '../helpers.mjs';
import assert from 'assert';
const { b, p, errs } = await open();
await wipe(p);
await seed(p, [tx('ada', 25000, '2025-01-05', { merchant: 'Warung' })]);
await p.evaluate(() => {
  localStorage.setItem(
    'fina_wpu_transactions_v1',
    JSON.stringify([
      {
        id: 'tx-1',
        type: 'income',
        amount: 16500000,
        date: '2026-11-01',
        merchant: 'PT Solusi Teknologi Indonesia',
      },
      { id: 'o1', type: 'expense', amount: 25000, date: '2025-01-05', merchant: 'warung' },
      {
        id: 'o2',
        type: 'expense',
        amount: 9000,
        date: '2025-01-06',
        merchant: 'Toko',
        receiptImage: 'data:image/jpeg;base64,AA',
      },
    ])
  );
  localStorage.setItem(
    'fina_wpu_budget_v1',
    JSON.stringify({
      monthlyIncomeTarget: 1,
      emergencyFundTarget: 2,
      currentEmergencyFund: 3,
      needsPercentage: 50,
      wantsPercentage: 30,
      savingsPercentage: 20,
    })
  );
});
await p.reload();
await p.getByText('Anggaran').first().waitFor();
await p.getByRole('button', { name: 'Anggaran' }).first().click();
await p.getByText('3 transaksi lama, 1 di antaranya data contoh').waitFor();
await p.getByRole('button', { name: 'Periksa Duplikasi' }).click();
await p.getByText('1 transaksi akan diimpor').waitFor();
assert.equal(
  await p.getByRole('button', { name: 'Hapus Data Lama dari Browser' }).count(),
  0,
  'hapus disembunyikan sebelum impor'
);
await p.getByRole('button', { name: 'Impor 3 Data' }).click();
await p.getByText('1 transaksi lama berhasil diimpor').waitFor();
await p.getByText('0 transaksi akan diimpor').waitFor();
assert.equal(
  await p.evaluate(() => !!localStorage.getItem('fina_wpu_transactions_v1')),
  true,
  'belum dihapus tanpa konfirmasi'
);
assert.equal((await get(p, 'settings', 'budget')).monthlyIncomeTarget, 1);
let n = await p.evaluate(
  async () =>
    (
      await window.__fs.getDocs(
        window.__fs.collection(window.__db, 'users', window.__auth.currentUser.uid, 'transactions')
      )
    ).size
);
assert.equal(n, 2);
p.once('dialog', (d) => d.dismiss());
await p.getByRole('button', { name: 'Hapus Data Lama dari Browser' }).click();
assert.equal(
  await p.evaluate(() => !!localStorage.getItem('fina_wpu_transactions_v1')),
  true,
  'batal = tetap'
);
p.once('dialog', (d) => d.accept());
await p.getByRole('button', { name: 'Hapus Data Lama dari Browser' }).click();
await p.getByText('Data lama sudah dihapus').waitFor();
assert.equal(await p.evaluate(() => localStorage.getItem('fina_wpu_transactions_v1')), null);
console.log('pr4 ok', errs);
await wipe(p);
await b.close();

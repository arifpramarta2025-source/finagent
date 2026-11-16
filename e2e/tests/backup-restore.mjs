// Backup download, restore preview, overwrite consent, damaged files, and the old-data notice.
import { open, seed, get, del, wipe, tx, OUT } from '../helpers.mjs';
import fs from 'fs';
import assert from 'assert';
const S = OUT;
const { b, p, errs } = await open();
await wipe(p);
await seed(
  p,
  [tx('a1', 1000, '2026-11-02', { hasReceiptImage: true }), tx('b1', 2000), tx('c1', 3000)],
  {
    receipt_a1: { image: 'data:image/jpeg;base64,AAAA' },
    budget: {
      needsPercentage: 60,
      wantsPercentage: 20,
      savingsPercentage: 20,
      monthlyIncomeTarget: 9,
      emergencyFundTarget: 0,
      currentEmergencyFund: 0,
    },
  }
);
await p.getByRole('button', { name: 'Anggaran' }).first().click();
const [dl] = await Promise.all([
  p.waitForEvent('download'),
  p.getByRole('button', { name: 'Unduh Cadangan' }).click(),
]);
const file = S + '/backup.json';
await dl.saveAs(file);
const bk = JSON.parse(fs.readFileSync(file));
assert.equal(bk.transactions.length, 3);
assert.equal(bk.settings.length, 2);
await p.getByText('Tersimpan: 3 transaksi dan 1 foto struk').waitFor();
console.log('backup ok', dl.suggestedFilename());
await del(p, 'transactions', 'a1');
await del(p, 'settings', 'receipt_a1');
await seed(p, [tx('b1', 7777)]);
await p.setInputFiles('input[type=file]', file);
await p.getByText('Pratinjau cadangan').waitFor();
await p.screenshot({ path: S + '/pr1-preview.png' });
const row = await p.locator('tbody tr').allInnerTexts();
console.log(row);
assert.match(row[0], /Transaksi\s+1\s+1\s+1/);
assert.match(row[1], /1\s+1\s+0/);
await p.getByRole('button', { name: 'Pulihkan 2 data' }).click();
await p.getByText('2 data berhasil dipulihkan').waitFor();
assert.equal((await get(p, 'transactions', 'b1')).amount, 7777, 'tidak ditimpa tanpa izin');
assert.equal((await get(p, 'transactions', 'a1')).amount, 1000);
assert.ok((await get(p, 'settings', 'receipt_a1')).image);
console.log('restore no-overwrite ok');
await p.setInputFiles('input[type=file]', file);
await p.getByText('Pratinjau cadangan').waitFor();
await p.getByLabel(/Timpa 1 transaksi/).check();
await p.getByRole('button', { name: 'Pulihkan 1 data' }).click();
await p.getByText('1 data berhasil dipulihkan').waitFor();
assert.equal((await get(p, 'transactions', 'b1')).amount, 2000);
console.log('overwrite with consent ok');
await p.setInputFiles('input[type=file]', file);
await p.getByRole('button', { name: 'Tidak ada yang perlu dipulihkan' }).waitFor();
await p.getByRole('button', { name: 'Batal' }).click();
fs.writeFileSync(
  S + '/bad.json',
  '{"format":"fina-backup","version":1,"transactions":[{"id":"x","data":{}}],"settings":[]}'
);
await p.setInputFiles('input[type=file]', S + '/bad.json');
await p.getByText('transaksi x tidak valid').waitFor();
assert.equal(await get(p, 'transactions', 'x'), null);
console.log('bad file ok');
await p.evaluate(() => {
  localStorage.setItem(
    'fina_wpu_transactions_v1',
    JSON.stringify([
      { id: 'tx-1', merchant: 'Kost Eksekutif Bandung', amount: 1 },
      { id: 'zz', merchant: 'Toko', amount: 2 },
    ])
  );
  document.documentElement.classList.add('dark');
});
await p.reload();
await p.getByText('Anggaran').first().waitFor();
await p.getByRole('button', { name: 'Anggaran' }).first().click();
await p.getByText('2 transaksi lama, 1 di antaranya data contoh').waitFor();
await p.evaluate(() => localStorage.removeItem('fina_wpu_transactions_v1'));
console.log('legacy ok; pageerrors', errs);
await wipe(p);
await b.close();

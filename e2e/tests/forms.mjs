// Manual, Catat AI and Scan Struk share one form; dates and receipt notes are read correctly.
import { chromium, get, wipe, OUT, FIXTURES } from '../helpers.mjs';
import assert from 'assert';
const S = OUT;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5199/');
await p.waitForFunction(() => window.__auth?.currentUser, null, { timeout: 60000 });
await p.locator('nav button:visible', { hasText: 'Dashboard' }).first().waitFor();
await wipe(p);
const today = await p.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
const yesterday = await p.evaluate(() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
const fab = async (name) => {
  await p.locator('div.fixed.bottom-20 button:visible').last().click();
  await p.waitForTimeout(250);
  await p.locator('div.fixed.bottom-20 button:visible', { hasText: name }).first().click();
};
const order = () =>
  p.evaluate(() =>
    [...document.querySelectorAll('.fixed.inset-0 label')]
      .map((l) => l.textContent.trim())
      .filter((t) => !/Tulis Transaksi/.test(t))
  );
// manual
await fab('Manual');
await p.locator('#tx-amount').waitFor();
const manual = await order();
console.log('manual', manual);
await p.screenshot({ path: S + '/form-manual.png', fullPage: false });
await p.keyboard.press('Escape');
await p.reload();
await p.locator('nav button:visible', { hasText: 'Dashboard' }).first().waitFor();
// catat AI with "kemarin" while AI echoes today
await fab('Catat AI');
await p.locator('textarea').fill('beli kopi kenangan 25rb kemarin pakai qris');
await p.getByRole('button', { name: 'Ekstrak Data Transaksi' }).click();
await p.locator('#tx-amount').waitFor();
const smart = await order();
console.log('smart', smart);
assert.equal(await p.locator('#tx-date').inputValue(), yesterday, 'Catat AI harus memakai kemarin');
assert.equal(await p.getByText('Tanggal tidak disebut').count(), 0);
await p.screenshot({ path: S + '/form-smart.png' });
await p.locator('textarea').fill('beli kopi 25rb pakai qris');
await p.getByRole('button', { name: 'Ekstrak Data Transaksi' }).click();
await p.getByText('Tanggal tidak disebut, jadi memakai hari ini.').waitFor();
assert.equal(await p.locator('#tx-date').inputValue(), today);
await p.locator('#tx-notes').fill('catatan dari AI');
await p.getByRole('button', { name: 'Simpan ke Riwayat Transaksi' }).click();
await p.locator('#tx-amount').waitFor({ state: 'detached' });
await p.reload();
await p.locator('nav button:visible', { hasText: 'Dashboard' }).first().waitFor();
// scan struk
await fab('Scan Struk');
await p.setInputFiles('.fixed.inset-0 input[type=file] >> nth=0', FIXTURES + '/struk.png');
await p.locator('#tx-amount').waitFor({ timeout: 15000 });
const receipt = await order();
console.log('receipt', receipt);
const y = today.slice(0, 4);
assert.equal(await p.locator('#tx-date').inputValue(), '2026-11-03', 'tanggal struk');
assert.equal(await p.locator('#tx-amount').inputValue(), '48500');
await p.locator('#tx-notes').fill('Belanja bulanan rumah');
await p.screenshot({ path: S + '/form-receipt.png' });
await p
  .locator('.fixed.inset-0 button', { hasText: /Simpan/ })
  .last()
  .click();
await p.locator('#tx-amount').waitFor({ state: 'detached' });
await p.waitForTimeout(600);
const saved = await p.evaluate(async () => {
  const { collection, getDocs } = window.__fs;
  return (
    await getDocs(collection(window.__db, 'users', window.__auth.currentUser.uid, 'transactions'))
  ).docs.map((d) => d.data());
});
const r = saved.find((t) => t.merchant === 'Indomaret');
assert.equal(r.notes, 'Belanja bulanan rumah');
assert.equal(r.date, '2026-11-03');
assert.equal(saved.find((t) => t.notes === 'catatan dari AI').date, today);
// receipt without date
await p.reload();
await p.locator('nav button:visible', { hasText: 'Dashboard' }).first().waitFor();
await fab('Scan Struk');
await p.setInputFiles('.fixed.inset-0 input[type=file] >> nth=0', FIXTURES + '/struk.png');
await p.locator('#tx-amount').waitFor({ timeout: 15000 });
await p.getByText('Tanggal tidak terbaca di struk').waitFor();
assert.deepEqual(manual, smart);
assert.deepEqual(manual, receipt);
console.log('forms consistent, dates ok, receipt notes saved', errs);
await wipe(p);
await b.close();

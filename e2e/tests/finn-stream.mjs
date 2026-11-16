// Finn replies arriving in pieces, the fallback route, quota errors and a dropped stream.
import { chromium, get, wipe, OUT } from '../helpers.mjs';
import assert from 'assert';
const S = OUT;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(
  `(()=>{class R{start(){window.__r=this}stop(){}abort(){}};window.SpeechRecognition=R;window.webkitSpeechRecognition=R})()`
);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const calls = [];
p.on('request', (r) => {
  if (r.url().includes('/api/ai/chat'))
    calls.push(r.url().endsWith('/stream') ? 'stream' : 'whole');
});
await p.goto('http://localhost:5199/');
await p.waitForFunction(() => window.__auth?.currentUser, null, { timeout: 60000 });
await p.locator('nav button:visible', { hasText: 'Dashboard' }).first().waitFor();
await wipe(p);
// mic colour
await p.locator('div.fixed.bottom-20 button:visible').last().click();
await p.waitForTimeout(250);
await p
  .locator('div.fixed.bottom-20 button:visible', { hasText: /Catat AI/ })
  .first()
  .click();
await p.getByLabel('Catat dengan suara').click();
await p.waitForTimeout(500);
console.log(
  'mic bg',
  await p.getByLabel('Berhenti mendengarkan').evaluate((e) => getComputedStyle(e).backgroundColor)
);
await p.reload();
await p.locator('nav button:visible', { hasText: 'Finn AI' }).first().click();
await p.getByPlaceholder(/Tanyakan soal keuangan/).waitFor();
const hit = await p.evaluate(() => {
  const b = document.querySelector('button[title="Kirim pesan"]');
  const r = b.getBoundingClientRect();
  const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return {
    inside: b.contains(e),
    bottom: r.bottom,
    nav: document.querySelector('nav.fixed, div.fixed.bottom-0, nav')?.getBoundingClientRect().top,
    h: innerHeight,
  };
});
console.log('send', hit);
assert.ok(hit.inside, 'tombol kirim tertutup');
const box = p.getByPlaceholder(/Tanyakan soal keuangan/);
const ask = async (t) => {
  await box.fill(t);
  await box.press('Enter');
};
// streaming visible partial
await ask('apa kabar keuangan');
const live = p.locator('[aria-live=polite]');
await live.waitFor({ timeout: 4000 });
await p.getByText('Bulan ini pengeluaran').waitFor();
const partial = await live.innerText();
assert.ok(!partial.includes('terkendali.'), 'harus masih sebagian: ' + partial);
await p.screenshot({ path: S + '/stream-partial.png' });
assert.equal(await box.isDisabled(), true);
await p.getByText('Bulan ini pengeluaran Anda aman dan terkendali.').first().waitFor();
await live.waitFor({ state: 'detached' });
await p.waitForTimeout(500);
let m = (await get(p, 'settings', 'chat')).messages;
assert.equal(m.length, 2);
assert.equal(m[1].content, 'Bulan ini pengeluaran Anda aman dan terkendali.');
assert.deepEqual(calls, ['stream']);
calls.length = 0;
console.log('streaming ok, saved once');
// sources
await ask('cek sumber');
await p.getByText('Rujukan Google Search').waitFor({ timeout: 6000 });
await p.waitForTimeout(300);
calls.length = 0;
// fallback html
await ask('html');
await p.getByText('Jawaban utuh dari rute biasa').waitFor();
assert.deepEqual(calls, ['stream', 'whole']);
calls.length = 0;
console.log('fallback ok');
// quota no fallback
await ask('kuota');
await p.getByText(/Kuota AI harian habis/).waitFor();
assert.deepEqual(calls, ['stream']);
calls.length = 0;
console.log('quota shown, no retry');
// server stream error before text
await ask('gagalawal');
await p.getByText('Koneksi ke Finn terputus').waitFor();
assert.deepEqual(calls, ['stream']);
calls.length = 0;
// dropped midway
await ask('putus');
await p.getByText('Jawaban terputus').waitFor({ timeout: 8000 });
assert.deepEqual(calls, ['stream'], 'tidak boleh dobel');
await p.waitForTimeout(400);
m = (await get(p, 'settings', 'chat')).messages;
assert.match(m.at(-1).content, /^Bulan ini pengeluaran Anda [\s\S]*terputus/);
console.log('dropped midway keeps text ok', errs);
await wipe(p);
await b.close();

// Voice input in Catat AI, with a simulated SpeechRecognition.
import { open, get, wipe, chromium, OUT } from '../helpers.mjs';
import assert from 'assert';
const S = OUT;
const fake = `(()=>{class R{constructor(){window.__rec=this}start(){window.__started=(window.__started||0)+1;if(window.__startError)setTimeout(()=>{this.onerror({error:window.__startError});this.onend()},10)}stop(){this.onend&&this.onend()}abort(){window.__aborted=true;this.onerror&&this.onerror({error:'aborted'});this.onend&&this.onend()}}
window.webkitSpeechRecognition=R;window.SpeechRecognition=R;window.__say=(parts)=>{window.__rec.onresult({results:parts.map(t=>[{transcript:t}])})}})()`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(fake);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5199/');
await p.waitForFunction(() => window.__auth?.currentUser, null, { timeout: 60000 });
await p.locator('nav button:visible', { hasText: 'Dashboard' }).first().waitFor();
await wipe(p);
const openModal = async () => {
  await p.locator('div.fixed.bottom-20 button:visible').last().click();
  await p.waitForTimeout(250);
  await p
    .locator('div.fixed.bottom-20 button:visible', { hasText: /Catat AI/ })
    .first()
    .click();
  await p.getByLabel('Catat dengan suara').waitFor();
};
await openModal();
await p.getByLabel('Catat dengan suara').click();
await p.getByText('Mendengarkan').waitFor();
await p.screenshot({ path: S + '/voice-listening.png' });
await p.evaluate(() => {
  __say(['beli kopi dua puluh']);
});
assert.equal(await p.locator('textarea').inputValue(), 'beli kopi dua puluh');
await p.evaluate(() => {
  __say(['beli kopi dua puluh lima ribu pakai qris']);
});
assert.equal(await p.locator('textarea').inputValue(), 'beli kopi dua puluh lima ribu pakai qris');
await p.getByLabel('Berhenti mendengarkan').click();
await p
  .getByText(/Rp\s?25\.000/)
  .first()
  .waitFor({ timeout: 12000 });
await p.screenshot({ path: S + '/voice-draft.png' });
const count = await p.evaluate(
  async () =>
    (await __fs.getDocs(__fs.collection(__db, 'users', __auth.currentUser.uid, 'transactions')))
      .size
);
assert.equal(count, 0, 'tidak simpan otomatis');
console.log('voice to draft ok, no autosave');
// close while listening must not parse
await p.reload();
await p.locator('nav button:visible', { hasText: 'Dashboard' }).first().waitFor();
await openModal();
await p.getByLabel('Catat dengan suara').click();
await p.evaluate(() => {
  __say(['beli sesuatu 5000']);
});
await p.locator('.fixed.inset-0 button').first().click();
await p.waitForTimeout(300);
assert.equal(await p.evaluate(() => window.__aborted), true);
console.log('cancel on close ok');
// permission denied
await p.reload();
await p.locator('nav button:visible', { hasText: 'Dashboard' }).first().waitFor();
await openModal();
await p.evaluate(() => {
  window.__startError = 'not-allowed';
});
await p.getByLabel('Catat dengan suara').click();
await p.getByText('Izin mikrofon ditolak').waitFor();
assert.equal(await p.getByText('Mendengarkan').count(), 0);
console.log('permission denied ok');
// unsupported browser hides mic
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx2.addInitScript(
  `delete window.webkitSpeechRecognition;delete window.SpeechRecognition;Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined});Object.defineProperty(window,'SpeechRecognition',{value:undefined})`
);
const q = await ctx2.newPage();
await q.goto('http://localhost:5199/');
await q.waitForFunction(() => window.__auth?.currentUser, null, { timeout: 60000 });
await q.locator('nav button:visible', { hasText: 'Dashboard' }).first().waitFor();
await q.locator('div.fixed.bottom-20 button:visible').last().click();
await q.waitForTimeout(250);
await q
  .locator('div.fixed.bottom-20 button:visible', { hasText: /Catat AI/ })
  .first()
  .click();
await q.locator('textarea').waitFor();
assert.equal(await q.getByLabel('Catat dengan suara').count(), 0);
console.log('unsupported hides mic ok', errs);
await wipe(p);
await b.close();

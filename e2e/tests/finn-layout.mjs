// The Finn screen fits phone widths and renders bold text.
import { chromium, wipe, OUT } from '../helpers.mjs';
import assert from 'assert';
const S = OUT;
const b = await chromium.launch();
for (const w of [320, 390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5199/');
  await p.waitForFunction(() => window.__auth?.currentUser, null, { timeout: 60000 });
  await p.getByRole('button', { name: 'Finn AI' }).locator('visible=true').first().click();
  await p.getByText('Data keuangan terhubung').waitFor();
  assert.equal(await p.getByText('**').count(), 0);
  assert.equal(await p.locator('strong', { hasText: 'Finn' }).count(), 1);
  const r = await p.evaluate(() => {
    const h = document.querySelector('h2');
    const q = [...document.querySelectorAll('.no-scrollbar')].filter((e) => e.offsetParent);
    return {
      page: [document.documentElement.scrollWidth, innerWidth],
      title: h.textContent,
      h: h.parentElement.getBoundingClientRect().height,
      bar: q[0] ? getComputedStyle(q[0]).scrollbarWidth : null,
    };
  });
  console.log(w, JSON.stringify(r), errs);
  assert.ok(r.page[0] <= r.page[1]);
  assert.equal(r.bar, 'none');
  await p.screenshot({ path: `${S}/finn-${w}.png` });
  await ctx.close();
}
await b.close();

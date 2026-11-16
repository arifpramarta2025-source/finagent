import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';

// Without a key, every route must still answer: Catat AI with the local parser,
// the others with a clear message. Login is checked in server.ts and tested elsewhere.
let baseUrl = '';
let close = () => {};

before(async () => {
  process.env.GEMINI_API_KEY = '';
  const { parseTextRouter } = await import('../server/routes/parseText.ts');
  const { parseReceiptRouter } = await import('../server/routes/parseReceipt.ts');
  const { auditRouter } = await import('../server/routes/audit.ts');
  const { chatRouter } = await import('../server/routes/chat.ts');

  const app = express();
  app.use('/api/ai', express.json({ limit: '12mb' }));
  app.use('/api/ai', parseTextRouter, parseReceiptRouter, auditRouter, chatRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ai`;
  close = () => server.close();
});

after(() => close());

const post = (path: string, body: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('Catat AI still works without a key, through the local parser', async () => {
  const response = await post('/parse-text', {
    text: 'beli kopi 25rb kemarin',
    currentDate: '2026-11-14',
  });
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.data.amount, 25000);
  assert.equal(json.data.date, '2026-11-13');
});

test('the AI routes explain that the key is missing', async () => {
  const cases: Array<[string, unknown]> = [
    ['/parse-receipt', { imageBase64: 'AAAA', mimeType: 'image/png' }],
    ['/audit', { summary: {}, transactions: [], budgetSettings: {} }],
    ['/chat', { message: 'halo' }],
    ['/chat/stream', { message: 'halo' }],
  ];

  for (const [path, body] of cases) {
    const response = await post(path, body);
    assert.equal(response.status, 503, path);
    assert.match((await response.json()).error, /GEMINI_API_KEY/, path);
  }
});

test('bad input is refused before any AI call', async () => {
  assert.equal((await post('/parse-text', { text: '' })).status, 400);
  assert.equal((await post('/parse-receipt', {})).status, 400);
  assert.equal((await post('/chat', { message: '' })).status, 400);
  assert.equal((await post('/chat/stream', { message: 'x'.repeat(4001) })).status, 400);
});

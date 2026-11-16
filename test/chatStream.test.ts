import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import express from 'express';
import { streamGeminiToResponse } from '../server/chatStream.ts';
import { createSseParser } from '../src/utils/sse.ts';

const servers: Array<{ close: () => void }> = [];
after(() => servers.forEach((server) => server.close()));

type Open = Parameters<typeof streamGeminiToResponse>[1];

async function serve(open: Open, idleMs = 200): Promise<string> {
  const app = express();
  app.post('/stream', async (_req, res) => {
    try {
      await streamGeminiToResponse(res, open, idleMs);
    } catch {
      res.status(429).json({ error: 'kuota habis' });
    }
  });
  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/stream`;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readEvents(url: string) {
  const response = await fetch(url, { method: 'POST' });
  const events: any[] = [];
  const arrivals: number[] = [];
  const parser = createSseParser((event) => {
    events.push(event);
    arrivals.push(Date.now());
  });
  const decoder = new TextDecoder();
  const reader = response.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser(decoder.decode(value, { stream: true }));
  }
  return { response, events, arrivals };
}

test('text reaches the browser as it is written, not all at the end', async () => {
  const url = await serve(async () =>
    (async function* () {
      yield { text: 'Halo ' };
      await wait(80);
      yield { text: 'dunia' };
      yield { candidates: [{ groundingMetadata: { sumber: 1 } }] };
    })()
  );

  const { response, events, arrivals } = await readEvents(url);

  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.deepEqual(
    events.map((event) => event.text ?? null),
    ['Halo ', 'dunia', null]
  );
  assert.ok(arrivals[1] - arrivals[0] >= 60, 'kedua potongan harus tiba terpisah');
  assert.deepEqual(events[2], { done: true, groundingMetadata: { sumber: 1 } });
});

test('an error before streaming starts keeps its normal status', async () => {
  const url = await serve(async () => {
    throw new Error('429');
  });

  const response = await fetch(url, { method: 'POST' });

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { error: 'kuota habis' });
});

test('a failure midway is reported after the text already sent', async () => {
  const url = await serve(async () =>
    (async function* () {
      yield { text: 'Sebagian' };
      throw new Error('putus');
    })()
  );

  const { events } = await readEvents(url);

  assert.equal(events[0].text, 'Sebagian');
  assert.ok(events[1].error);
  assert.equal(
    events.some((event) => event.done),
    false
  );
});

test('an empty answer still gives the owner a message', async () => {
  const url = await serve(async () => (async function* () {})());

  const { events } = await readEvents(url);

  assert.match(events[0].text, /Maaf/);
  assert.equal(events[1].done, true);
});

test('a silent Gemini stream is aborted', async () => {
  let aborted = false;
  const url = await serve(
    async (signal) =>
      (async function* () {
        yield { text: 'mulai' };
        await new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('dibatalkan'));
          })
        );
      })(),
    50
  );

  const { events } = await readEvents(url);

  assert.equal(aborted, true);
  assert.ok(events.at(-1).error);
});

test('leaving the page stops the Gemini request', async () => {
  let aborted = false;
  const url = await serve(
    async (signal) =>
      (async function* () {
        yield { text: 'mulai' };
        await new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('dibatalkan'));
          })
        );
      })(),
    5000
  );

  const controller = new AbortController();
  const response = await fetch(url, { method: 'POST', signal: controller.signal });
  await response.body!.getReader().read();
  controller.abort();
  await wait(50);

  assert.equal(aborted, true);
});

test('the parser copes with events cut at any point', () => {
  const events: unknown[] = [];
  const push = createSseParser((event) => events.push(event));

  push('data: {"te');
  push('xt":"a"}\n');
  push('\ndata: {"text":"b"}\r\n\r\n: komentar\n\n');
  push('data: {"done":true}');
  assert.deepEqual(events, [{ text: 'a' }, { text: 'b' }]);

  push('\n\n');
  assert.deepEqual(events.at(-1), { done: true });
});

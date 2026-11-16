import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  QuotaExhaustedError,
  createGeminiCaller,
  describeQuotaError,
  msUntilQuotaReset,
  readQuotaLimit,
} from '../server/geminiQuota.ts';

const MODELS = ['utama', 'cadangan'];
const NOV_4_NOON_UTC = Date.UTC(2026, 10, 4, 12, 0, 0); // 04.00 Pacific (PST)

function quotaError(message: string) {
  return Object.assign(new Error(message), { status: 429 });
}

const dailyError = () =>
  quotaError('RESOURCE_EXHAUSTED quotaId GenerateRequestsPerDayPerProjectPerModel');
const minuteError = () => quotaError('{"retryDelay":"30s","quotaId":"GenerateRequestsPerMinute"}');

function harness(answer: (model: string, signal: AbortSignal) => Promise<string>) {
  let clock = NOV_4_NOON_UTC;
  const calls: string[] = [];
  const call = createGeminiCaller({
    models: MODELS,
    timeoutMs: 30,
    now: () => clock,
    generate: (model, signal) => {
      calls.push(model);
      return answer(model, signal);
    },
  });
  return { call, calls, advance: (ms: number) => (clock += ms) };
}

test('the daily quota resets at midnight Pacific', () => {
  assert.equal(msUntilQuotaReset(NOV_4_NOON_UTC), 20 * 3600 * 1000);
});

test('quota errors are told apart from other failures', () => {
  assert.equal(readQuotaLimit(dailyError(), NOV_4_NOON_UTC)?.kind, 'daily');
  assert.deepEqual(readQuotaLimit(minuteError(), NOV_4_NOON_UTC), {
    kind: 'minute',
    retryAfterMs: 30_000,
  });
  assert.equal(readQuotaLimit(quotaError('terlalu banyak'), 0)?.retryAfterMs, 60_000);
  assert.equal(readQuotaLimit(new Error('jaringan putus'), 0), null);
});

test('a model over its daily quota is skipped on the next request', async () => {
  const { call, calls } = harness(async (model) => {
    if (model === 'utama') throw dailyError();
    return 'jawaban';
  });

  assert.equal(await call(), 'jawaban');
  assert.equal(await call(), 'jawaban');
  assert.deepEqual(calls, ['utama', 'cadangan', 'cadangan']);
});

test('a model is tried again once its cooldown ends', async () => {
  let limited = true;
  const { call, calls, advance } = harness(async (model) => {
    if (model === 'utama' && limited) throw minuteError();
    return model;
  });

  await call();
  limited = false;
  advance(31_000);

  assert.equal(await call(), 'utama');
  assert.deepEqual(calls, ['utama', 'cadangan', 'utama']);
});

test('with every model limited no request is sent at all', async () => {
  const { call, calls } = harness(async () => {
    throw dailyError();
  });

  await assert.rejects(call, QuotaExhaustedError);
  assert.equal(calls.length, 2);

  await assert.rejects(call, QuotaExhaustedError);
  assert.equal(calls.length, 2);
});

test('a failure unrelated to quota sets no cooldown', async () => {
  const { call, calls } = harness(async (model) => {
    if (model === 'utama' && calls.length === 1) throw new Error('503 sibuk');
    return model;
  });

  assert.equal(await call(), 'cadangan');
  assert.equal(await call(), 'utama');
});

test('a slow request is aborted instead of left running', async () => {
  let aborted = 0;
  const { call } = harness(
    (_model, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted += 1;
          reject(new Error('dibatalkan'));
        });
      })
  );

  await assert.rejects(call, /dibatalkan/);
  assert.equal(aborted, 2);
});

test('the owner is told when AI comes back, in WIB', () => {
  const availableAt = NOV_4_NOON_UTC + msUntilQuotaReset(NOV_4_NOON_UTC);

  assert.match(
    describeQuotaError(new QuotaExhaustedError('daily', availableAt), NOV_4_NOON_UTC),
    /pukul 15[.:]00 WIB/
  );
  assert.match(
    describeQuotaError(new QuotaExhaustedError('minute', NOV_4_NOON_UTC + 30_000), NOV_4_NOON_UTC),
    /30 detik/
  );
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Transaction } from '../src/types/index.ts';
import {
  mergeTransactions,
  monthStart,
  shiftMonthStart,
  touchesOlderHistory,
} from '../src/utils/transactionWindow.ts';

const tx = (id: string, amount = 1) => ({ id, amount }) as Transaction;

test('the live window covers this month and the two before it', () => {
  assert.equal(monthStart(new Date(2026, 10, 30), 2), '2026-09-01');
});

test('the window crosses a year boundary', () => {
  assert.equal(monthStart(new Date(2026, 0, 15), 2), '2025-11-01');
  assert.equal(shiftMonthStart('2026-01-01', 3), '2025-10-01');
});

test('a month-end date does not skip a short month', () => {
  assert.equal(monthStart(new Date(2026, 2, 31), 1), '2026-02-01');
});

test('a record in both lists appears once, with its live version', () => {
  const merged = mergeTransactions([tx('a', 9)], [tx('a', 1), tx('b')]);

  assert.deepEqual(
    merged.map((item) => item.id),
    ['a', 'b']
  );
  assert.equal(merged[0].amount, 9);
});

test('changes before the window are recognised', () => {
  assert.equal(touchesOlderHistory(['2026-08-31'], '2026-09-01'), true);
  assert.equal(touchesOlderHistory(['2026-09-01', undefined], '2026-09-01'), false);
});

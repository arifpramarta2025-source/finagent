import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findDateInText, normalizeDate } from '../src/utils/dates.ts';
import { parseTransactionLocally } from '../src/utils/nlpParser.ts';

const TODAY = '2026-11-09'; // Monday

test('receipt dates in common formats become YYYY-MM-DD, day first', () => {
  const cases: Array<[string, string]> = [
    ['2026-11-03', '2026-11-03'],
    ['2026/11/03 14:22', '2026-11-03'],
    ['03/11/2026', '2026-11-03'],
    ['03-11-26', '2026-11-03'],
    ['3.11.26', '2026-11-03'],
    ['03 Nov 2026', '2026-11-03'],
    ['3 November 2026', '2026-11-03'],
    ['03-NOP-26', '2026-11-03'],
  ];
  for (const [raw, iso] of cases) assert.equal(normalizeDate(raw), iso, raw);
});

test('impossible or missing receipt dates are refused rather than guessed', () => {
  for (const raw of ['', '31/02/2026', '2026-13-01', 'tidak ada', undefined, 20261103]) {
    assert.equal(normalizeDate(raw), null, String(raw));
  }
});

test('relative words in a sentence are counted back from today', () => {
  const dateOf = (text: string) => findDateInText(text, TODAY)?.date;

  assert.equal(dateOf('beli kopi 25rb kemarin'), '2026-11-08');
  assert.equal(dateOf('kemarin lusa makan bakso'), '2026-11-07');
  assert.equal(dateOf('bensin 3 hari yang lalu'), '2026-11-06');
  assert.equal(dateOf('jumat kemarin nonton'), '2026-11-06');
  assert.equal(dateOf('senin lalu bayar listrik'), '2026-11-02');
  assert.equal(dateOf('beli sabun tadi pagi'), TODAY);
  assert.equal(dateOf('beli sabun 25rb'), undefined);
});

test('a named date never lands in the future', () => {
  const dateOf = (text: string) => findDateInText(text, TODAY)?.date;

  assert.equal(dateOf('bayar kos tanggal 3'), '2026-11-03');
  assert.equal(dateOf('bayar kos tanggal 25'), '2026-10-25');
  assert.equal(dateOf('pulsa 3 november'), '2026-11-03');
  assert.equal(dateOf('belanja 20 desember'), '2025-12-20');
  assert.equal(dateOf('gaji 1 november 2026'), '2026-11-01');
  assert.equal(dateOf('tgl 5/11 makan'), '2026-11-05');
  assert.equal(dateOf('tanggal 05/11/2026 parkir'), '2026-11-05');
});

test('the offline parser uses the date and does not read it as money', () => {
  const tx = parseTransactionLocally('Youtube premium 38.575 pada tanggal 3 November 2026', TODAY);
  assert.equal(tx.date, '2026-11-03');
  assert.equal(tx.amount, 38575);

  const spoken = parseTransactionLocally('beli kopi dua puluh lima ribu kemarin', TODAY);
  assert.equal(spoken.date, '2026-11-08');
  assert.equal(spoken.amount, 25000);
  assert.equal(spoken.merchant, 'Kopi');

  assert.equal(parseTransactionLocally('bayar kos 1,8 juta tgl 1', TODAY).date, '2026-11-01');
  assert.equal(parseTransactionLocally('bayar kos 1,8 juta tgl 1', TODAY).amount, 1800000);
});

test('without a date the offline parser keeps today', () => {
  assert.equal(parseTransactionLocally('beli kopi 25rb', TODAY).date, TODAY);
});

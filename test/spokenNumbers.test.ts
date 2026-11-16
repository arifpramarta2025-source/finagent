import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTransactionLocally } from '../src/utils/nlpParser.ts';
import { normalizeSpokenNumbers } from '../src/utils/spokenNumbers.ts';

const TODAY = '2026-11-04';
const amountOf = (text: string) => parseTransactionLocally(text, TODAY).amount;

test('amounts said in words become digits', () => {
  const cases: Array<[string, string]> = [
    ['dua puluh lima ribu', '25000'],
    ['lima belas ribu', '15000'],
    ['sebelas ribu', '11000'],
    ['seratus ribu', '100000'],
    ['seribu', '1000'],
    ['sejuta', '1000000'],
    ['tiga ratus lima puluh ribu', '350000'],
    ['dua juta lima ratus ribu', '2500000'],
    ['satu setengah juta', '1500000'],
    ['setengah juta', '500000'],
    ['satu koma lima juta', '1500000'],
    ['seratus dua puluh lima ribu lima ratus', '125500'],
  ];

  for (const [spoken, digits] of cases) {
    assert.equal(normalizeSpokenNumbers(spoken), digits, spoken);
  }
});

test('words around the amount are kept, including a lone quantity', () => {
  assert.equal(
    normalizeSpokenNumbers('Beli dua kopi dua puluh ribu di Kenangan'),
    'Beli dua kopi 20000 di Kenangan'
  );
  assert.equal(normalizeSpokenNumbers('pakai   qris'), 'pakai   qris');
  assert.equal(normalizeSpokenNumbers('beli 25 ribu saja'), 'beli 25 ribu saja');
});

test('the offline parser reads speech-style amounts', () => {
  assert.equal(amountOf('beli kopi dua puluh lima ribu pakai qris'), 25000);
  assert.equal(amountOf('beli dua kopi dua puluh ribu'), 20000);
  assert.equal(amountOf('gaji masuk lima juta'), 5000000);
  assert.equal(amountOf('bayar kontrakan dua juta lima ratus ribu'), 2500000);
  assert.equal(amountOf('bayar kontrakan 2 juta 500 ribu'), 2500000);
  assert.equal(amountOf('beli pulsa 1,5 juta'), 1500000);
});

test('a quantity before a word starting with k is not read as thousands', () => {
  assert.equal(amountOf('beli 2 kopi 25 ribu'), 25000);
  assert.equal(amountOf('beli 3 kue 30rb'), 30000);
  assert.equal(amountOf('jajan 50k'), 50000);
});

test('typed formats still work', () => {
  assert.equal(amountOf('Makan siang sate padang 35.000 bayar tunai'), 35000);
  assert.equal(amountOf('Gaji freelance landing page masuk 3.5jt transfer bca'), 3500000);
  assert.equal(amountOf('Isi bensin pertamax di spbu 150000 pake kartu debit'), 150000);
  assert.equal(amountOf('Beli vitamin dan obat flu di apotek k-24 65rb'), 65000);
});

test('merchant names survive cleaning', () => {
  assert.equal(
    parseTransactionLocally('beli sabun di indomaret 25rb', TODAY).merchant,
    'Sabun Indomaret'
  );
  assert.equal(
    parseTransactionLocally('beli kopi kenangan dua puluh lima ribu pakai qris', TODAY).merchant,
    'Kopi Kenangan'
  );
});

test('the original sentence stays in the notes', () => {
  const spoken = 'beli kopi dua puluh lima ribu';
  assert.equal(parseTransactionLocally(spoken, TODAY).notes, spoken);
});

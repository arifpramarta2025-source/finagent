import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseChatText } from '../src/utils/chatText.ts';

test('bold markers are removed and marked', () => {
  assert.deepEqual(parseChatText('Halo **Finn** ya')[0].parts, [
    { text: 'Halo ', isBold: false },
    { text: 'Finn', isBold: true },
    { text: ' ya', isBold: false },
  ]);
});

test('bullets lose their marker, for both styles', () => {
  const [star, dash, plain] = parseChatText('* satu\n- **dua**\nbiasa');

  assert.equal(star.isBullet, true);
  assert.equal(star.parts[0].text, 'satu');
  assert.deepEqual(dash.parts, [{ text: 'dua', isBold: true }]);
  assert.equal(plain.isBullet, false);
});

test('a marker still arriving mid-stream stays readable', () => {
  assert.deepEqual(parseChatText('Total **Rp 5')[0].parts, [
    { text: 'Total **Rp 5', isBold: false },
  ]);
});

test('blank lines are kept as paragraph breaks', () => {
  assert.equal(parseChatText('a\n\nb')[1].parts.length, 0);
});

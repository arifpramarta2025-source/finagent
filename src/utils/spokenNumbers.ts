/**
 * Turns money amounts said in words into digits, so the offline parser can read speech:
 * "dua puluh lima ribu" becomes "25000". A lone "dua" stays a word, because in
 * "beli dua kopi" it is a quantity rather than an amount.
 */

const DIGITS: Record<string, number> = {
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
};

const SCALES: Record<string, number> = { ribu: 1_000, rb: 1_000, juta: 1_000_000, jt: 1_000_000 };
const ONE_WORD_GROUPS: Record<string, number> = { sepuluh: 10, sebelas: 11, seratus: 100 };
const ONE_WORD_SCALES: Record<string, number> = { seribu: 1_000, sejuta: 1_000_000 };
const CONNECTORS = new Set(['puluh', 'belas', 'ratus', 'setengah', 'koma']);

function isNumberWord(word: string): boolean {
  return (
    word in DIGITS ||
    word in SCALES ||
    word in ONE_WORD_GROUPS ||
    word in ONE_WORD_SCALES ||
    CONNECTORS.has(word)
  );
}

function hasMagnitude(words: string[]): boolean {
  return words.some((word) => !(word in DIGITS) && word !== 'koma');
}

function wordsToNumber(words: string[]): number {
  let total = 0;
  let group = 0;
  let digit = 0;

  const closeScale = (scale: number) => {
    total += (group + digit || 1) * scale;
    group = 0;
    digit = 0;
  };

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word in DIGITS) {
      digit = DIGITS[word];
    } else if (word === 'puluh') {
      group += digit * 10;
      digit = 0;
    } else if (word === 'belas') {
      group += digit + 10;
      digit = 0;
    } else if (word === 'ratus') {
      group += digit * 100;
      digit = 0;
    } else if (word === 'setengah') {
      digit += 0.5;
    } else if (word === 'koma') {
      digit += (DIGITS[words[index + 1]] ?? 0) / 10;
      index += 1;
    } else if (word in ONE_WORD_GROUPS) {
      group += ONE_WORD_GROUPS[word];
    } else if (word in ONE_WORD_SCALES) {
      closeScale(ONE_WORD_SCALES[word]);
    } else if (word in SCALES) {
      closeScale(SCALES[word]);
    }
  }

  return Math.round(total + group + digit);
}

export function normalizeSpokenNumbers(text: string): string {
  const parts = text.split(/(\s+)/);
  const output: string[] = [];
  let run: string[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    const words = run.filter((part) => part.trim()).map((part) => part.toLowerCase());
    output.push(hasMagnitude(words) ? String(wordsToNumber(words)) : run.join(''));
    run = [];
  };

  for (const part of parts) {
    const isSpace = !part.trim();
    const word = part.toLowerCase();
    // A leading "ribu" belongs to digits before it, as in "25 ribu".
    const startsWithScale = run.length === 0 && word in SCALES;
    if (!isSpace && isNumberWord(word) && !startsWithScale) {
      run.push(part);
    } else if (isSpace && run.length > 0) {
      run.push(part);
    } else {
      const trailingSpace = run.length > 0 && !run[run.length - 1].trim() ? run.pop() : '';
      flushRun();
      if (trailingSpace) output.push(trailingSpace);
      output.push(part);
    }
  }

  const trailingSpace = run.length > 0 && !run[run.length - 1].trim() ? run.pop() : '';
  flushRun();
  if (trailingSpace) output.push(trailingSpace);
  return output.join('');
}

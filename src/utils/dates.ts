/**
 * Reads transaction dates in the forms people write and receipts print. Every result is a
 * YYYY-MM-DD string, or null when no real date could be found. Nothing here guesses today.
 * The server imports this file, so local imports keep their .ts extension.
 */

const MONTHS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  peb: 2,
  pebruari: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  agus: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oct: 10,
  oktober: 10,
  october: 10,
  nov: 11,
  nop: 11,
  november: 11,
  nopember: 11,
  des: 12,
  dec: 12,
  desember: 12,
  december: 12,
};

const WEEKDAYS: Record<string, number> = {
  minggu: 0,
  ahad: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  sabtu: 6,
};

const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toIso(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  const isReal =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isReal && year >= 2000 && year <= 2100 ? `${year}-${pad(month)}-${pad(day)}` : null;
}

function fullYear(year: string): number {
  const value = Number(year);
  return year.length <= 2 ? 2000 + value : value;
}

function parseToday(today: string): Date {
  const [year, month, day] = today.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDays(today: string, days: number): string {
  const date = parseToday(today);
  date.setDate(date.getDate() + days);
  return toIso(date.getFullYear(), date.getMonth() + 1, date.getDate())!;
}

/** A date without a year or month means the most recent one, never a future date. */
function latestOnOrBefore(today: string, day: number, month?: number): string | null {
  const now = parseToday(today);
  const year = now.getFullYear();
  if (month !== undefined) {
    const thisYear = toIso(year, month, day);
    return thisYear && thisYear <= today ? thisYear : toIso(year - 1, month, day);
  }
  const thisMonth = toIso(year, now.getMonth() + 1, day);
  if (thisMonth && thisMonth <= today) return thisMonth;
  const previous = new Date(year, now.getMonth() - 1, 1);
  return toIso(previous.getFullYear(), previous.getMonth() + 1, day);
}

/** Normalises a date written by Gemini or printed on a receipt. Indonesian order is day first. */
export function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return toIso(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
  if (match) return toIso(fullYear(match[3]), Number(match[2]), Number(match[1]));

  match = text.match(
    new RegExp(`^(\\d{1,2})[\\s-]*(${MONTH_PATTERN})\\.?[\\s-]*(\\d{2}|\\d{4})\\b`)
  );
  if (match) return toIso(fullYear(match[3]), MONTHS[match[2]], Number(match[1]));

  return null;
}

export interface FoundDate {
  date: string;
  /** The sentence without the date words, so they are not read as an amount or a merchant. */
  rest: string;
}

/** Finds a date mentioned in a sentence such as "beli kopi kemarin" or "tanggal 3 november". */
export function findDateInText(text: string, today: string): FoundDate | null {
  const lower = text.toLowerCase();
  const take = (match: RegExpMatchArray, date: string | null): FoundDate | null =>
    date
      ? {
          date,
          rest: (text.slice(0, match.index) + ' ' + text.slice(match.index! + match[0].length))
            .replace(/\s+/g, ' ')
            .trim(),
        }
      : null;

  const rules: Array<[RegExp, (match: RegExpMatchArray) => string | null]> = [
    [
      /\b(?:pada\s+)?(?:tanggal|tgl\.?)?\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/,
      (m) => toIso(fullYear(m[3]), Number(m[2]), Number(m[1])),
    ],
    [
      new RegExp(
        `\\b(?:pada\\s+)?(?:tanggal|tgl\\.?)?\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})\\.?(?:\\s+(\\d{4}))?\\b`
      ),
      (m) =>
        m[3]
          ? toIso(Number(m[3]), MONTHS[m[2]], Number(m[1]))
          : latestOnOrBefore(today, Number(m[1]), MONTHS[m[2]]),
    ],
    [
      /\b(?:pada\s+)?(?:tanggal|tgl\.?)\s*(\d{1,2})[/.-](\d{1,2})\b/,
      (m) => latestOnOrBefore(today, Number(m[1]), Number(m[2])),
    ],
    [
      /\b(?:pada\s+)?(?:tanggal|tgl\.?)\s*(\d{1,2})\b/,
      (m) => latestOnOrBefore(today, Number(m[1])),
    ],
    [
      /\b(?:hari\s+)?(minggu|ahad|senin|selasa|rabu|kamis|jum'?at|sabtu)\s+(?:kemarin|lalu|kemaren)\b/,
      (m) => {
        const target = WEEKDAYS[m[1].replace("'", '')] ?? WEEKDAYS[m[1]];
        const back = (parseToday(today).getDay() - target + 7) % 7 || 7;
        return shiftDays(today, -back);
      },
    ],
    [/\bkemarin\s+lusa\b/, () => shiftDays(today, -2)],
    [/\b(\d{1,2})\s+hari\s+(?:yang\s+)?(?:lalu|kemarin)\b/, (m) => shiftDays(today, -Number(m[1]))],
    [/\b(?:kemarin|kemaren|kmrn|kmarin)\b/, () => shiftDays(today, -1)],
    [/\b(?:hari\s+ini|barusan|tadi)\b/, () => today],
  ];

  for (const [pattern, toDate] of rules) {
    const match = lower.match(pattern);
    if (match) {
      const found = take(match, toDate(match));
      if (found) return found;
    }
  }
  return null;
}

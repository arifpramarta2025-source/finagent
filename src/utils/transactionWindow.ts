import { Transaction } from '../types';
import { getLocalDateString } from './constants';

/** Months kept live on open, counting the current month. */
export const RECENT_MONTHS = 3;

/** First day of the month that is monthsBack before the given month. */
export function monthStart(date: Date, monthsBack: number): string {
  return getLocalDateString(new Date(date.getFullYear(), date.getMonth() - monthsBack, 1));
}

export function shiftMonthStart(start: string, monthsBack: number): string {
  const [year, month] = start.split('-').map(Number);
  return monthStart(new Date(year, month - 1, 1), monthsBack);
}

/** The live list wins when one record appears in both lists. */
export function mergeTransactions(recent: Transaction[], older: Transaction[]): Transaction[] {
  const recentIds = new Set(recent.map((tx) => tx.id));
  return [...recent, ...older.filter((tx) => !recentIds.has(tx.id))];
}

/** The live listener does not see these dates, so the loaded history must be refreshed. */
export function touchesOlderHistory(
  dates: Array<string | undefined>,
  windowStart: string
): boolean {
  return dates.some((date) => date !== undefined && date < windowStart);
}

export function formatMonthYear(start: string): string {
  const [year, month] = start.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
}

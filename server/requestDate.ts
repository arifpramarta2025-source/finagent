import { getLocalDateString } from '../src/utils/constants.ts';
import { normalizeDate } from '../src/utils/dates.ts';

/** Only a plain YYYY-MM-DD from the browser reaches a prompt. */
export function readCurrentDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && normalizeDate(value)
    ? value
    : getLocalDateString();
}

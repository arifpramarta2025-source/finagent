import { useCallback, useEffect, useRef, useState } from 'react';
import { countOlderTransactions, fetchOlderTransactions } from '../services/firestoreService';
import { Transaction } from '../types';
import { RECENT_MONTHS, shiftMonthStart } from '../utils/transactionWindow';

const ALL_HISTORY = '';

/** History before the live window, read only when asked for. */
export function useOlderTransactions(userId: string | null, windowStart: string) {
  const [older, setOlder] = useState<Transaction[]>([]);
  const [olderCount, setOlderCount] = useState<number | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<string>(windowStart);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refreshCount = useCallback(async () => {
    if (!userId) return;
    try {
      setOlderCount(await countOlderTransactions(userId, windowStart));
    } catch (err) {
      console.error('Failed counting older transactions:', err);
      setOlderCount(null); // The screen then offers loading history instead of claiming a number.
    }
  }, [userId, windowStart]);

  const load = useCallback(
    async (from: string) => {
      if (!userId) return;
      const request = ++requestId.current;
      setIsLoading(true);
      setError(null);

      try {
        const rows = await fetchOlderTransactions(userId, from, windowStart);
        if (request === requestId.current) {
          setOlder(rows);
          setLoadedFrom(from);
        }
      } catch (err) {
        console.error('Failed loading older transactions:', err);
        if (request === requestId.current) {
          setError('Riwayat lama gagal dimuat. Periksa koneksi lalu coba lagi.');
        }
      } finally {
        if (request === requestId.current) {
          setIsLoading(false);
        }
      }
    },
    [userId, windowStart]
  );

  useEffect(() => {
    requestId.current += 1;
    setOlder([]);
    setLoadedFrom(windowStart);
    setError(null);
    setOlderCount(null);
    void refreshCount();
  }, [refreshCount, windowStart]);

  const isAllLoaded = loadedFrom === ALL_HISTORY;

  const loadPrevious = useCallback(
    () => load(shiftMonthStart(loadedFrom, RECENT_MONTHS)),
    [load, loadedFrom]
  );
  const loadAll = useCallback(() => load(ALL_HISTORY), [load]);

  /** Re-reads what is already shown, after a change the live listener cannot see. */
  const refresh = useCallback(async () => {
    await refreshCount();
    if (loadedFrom !== windowStart) {
      await load(loadedFrom);
    }
  }, [load, loadedFrom, refreshCount, windowStart]);

  const unloadedCount =
    olderCount === null ? null : isAllLoaded ? 0 : Math.max(0, olderCount - older.length);

  return {
    older,
    unloadedCount,
    loadedFrom,
    isAllLoaded,
    isLoading,
    error,
    loadPrevious,
    loadAll,
    refresh,
  };
}

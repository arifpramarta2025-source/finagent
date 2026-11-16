import React, { useCallback, useEffect, useState } from 'react';
import { History, Loader2, ShieldCheck } from 'lucide-react';
import {
  ActivityPage,
  fetchActivityPage,
  isActivityLogEnabled,
} from '../services/firestoreService';
import { ActivityEntry } from '../utils/activityLog';

interface ActivityLogViewProps {
  ledgerId: string;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Read only when opened, so the log costs no reads on a normal app open. */
export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ ledgerId }) => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [cursor, setCursor] = useState<ActivityPage['cursor']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (after: ActivityPage['cursor']) => {
      setIsLoading(true);
      setError(null);
      try {
        const page = await fetchActivityPage(ledgerId, after);
        setEntries((current) => (after ? [...current, ...page.entries] : page.entries));
        setCursor(page.cursor);
      } catch (err) {
        console.error('Failed loading activity log:', err);
        setError('Log gagal dimuat. Periksa koneksi lalu coba lagi.');
      } finally {
        setIsLoading(false);
      }
    },
    [ledgerId]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <div className="p-4 md:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-600" />
          Log Aktivitas
        </h3>
        <p className="mt-1 text-xs text-slate-500 flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Siapa mengubah apa. Log tidak bisa diedit atau dihapus dari aplikasi.</span>
        </p>
      </div>

      {!isActivityLogEnabled() && (
        <p
          role="alert"
          className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800"
        >
          Log belum aktif karena rules Firestore belum diperbarui.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700"
        >
          {error}
        </p>
      )}

      <ul className="divide-y divide-slate-100">
        {entries.map((entry) => (
          <li key={entry.id} className="py-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-slate-800 break-words">
                <strong className="text-slate-900">{entry.actorName}</strong> {entry.summary}
              </p>
              <time className="shrink-0 text-[11px] text-slate-400">{formatTime(entry.at)}</time>
            </div>
            {entry.changes && entry.changes.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] text-slate-500">
                  {entry.changes.length} rincian
                </summary>
                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                  {entry.changes.map((change) => (
                    <li key={change.label} className="break-words">
                      <span className="font-medium">{change.label}:</span>{' '}
                      {entry.action === 'add'
                        ? change.to
                        : entry.action === 'delete'
                          ? change.from
                          : `${change.from} → ${change.to}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>

      {!isLoading && entries.length === 0 && !error && (
        <p className="py-6 text-center text-xs text-slate-400">Belum ada aktivitas tercatat.</p>
      )}
      {isLoading && <Loader2 className="w-4 h-4 mx-auto animate-spin text-slate-400" />}
      {!isLoading && cursor && (
        <button
          type="button"
          onClick={() => load(cursor)}
          className="w-full py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          Muat Log Lebih Lama
        </button>
      )}
    </div>
  );
};

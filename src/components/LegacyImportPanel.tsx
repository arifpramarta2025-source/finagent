import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { applyRestoreWrites, fetchAllUserDocs, recordActivity } from '../services/firestoreService';
import { BackupDoc } from '../utils/backup';
import {
  clearLegacyBrowserData,
  inspectLegacyBrowserData,
  planLegacyImport,
  readLegacyBudget,
} from '../utils/legacyData';

interface LegacyImportPanelProps {
  userId: string;
  onDataChanged: () => Promise<void>;
}

interface StoredSnapshot {
  transactions: BackupDoc[];
  hasBudget: boolean;
}

export const LegacyImportPanel: React.FC<LegacyImportPanelProps> = ({ userId, onDataChanged }) => {
  const [legacy, setLegacy] = useState(inspectLegacyBrowserData);
  const [stored, setStored] = useState<StoredSnapshot | null>(null);
  const [includeSamples, setIncludeSamples] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isCleared, setIsCleared] = useState(false);

  const plan = useMemo(
    () =>
      stored
        ? planLegacyImport(legacy.rows, stored.transactions, {
            userId,
            includeSamples,
            storedBudgetExists: stored.hasBudget,
            legacyBudget: readLegacyBudget(),
          })
        : null,
    [stored, legacy.rows, includeSamples, userId]
  );

  const hasLegacyData = legacy.rows.length > 0 || legacy.hasBudget || legacy.isUnreadable;

  if (isCleared) {
    return (
      <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
        <Check className="w-4 h-4" />
        Data lama sudah dihapus dari browser ini.
      </p>
    );
  }
  if (!hasLegacyData) return null;

  const refreshStored = async () => {
    const docs = await fetchAllUserDocs(userId);
    setStored({
      transactions: docs.transactions,
      hasBudget: docs.settings.some((item) => item.id === 'budget'),
    });
  };

  const handleCheck = async () => {
    setBusy(true);
    setError(null);
    try {
      await refreshStored();
    } catch (err: any) {
      console.error('Failed checking legacy data:', err);
      setError('Data gagal diperiksa. Periksa koneksi lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!plan || plan.writes.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await recordActivity(userId, {
        action: 'import',
        summary: `Mengimpor ${plan.transactionCount} transaksi lama dari browser`,
      });
      await applyRestoreWrites(userId, plan.writes, () => {});
      setDone(`${plan.transactionCount} transaksi lama berhasil diimpor.`);
      await refreshStored();
      await onDataChanged();
    } catch (err: any) {
      console.error('Failed importing legacy data:', err);
      setError(
        `${err?.message || 'Impor terhenti.'} Jalankan lagi, data yang sudah masuk tidak terduplikasi.`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    const confirmed = window.confirm(
      'Hapus data lama dari browser ini? Data di Firestore tidak berubah, tetapi data lama di browser tidak bisa dikembalikan.'
    );
    if (!confirmed) return;
    try {
      clearLegacyBrowserData();
      setLegacy(inspectLegacyBrowserData());
      setIsCleared(true);
    } catch (err) {
      console.error('Failed clearing legacy data:', err);
      setError('Data lama gagal dihapus dari browser.');
    }
  };

  const canClear = legacy.isUnreadable || (plan !== null && plan.writes.length === 0);

  return (
    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="space-y-2 min-w-0">
        <p className="font-semibold">Browser ini masih menyimpan data versi lama</p>
        {legacy.isUnreadable ? (
          <p>Data transaksi lama ada, tetapi tidak bisa dibaca.</p>
        ) : (
          <p>
            {legacy.rows.length} transaksi lama, {legacy.sampleCount} di antaranya data contoh
            {legacy.hasBudget ? ', ditambah pengaturan anggaran lama' : ''}.
          </p>
        )}

        {plan && (
          <ul className="list-disc pl-4 space-y-0.5">
            <li>{plan.transactionCount} transaksi akan diimpor</li>
            <li>{plan.duplicateCount} sudah ada di Fina, dilewati</li>
            {plan.sampleCount > 0 && <li>{plan.sampleCount} data contoh, dilewati</li>}
            {plan.invalidCount > 0 && <li>{plan.invalidCount} baris rusak, dilewati</li>}
            {plan.importsBudget && <li>Anggaran lama dipakai karena belum ada anggaran</li>}
          </ul>
        )}

        {plan && legacy.sampleCount > 0 && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={includeSamples}
              onChange={(e) => setIncludeSamples(e.target.checked)}
              className="mt-0.5"
            />
            <span>Ikut impor baris yang terdeteksi sebagai data contoh</span>
          </label>
        )}

        {done && <p className="font-medium">{done}</p>}
        {error && (
          <p role="alert" className="text-rose-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!plan && !legacy.isUnreadable && (
            <button
              type="button"
              onClick={handleCheck}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-800 bg-white border border-amber-300 rounded-lg disabled:opacity-60"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Periksa Duplikasi
            </button>
          )}

          {plan && plan.writes.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Impor {plan.writes.length} Data
            </button>
          )}

          {canClear && (
            <button
              type="button"
              onClick={handleClear}
              disabled={busy}
              className="px-3 py-1.5 font-medium text-rose-700 bg-white border border-rose-200 rounded-lg disabled:opacity-60"
            >
              Hapus Data Lama dari Browser
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

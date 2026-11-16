import React, { useMemo, useRef, useState } from 'react';
import { Check, DatabaseBackup, Download, Loader2, Upload } from 'lucide-react';
import { applyRestoreWrites, fetchAllUserDocs, recordActivity } from '../services/firestoreService';
import { auth } from '../services/firebase';
import { chatDocumentId, findMember } from '../utils/members';
import {
  FinaBackup,
  RestorePlan,
  buildBackup,
  buildRestoreWrites,
  countReceipts,
  parseBackup,
  planRestore,
  withoutOtherChats,
} from '../utils/backup';
import { getLocalDateString } from '../utils/constants';
import { LegacyImportPanel } from './LegacyImportPanel';

const LAST_BACKUP_KEY = 'fina_last_backup_at';

interface BackupPanelProps {
  userId: string;
  onDataChanged: () => Promise<void>;
}

function readLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

function rememberLastBackup(value: string): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, value);
  } catch {
    // Only a reminder for this device; the backup itself is already downloaded.
  }
}

function downloadJson(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatBackupDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'tanggal tidak diketahui'
    : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export const BackupPanel: React.FC<BackupPanelProps> = ({ userId, onDataChanged }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(readLastBackup);
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'backup' | 'reading' | 'restoring' | null>(null);

  const [pending, setPending] = useState<{ backup: FinaBackup; plan: RestorePlan } | null>(null);
  const [overwriteTransactions, setOverwriteTransactions] = useState(false);
  const [overwriteSettings, setOverwriteSettings] = useState(false);
  const [restoredCount, setRestoredCount] = useState(0);
  const [restoreDone, setRestoreDone] = useState<string | null>(null);

  const writes = useMemo(
    () =>
      pending
        ? buildRestoreWrites(pending.plan, { overwriteTransactions, overwriteSettings }, userId)
        : [],
    [pending, overwriteTransactions, overwriteSettings, userId]
  );

  const handleBackup = async () => {
    setBusy('backup');
    setError(null);
    setBackupNote(null);

    try {
      const backup = buildBackup(await fetchAllUserDocs(userId));
      downloadJson(JSON.stringify(backup), `FINA_Cadangan_${getLocalDateString()}.json`);
      rememberLastBackup(backup.exportedAt);
      setLastBackup(backup.exportedAt);
      setBackupNote(
        `Tersimpan: ${backup.transactions.length} transaksi dan ${countReceipts(backup.settings)} foto struk.`
      );
    } catch (err: any) {
      console.error('Failed creating backup:', err);
      setError(
        'Cadangan gagal dibuat, tidak ada file yang diunduh. Periksa koneksi lalu coba lagi.'
      );
    } finally {
      setBusy(null);
    }
  };

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // Lets the same file be chosen again after a failed attempt.
    if (!file) return;

    setBusy('reading');
    setError(null);
    setPending(null);
    setRestoreDone(null);
    setOverwriteTransactions(false);
    setOverwriteSettings(false);

    try {
      const member = findMember(auth.currentUser?.email);
      const backup = withoutOtherChats(
        parseBackup(await file.text()),
        member && auth.currentUser ? chatDocumentId(member, auth.currentUser.uid) : 'chat'
      );
      const stored = await fetchAllUserDocs(
        userId,
        backup.settings.map((item) => item.id)
      );
      const plan = planRestore(backup, stored);
      setPending({ backup, plan });
    } catch (err: any) {
      console.error('Failed reading backup:', err);
      setError(err?.message || 'File cadangan gagal dibaca.');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!pending || writes.length === 0) return;

    setBusy('restoring');
    setError(null);
    setRestoredCount(0);

    try {
      await recordActivity(userId, {
        action: 'restore',
        summary: `Memulihkan ${writes.length} data dari file cadangan`,
      });
      await applyRestoreWrites(userId, writes, setRestoredCount);
      setRestoreDone(`${writes.length} data berhasil dipulihkan.`);
      setPending(null);
      await onDataChanged();
    } catch (err: any) {
      console.error('Failed restoring backup:', err);
      setError(
        `${err?.message || 'Pemulihan terhenti.'} Data yang sudah masuk tetap aman. Pilih file yang sama lagi untuk melanjutkan.`
      );
      setPending(null);
    } finally {
      setBusy(null);
    }
  };

  const plan = pending?.plan;

  return (
    <section
      aria-labelledby="backup-heading"
      className="max-w-4xl mx-auto p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4"
    >
      <div>
        <h3
          id="backup-heading"
          className="text-sm font-bold text-slate-900 flex items-center gap-2"
        >
          <DatabaseBackup className="w-4 h-4 text-emerald-600" />
          Cadangan Data
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          File berisi transaksi, anggaran, foto struk, chat, dan audit. File ini tidak dikunci kata
          sandi, jadi simpan di tempat pribadi.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleBackup}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-xl transition-colors"
        >
          {busy === 'backup' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>{busy === 'backup' ? 'Menyiapkan...' : 'Unduh Cadangan'}</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-xl transition-colors"
        >
          {busy === 'reading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          <span>{busy === 'reading' ? 'Membaca...' : 'Pulihkan dari File'}</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChosen}
          className="hidden"
          aria-label="Pilih file cadangan"
        />

        <span className="text-[11px] text-slate-500">
          {lastBackup
            ? `Cadangan terakhir di perangkat ini: ${formatBackupDate(lastBackup)}`
            : 'Belum ada cadangan dari perangkat ini'}
        </span>
      </div>

      {backupNote && (
        <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
          <Check className="w-4 h-4" />
          {backupNote}
        </p>
      )}

      {restoreDone && (
        <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
          <Check className="w-4 h-4" />
          {restoreDone}
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

      {pending && plan && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">
            Pratinjau cadangan {formatBackupDate(pending.backup.exportedAt)}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-4 font-medium">Jenis</th>
                  <th className="py-1 pr-4 font-medium">Baru</th>
                  <th className="py-1 pr-4 font-medium">Sudah sama</th>
                  <th className="py-1 font-medium">Berbeda</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-4">Transaksi</td>
                  <td className="py-1 pr-4">{plan.transactions.toAdd.length}</td>
                  <td className="py-1 pr-4">{plan.transactions.unchanged.length}</td>
                  <td className="py-1">{plan.transactions.different.length}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4">Struk, anggaran, chat, audit</td>
                  <td className="py-1 pr-4">{plan.settings.toAdd.length}</td>
                  <td className="py-1 pr-4">{plan.settings.unchanged.length}</td>
                  <td className="py-1">{plan.settings.different.length}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {plan.transactions.different.length > 0 && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={overwriteTransactions}
                onChange={(e) => setOverwriteTransactions(e.target.checked)}
                className="mt-0.5 accent-rose-600"
              />
              <span>
                Timpa {plan.transactions.different.length} transaksi yang berbeda dengan versi
                cadangan. Versi sekarang akan hilang.
              </span>
            </label>
          )}

          {plan.settings.different.length > 0 && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={overwriteSettings}
                onChange={(e) => setOverwriteSettings(e.target.checked)}
                className="mt-0.5 accent-rose-600"
              />
              <span>
                Timpa {plan.settings.different.length} data struk, anggaran, chat, atau audit yang
                berbeda. Versi sekarang akan hilang.
              </span>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRestore}
              disabled={busy !== null || writes.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-xl transition-colors"
            >
              {busy === 'restoring' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {busy === 'restoring'
                  ? `Memulihkan ${restoredCount}/${writes.length}...`
                  : writes.length === 0
                    ? 'Tidak ada yang perlu dipulihkan'
                    : `Pulihkan ${writes.length} data`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={busy !== null}
              className="px-3.5 py-2 font-medium text-slate-600 hover:text-slate-800 rounded-xl transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <LegacyImportPanel userId={userId} onDataChanged={onDataChanged} />
    </section>
  );
};

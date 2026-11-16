import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Tags,
} from 'lucide-react';
import {
  confirmWrite,
  fetchEveryTransaction,
  recordActivity,
  saveCategoryConfig,
  updateTransactionsInBatches,
} from '../services/firestoreService';
import { useCategories } from '../hooks/useCategories';
import {
  CategoryConfig,
  CategoryType,
  MAX_NAME_LENGTH,
  NameChange,
  addCategory,
  addSubCategory,
  applyNameChange,
  changedFields,
  findAffectedTransactionIds,
  isLockedCategory,
  prepareCategoryRename,
  prepareSubCategoryRename,
  setCategoryHidden,
  setSubCategoryHidden,
} from '../utils/categories';

interface CategorySettingsPanelProps {
  userId: string;
  canEdit: boolean;
  onDataChanged: () => Promise<void>;
}

interface RenameTarget {
  from: string;
  category?: string; // Set when renaming a subcategory.
}

const ICON_BUTTON =
  'w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50';
const TEXT_INPUT =
  'min-w-0 flex-1 px-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500';
const SMALL_BUTTON =
  'shrink-0 px-3 py-2 text-xs font-semibold rounded-xl transition-colors disabled:opacity-60';

export const CategorySettingsPanel: React.FC<CategorySettingsPanelProps> = ({
  userId,
  canEdit,
  onDataChanged,
}) => {
  const config = useCategories();
  const [type, setType] = useState<CategoryType>('expense');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [renaming, setRenaming] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [preview, setPreview] = useState<{ change: NameChange; ids: string[] } | null>(null);
  const [progress, setProgress] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err: any) {
      console.error('Failed updating categories:', err);
      setError(err?.message || 'Perubahan gagal disimpan. Silakan coba lagi.');
    } finally {
      setIsBusy(false);
    }
  };

  const save = (next: CategoryConfig, summary: string) =>
    confirmWrite(() => saveCategoryConfig(userId, next, summary));

  const closeRename = () => {
    setRenaming(null);
    setRenameValue('');
    setPreview(null);
  };

  const startRename = (target: RenameTarget) => {
    setRenaming(target);
    setRenameValue(target.from);
    setPreview(null);
    setError(null);
    setNotice(null);
  };

  const finishRename = async (change: NameChange, count: number) => {
    await save(
      applyNameChange(config, change),
      `Mengganti nama ${change.kind === 'category' ? 'kategori' : 'subkategori'} "${change.from}" menjadi "${change.to}" (${count} transaksi ikut berubah)`
    );
    await onDataChanged();
    closeRename();
    if (change.kind === 'category' && expanded === change.from) {
      setExpanded(change.to);
    }
    setNotice(`"${change.from}" menjadi "${change.to}". ${count} transaksi ikut diperbarui.`);
  };

  const handleCheckRename = () =>
    run(async () => {
      if (!renaming) return;
      if (renameValue.trim() === renaming.from) {
        closeRename();
        return;
      }

      const change = renaming.category
        ? prepareSubCategoryRename(config, type, renaming.category, renaming.from, renameValue)
        : prepareCategoryRename(config, type, renaming.from, renameValue);

      // Reads the full history so transactions outside the live window are included.
      const ids = findAffectedTransactionIds(await fetchEveryTransaction(userId), change);
      if (ids.length === 0) {
        await finishRename(change, 0);
      } else {
        setPreview({ change, ids });
      }
    });

  const handleApplyRename = () =>
    run(async () => {
      if (!preview) return;
      setProgress(0);
      await recordActivity(userId, {
        action: 'category',
        summary: `Memulai ganti nama "${preview.change.from}" menjadi "${preview.change.to}" untuk ${preview.ids.length} transaksi`,
      });
      try {
        // Transactions go first. If this stops midway, repeating the rename finishes the rest.
        await updateTransactionsInBatches(
          userId,
          preview.ids,
          changedFields(preview.change),
          setProgress
        );
      } catch (err: any) {
        await onDataChanged();
        closeRename();
        throw new Error(
          `${err?.message || 'Pembaruan terhenti.'} Ulangi ganti nama yang sama untuk menyelesaikan sisanya.`
        );
      }
      await finishRename(preview.change, preview.ids.length);
    });

  const handleAddCategory = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async () => {
      await save(
        addCategory(config, type, newCategory),
        `Menambah kategori "${newCategory.trim()}"`
      );
      setNewCategory('');
    });
  };

  const handleAddSubCategory = (event: React.FormEvent, category: string) => {
    event.preventDefault();
    return run(async () => {
      await save(
        addSubCategory(config, type, category, newSubCategory),
        `Menambah subkategori "${newSubCategory.trim()}" di "${category}"`
      );
      setNewSubCategory('');
    });
  };

  const renderRenameForm = () => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleCheckRename();
      }}
      className="flex flex-wrap items-center gap-2 py-2"
    >
      <input
        value={renameValue}
        onChange={(event) => setRenameValue(event.target.value)}
        maxLength={MAX_NAME_LENGTH}
        aria-label={`Nama baru untuk ${renaming?.from}`}
        autoFocus
        disabled={isBusy || preview !== null}
        className={TEXT_INPUT}
      />
      {!preview && (
        <>
          <button
            type="submit"
            disabled={isBusy}
            className={`${SMALL_BUTTON} text-white bg-slate-900 hover:bg-slate-800`}
          >
            {isBusy ? 'Memeriksa...' : 'Lanjut'}
          </button>
          <button
            type="button"
            onClick={closeRename}
            disabled={isBusy}
            className={`${SMALL_BUTTON} text-slate-600 bg-slate-100 hover:bg-slate-200`}
          >
            Batal
          </button>
        </>
      )}

      {preview && (
        <div className="w-full p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
          <p className="flex items-start gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {preview.ids.length} transaksi akan diubah dari "{preview.change.from}" ke "
              {preview.change.to}".
            </span>
          </p>
          <p>Perubahan massal ini tidak punya tombol batal. Unduh cadangan dulu di bagian bawah.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApplyRename}
              disabled={isBusy}
              className={`${SMALL_BUTTON} flex items-center gap-1.5 text-white bg-emerald-600 hover:bg-emerald-700`}
            >
              {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isBusy ? `Memperbarui ${progress}/${preview.ids.length}...` : 'Terapkan'}
            </button>
            <button
              type="button"
              onClick={closeRename}
              disabled={isBusy}
              className={`${SMALL_BUTTON} text-slate-700 bg-white border border-amber-300`}
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </form>
  );

  return (
    <section
      aria-labelledby="category-heading"
      className="max-w-4xl mx-auto p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4"
    >
      <div>
        <h3
          id="category-heading"
          className="text-sm font-bold text-slate-900 flex items-center gap-2"
        >
          <Tags className="w-4 h-4 text-emerald-600" />
          Kategori
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Kategori yang disembunyikan hilang dari pilihan baru, sedangkan transaksi lamanya tetap
          utuh. Ganti nama ikut memperbarui transaksi lama.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Jenis kategori"
        className="inline-flex p-1 rounded-xl bg-slate-100"
      >
        {(['expense', 'income'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={type === option}
            onClick={() => {
              setType(option);
              setExpanded(null);
              closeRename();
              setError(null);
              setNotice(null);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              type === option ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            {option === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
          </button>
        ))}
      </div>

      {!canEdit && (
        <p
          role="alert"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700"
        >
          Kategori gagal dimuat, jadi pengubahan dimatikan agar daftar Anda tidak tertimpa. Muat
          ulang halaman.
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
      {notice && <p className="text-xs font-medium text-emerald-700">{notice}</p>}

      <ul className="divide-y divide-slate-100">
        {config[type].map((entry) => {
          const isExpanded = expanded === entry.name;
          const isLocked = isLockedCategory(type, entry.name);
          const isRenaming = renaming?.from === entry.name && !renaming.category;
          const Chevron = isExpanded ? ChevronDown : ChevronRight;

          return (
            <li key={entry.name} className="py-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(isExpanded ? null : entry.name);
                    setNewSubCategory('');
                  }}
                  aria-expanded={isExpanded}
                  className="min-w-0 flex-1 min-h-10 flex items-center gap-2 text-left"
                >
                  <Chevron className="w-4 h-4 shrink-0 text-slate-400" />
                  <span
                    className={`min-w-0 text-xs font-semibold break-words ${
                      entry.hidden ? 'text-slate-400 line-through' : 'text-slate-800'
                    }`}
                  >
                    {entry.name}
                  </span>
                  {entry.subCategories.length > 0 && (
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {entry.subCategories.length} sub
                    </span>
                  )}
                  {isLocked && (
                    <span className="shrink-0 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      Cadangan
                    </span>
                  )}
                </button>

                {!isLocked && (
                  <>
                    <button
                      type="button"
                      onClick={() => startRename({ from: entry.name })}
                      disabled={!canEdit || isBusy}
                      aria-label={`Ganti nama ${entry.name}`}
                      className={ICON_BUTTON}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        run(() =>
                          save(
                            setCategoryHidden(config, type, entry.name, !entry.hidden),
                            `${entry.hidden ? 'Memunculkan' : 'Menyembunyikan'} kategori "${entry.name}"`
                          )
                        )
                      }
                      disabled={!canEdit || isBusy}
                      aria-label={`${entry.hidden ? 'Munculkan' : 'Sembunyikan'} ${entry.name}`}
                      className={ICON_BUTTON}
                    >
                      {entry.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>

              {isRenaming && renderRenameForm()}

              {isExpanded && (
                <div className="ml-6 pl-3 border-l border-slate-100 space-y-1 pb-2">
                  {entry.subCategories.length === 0 && (
                    <p className="py-2 text-xs text-slate-400">Belum ada subkategori.</p>
                  )}

                  <ul>
                    {entry.subCategories.map((item) => (
                      <li key={item.name}>
                        <div className="flex items-center gap-1">
                          <span
                            className={`min-w-0 flex-1 text-xs break-words ${
                              item.hidden ? 'text-slate-400 line-through' : 'text-slate-700'
                            }`}
                          >
                            {item.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => startRename({ from: item.name, category: entry.name })}
                            disabled={!canEdit || isBusy}
                            aria-label={`Ganti nama ${item.name}`}
                            className={ICON_BUTTON}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              run(() =>
                                save(
                                  setSubCategoryHidden(
                                    config,
                                    type,
                                    entry.name,
                                    item.name,
                                    !item.hidden
                                  ),
                                  `${item.hidden ? 'Memunculkan' : 'Menyembunyikan'} subkategori "${item.name}" di "${entry.name}"`
                                )
                              )
                            }
                            disabled={!canEdit || isBusy}
                            aria-label={`${item.hidden ? 'Munculkan' : 'Sembunyikan'} ${item.name}`}
                            className={ICON_BUTTON}
                          >
                            {item.hidden ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {renaming?.from === item.name &&
                          renaming.category === entry.name &&
                          renderRenameForm()}
                      </li>
                    ))}
                  </ul>

                  <form
                    onSubmit={(event) => handleAddSubCategory(event, entry.name)}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      value={newSubCategory}
                      onChange={(event) => setNewSubCategory(event.target.value)}
                      maxLength={MAX_NAME_LENGTH}
                      placeholder="Subkategori baru"
                      aria-label={`Subkategori baru untuk ${entry.name}`}
                      disabled={!canEdit || isBusy}
                      className={TEXT_INPUT}
                    />
                    <button
                      type="submit"
                      disabled={!canEdit || isBusy || !newSubCategory.trim()}
                      aria-label={`Tambah subkategori ke ${entry.name}`}
                      className={`${SMALL_BUTTON} text-slate-700 bg-slate-100 hover:bg-slate-200`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form onSubmit={handleAddCategory} className="flex items-center gap-2">
        <input
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder={`Kategori ${type === 'expense' ? 'pengeluaran' : 'pemasukan'} baru`}
          aria-label="Nama kategori baru"
          disabled={!canEdit || isBusy}
          className={TEXT_INPUT}
        />
        <button
          type="submit"
          disabled={!canEdit || isBusy || !newCategory.trim()}
          className={`${SMALL_BUTTON} text-white bg-slate-900 hover:bg-slate-800`}
        >
          Tambah
        </button>
      </form>
    </section>
  );
};

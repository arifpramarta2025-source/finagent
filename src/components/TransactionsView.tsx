import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  RotateCcw,
  Plus,
  Eye,
  Trash2,
  Edit2,
  Receipt,
  ArrowUpDown,
  Tag,
  CreditCard,
  Calendar,
  History,
  Loader2,
} from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { useCategories } from '../hooks/useCategories';
import { allCategoryNames } from '../utils/categories';
import { formatIDR, formatDateIndo } from '../utils/constants';
import { formatMonthYear } from '../utils/transactionWindow';
import { TransactionCard } from './TransactionCard';
import { ActivityLogView } from './ActivityLogView';
import { MEMBERS, recordedBy } from '../utils/members';

interface TransactionsViewProps {
  transactions: Transaction[];
  onOpenManualModal: (tx?: Transaction) => void;
  onOpenSmartText: () => void;
  onOpenReceiptScanner: () => void;
  onSelectTransactionForDetail: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onResetData: () => void;
  onExportCsv: () => Promise<void>;
  history: {
    unloadedCount: number | null;
    loadedFrom: string;
    isAllLoaded: boolean;
    isLoading: boolean;
    error: string | null;
    loadPrevious: () => Promise<void>;
    loadAll: () => Promise<void>;
  };
  ledgerId: string;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  onOpenManualModal,
  onOpenSmartText,
  onOpenReceiptScanner,
  onSelectTransactionForDetail,
  onDeleteTransaction,
  onResetData,
  onExportCsv,
  history,
  ledgerId,
}) => {
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [recorderFilter, setRecorderFilter] = useState('all');
  const categories = useCategories();
  const [isExporting, setIsExporting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>(
    'date-desc'
  );

  const confirmDelete = (tx: Transaction) => {
    if (window.confirm(`Hapus transaksi "${tx.merchant}" (${formatIDR(tx.amount)})?`)) {
      onDeleteTransaction(tx.id);
    }
  };

  // Filter & Sort Logic
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            tx.merchant.toLowerCase().includes(q) ||
            tx.category.toLowerCase().includes(q) ||
            (tx.notes && tx.notes.toLowerCase().includes(q)) ||
            (tx.subCategory && tx.subCategory.toLowerCase().includes(q));
          if (!matches) return false;
        }

        // Type filter
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

        // Category filter
        if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;

        // Recorder filter
        if (recorderFilter !== 'all' && recordedBy(tx) !== recorderFilter) return false;

        // Classification filter
        if (classificationFilter !== 'all' && tx.budgetClassification !== classificationFilter)
          return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return b.date.localeCompare(a.date);
        if (sortBy === 'date-asc') return a.date.localeCompare(b.date);
        if (sortBy === 'amount-desc') return b.amount - a.amount;
        if (sortBy === 'amount-asc') return a.amount - b.amount;
        return 0;
      });
  }, [
    transactions,
    searchQuery,
    typeFilter,
    categoryFilter,
    classificationFilter,
    recorderFilter,
    sortBy,
  ]);

  // Filtered Totals
  const filteredIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const filteredExpense = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const allCategories = Array.from(
    new Set([...allCategoryNames(categories), ...transactions.map((t) => t.category)])
  );

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Riwayat Transaksi & Buku Kas
            </h2>
            <p className="text-xs text-slate-500">
              Kelola, cari, dan tinjau seluruh rekaman pemasukan dan pengeluaran Anda
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLogOpen(!isLogOpen)}
              aria-pressed={isLogOpen}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>{isLogOpen ? 'Tutup Log' : 'Log Aktivitas'}</span>
            </button>

            <button
              onClick={async () => {
                setIsExporting(true);
                await onExportCsv();
                setIsExporting(false);
              }}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              title="Download seluruh transaksi format CSV"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Ekspor CSV</span>
            </button>

            <button
              onClick={onResetData}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              title="Hapus semua transaksi secara permanen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hapus Semua</span>
            </button>

            <button
              onClick={() => onOpenManualModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baru</span>
            </button>
          </div>
        </div>

        {/* Search & Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari merchant, kategori, atau catatan..."
              className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
            >
              <option value="all">Semua Tipe (Semua)</option>
              <option value="expense">Pengeluaran Saja</option>
              <option value="income">Pemasukan Saja</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
            >
              <option value="all">Semua Kategori</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Recorder Filter */}
          <div>
            <select
              value={recorderFilter}
              onChange={(e) => setRecorderFilter(e.target.value)}
              aria-label="Filter pencatat"
              className="w-full px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
            >
              <option value="all">Semua Pencatat</option>
              {MEMBERS.map((member) => (
                <option key={member.name} value={member.name}>
                  Dicatat {member.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
            >
              <option value="date-desc">Tanggal Terbaru</option>
              <option value="date-asc">Tanggal Terlama</option>
              <option value="amount-desc">Nominal Tertinggi</option>
              <option value="amount-asc">Nominal Terendah</option>
            </select>
          </div>
        </div>

        {/* Filter Summary Counter */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Menampilkan <strong className="text-slate-900">{filteredTransactions.length}</strong>{' '}
            dari {transactions.length} transaksi
          </span>
          <div className="flex items-center gap-3">
            {filteredIncome > 0 && (
              <span className="text-teal-700 font-medium">
                Pemasukan: +{formatIDR(filteredIncome)}
              </span>
            )}
            {filteredExpense > 0 && (
              <span className="text-rose-700 font-medium">
                Pengeluaran: -{formatIDR(filteredExpense)}
              </span>
            )}
          </div>
        </div>
      </div>

      {isLogOpen && <ActivityLogView ledgerId={ledgerId} />}

      {/* Older history is read only on request */}
      {!history.isAllLoaded && history.unloadedCount !== 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <p className="flex items-start gap-2">
            <History className="w-4 h-4 shrink-0 text-slate-400" />
            <span>
              Daftar, filter, dan pencarian mencakup data sejak{' '}
              {formatMonthYear(history.loadedFrom)}.{' '}
              {history.unloadedCount === null
                ? 'Jumlah riwayat lama belum diketahui.'
                : `${history.unloadedCount} transaksi lebih lama belum dimuat.`}
            </span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={history.loadPrevious}
              disabled={history.isLoading}
              className="px-3 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-xl transition-colors"
            >
              {history.isLoading ? 'Memuat...' : 'Muat 3 Bulan Sebelumnya'}
            </button>
            <button
              type="button"
              onClick={history.loadAll}
              disabled={history.isLoading}
              className="px-3 py-2 font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 rounded-xl transition-colors"
            >
              Muat Semua
            </button>
          </div>
        </div>
      )}

      {history.error && (
        <p
          role="alert"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700"
        >
          {history.error}
        </p>
      )}

      {/* Transactions Table */}
      <div className="p-4 md:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Tidak ada transaksi yang cocok dengan filter
            </p>
            <p className="text-xs text-slate-400">
              Coba reset filter atau catat transaksi baru lewat tombol di atas
            </p>
          </div>
        ) : (
          <>
            <ul className="min-[900px]:hidden divide-y divide-slate-100">
              {filteredTransactions.map((tx) => (
                <TransactionCard
                  key={tx.id}
                  tx={tx}
                  onViewDetail={onSelectTransactionForDetail}
                  onEdit={onOpenManualModal}
                  onDelete={confirmDelete}
                />
              ))}
            </ul>

            <div className="hidden min-[900px]:block overflow-x-auto">
              <table className="w-full table-fixed text-left text-xs">
                <colgroup>
                  <col />
                  <col className="w-[24%]" />
                  <col className="w-32" />
                  <col className="w-20" />
                  <col className="w-32" />
                  <col className="w-24" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pr-4">Merchant / Sumber</th>
                    <th className="pb-3 pr-4">Kategori & Alokasi</th>
                    <th className="pb-3 pr-4">Tanggal & Metode</th>
                    <th className="pb-3 pr-4">Dicatat</th>
                    <th className="pb-3 pr-4 text-right">Nominal</th>
                    <th className="pb-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                              tx.type === 'income'
                                ? 'bg-teal-50 text-teal-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 flex flex-wrap items-center gap-x-1.5 break-words">
                              <span className="min-w-0 break-words">{tx.merchant}</span>
                              {(tx.receiptImage || tx.hasReceiptImage) && (
                                <button
                                  onClick={() => onSelectTransactionForDetail(tx)}
                                  title="Lihat struk belanja"
                                  className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 hover:bg-teal-100 flex items-center gap-1"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>Struk</span>
                                </button>
                              )}
                            </div>
                            {tx.notes && (
                              <p
                                className="text-[11px] text-slate-500 line-clamp-2 break-words"
                                title={tx.notes}
                              >
                                {tx.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 pr-4">
                        <div className="text-slate-800 font-medium break-words">{tx.category}</div>
                        <div className="text-[10px] text-slate-400 break-words">
                          {[
                            tx.type === 'expense' ? tx.budgetClassification.toUpperCase() : '',
                            tx.subCategory,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </td>

                      <td className="py-3.5 pr-4 text-slate-600">
                        <div className="whitespace-nowrap">{formatDateIndo(tx.date)}</div>
                        <div className="text-[10px] text-slate-400 break-words">
                          {tx.paymentMethod}
                        </div>
                      </td>

                      <td className="py-3.5 pr-4 text-slate-600 font-medium">{recordedBy(tx)}</td>

                      <td className="py-3.5 pr-4 text-right whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            tx.type === 'income' ? 'text-teal-600' : 'text-slate-900'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatIDR(tx.amount)}
                        </span>
                      </td>

                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {tx.receiptImage ||
                          tx.hasReceiptImage ||
                          (tx.items && tx.items.length > 0) ? (
                            <button
                              onClick={() => onSelectTransactionForDetail(tx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50"
                              title="Detail Struk"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          ) : null}

                          <button
                            onClick={() => onOpenManualModal(tx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                            title="Edit Transaksi"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => confirmDelete(tx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Hapus Transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

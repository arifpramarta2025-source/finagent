import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  ChevronRight,
  CreditCard,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Tag,
} from 'lucide-react';
import { Transaction } from '../types';
import { formatIDR, formatDateIndo, CATEGORY_COLORS } from '../utils/constants';
import { recordedBy } from '../utils/members';
import { useCategories } from '../hooks/useCategories';
import { categoryColor } from '../utils/categories';

export type ChartDetailTarget =
  { type: 'daily'; date: string } | { type: 'category'; category: string };

interface ChartDetailModalProps {
  target: ChartDetailTarget | null;
  onClose: () => void;
  monthlyTransactions: Transaction[];
  allTransactions?: Transaction[];
  totalMonthlyExpense: number;
  onSelectTransactionForDetail: (tx: Transaction) => void;
}

function formatFullDateIndo(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export const ChartDetailModal: React.FC<ChartDetailModalProps> = ({
  target,
  onClose,
  monthlyTransactions,
  allTransactions = [],
  totalMonthlyExpense,
  onSelectTransactionForDetail,
}) => {
  const categories = useCategories();
  const getCatColor = (catName: string) =>
    categoryColor(categories, catName) || CATEGORY_COLORS[catName] || '#94A3B8';
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');

  // Reset filter when target changes
  useEffect(() => {
    setFilterType('all');
  }, [target]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Memoized daily data
  const dailyData = useMemo(() => {
    if (!target || target.type !== 'daily') return null;
    const targetDate = target.date;

    // Deduplicate from monthlyTransactions and allTransactions
    const map = new Map<string, Transaction>();
    for (const tx of monthlyTransactions) {
      if (tx.date === targetDate) map.set(tx.id, tx);
    }
    for (const tx of allTransactions) {
      if (tx.date === targetDate) map.set(tx.id, tx);
    }

    const txs = Array.from(map.values()).sort((a, b) => {
      const aTime = a.createdAt || '';
      const bTime = b.createdAt || '';
      return bTime.localeCompare(aTime);
    });

    let income = 0;
    let expense = 0;
    const categoryTotals: Record<string, { amount: number; count: number }> = {};

    for (const tx of txs) {
      if (tx.type === 'income') {
        income += tx.amount;
      } else {
        expense += tx.amount;
        if (!categoryTotals[tx.category]) {
          categoryTotals[tx.category] = { amount: 0, count: 0 };
        }
        categoryTotals[tx.category].amount += tx.amount;
        categoryTotals[tx.category].count += 1;
      }
    }

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([cat, val]) => ({
        category: cat,
        amount: val.amount,
        count: val.count,
        color: getCatColor(cat),
        percentage: expense > 0 ? (val.amount / expense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      date: targetDate,
      fullDateLabel: formatFullDateIndo(targetDate),
      transactions: txs,
      income,
      expense,
      net: income - expense,
      categoryBreakdown,
    };
  }, [target, monthlyTransactions, allTransactions, categories]);

  // Memoized category data
  const categoryData = useMemo(() => {
    if (!target || target.type !== 'category') return null;
    const catName = target.category;
    const catColor = getCatColor(catName);

    const txs = monthlyTransactions
      .filter((tx) => tx.type === 'expense' && tx.category === catName)
      .sort((a, b) => b.date.localeCompare(a.date));

    let total = 0;
    const subcategoryTotals: Record<string, { amount: number; count: number }> = {};

    for (const tx of txs) {
      total += tx.amount;
      const sub = tx.subCategory?.trim() || 'Umum / Lainnya';
      if (!subcategoryTotals[sub]) {
        subcategoryTotals[sub] = { amount: 0, count: 0 };
      }
      subcategoryTotals[sub].amount += tx.amount;
      subcategoryTotals[sub].count += 1;
    }

    const subcategoryBreakdown = Object.entries(subcategoryTotals)
      .map(([sub, val]) => ({
        subCategory: sub,
        amount: val.amount,
        count: val.count,
        percentage: total > 0 ? (val.amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const shareOfTotalExpense = totalMonthlyExpense > 0 ? (total / totalMonthlyExpense) * 100 : 0;

    return {
      category: catName,
      color: catColor,
      total,
      count: txs.length,
      shareOfTotalExpense,
      avgPerTx: txs.length > 0 ? total / txs.length : 0,
      subcategoryBreakdown,
      transactions: txs,
    };
  }, [target, monthlyTransactions, totalMonthlyExpense]);

  if (!target) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {target.type === 'daily' ? (
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700 shrink-0 shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                style={{ backgroundColor: categoryData?.color || '#0ea5e9' }}
              >
                <Layers className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {target.type === 'daily' ? 'Rincian Arus Kas Harian' : 'Rincian Pos Kategori'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                  Interaktif
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-base truncate">
                {target.type === 'daily' ? dailyData?.fullDateLabel : target.category}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Tutup rincian"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* DAILY TARGET CONTENT */}
          {target.type === 'daily' && dailyData && (
            <>
              {/* Daily KPI Metric Cards */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="p-3 sm:p-3.5 rounded-xl bg-teal-50/70 border border-teal-200/60">
                  <div className="flex items-center gap-1.5 text-teal-800 text-xs font-semibold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Pemasukan</span>
                  </div>
                  <div className="mt-1 font-bold text-xs sm:text-sm text-teal-700 truncate">
                    +{formatIDR(dailyData.income)}
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/60">
                  <div className="flex items-center gap-1.5 text-rose-800 text-xs font-semibold">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Pengeluaran</span>
                  </div>
                  <div className="mt-1 font-bold text-xs sm:text-sm text-rose-700 truncate">
                    -{formatIDR(dailyData.expense)}
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-600 text-xs font-medium">Kas Bersih</div>
                  <div
                    className={`mt-1 font-bold text-xs sm:text-sm truncate ${
                      dailyData.net >= 0 ? 'text-teal-700' : 'text-rose-700'
                    }`}
                  >
                    {dailyData.net >= 0 ? '+' : ''}
                    {formatIDR(dailyData.net)}
                  </div>
                </div>
              </div>

              {/* Pos Pengeluaran Hari Ini (Breakdown by Category if any expense exists) */}
              {dailyData.categoryBreakdown.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-500" />
                      <span>Pos Pengeluaran Hari Ini</span>
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {dailyData.categoryBreakdown.length} pos kategori
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    {dailyData.categoryBreakdown.map((cat) => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 min-w-0 font-medium text-slate-800">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="truncate">{cat.category}</span>
                            <span className="text-[10px] text-slate-400">({cat.count}x)</span>
                          </span>
                          <span className="font-semibold text-slate-900 shrink-0">
                            {formatIDR(cat.amount)}{' '}
                            <span className="font-normal text-slate-400">
                              ({cat.percentage.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                            className="h-full rounded-full transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction List Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Daftar Transaksi ({dailyData.transactions.length})
                  </h4>

                  {/* Filter Pills if day has both income & expense */}
                  {dailyData.income > 0 && dailyData.expense > 0 && (
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                      <button
                        type="button"
                        onClick={() => setFilterType('all')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          filterType === 'all'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterType('expense')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          filterType === 'expense'
                            ? 'bg-white text-rose-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Keluar
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterType('income')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          filterType === 'income'
                            ? 'bg-white text-teal-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Masuk
                      </button>
                    </div>
                  )}
                </div>

                {dailyData.transactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Tidak ada transaksi tercatat pada tanggal ini.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {dailyData.transactions
                      .filter((tx) => filterType === 'all' || tx.type === filterType)
                      .map((tx) => (
                        <div
                          key={tx.id}
                          onClick={() => {
                            onClose();
                            onSelectTransactionForDetail(tx);
                          }}
                          className="p-3 sm:p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                                tx.type === 'income'
                                  ? 'bg-teal-50 text-teal-700 border border-teal-200/70'
                                  : 'bg-rose-50 text-rose-600 border border-rose-200/70'
                              }`}
                            >
                              {tx.type === 'income' ? '+' : '-'}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                  {tx.merchant}
                                </span>
                                {(tx.receiptImage || tx.hasReceiptImage) && (
                                  <span
                                    title="Memiliki bukti struk"
                                    className="inline-flex items-center gap-0.5 text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200/60"
                                  >
                                    <Receipt className="w-2.5 h-2.5" />
                                    <span>Struk</span>
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="font-medium text-slate-700">{tx.category}</span>
                                {tx.subCategory && (
                                  <>
                                    <span>·</span>
                                    <span className="text-slate-500">{tx.subCategory}</span>
                                  </>
                                )}
                                <span>·</span>
                                <span>{tx.paymentMethod}</span>
                                {tx.notes && (
                                  <>
                                    <span>·</span>
                                    <span className="italic text-slate-400 truncate max-w-[150px]">
                                      "{tx.notes}"
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <div
                                className={`text-xs sm:text-sm font-bold ${
                                  tx.type === 'income' ? 'text-teal-600' : 'text-slate-900'
                                }`}
                              >
                                {tx.type === 'income' ? '+' : '-'}
                                {formatIDR(tx.amount)}
                              </div>
                              <div className="text-[10px] text-slate-400">{recordedBy(tx)}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* CATEGORY TARGET CONTENT */}
          {target.type === 'category' && categoryData && (
            <>
              {/* Category KPI Metric Cards */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 text-[11px] font-medium">Total Pengeluaran</div>
                  <div className="mt-1 font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {formatIDR(categoryData.total)}
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 text-[11px] font-medium">
                    Porsi Belanja Bulan Ini
                  </div>
                  <div className="mt-1 font-bold text-xs sm:text-sm text-slate-900">
                    {categoryData.shareOfTotalExpense.toFixed(1)}%
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 text-[11px] font-medium">
                    Rata-rata / Transaksi
                  </div>
                  <div className="mt-1 font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {formatIDR(categoryData.avgPerTx)}
                  </div>
                </div>
              </div>

              {/* Pos Pengeluaran / Subkategori Breakdown */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Rincian Pos Subkategori</span>
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {categoryData.subcategoryBreakdown.length} pos terdata
                  </span>
                </div>

                {categoryData.subcategoryBreakdown.length === 0 ? (
                  <div className="text-xs text-slate-400 py-1">
                    Belum ada subkategori tersimpan.
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    {categoryData.subcategoryBreakdown.map((sub) => (
                      <div key={sub.subCategory} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 flex items-center gap-1.5 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: categoryData.color }}
                            />
                            <span className="truncate">{sub.subCategory}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({sub.count} transaksi)
                            </span>
                          </span>
                          <span className="font-semibold text-slate-900 shrink-0">
                            {formatIDR(sub.amount)}{' '}
                            <span className="font-normal text-slate-400">
                              ({sub.percentage.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(sub.percentage, 3))}%`,
                              backgroundColor: categoryData.color,
                            }}
                            className="h-full rounded-full transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaction List for this Category */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Semua Transaksi Kategori ({categoryData.transactions.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">Urut dari terbaru</span>
                </div>

                {categoryData.transactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Tidak ada transaksi untuk kategori ini.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {categoryData.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => {
                          onClose();
                          onSelectTransactionForDetail(tx);
                        }}
                        className="p-3 sm:p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                            <ShoppingBag className="w-4 h-4 text-slate-500" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                {tx.merchant}
                              </span>
                              {(tx.receiptImage || tx.hasReceiptImage) && (
                                <span
                                  title="Memiliki bukti struk"
                                  className="inline-flex items-center gap-0.5 text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200/60"
                                >
                                  <Receipt className="w-2.5 h-2.5" />
                                  <span>Struk</span>
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-slate-600">{formatDateIndo(tx.date)}</span>
                              {tx.subCategory && (
                                <>
                                  <span>·</span>
                                  <span className="font-medium text-slate-700">
                                    {tx.subCategory}
                                  </span>
                                </>
                              )}
                              <span>·</span>
                              <span>{tx.paymentMethod}</span>
                              {tx.notes && (
                                <>
                                  <span>·</span>
                                  <span className="italic text-slate-400 truncate max-w-[140px]">
                                    "{tx.notes}"
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-bold text-slate-900">
                              {formatIDR(tx.amount)}
                            </div>
                            <div className="text-[10px] text-slate-400">{recordedBy(tx)}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Klik salah satu baris transaksi untuk melihat struk atau detail lengkap</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

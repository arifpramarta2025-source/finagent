import React, { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Camera,
  Plus,
  ArrowRight,
  ChevronRight,
  Receipt,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { Transaction, BudgetSettings, FinancialSummary } from '../types';
import { TransactionCard } from './TransactionCard';
import { ChartDetailModal, ChartDetailTarget } from './ChartDetailModal';
import { recordedBy } from '../utils/members';
import { formatIDR, formatDateIndo } from '../utils/constants';

interface DashboardViewProps {
  summary: FinancialSummary;
  transactions: Transaction[];
  totalTransactionCount?: number;
  monthlyTransactions: Transaction[];
  budgetSettings: BudgetSettings;
  onOpenSmartText: (initialText?: string) => void;
  onOpenReceiptScanner: () => void;
  onOpenManualModal: () => void;
  onSelectTransactionForDetail: (tx: Transaction) => void;
  onNavigateToTab: (tab: 'chat' | 'audit' | 'transactions' | 'budget') => void;
  onQuickTextSubmit?: (text: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  transactions,
  totalTransactionCount,
  monthlyTransactions,
  budgetSettings,
  onOpenSmartText,
  onOpenReceiptScanner,
  onOpenManualModal,
  onSelectTransactionForDetail,
  onNavigateToTab,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [chartDetailTarget, setChartDetailTarget] = useState<ChartDetailTarget | null>(null);
  const [showAllDays, setShowAllDays] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // 50/30/20 actual vs target calculations
  const totalIncome = summary.totalIncome || 1;
  const actualNeedsPct = Math.round((summary.needsTotal / totalIncome) * 100);
  const actualWantsPct = Math.round((summary.wantsTotal / totalIncome) * 100);
  const actualSavingsPct = Math.round((summary.savingsTotal / totalIncome) * 100);

  // Emergency fund months covered based on average expenses
  const monthlyExpense = summary.totalExpense || 1;
  const emergencyMonthsCovered = (budgetSettings.currentEmergencyFund / monthlyExpense).toFixed(1);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    onOpenSmartText(quickInput.trim());
    setQuickInput('');
  };

  // Recent 6 transactions
  const recentTransactions = transactions.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Hero welcome and quick entry bar */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-400">
            <span className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              FINA Intelligent Transaction Factory
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Kelola Keuangan dengan AI
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1">
              Catat pengeluaran lewat kalimat santai, pindai nota struk belanja, dan dapatkan
              bimbingan dari Fin AI Agent.
            </p>
          </div>

          {/* Quick NLP Command Bar */}
          <form onSubmit={handleQuickSubmit} className="pt-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="Ketik cepat: 'Makan siang soto ayam 25rb bayar qris' atau 'Gaji masuk 15jt'..."
                  className="w-full px-4 py-2.5 text-xs sm:text-sm text-slate-900 bg-white rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!quickInput.trim()}
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Proses AI</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenReceiptScanner}
                  className="px-3.5 py-2.5 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors flex items-center justify-center gap-1.5"
                  title="Scan Struk Belanja"
                >
                  <Camera className="w-3.5 h-3.5 text-teal-300" />
                  <span>Scan Struk</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Subtle decorative background gradient */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Balance / Cashflow */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Arus Kas Bersih (Bulan Ini)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {formatIDR(summary.netCashflow)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>
                {summary.savingsRate > 0
                  ? `${summary.savingsRate.toFixed(1)}% tabungan tersisa`
                  : 'Pengeluaran melebihi pemasukan'}
              </span>
            </div>
          </div>
        </div>

        {/* Total Income */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Pemasukan</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {formatIDR(summary.totalIncome)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Target bulanan: {formatIDR(budgetSettings.monthlyIncomeTarget)}
            </div>
          </div>
        </div>

        {/* Total Expense */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Pengeluaran</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {formatIDR(summary.totalExpense)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>
                {monthlyTransactions.filter((t) => t.type === 'expense').length} transaksi bulan ini
              </span>
            </div>
          </div>
        </div>

        {/* Emergency Fund Readiness */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Kesiapan Dana Darurat</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {formatIDR(budgetSettings.currentEmergencyFund)}
            </div>
            <div className="text-xs text-indigo-600 mt-1 font-medium">
              Mampu menutup ~{emergencyMonthsCovered} bulan pengeluaran
            </div>
          </div>
        </div>
      </div>

      {/* 50/30/20 Rule Diagnostic Bar */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Alokasi Aturan Keuangan 50 / 30 / 20
              </h2>
              <span className="text-[11px] text-slate-500">(Needs · Wants · Savings)</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluasi proporsi pengeluaran pokok vs gaya hidup dari total pendapatan bulan ini
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab('audit')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Buka Audit Lengkap AI</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stacked Progress Bar */}
        <div className="space-y-2">
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${Math.min(actualNeedsPct, 100)}%` }}
              className="bg-blue-500 transition-all duration-500"
              title={`Needs: ${actualNeedsPct}%`}
            />
            <div
              style={{ width: `${Math.min(actualWantsPct, 100)}%` }}
              className="bg-pink-500 transition-all duration-500"
              title={`Wants: ${actualWantsPct}%`}
            />
            <div
              style={{ width: `${Math.min(actualSavingsPct, 100)}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Savings: ${actualSavingsPct}%`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
              <div className="flex items-center justify-between font-semibold text-blue-900">
                <span>Needs (Pokok)</span>
                <span>
                  {actualNeedsPct}% <span className="font-normal text-blue-600">(Ideal 50%)</span>
                </span>
              </div>
              <div className="text-slate-600 text-[11px] mt-1">
                {formatIDR(summary.needsTotal)} terpakai untuk sewa, makanan, tagihan, transportasi
              </div>
            </div>

            <div className="p-3 rounded-xl bg-pink-50/60 border border-pink-100">
              <div className="flex items-center justify-between font-semibold text-pink-900">
                <span>Wants (Gaya Hidup)</span>
                <span>
                  {actualWantsPct}% <span className="font-normal text-pink-600">(Ideal 30%)</span>
                </span>
              </div>
              <div className="text-slate-600 text-[11px] mt-1">
                {formatIDR(summary.wantsTotal)} untuk jajan kopi, nongkrong, hiburan
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center justify-between font-semibold text-emerald-900">
                <span>Savings (Investasi)</span>
                <span>
                  {actualSavingsPct}%{' '}
                  <span className="font-normal text-emerald-600">(Ideal 20%)</span>
                </span>
              </div>
              <div className="text-slate-600 text-[11px] mt-1">
                {formatIDR(summary.savingsTotal)} dialokasikan ke reksadana, emas, tabungan
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Cash Flow Trend Chart & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cash Flow Trend (7 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Tren Arus Kas Harian</h3>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    Klik bar untuk rincian
                  </span>
                </div>
                <p className="text-xs text-slate-500">Perbandingan pemasukan & pengeluaran</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  Masuk
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  Keluar
                </span>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="pt-1">
              {summary.dailyTrends.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                  Belum ada data transaksi harian
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(showAllDays ? summary.dailyTrends : summary.dailyTrends.slice(-5)).map((d) => {
                    const maxVal = Math.max(d.income, d.expense, 1);
                    const incomeWidth = Math.min(100, Math.round((d.income / maxVal) * 100));
                    const expenseWidth = Math.min(100, Math.round((d.expense / maxVal) * 100));

                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => setChartDetailTarget({ type: 'daily', date: d.date })}
                        className="w-full text-left p-2 -mx-2 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        title={`Klik untuk melihat rincian transaksi tanggal ${formatDateIndo(d.date)}`}
                      >
                        <div className="text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors flex items-center gap-1">
                              <span>{formatDateIndo(d.date)}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
                            </span>
                            <span className="text-[11px] font-medium">
                              {d.income > 0 && (
                                <span className="text-teal-600">+{formatIDR(d.income)} </span>
                              )}
                              {d.expense > 0 && (
                                <span className="text-rose-600">-{formatIDR(d.expense)}</span>
                              )}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 group-hover:bg-slate-200/60 rounded-full overflow-hidden flex gap-0.5 transition-colors">
                            {d.income > 0 && (
                              <div
                                style={{ width: `${incomeWidth}%` }}
                                className="bg-teal-500 h-full rounded-full transition-all"
                              />
                            )}
                            {d.expense > 0 && (
                              <div
                                style={{ width: `${expenseWidth}%` }}
                                className="bg-rose-400 h-full rounded-full transition-all"
                              />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {summary.dailyTrends.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDays(!showAllDays)}
                      className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 transition-colors text-center w-full pt-1.5 cursor-pointer"
                    >
                      {showAllDays
                        ? 'Tampilkan 5 Hari Terakhir'
                        : `Lihat ${summary.dailyTrends.length - 5} Hari Lainnya`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Sisa Kas Bersih Periode:</span>
            <span className="font-bold text-slate-900">{formatIDR(summary.netCashflow)}</span>
          </div>
        </div>

        {/* Right Column: Category Distribution (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Distribusi Kategori</h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  Klik bar untuk rincian pos
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {summary.topCategories.length} kategori
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              {(showAllCategories ? summary.topCategories : summary.topCategories.slice(0, 5)).map(
                (cat) => (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() =>
                      setChartDetailTarget({ type: 'category', category: cat.category })
                    }
                    className="w-full text-left p-2 -mx-2 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    title={`Klik untuk melihat rincian pos pengeluaran kategori ${cat.category}`}
                  >
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 min-w-0 text-slate-800 font-semibold group-hover:text-blue-900 transition-colors">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="truncate">{cat.category}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100 shrink-0" />
                        </span>
                        <span className="shrink-0 whitespace-nowrap font-bold text-slate-900">
                          {formatIDR(cat.amount)}{' '}
                          <span className="font-normal text-slate-400">
                            ({cat.percentage.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 group-hover:bg-slate-200/60 rounded-full overflow-hidden transition-colors">
                        <div
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.color,
                          }}
                          className="h-full rounded-full transition-all"
                        />
                      </div>
                    </div>
                  </button>
                )
              )}

              {summary.topCategories.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 transition-colors text-center w-full pt-1.5 cursor-pointer"
                >
                  {showAllCategories
                    ? 'Tampilkan 5 Kategori Teratas'
                    : `Lihat ${summary.topCategories.length - 5} Kategori Lainnya`}
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab('chat')}
            className="mt-4 w-full p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Minta Finn Analisis Kategori Boros</span>
          </button>
        </div>
      </div>

      {/* Recent Transactions List Table */}
      <div className="p-4 md:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Transaksi Terbaru</h3>
            <p className="text-xs text-slate-500">Catatan mutasi keuangan terkini</p>
          </div>
          <button
            onClick={() => onNavigateToTab('transactions')}
            className="shrink-0 text-right text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
          >
            <span>Lihat Semua Transaksi ({totalTransactionCount ?? transactions.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <ul className="min-[900px]:hidden divide-y divide-slate-100">
          {recentTransactions.map((tx) => (
            <TransactionCard key={tx.id} tx={tx} onViewDetail={onSelectTransactionForDetail} />
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
              <col className="w-14" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-medium">
                <th className="pb-2 pr-4">Merchant / Sumber</th>
                <th className="pb-2 pr-4">Kategori</th>
                <th className="pb-2 pr-4">Tanggal & Metode</th>
                <th className="pb-2 pr-4">Pencatat</th>
                <th className="pb-2 pr-4 text-right">Nominal</th>
                <th className="pb-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                          tx.type === 'income'
                            ? 'bg-teal-50 text-teal-700 font-bold'
                            : 'bg-slate-100 text-slate-700 font-bold'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-x-1.5">
                          <span className="min-w-0 break-words">{tx.merchant}</span>
                          {(tx.receiptImage || tx.hasReceiptImage) && (
                            <span
                              title="Struk tersimpan"
                              className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200/60"
                            >
                              Struk
                            </span>
                          )}
                        </div>
                        {tx.notes && (
                          <div className="text-[11px] text-slate-400 truncate" title={tx.notes}>
                            {tx.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    <div className="break-words">{tx.category}</div>
                    <span className="text-[10px] text-slate-400">
                      {tx.type === 'expense' ? tx.budgetClassification.toUpperCase() : ''}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    <div className="whitespace-nowrap">{formatDateIndo(tx.date)}</div>
                    <div className="text-[10px] text-slate-400 break-words">{tx.paymentMethod}</div>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{recordedBy(tx)}</td>
                  <td className="py-3 pr-4 text-right whitespace-nowrap">
                    <span
                      className={`font-bold ${
                        tx.type === 'income' ? 'text-teal-600' : 'text-slate-900'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatIDR(tx.amount)}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {tx.receiptImage || tx.hasReceiptImage || (tx.items && tx.items.length > 0) ? (
                      <button
                        onClick={() => onSelectTransactionForDetail(tx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                        title="Lihat Detail Struk & Item"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Horizontal Bar Chart Drill-down Modal */}
      <ChartDetailModal
        target={chartDetailTarget}
        onClose={() => setChartDetailTarget(null)}
        monthlyTransactions={monthlyTransactions}
        allTransactions={transactions}
        totalMonthlyExpense={summary.totalExpense}
        onSelectTransactionForDetail={onSelectTransactionForDetail}
      />
    </div>
  );
};

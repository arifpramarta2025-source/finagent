import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertOctagon,
  CheckCircle2,
  TrendingDown,
  PiggyBank,
  ArrowRight,
  Flame,
  Lightbulb,
  Quote,
  RefreshCw,
} from 'lucide-react';
import { FinancialSummary, BudgetSettings, Transaction, AuditResult } from '../types';
import { formatIDR } from '../utils/constants';
import { postAi } from '../services/api';
import { saveAuditResult, subscribeToAuditResult } from '../services/firestoreService';

interface AuditViewProps {
  userId: string;
  summary: FinancialSummary;
  budgetSettings: BudgetSettings;
  transactions: Transaction[];
  onNavigateToTab: (tab: 'chat' | 'budget') => void;
}

export const AuditView: React.FC<AuditViewProps> = ({
  userId,
  summary,
  budgetSettings,
  transactions,
  onNavigateToTab,
}) => {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToAuditResult(userId, setAudit), [userId]);

  const handleRunAudit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await postAi('/api/ai/audit', {
        summary,
        transactions: transactions.slice(0, 10).map(({ receiptImage, items, ...tx }) => tx),
        budgetSettings,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal membuat audit keuangan AI');
      }

      const result: AuditResult = {
        ...json.data,
        generatedAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setAudit(result);
      await saveAuditResult(userId, result);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Gagal memproses audit dengan Gemini AI');
    } finally {
      setIsLoading(false);
    }
  };

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Audit & Diagnostik Kesehatan Finansial AI
            </h2>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
              Gemini 3.8 Flash Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Sistem menganalisis seluruh mutasi buku kas Anda, menguji rasio 50/30/20, melacak
            potensi kebocoran dana, serta menguji ketahanan dana darurat secara objektif.
          </p>
        </div>

        <button
          onClick={handleRunAudit}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Mendiagnosis Keuangan...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>Jalankan Audit Baru AI</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {!audit && (
        <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-xs text-center">
          <ShieldCheck className="w-8 h-8 mx-auto text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">Belum ada hasil audit</h3>
          <p className="mt-1 text-xs text-slate-500">
            Klik tombol Jalankan Audit Baru AI untuk mengevaluasi data transaksi Anda.
          </p>
        </div>
      )}

      {audit && (
        <>
          {/* Main Score & Diagnostic Headline Bento Card */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Score Ring / Card (4 cols) */}
            <div className="md:col-span-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center space-y-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Financial Health Score
              </span>

              <div
                className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-inner ${getScoreColor(
                  audit.healthScore
                )}`}
              >
                <span className="text-3xl font-black tracking-tight">{audit.healthScore}</span>
                <span className="text-[10px] font-bold uppercase">/ 100</span>
              </div>

              <div>
                <div className="font-bold text-slate-900 text-sm">Status: {audit.healthStatus}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Terakhir diaudit: {audit.generatedAt || 'Baru saja'}
                </p>
              </div>
            </div>

            {/* Diagnostic Headline & 50/30/20 Overview (8 cols) */}
            <div className="md:col-span-8 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  Kesimpulan Hasil Diagnosis
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {audit.headline}
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {audit.rule50_30_20.analysis}
                </p>
              </div>

              {/* 50/30/20 Breakdown Badges */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                  <span className="text-blue-900 font-semibold block">Needs (Pokok)</span>
                  <span className="text-lg font-bold text-blue-950">
                    {audit.rule50_30_20.needsPercentage}%
                  </span>
                  <span className="text-[10px] text-blue-600 block mt-0.5">Maksimal 50%</span>
                </div>

                <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100">
                  <span className="text-pink-900 font-semibold block">Wants (Gaya Hidup)</span>
                  <span className="text-lg font-bold text-pink-950">
                    {audit.rule50_30_20.wantsPercentage}%
                  </span>
                  <span className="text-[10px] text-pink-600 block mt-0.5">Maksimal 30%</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <span className="text-emerald-900 font-semibold block">Savings (Tabungan)</span>
                  <span className="text-lg font-bold text-emerald-950">
                    {audit.rule50_30_20.savingsPercentage}%
                  </span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5">Minimal 20%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Spending Leaks (Kebocoran Dana) Detector */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Detektor Kebocoran Dana (Spending Leaks)
                </h3>
                <p className="text-xs text-slate-500">
                  Pos pengeluaran mikro yang tanpa disadari mengikis saldo Anda setiap bulan
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {audit.spendingLeaks.map((leak, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900 text-xs">{leak.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          leak.severity === 'high'
                            ? 'bg-rose-100 text-rose-700'
                            : leak.severity === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {leak.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{leak.description}</p>
                  </div>

                  {leak.estimatedMonthlyImpact && (
                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Dampak bulanan:</span>
                      <span className="font-bold text-rose-700">{leak.estimatedMonthlyImpact}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Fund & Strategic Action Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Emergency Fund Card (5 cols) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Kesiapan Dana Darurat</h3>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-2">
                  <div className="text-2xl font-black text-indigo-950">
                    {audit.emergencyFundEvaluation.monthsCovered} Bulan
                    <span className="text-xs font-normal text-slate-500 ml-2">
                      (Target: {audit.emergencyFundEvaluation.targetMonths || 6} Bulan)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {audit.emergencyFundEvaluation.statusMessage}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">Saldo dana darurat saat ini:</span>
                <span className="font-bold text-slate-900 text-xs">
                  {formatIDR(budgetSettings.currentEmergencyFund)}
                </span>
              </div>
            </div>

            {/* Action Roadmap (7 cols) */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Rekomendasi Aksi Taktis Finansial
                  </h3>
                  <p className="text-xs text-slate-500">
                    Langkah konkret yang disusun oleh AI untuk optimasi saldo Anda
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {audit.actionRecommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] shrink-0">
                        {rec.priority}
                      </span>
                      <span>{rec.title}</span>
                      {rec.category && (
                        <span className="ml-auto text-[10px] text-slate-500 font-normal bg-white px-2 py-0.5 rounded border border-slate-200">
                          {rec.category}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 pl-7 leading-relaxed">{rec.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inspirational Quote Banner */}
          {audit.inspirationalQuote && (
            <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center gap-3">
              <Quote className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs sm:text-sm text-slate-200 italic">
                "{audit.inspirationalQuote}"
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Check,
  ShieldAlert,
  Sparkles,
  PiggyBank,
  Calculator,
} from 'lucide-react';
import { BudgetSettings } from '../types';
import { formatIDR } from '../utils/constants';

interface BudgetSettingsViewProps {
  settings: BudgetSettings;
  onSave: (newSettings: BudgetSettings) => Promise<void>;
}

export const BudgetSettingsView: React.FC<BudgetSettingsViewProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = useState<BudgetSettings>({ ...settings });
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    setIsSaved(false);

    try {
      await onSave(formData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error: any) {
      console.error('Failed saving budget:', error);
      setSaveError(error?.message || 'Pengaturan gagal disimpan. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const calculatedNeeds = Math.round(
    (formData.monthlyIncomeTarget * formData.needsPercentage) / 100
  );
  const calculatedWants = Math.round(
    (formData.monthlyIncomeTarget * formData.wantsPercentage) / 100
  );
  const calculatedSavings = Math.round(
    (formData.monthlyIncomeTarget * formData.savingsPercentage) / 100
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Pengaturan Anggaran & Target Keuangan
          </h2>
          <p className="text-xs text-slate-500">
            Sesuaikan patokan pendapatan bulanan, dana darurat, dan alokasi rumus 50/30/20
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Income & Emergency Fund Settings */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-600" />
            Pendapatan & Target Dana Darurat
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-600 block mb-1 font-medium">
                Estimasi Pemasukan Bulanan (IDR)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.monthlyIncomeTarget || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    monthlyIncomeTarget: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFormData((prev) => ({
                      ...prev,
                      monthlyIncomeTarget: (prev.monthlyIncomeTarget || 0) + 500000,
                    }));
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFormData((prev) => ({
                      ...prev,
                      monthlyIncomeTarget: Math.max(0, (prev.monthlyIncomeTarget || 0) - 500000),
                    }));
                  }
                }}
                className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
              <span className="text-[11px] text-emerald-600 mt-1 block">
                {formatIDR(formData.monthlyIncomeTarget)}
              </span>
            </div>

            <div>
              <label className="text-slate-600 block mb-1 font-medium">
                Target Dana Darurat Ideal (IDR)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.emergencyFundTarget || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    emergencyFundTarget: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFormData((prev) => ({
                      ...prev,
                      emergencyFundTarget: (prev.emergencyFundTarget || 0) + 1000000,
                    }));
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFormData((prev) => ({
                      ...prev,
                      emergencyFundTarget: Math.max(0, (prev.emergencyFundTarget || 0) - 1000000),
                    }));
                  }
                }}
                className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
              <span className="text-[11px] text-indigo-600 mt-1 block">
                {formatIDR(formData.emergencyFundTarget)}
              </span>
            </div>

            <div>
              <label className="text-slate-600 block mb-1 font-medium">
                Dana Darurat Terkumpul Saat Ini (IDR)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.currentEmergencyFund || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currentEmergencyFund: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFormData((prev) => ({
                      ...prev,
                      currentEmergencyFund: (prev.currentEmergencyFund || 0) + 500000,
                    }));
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFormData((prev) => ({
                      ...prev,
                      currentEmergencyFund: Math.max(0, (prev.currentEmergencyFund || 0) - 500000),
                    }));
                  }
                }}
                className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                {formatIDR(formData.currentEmergencyFund)}
              </span>
            </div>
          </div>
        </div>

        {/* 50/30/20 Distribution Config & Preview */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-teal-600" />
              Alokasi Rumus 50 / 30 / 20
            </h3>
            <span className="text-xs text-slate-500">
              Total:{' '}
              {formData.needsPercentage + formData.wantsPercentage + formData.savingsPercentage}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Needs */}
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 text-xs">Needs (Pokok)</span>
                <span className="text-xs font-bold text-blue-950">{formData.needsPercentage}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="70"
                value={formData.needsPercentage}
                onChange={(e) =>
                  setFormData({ ...formData, needsPercentage: Number(e.target.value) })
                }
                className="w-full accent-blue-600"
              />
              <div className="text-xs font-bold text-blue-950">
                Alokasi: {formatIDR(calculatedNeeds)}
              </div>
              <p className="text-[11px] text-slate-500">
                Sewa/KPR, listrik, air, groceries, transportasi, pendidikan wajib
              </p>
            </div>

            {/* Wants */}
            <div className="p-4 rounded-xl bg-pink-50/50 border border-pink-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-pink-900 text-xs">Wants (Gaya Hidup)</span>
                <span className="text-xs font-bold text-pink-950">{formData.wantsPercentage}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={formData.wantsPercentage}
                onChange={(e) =>
                  setFormData({ ...formData, wantsPercentage: Number(e.target.value) })
                }
                className="w-full accent-pink-600"
              />
              <div className="text-xs font-bold text-pink-950">
                Alokasi: {formatIDR(calculatedWants)}
              </div>
              <p className="text-[11px] text-slate-500">
                Kopi susu, kuliner akhir pekan, langganan film streaming, belanja fashion
              </p>
            </div>

            {/* Savings */}
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-900 text-xs">Savings (Investasi)</span>
                <span className="text-xs font-bold text-emerald-950">
                  {formData.savingsPercentage}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={formData.savingsPercentage}
                onChange={(e) =>
                  setFormData({ ...formData, savingsPercentage: Number(e.target.value) })
                }
                className="w-full accent-emerald-600"
              />
              <div className="text-xs font-bold text-emerald-950">
                Alokasi: {formatIDR(calculatedSavings)}
              </div>
              <p className="text-[11px] text-slate-500">
                Reksadana, emas fisik, saham deviden, deposito, dana darurat
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3">
          {saveError && (
            <span role="alert" className="text-xs text-rose-600">
              {saveError}
            </span>
          )}
          {isSaved && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 animate-fadeIn">
              <Check className="w-4 h-4" />
              Pengaturan berhasil disimpan!
            </span>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
};

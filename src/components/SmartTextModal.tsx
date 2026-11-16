import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, ArrowRight, CheckCircle2, Mic, Square } from 'lucide-react';
import { Transaction, BudgetClassification } from '../types';
import { getLocalDateString } from '../utils/constants';
import { findDateInText, normalizeDate } from '../utils/dates';
import { normalizeSpokenNumbers } from '../utils/spokenNumbers';
import { TransactionFields, TransactionFieldValues } from './TransactionFields';
import { useCategories } from '../hooks/useCategories';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { normalizeSelection, toAiCategoryLists } from '../utils/categories';
import { parseTransactionLocally } from '../utils/nlpParser';
import { postAi } from '../services/api';

interface SmartTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  initialText?: string;
}

const SAMPLE_PROMPTS = [
  'Beli es kopi kenangan mantan 28rb pake qris',
  'Makan siang sate padang 35.000 bayar tunai',
  'Gaji freelance landing page masuk 3.5jt transfer bca',
  'Isi bensin pertamax di spbu 150000 pake kartu debit',
  'Beli vitamin dan obat flu di apotek k-24 65rb',
  'Belanja bulanan beras minyak sabun di superindo 480rb',
];

export const SmartTextModal: React.FC<SmartTextModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialText = '',
}) => {
  const categories = useCategories();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted draft state
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<TransactionFieldValues | null>(null);
  const [dateHint, setDateHint] = useState<string | null>(null);

  const handleParse = async (textToParse?: string) => {
    const text = textToParse !== undefined ? textToParse : inputText;
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    const today = getLocalDateString();
    const dateInText = findDateInText(normalizeSpokenNumbers(text), today)?.date ?? null;
    const resolveDate = (aiDate: unknown) => {
      // Gemini sometimes answers with the reference date even when the sentence names another.
      const date = dateInText ?? normalizeDate(aiDate) ?? today;
      setDateHint(
        dateInText || date !== today ? null : 'Tanggal tidak disebut, jadi memakai hari ini.'
      );
      return date;
    };

    try {
      // Long enough for Gemini to answer. The local parser takes over if it does not.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const res = await postAi(
        '/api/ai/parse-text',
        {
          text,
          currentDate: today,
          categories: toAiCategoryLists(categories),
        },
        controller.signal
      );

      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Server parsing error');
      }

      const d = json.data;
      const transactionType = d.type === 'income' ? 'income' : 'expense';
      setDraft({
        type: transactionType,
        amount: Number(d.amount) || 0,
        ...normalizeSelection(categories, transactionType, d.category, d.subCategory),
        merchant: d.merchant || 'Transaksi AI',
        date: resolveDate(d.date),
        paymentMethod: d.paymentMethod || 'QRIS / E-Wallet',
        notes: d.notes || text,
        budgetClassification:
          (d.budgetClassification as BudgetClassification) ||
          (d.type === 'income' ? 'savings' : 'needs'),
      });
    } catch (err: any) {
      console.warn('Network or API issue, using client-side smart parser:', err);
      // Seamlessly fall back to client-side smart parser
      const localParsed = parseTransactionLocally(text, today);
      setDraft({
        ...localParsed,
        date: resolveDate(localParsed.date),
        ...normalizeSelection(
          categories,
          localParsed.type,
          localParsed.category,
          localParsed.subCategory
        ),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const speech = useSpeechInput({
    onTranscript: setInputText,
    onFinished: (text) => {
      void handleParse(text);
    },
  });

  const handleMicClick = () => {
    if (speech.isListening) {
      speech.stopListening();
      return;
    }
    setInputText('');
    setDraft(null);
    setError(null);
    speech.startListening();
  };

  useEffect(() => {
    if (!isOpen) speech.cancelListening();
  }, [isOpen, speech.cancelListening]);

  useEffect(() => {
    if (isOpen) {
      if (initialText && initialText.trim()) {
        setInputText(initialText.trim());
        handleParse(initialText.trim());
      } else {
        setInputText('');
        setDraft(null);
        setError(null);
      }
    } else {
      setDraft(null);
      setDateHint(null);
      setError(null);
      setInputText('');
    }
  }, [isOpen, initialText]);

  const handleConfirmSave = async () => {
    if (!draft || draft.amount <= 0 || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(draft.type === 'income' ? { ...draft, budgetClassification: 'savings' } : draft);
      setDraft(null);
      setInputText('');
      onClose();
    } catch (saveError: any) {
      console.error('Failed saving transaction:', saveError);
      setError(saveError?.message || 'Transaksi gagal disimpan. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Catat Transaksi Cerdas (AI NLP)
              </h3>
              <p className="text-xs text-slate-500">
                Ketik atau ucapkan kalimat bebas dalam Bahasa Indonesia sehari-hari
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Tulis Transaksi Anda
            </label>
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={3}
                placeholder={
                  speech.isListening
                    ? 'Silakan bicara, misalnya: beli kopi dua puluh lima ribu pakai QRIS'
                    : 'Contoh: Beli kopi di Janji Jiwa 28rb pake qris tadi pagi...'
                }
                className="w-full pl-3.5 pr-14 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleParse();
                  }
                }}
              />
              {speech.isSupported && (
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={isLoading}
                  aria-label={speech.isListening ? 'Berhenti mendengarkan' : 'Catat dengan suara'}
                  aria-pressed={speech.isListening}
                  className={`absolute right-2 top-2 w-10 h-10 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                    speech.isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {speech.isListening ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
            {speech.isListening && (
              <p role="status" className="mt-1.5 text-xs font-medium text-rose-600">
                Mendengarkan... tekan tombol merah jika sudah selesai.
              </p>
            )}
            {speech.speechError && (
              <p role="alert" className="mt-1.5 text-xs text-rose-600">
                {speech.speechError}
              </p>
            )}
          </div>

          {/* Quick Examples */}
          <div>
            <p className="text-[11px] font-medium text-slate-500 mb-2">
              Contoh Cepat (Klik untuk coba):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInputText(sample);
                    handleParse(sample);
                  }}
                  className="text-left text-xs bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-md transition-colors"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* Parse Button */}
          <button
            type="button"
            onClick={() => handleParse()}
            disabled={isLoading || !inputText.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menganalisis dengan Gemini AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Ekstrak Data Transaksi
              </>
            )}
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Extracted Preview Card */}
          {draft && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Hasil Ekstraksi AI
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    draft.type === 'income'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {draft.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                </span>
              </div>

              <TransactionFields
                value={draft}
                onChange={(patch) =>
                  setDraft((current) => (current ? { ...current, ...patch } : current))
                }
                dateHint={dateHint}
              />

              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving || !draft || draft.amount <= 0}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xs"
              >
                <span>{isSaving ? 'Menyimpan...' : 'Simpan ke Riwayat Transaksi'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

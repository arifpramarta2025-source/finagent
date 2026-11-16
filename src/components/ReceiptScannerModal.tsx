import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileText,
  AlertCircle,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { Transaction, ReceiptItem, BudgetClassification } from '../types';
import { formatIDR, getLocalDateString } from '../utils/constants';
import { useCategories } from '../hooks/useCategories';
import { normalizeSelection, toAiCategoryLists } from '../utils/categories';
import { normalizeDate } from '../utils/dates';
import { TransactionFields, TransactionFieldValues } from './TransactionFields';
import { compressReceiptImage, MAX_STORED_RECEIPT_CHARS } from '../utils/imageCompress';
import { postAi } from '../services/api';

const MAX_PDF_BYTES = 8 * 1024 * 1024;

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const categories = useCategories();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extracted data state
  const [parsedData, setParsedData] = useState<
    | (TransactionFieldValues & {
        time?: string;
        subtotal?: number;
        taxAmount?: number;
        items: ReceiptItem[];
      })
    | null
  >(null);
  const [dateHint, setDateHint] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPdf) {
      setError(
        'Harap pilih file gambar (JPG, PNG, WebP) atau file PDF invoice/struk (misal: invoice Tokopedia)'
      );
      return;
    }

    if (isPdf && file.size > MAX_PDF_BYTES) {
      setError('Ukuran PDF maksimal 8 MB');
      return;
    }

    const originalMime = isPdf ? 'application/pdf' : file.type || 'image/jpeg';
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const original = event.target?.result as string;
      let processed = original;
      let processedMime = originalMime;

      if (isImage) {
        try {
          processed = await compressReceiptImage(original);
          processedMime = 'image/jpeg';
        } catch (compressError) {
          console.warn('Receipt image could not be compressed:', compressError);
        }
      }

      setMimeType(processedMime);
      setSelectedImage(processed);
      setParsedData(null);
      setError(null);
      processReceipt(processed, processedMime);
    };
    reader.readAsDataURL(file);
  };

  const processReceipt = async (imgData: string, type: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await postAi('/api/ai/parse-receipt', {
        imageBase64: imgData,
        mimeType: type,
        currentDate: getLocalDateString(),
        categories: toAiCategoryLists(categories),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memproses struk dengan OCR Gemini');
      }

      const d = json.data;
      const today = getLocalDateString();
      const receiptDate = normalizeDate(d.date);
      setDateHint(
        !receiptDate
          ? 'Tanggal tidak terbaca di struk, jadi memakai hari ini. Periksa lagi.'
          : receiptDate > today
            ? 'Tanggal struk setelah hari ini. Periksa apakah terbaca benar.'
            : null
      );
      setParsedData({
        type: 'expense',
        merchant: d.merchant || 'Merchant Struk',
        date: receiptDate ?? today,
        time: d.time || '',
        amount: Number(d.totalAmount) || 0,
        subtotal: d.subtotal ? Number(d.subtotal) : undefined,
        taxAmount: d.taxAmount ? Number(d.taxAmount) : undefined,
        ...normalizeSelection(categories, 'expense', d.category, d.subCategory),
        paymentMethod: d.paymentMethod || 'QRIS / E-Wallet',
        items: Array.isArray(d.items)
          ? d.items.map((it: any) => ({
              name: it.name || 'Item',
              qty: Number(it.qty) || 1,
              price: Number(it.price) || Number(it.total) || 0,
              total: Number(it.total) || 0,
            }))
          : [],
        notes: typeof d.notes === 'string' ? d.notes : '',
        budgetClassification: (d.budgetClassification as BudgetClassification) || 'needs',
      });
    } catch (err: any) {
      console.warn('Receipt could not be read:', err);
      setError(err?.message || 'Struk belum bisa dibaca AI. Silakan coba lagi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!parsedData || isSaving) return;
    if (parsedData.amount <= 0) {
      setSaveError('Isi nominal struk terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave({
        type: 'expense',
        amount: parsedData.amount,
        category: parsedData.category,
        subCategory: parsedData.subCategory,
        merchant: parsedData.merchant,
        date: parsedData.date,
        paymentMethod: parsedData.paymentMethod,
        notes: (parsedData.notes || '').trim(),
        budgetClassification: parsedData.budgetClassification,
        receiptImage:
          selectedImage && selectedImage.length <= MAX_STORED_RECEIPT_CHARS
            ? selectedImage
            : undefined,
        items: parsedData.items,
      });

      handleReset();
      onClose();
    } catch (error: any) {
      console.error('Failed saving receipt:', error);
      setSaveError(error?.message || 'Transaksi gagal disimpan. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const isFileTooLargeToStore = Boolean(
    selectedImage && selectedImage.length > MAX_STORED_RECEIPT_CHARS
  );

  const handleReset = () => {
    setSelectedImage(null);
    setFileName(null);
    setParsedData(null);
    setError(null);
    setSaveError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isPdf =
    mimeType === 'application/pdf' ||
    (selectedImage ? selectedImage.startsWith('data:application/pdf') : false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/60 to-emerald-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-sm">
                  Scan Struk & PDF Invoice (Gemini AI)
                </h3>
                <span className="text-[10px] font-semibold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded">
                  Transaction Factory
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Otomatis membaca foto struk belanja & dokumen PDF invoice (Tokopedia, marketplace,
                dll)
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Preset Buttons for Quick Testing */}
          {selectedImage && (
            <div className="flex justify-end">
              <button
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Ganti Struk Lain
              </button>
            </div>
          )}

          {/* Upload Area / Image Preview & Results Split */}
          {!selectedImage ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-teal-50/20 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Klik atau Seret Foto Struk / Dokumen PDF ke Sini
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Mendukung struk belanja (JPG, PNG) & file PDF invoice (Tokopedia, Shopee,
                e-commerce, atau bukti transfer bank)
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Image or PDF Preview */}
              <div className="md:col-span-5 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    {isPdf ? (
                      <>
                        <FileText className="w-3.5 h-3.5 text-rose-600" />
                        Dokumen PDF Invoice
                      </>
                    ) : (
                      'Gambar Bukti Struk'
                    )}
                  </span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
                  >
                    Unggah Baru
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 overflow-hidden flex flex-col items-center justify-center min-h-[300px] max-h-[380px]">
                  {isPdf ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-2 shadow-xs">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 truncate max-w-[220px]">
                        {fileName || 'Dokumen_Invoice.pdf'}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5">
                        Invoice Digital (PDF)
                      </span>
                      <div className="mt-2.5 w-full h-48 rounded-lg overflow-hidden border border-slate-200 bg-white">
                        <iframe
                          src={selectedImage}
                          title="PDF Preview"
                          className="w-full h-full border-0"
                        />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={selectedImage}
                      alt="Receipt preview"
                      className="max-h-[360px] w-auto object-contain rounded shadow-xs"
                    />
                  )}
                </div>
              </div>

              {/* Right Column: AI Extraction Results */}
              <div className="md:col-span-7 flex flex-col justify-between">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-800">
                        Memindai & Menganalisis Struk...
                      </p>
                      <p className="text-xs text-slate-500 max-w-xs">
                        Gemini AI sedang membaca teks, menghitung item, dan memverifikasi nominal
                        struk.
                      </p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                    <p className="text-xs text-rose-600">{error}</p>
                    <button
                      onClick={() => processReceipt(selectedImage, mimeType)}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                    >
                      Coba Ulangi Scan
                    </button>
                  </div>
                ) : parsedData ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Detail Ekstraksi Struk
                      </span>
                      <span className="text-xs font-bold text-emerald-700">
                        {formatIDR(parsedData.amount)}
                      </span>
                    </div>

                    <TransactionFields
                      value={parsedData}
                      onChange={(patch) =>
                        setParsedData((current) => (current ? { ...current, ...patch } : current))
                      }
                      dateHint={dateHint}
                    />

                    {/* Itemized Table Breakdown */}
                    {parsedData.items.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-slate-600 mb-1">
                          Rincian Item yang Terdeteksi ({parsedData.items.length} item):
                        </p>
                        <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                          {parsedData.items.map((it, idx) => (
                            <div
                              key={idx}
                              className="px-2.5 py-1.5 flex items-center justify-between bg-slate-50/50"
                            >
                              <span className="text-slate-700 truncate max-w-[200px]">
                                {it.qty ? `${it.qty}x ` : ''}
                                {it.name}
                              </span>
                              <span className="font-medium text-slate-900">
                                {formatIDR(it.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isFileTooLargeToStore && (
                      <p className="mt-4 text-[11px] text-amber-700">
                        File terlalu besar untuk disimpan. Hanya data transaksinya yang akan
                        tersimpan.
                      </p>
                    )}

                    {saveError && (
                      <p role="alert" className="mt-4 text-xs text-rose-600">
                        {saveError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleConfirmSave}
                      disabled={isSaving}
                      className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isSaving ? 'Menyimpan...' : 'Konfirmasi & Simpan Transaksi'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Pilih struk untuk memulai OCR otomatis
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

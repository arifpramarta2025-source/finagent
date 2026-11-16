import { useEffect, useState } from 'react';
import { X, Receipt, Store, Calendar, CreditCard, Tag, FileText, Download } from 'lucide-react';
import { Transaction } from '../types';
import { fetchReceiptImage } from '../services/firestoreService';
import { formatIDR, formatDateIndo } from '../utils/constants';

interface ReceiptDetailModalProps {
  userId: string;
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  userId,
  transaction,
  onClose,
}) => {
  const [loadedImage, setLoadedImage] = useState<string | null>(null);
  const [isImageMissing, setIsImageMissing] = useState(false);

  const transactionId = transaction?.id;
  const needsImageFetch = Boolean(transaction?.hasReceiptImage && !transaction.receiptImage);

  useEffect(() => {
    setLoadedImage(null);
    setIsImageMissing(false);
    if (!transactionId || !needsImageFetch) return;

    let isCurrent = true;
    fetchReceiptImage(userId, transactionId)
      .then((image) => {
        if (!isCurrent) return;
        setLoadedImage(image);
        setIsImageMissing(!image);
      })
      .catch((error) => {
        console.error('Failed loading receipt image:', error);
        if (isCurrent) setIsImageMissing(true);
      });

    return () => {
      isCurrent = false;
    };
  }, [userId, transactionId, needsImageFetch]);

  if (!transaction) return null;

  const receiptImage = transaction.receiptImage || loadedImage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Detail Bukti Struk & Item</h3>
              <p className="text-xs text-slate-500">Data hasil pemindaian Multimodal Gemini OCR</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Summary Header */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-teal-50/50 border border-teal-100">
            <div>
              <span className="text-xs text-teal-800 font-medium block">Total Pembayaran</span>
              <span className="text-xl font-bold text-teal-950">
                {formatIDR(transaction.amount)}
              </span>
            </div>
            <div className="text-right text-xs text-slate-600 space-y-0.5">
              <div className="flex items-center justify-end gap-1 font-semibold text-slate-900">
                <Store className="w-3.5 h-3.5 text-teal-600" />
                {transaction.merchant}
              </div>
              <div className="flex items-center justify-end gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {formatDateIndo(transaction.date)}
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Kategori & Alokasi
              </span>
              <span className="font-medium text-slate-800">
                {transaction.category}
                {transaction.type === 'expense'
                  ? ` · ${transaction.budgetClassification.toUpperCase()}`
                  : ''}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Metode Pembayaran
              </span>
              <span className="font-medium text-slate-800">{transaction.paymentMethod}</span>
            </div>
          </div>

          {/* Itemized List */}
          {transaction.items && transaction.items.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                Daftar Item Belanja ({transaction.items.length} item)
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {transaction.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 flex items-center justify-between bg-white hover:bg-slate-50"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{item.name}</div>
                      {item.qty && item.price && (
                        <div className="text-[11px] text-slate-500">
                          {item.qty}x @ {formatIDR(item.price)}
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-slate-900">{formatIDR(item.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stored Receipt Image or PDF Document */}
          {needsImageFetch && !loadedImage && (
            <p className="text-xs text-slate-500">
              {isImageMissing ? 'Foto struk gagal dimuat.' : 'Memuat foto struk...'}
            </p>
          )}

          {receiptImage && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                {receiptImage.startsWith('data:application/pdf')
                  ? 'Dokumen Invoice Digital (PDF)'
                  : 'Foto / Salinan Struk Asli'}
              </h4>
              {receiptImage.startsWith('data:application/pdf') ? (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-center text-center space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shadow-xs">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Dokumen PDF Invoice ({transaction.merchant})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Tersimpan secara aman di riwayat transaksi
                    </span>
                  </div>
                  <a
                    href={receiptImage}
                    download={`Invoice_${transaction.merchant.replace(/\s+/g, '_')}_${transaction.date}.pdf`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Dokumen PDF</span>
                  </a>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center justify-center max-h-72 overflow-hidden">
                  <img
                    src={receiptImage}
                    alt="Receipt snapshot"
                    className="max-h-68 w-auto object-contain rounded"
                  />
                </div>
              )}
            </div>
          )}

          {transaction.notes && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-700 block mb-0.5">Catatan:</span>
              {transaction.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

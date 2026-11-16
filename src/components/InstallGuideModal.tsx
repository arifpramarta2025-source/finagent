import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Download,
  Laptop,
} from 'lucide-react';

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  // The live URL currently open in the user's browser
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (!isOpen) return null;

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 via-white to-teal-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Cara Menggunakan FINA Setiap Hari
              </h3>
              <p className="text-xs text-slate-500">
                Pasang di HP seperti aplikasi asli tanpa perlu download Play Store / App Store
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

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Step 1: Link Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div>
              <span className="font-bold text-slate-800 block text-xs">1. Salin Link Aplikasi</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Buka link ini di HP, lalu login dengan akun Google Anda:
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono truncate"
              />
              <button
                type="button"
                onClick={() => handleCopyLink(appUrl)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Install Guide for Android & iPhone */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 block text-sm">
              2. Tambahkan ke Layar Utama (Add to Home Screen)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Android Chrome */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Di Android (Google Chrome):
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600 text-[11px] leading-relaxed">
                  <li>Buka link aplikasi di Chrome.</li>
                  <li>
                    Tekan ikon <strong>Titik Tiga (⋮)</strong> di pojok kanan atas.
                  </li>
                  <li>
                    Pilih menu <strong>"Tambahkan ke Layar Utama"</strong> atau{' '}
                    <strong>"Instal Aplikasi"</strong>.
                  </li>
                  <li>Ikon FINA akan langsung muncul di halaman depan HP Anda.</li>
                </ol>
              </div>

              {/* iPhone Safari */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Di iPhone / iPad (Safari):
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600 text-[11px] leading-relaxed">
                  <li>Buka link aplikasi di Safari.</li>
                  <li>
                    Tekan tombol <strong>Bagikan / Share</strong> (kotak panah ke atas di bawah
                    layar).
                  </li>
                  <li>
                    Geser ke bawah dan pilih{' '}
                    <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Tekan <strong>Tambah</strong> di pojok kanan atas.
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Privacy & Storage Info */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-emerald-950 block">
                Privat & Tersinkron di Akun Anda
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Transaksi tersimpan di Firestore dan hanya bisa dibuka oleh akun Anda, jadi data di
                laptop dan HP selalu sama.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

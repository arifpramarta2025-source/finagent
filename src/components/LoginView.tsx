import React, { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { findMember } from '../utils/members';
import { Bot, Shield, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!findMember(user.email)) {
        // Unauthorized email -> sign out immediately
        await signOut(auth);
        setErrorMessage(
          `Akses Ditolak: Email ini tidak terdaftar untuk mengakses Fina. Anda masuk menggunakan "${user.email || 'tanpa email'}".`
        );
        return;
      }

      // Successful authorized login
      onLoginSuccess();
    } catch (error: any) {
      console.error('Google Sign In error:', error);
      if (error?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(
          error?.message || 'Gagal melakukan login dengan Google. Silakan coba kembali.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
            <Bot className="w-8 h-8" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">FINA</h1>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                WPU FinAgent
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Asisten Keuangan Pribadi Berbasis Gemini AI & Firebase Firestore
            </p>
          </div>
        </div>

        {/* Security Access Badge */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 text-slate-600">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Akses Terenkripsi & Terproteksi</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Hanya email pemilik terdaftar yang memiliki izin membaca dan menulis buku kas di
            Firebase:
          </p>
          <div className="font-mono text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded border border-slate-200 truncate">
            Hanya akun Andi dan Sari
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Sign In CTA */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Memverifikasi Akun Google...</span>
            </>
          ) : (
            <>
              {/* Google G Logo SVG */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Masuk dengan Google</span>
            </>
          )}
        </button>

        {/* Feature Highlights */}
        <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Tersinkronisasi otomatis di Cloud Firestore (Laptop & HP)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Audit Finansial 50/30/20 & OCR Struk berbasis Gemini AI</span>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-xs text-slate-500 text-center relative z-10">
        FINA · WPU FinAgent © 2026. Data tersimpan di Google Cloud Firestore.
      </footer>
    </div>
  );
};

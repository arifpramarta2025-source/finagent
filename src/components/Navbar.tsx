import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Camera,
  Plus,
  LayoutDashboard,
  MessageSquareText,
  ShieldCheck,
  ReceiptText,
  SlidersHorizontal,
  Bot,
  Smartphone,
  LogOut,
  CheckCircle2,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from '../utils/theme';

export type ActiveTab = 'dashboard' | 'chat' | 'audit' | 'transactions' | 'budget';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenSmartText: () => void;
  onOpenReceiptScanner: () => void;
  onOpenManualModal: () => void;
  onOpenInstallGuide: () => void;
  totalBalance?: number;
  isCloudSynced?: boolean;
  userEmail?: string;
  userName?: string;
  userPhoto?: string;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSmartText,
  onOpenReceiptScanner,
  onOpenManualModal,
  onOpenInstallGuide,
  userEmail,
  userName,
  userPhoto,
  onSignOut,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown or mobile speed-dial when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
      if (fabRef.current && !fabRef.current.contains(target)) {
        setIsFabOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
        setIsFabOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Standard 5 menu items identical on all screen sizes
  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'Finn AI', icon: MessageSquareText },
    { id: 'audit', label: 'Audit', icon: ShieldCheck },
    { id: 'transactions', label: 'Riwayat', icon: ReceiptText },
    { id: 'budget', label: 'Anggaran', icon: SlidersHorizontal },
  ];

  return (
    <>
      {/* Top Header Bar (1 baris, h-16 ~64px) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Kiri: Logo dan Tulisan FINA */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-left group focus:outline-none min-h-[44px] cursor-pointer"
              aria-label="FINA Dashboard"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
                FINA
              </span>
            </button>

            {/* Tengah (Desktop lg:): 5 Menu Navigasi dengan jarak konsisten & tanda aktif jelas */}
            <nav
              className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70"
              aria-label="Navigasi Desktop"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap min-h-[44px] cursor-pointer ${
                      isActive
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                    />
                    <span className="whitespace-nowrap">{item.label}</span>
                    {item.id === 'chat' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Kanan: Catat AI, Scan Struk, Tambah Manual & Foto Profil */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Desktop Tombol Catat AI */}
              <button
                onClick={onOpenSmartText}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/90 transition-colors shadow-xs whitespace-nowrap min-h-[44px] cursor-pointer"
                aria-label="Catat AI"
                title="Catat pengeluaran/pemasukan dengan bahasa natural Gemini AI"
              >
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">Catat AI</span>
              </button>

              {/* Desktop Tombol Scan Struk */}
              <button
                onClick={onOpenReceiptScanner}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-teal-900 bg-teal-50 border border-teal-200 hover:bg-teal-100/90 transition-colors shadow-xs whitespace-nowrap min-h-[44px] cursor-pointer"
                aria-label="Scan Struk"
                title="Pindai foto struk belanja otomatis dengan OCR Gemini AI"
              >
                <Camera className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">Scan Struk</span>
              </button>

              {/* Desktop Tombol Tambah Manual */}
              <button
                onClick={onOpenManualModal}
                className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xs whitespace-nowrap min-h-[44px] cursor-pointer"
                aria-label="Tambah Manual"
                title="Tambah transaksi manual"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline whitespace-nowrap">Tambah Manual</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
                title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Foto Profil & Dropdown Menu */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  className="min-h-[44px] min-w-[44px] p-1 flex items-center justify-center rounded-full hover:ring-2 hover:ring-emerald-500/30 transition-all focus:outline-none cursor-pointer"
                  aria-label="Buka menu profil"
                  aria-expanded={isProfileOpen}
                >
                  {userPhoto ? (
                    <img
                      src={userPhoto}
                      alt={userName || 'User'}
                      className="w-9 h-9 rounded-full object-cover border-2 border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {(userEmail || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>

                {/* Profil Dropdown Menu */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* User Info (Nama & Email) */}
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate whitespace-nowrap">
                        {userName || 'Pengguna FINA'}
                      </p>
                      {userEmail && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono whitespace-nowrap">
                          {userEmail}
                        </p>
                      )}
                    </div>

                    {/* Status Tersinkron */}
                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="font-semibold text-emerald-800 whitespace-nowrap">
                          Tersinkron
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Firestore
                      </span>
                    </div>

                    {/* Pasang di HP */}
                    <div className="p-1 border-b border-slate-100">
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onOpenInstallGuide();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap min-h-[44px] text-left cursor-pointer"
                      >
                        <Smartphone className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="whitespace-nowrap">Pasang di HP</span>
                      </button>
                    </div>

                    {/* Keluar */}
                    {onSignOut && (
                      <div className="p-1">
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            onSignOut();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors whitespace-nowrap min-h-[44px] text-left cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          <span className="whitespace-nowrap">Keluar</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Speed Dial Menu & Round Floating Action Button (+) di HP & Tablet (< 1024px) */}
      <div
        className={`fixed bottom-20 right-4 sm:right-6 z-40 lg:hidden ${
          activeTab === 'chat' ? 'hidden' : ''
        }`}
        ref={fabRef}
      >
        {/* Backdrop saat menu pilihan terbuka */}
        {isFabOpen && (
          <div
            onClick={() => setIsFabOpen(false)}
            className="fixed inset-0 bg-slate-950/25 backdrop-blur-xs -z-10 animate-in fade-in duration-150"
            aria-hidden="true"
          />
        )}

        {/* Speed Dial Action Options */}
        {isFabOpen && (
          <div className="flex flex-col items-end gap-2.5 mb-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* 1. Catat AI */}
            <button
              onClick={() => {
                setIsFabOpen(false);
                onOpenSmartText();
              }}
              className="flex items-center gap-3 px-4 py-2.5 bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200/90 hover:bg-emerald-50/70 active:scale-95 transition-all min-h-[44px] cursor-pointer whitespace-nowrap group text-right"
            >
              <div>
                <span className="block text-xs font-bold text-slate-900 whitespace-nowrap group-hover:text-emerald-700">
                  Catat AI
                </span>
                <span className="block text-[10px] text-slate-400 whitespace-nowrap">
                  Tulis kalimat bebas
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/80">
                <Sparkles className="w-4 h-4" />
              </div>
            </button>

            {/* 2. Scan Struk */}
            <button
              onClick={() => {
                setIsFabOpen(false);
                onOpenReceiptScanner();
              }}
              className="flex items-center gap-3 px-4 py-2.5 bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200/90 hover:bg-teal-50/70 active:scale-95 transition-all min-h-[44px] cursor-pointer whitespace-nowrap group text-right"
            >
              <div>
                <span className="block text-xs font-bold text-slate-900 whitespace-nowrap group-hover:text-teal-700">
                  Scan Struk
                </span>
                <span className="block text-[10px] text-slate-400 whitespace-nowrap">
                  Foto / unggah nota
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-200/80">
                <Camera className="w-4 h-4" />
              </div>
            </button>

            {/* 3. Tambah Manual */}
            <button
              onClick={() => {
                setIsFabOpen(false);
                onOpenManualModal();
              }}
              className="flex items-center gap-3 px-4 py-2.5 bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200/90 hover:bg-slate-100 active:scale-95 transition-all min-h-[44px] cursor-pointer whitespace-nowrap group text-right"
            >
              <div>
                <span className="block text-xs font-bold text-slate-900 whitespace-nowrap group-hover:text-slate-950">
                  Tambah Manual
                </span>
                <span className="block text-[10px] text-slate-400 whitespace-nowrap">
                  Isi formulir manual
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                <Plus className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}

        {/* Tombol Bulat Utama (+) */}
        <button
          onClick={() => setIsFabOpen((prev) => !prev)}
          className={`w-13 h-13 min-w-[44px] min-h-[44px] rounded-full text-white shadow-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer focus:outline-none ${
            isFabOpen
              ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30 rotate-45'
              : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/30'
          }`}
          aria-label={
            isFabOpen ? 'Tutup Pilihan Tambah Transaksi' : 'Buka Pilihan Tambah Transaksi'
          }
          title="Tambah Transaksi"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Bottom Navigation Bar (Tablet & HP, lg:hidden) - Tetap terlihat, 5 menu rata, no scroll */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] lg:hidden"
        aria-label="Navigasi Utama"
      >
        <div className="grid grid-cols-5 h-16 w-full max-w-lg mx-auto px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'text-emerald-700 font-bold bg-emerald-50/70'
                    : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? 'text-emerald-600' : 'text-slate-500'
                    }`}
                  />
                  {item.id === 'chat' && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-1 ring-white" />
                  )}
                </div>
                <span className="text-[10px] leading-tight mt-1 whitespace-nowrap truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

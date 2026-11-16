import React, { useMemo, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth } from './services/firebase';
import {
  subscribeToRecentTransactions,
  fetchEveryTransaction,
  addTransactionToFirestore,
  updateTransactionInFirestore,
  deleteTransactionFromFirestore,
  subscribeToUserBudget,
  saveBudgetToFirestore,
  migrateLocalInsights,
  recordActivity,
  resolveLedger,
  setActivityActor,
  LedgerLookup,
  subscribeToCategoryConfig,
  confirmWrite,
  DEFAULT_CLEAN_BUDGET,
} from './services/firestoreService';
import { LoginView } from './components/LoginView';
import { Navbar, ActiveTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { FinaBotView } from './components/FinaBotView';
import { AuditView } from './components/AuditView';
import { TransactionsView } from './components/TransactionsView';
import { BudgetSettingsView } from './components/BudgetSettingsView';
import { BackupPanel } from './components/BackupPanel';
import { CategorySettingsPanel } from './components/CategorySettingsPanel';
import { SmartTextModal } from './components/SmartTextModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { ManualTransactionModal } from './components/ManualTransactionModal';
import { ReceiptDetailModal } from './components/ReceiptDetailModal';
import { InstallGuideModal } from './components/InstallGuideModal';
import { Transaction, BudgetSettings } from './types';
import { calculateSummary, exportTransactionsCSV } from './utils/storage';
import { getLocalMonthKey } from './utils/constants';
import {
  RECENT_MONTHS,
  mergeTransactions,
  monthStart,
  touchesOlderHistory,
} from './utils/transactionWindow';
import { useOlderTransactions } from './hooks/useOlderTransactions';
import { chatDocumentId, findMember } from './utils/members';
import { CategoryProvider } from './hooks/useCategories';
import { CategoryConfig, buildDefaultCategories, categoryColor } from './utils/categories';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>(DEFAULT_CLEAN_BUDGET);
  const [isTransactionsLoaded, setIsTransactionsLoaded] = useState(false);
  const [isBudgetLoaded, setIsBudgetLoaded] = useState(false);
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig>(buildDefaultCategories);
  const [categoryStatus, setCategoryStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [hasDataError, setHasDataError] = useState(false);

  // Modals state
  const [isSmartTextOpen, setIsSmartTextOpen] = useState(false);
  const [smartTextInitial, setSmartTextInitial] = useState('');
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedReceiptDetail, setSelectedReceiptDetail] = useState<Transaction | null>(null);

  const [ledger, setLedger] = useState<LedgerLookup | null>(null);
  const [ledgerError, setLedgerError] = useState(false);
  const ledgerId = ledger?.status === 'ready' ? ledger.ledgerId : null;

  const windowStart = useMemo(() => monthStart(new Date(), RECENT_MONTHS - 1), []);
  const history = useOlderTransactions(ledgerId, windowStart);
  const transactions = useMemo(
    () => mergeTransactions(recentTransactions, history.older),
    [recentTransactions, history.older]
  );

  // 1. Firebase Authentication Listener (Strictly restricted to Fina's members)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user && findMember(user.email)) {
        setCurrentUser(user);
      } else {
        if (user) {
          console.warn('Unauthorized user blocked:', user.email);
          await signOut(auth);
        }
        setCurrentUser(null);
        setLedger(null);
        setLedgerError(false);
        setActivityActor(null, false);
        setRecentTransactions([]);
        setBudgetSettings(DEFAULT_CLEAN_BUDGET);
        setCategoryConfig(buildDefaultCategories());
        setCategoryStatus('loading');
        setIsTransactionsLoaded(false);
        setIsBudgetLoaded(false);
        setHasDataError(false);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Find the shared ledger and who is writing to it
  useEffect(() => {
    const member = findMember(currentUser?.email);
    if (!currentUser || !member) return;

    let isCurrent = true;
    setLedgerError(false);
    resolveLedger(currentUser.uid, member.isLedgerOwner)
      .then((result) => {
        if (!isCurrent) return;
        setActivityActor(
          {
            uid: currentUser.uid,
            name: member.name,
            chatDocumentId: chatDocumentId(member, currentUser.uid),
          },
          result.status === 'ready' && result.logEnabled
        );
        setLedger(result);
      })
      .catch((error) => {
        console.error('Failed finding the ledger:', error);
        if (isCurrent) setLedgerError(true);
      });

    return () => {
      isCurrent = false;
    };
  }, [currentUser]);

  // 3. Real-time Firestore Subscriptions (Transactions & Budget)
  useEffect(() => {
    if (!ledgerId) return;

    migrateLocalInsights(ledgerId).catch((error) => {
      console.error('Failed moving local chat and audit data to Firestore:', error);
    });

    // Real-time listener for personal transactions
    const handleDataError = () => setHasDataError(true);

    const unsubTx = subscribeToRecentTransactions(
      ledgerId,
      windowStart,
      (txs) => {
        setRecentTransactions(txs);
        setIsTransactionsLoaded(true);
        setHasDataError(false);
      },
      handleDataError
    );

    // Real-time listener for personal budget settings
    const unsubBudget = subscribeToUserBudget(
      ledgerId,
      (budget) => {
        setBudgetSettings(budget);
        setIsBudgetLoaded(true);
      },
      handleDataError
    );

    const unsubCategories = subscribeToCategoryConfig(
      ledgerId,
      (config) => {
        setCategoryConfig(config);
        setCategoryStatus('ready');
      },
      () => {
        setCategoryStatus('failed'); // Editing stays off so the built-in list cannot overwrite the real one.
        handleDataError();
      }
    );

    return () => {
      unsubTx();
      unsubBudget();
      unsubCategories();
    };
  }, [ledgerId, windowStart]);

  // Every "Bulan Ini" figure comes from the current month only
  const currentMonth = getLocalMonthKey();
  const monthlyTransactions = transactions.filter((tx) => tx.date.startsWith(currentMonth));
  const summary = calculateSummary(monthlyTransactions, (category) =>
    categoryColor(categoryConfig, category)
  );

  // Save new or edited transaction directly to Firestore
  const handleSaveTransaction = async (
    txData: Omit<Transaction, 'id' | 'createdAt'>,
    editId?: string
  ) => {
    if (!ledgerId) return;

    const previous = transactions.find((tx) => tx.id === editId);
    if (editId) {
      if (!previous) throw new Error('Transaksi tidak ditemukan. Muat ulang halaman.');
      await confirmWrite(() => updateTransactionInFirestore(ledgerId, editId, txData, previous));
    } else {
      const newTx: Transaction = {
        ...txData,
        id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
      };
      await confirmWrite(() => addTransactionToFirestore(ledgerId, newTx));
    }

    if (touchesOlderHistory([previous?.date, txData.date], windowStart)) {
      await history.refresh();
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const transaction = transactions.find((tx) => tx.id === id);
    if (!ledgerId || !transaction) return;
    try {
      await confirmWrite(() => deleteTransactionFromFirestore(ledgerId, transaction));
      if (touchesOlderHistory([transaction.date], windowStart)) {
        await history.refresh();
      }
    } catch (error: any) {
      window.alert(error?.message || 'Transaksi gagal dihapus. Silakan coba lagi.');
    }
  };

  const handleExportCsv = async () => {
    if (!ledgerId) return;
    try {
      exportTransactionsCSV(await fetchEveryTransaction(ledgerId));
    } catch (error) {
      console.error('Failed exporting transactions:', error);
      window.alert(
        'CSV gagal dibuat, tidak ada file yang diunduh. Periksa koneksi lalu coba lagi.'
      );
    }
  };

  const handleResetData = async () => {
    if (!ledgerId) return;

    let everyTransaction: Transaction[];
    try {
      // Deleting from the loaded list alone would leave older history behind.
      everyTransaction = await fetchEveryTransaction(ledgerId);
    } catch (error) {
      console.error('Failed reading transactions before reset:', error);
      window.alert('Data gagal dibaca, tidak ada yang dihapus. Periksa koneksi lalu coba lagi.');
      return;
    }

    const confirmation = window.prompt(
      `Tindakan ini menghapus permanen ${everyTransaction.length} transaksi dan tidak bisa dibatalkan. Unduh cadangan dulu di menu Anggaran.\n\nKetik HAPUS untuk melanjutkan.`
    );
    if (confirmation !== 'HAPUS') return;

    try {
      await recordActivity(ledgerId, {
        action: 'delete_all',
        summary: `Menjalankan Hapus Semua untuk ${everyTransaction.length} transaksi`,
      });
      for (const tx of everyTransaction) {
        await confirmWrite(() => deleteTransactionFromFirestore(ledgerId, tx));
      }
    } catch (error: any) {
      window.alert(error?.message || 'Sebagian transaksi gagal dihapus. Silakan cek Riwayat.');
    } finally {
      await history.refresh();
    }
  };

  const handleOpenManualModal = (txToEdit?: Transaction) => {
    setEditingTransaction(txToEdit || null);
    setIsManualModalOpen(true);
  };

  const handleOpenSmartText = (initialText?: string) => {
    setSmartTextInitial(initialText || '');
    setIsSmartTextOpen(true);
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  // Auth loading state
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-3 text-white font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-xs text-slate-400">Memeriksa autentikasi Firebase...</p>
      </div>
    );
  }

  // If not logged in, render the secure Login View
  if (!currentUser) {
    return <LoginView onLoginSuccess={() => {}} />;
  }

  // Signed in, but the shared ledger cannot be opened yet
  if (
    ledgerError ||
    ledger?.status === 'waiting_for_owner' ||
    ledger?.status === 'rules_not_updated'
  ) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 p-6 text-center text-white font-sans">
        <p className="max-w-sm text-sm text-slate-200">
          {ledgerError
            ? 'Buku kas gagal dibuka. Periksa koneksi lalu muat ulang halaman.'
            : ledger?.status === 'waiting_for_owner'
              ? 'Buku kas bersama belum siap. Minta Andi membuka Fina sekali, lalu muat ulang halaman ini.'
              : 'Akses belum aktif karena rules Firestore belum diperbarui. Minta Andi menerapkannya.'}
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-white text-slate-900"
        >
          Keluar
        </button>
      </div>
    );
  }

  // Never show zero balances or empty forms while the real data is still loading
  if (
    !ledgerId ||
    (!hasDataError && (!isTransactionsLoaded || !isBudgetLoaded || categoryStatus === 'loading'))
  ) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-3 text-white font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-xs text-slate-400">Memuat data keuangan...</p>
      </div>
    );
  }

  return (
    <CategoryProvider value={categoryConfig}>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
        {/* Top Navbar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenSmartText={() => handleOpenSmartText('')}
          onOpenReceiptScanner={() => setIsReceiptScannerOpen(true)}
          onOpenManualModal={() => handleOpenManualModal()}
          onOpenInstallGuide={() => setIsInstallGuideOpen(true)}
          totalBalance={summary.totalBalance}
          isCloudSynced={true}
          userEmail={currentUser.email || undefined}
          userName={currentUser.displayName || undefined}
          userPhoto={currentUser.photoURL || undefined}
          onSignOut={handleSignOut}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-8">
          {ledger?.status === 'ready' && !ledger.logEnabled && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800"
            >
              Rules Firestore belum diperbarui. Fina tetap berjalan untuk Anda, tetapi Sari belum
              bisa masuk dan Log Aktivitas belum mencatat.
            </div>
          )}

          {hasDataError && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700"
            >
              Data gagal dimuat, jadi angka di layar belum tentu benar. Periksa koneksi lalu muat
              ulang halaman. Data Anda tidak terhapus.
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              summary={summary}
              transactions={transactions}
              totalTransactionCount={
                history.unloadedCount === null
                  ? undefined
                  : transactions.length + history.unloadedCount
              }
              monthlyTransactions={monthlyTransactions}
              budgetSettings={budgetSettings}
              onOpenSmartText={(text) => handleOpenSmartText(text)}
              onOpenReceiptScanner={() => setIsReceiptScannerOpen(true)}
              onOpenManualModal={() => handleOpenManualModal()}
              onSelectTransactionForDetail={(tx) => setSelectedReceiptDetail(tx)}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onQuickTextSubmit={(text) => handleOpenSmartText(text)}
            />
          )}

          {activeTab === 'chat' && (
            <FinaBotView
              userId={ledgerId}
              summary={summary}
              budgetSettings={budgetSettings}
              transactions={transactions}
            />
          )}

          {activeTab === 'audit' && (
            <AuditView
              userId={ledgerId}
              summary={summary}
              budgetSettings={budgetSettings}
              transactions={monthlyTransactions}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              onOpenManualModal={handleOpenManualModal}
              onOpenSmartText={() => handleOpenSmartText('')}
              onOpenReceiptScanner={() => setIsReceiptScannerOpen(true)}
              onSelectTransactionForDetail={(tx) => setSelectedReceiptDetail(tx)}
              onDeleteTransaction={handleDeleteTransaction}
              onResetData={handleResetData}
              onExportCsv={handleExportCsv}
              history={history}
              ledgerId={ledgerId}
            />
          )}

          {activeTab === 'budget' && (
            <div className="space-y-6">
              <BudgetSettingsView
                settings={budgetSettings}
                onSave={async (newSettings) => {
                  await confirmWrite(() =>
                    saveBudgetToFirestore(ledgerId, newSettings, budgetSettings)
                  );
                }}
              />
              <CategorySettingsPanel
                userId={ledgerId}
                canEdit={categoryStatus === 'ready'}
                onDataChanged={history.refresh}
              />
              <BackupPanel userId={ledgerId} onDataChanged={history.refresh} />
            </div>
          )}
        </main>

        {/* Modals */}
        <SmartTextModal
          isOpen={isSmartTextOpen}
          onClose={() => {
            setIsSmartTextOpen(false);
            setSmartTextInitial('');
          }}
          onSave={handleSaveTransaction}
          initialText={smartTextInitial}
        />

        <ReceiptScannerModal
          isOpen={isReceiptScannerOpen}
          onClose={() => setIsReceiptScannerOpen(false)}
          onSave={handleSaveTransaction}
        />

        <ManualTransactionModal
          isOpen={isManualModalOpen}
          onClose={() => {
            setIsManualModalOpen(false);
            setEditingTransaction(null);
          }}
          onSave={handleSaveTransaction}
          initialTransaction={editingTransaction}
        />

        <ReceiptDetailModal
          userId={ledgerId}
          transaction={selectedReceiptDetail}
          onClose={() => setSelectedReceiptDetail(null)}
        />

        <InstallGuideModal
          isOpen={isInstallGuideOpen}
          onClose={() => setIsInstallGuideOpen(false)}
        />

        {/* Quiet Footer */}
        <footer className="border-t border-slate-200 bg-white py-6 mt-12 mb-20 lg:mb-0 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">FINA</span>
              <span>·</span>
              <span>WPU FinAgent (Sandhika Galih)</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Powered by Google Gemini & Firebase Firestore</span>
              <span>·</span>
              <span>Tersinkronisasi per akun Google</span>
            </div>
          </div>
        </footer>
      </div>
    </CategoryProvider>
  );
}

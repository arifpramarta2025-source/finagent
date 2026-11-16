/**
 * Every Firestore read and write the app makes, grouped by topic under ./firestore/.
 * Components import from this file, so moving code between those files changes no import.
 * Helpers that only those files share are left out on purpose.
 */

export {
  fetchActivityPage,
  isActivityLogEnabled,
  recordActivity,
  setActivityActor,
} from './firestore/activity';
export type { ActivityPage, Actor } from './firestore/activity';
export { applyRestoreWrites, fetchAllUserDocs } from './firestore/backup';
export { confirmWrite } from './firestore/common';
export { resolveLedger } from './firestore/ledger';
export type { LedgerLookup } from './firestore/ledger';
export {
  DEFAULT_CLEAN_BUDGET,
  deleteChatHistory,
  migrateLocalInsights,
  saveAuditResult,
  saveBudgetToFirestore,
  saveCategoryConfig,
  saveChatHistory,
  subscribeToAuditResult,
  subscribeToCategoryConfig,
  subscribeToChatHistory,
  subscribeToUserBudget,
  trimChatHistory,
} from './firestore/settings';
export {
  addTransactionToFirestore,
  countOlderTransactions,
  deleteTransactionFromFirestore,
  fetchEveryTransaction,
  fetchOlderTransactions,
  fetchReceiptImage,
  subscribeToRecentTransactions,
  updateTransactionInFirestore,
  updateTransactionsInBatches,
} from './firestore/transactions';

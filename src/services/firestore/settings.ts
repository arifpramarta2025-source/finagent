/** Budget, categories, Finn chat and audit documents under settings/. */
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AuditResult, ChatMessage, BudgetSettings } from '../../types';
import { readPercentage } from '../../utils/storage';
import { parseCategoryConfig, type CategoryConfig } from '../../utils/categories';
import { describeBudget } from '../../utils/activityLog';
import { addActivityToBatch, getActor } from './activity';
import { withoutUndefined } from './common';

export const DEFAULT_CLEAN_BUDGET: BudgetSettings = {
  monthlyIncomeTarget: 0,
  emergencyFundTarget: 0,
  currentEmergencyFund: 0,
  needsPercentage: 50,
  wantsPercentage: 30,
  savingsPercentage: 20,
};

const MAX_CHAT_MESSAGES = 60;

const MAX_CHAT_CHARS = 800_000;

function chatDocRef(userId: string) {
  return doc(db, 'users', userId, 'settings', getActor()?.chatDocumentId ?? 'chat');
}

/** Keeps the newest messages that fit in one Firestore document. */
export function trimChatHistory(messages: ChatMessage[]): ChatMessage[] {
  const trimmed = messages.slice(-MAX_CHAT_MESSAGES);
  while (trimmed.length > 0 && JSON.stringify(trimmed).length > MAX_CHAT_CHARS) {
    trimmed.shift();
  }
  return trimmed;
}

/**
 * Real-time listener for user's budget settings in Firestore
 */
export function subscribeToUserBudget(
  userId: string,
  callback: (budget: BudgetSettings) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const docRef = doc(db, 'users', userId, 'settings', 'budget');

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          monthlyIncomeTarget: Number(data.monthlyIncomeTarget) || 0,
          emergencyFundTarget: Number(data.emergencyFundTarget) || 0,
          currentEmergencyFund: Number(data.currentEmergencyFund) || 0,
          needsPercentage: readPercentage(data.needsPercentage, 50),
          wantsPercentage: readPercentage(data.wantsPercentage, 30),
          savingsPercentage: readPercentage(data.savingsPercentage, 20),
        });
      } else {
        // Start with clean empty budget
        callback(DEFAULT_CLEAN_BUDGET);
      }
    },
    (error) => {
      console.error('Firestore budget snapshot error:', error);
      onError(error);
    }
  );
}

/**
 * Save budget settings to Firestore
 */
export async function saveBudgetToFirestore(
  userId: string,
  budget: BudgetSettings,
  before: BudgetSettings
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', userId, 'settings', 'budget'), {
    ...budget,
    userId,
    updatedAt: new Date().toISOString(),
  });
  addActivityToBatch(batch, userId, describeBudget(before, budget));
  await batch.commit();
}

/** Real-time listener for the owner's category lists. No document means the built-in lists. */
export function subscribeToCategoryConfig(
  userId: string,
  callback: (config: CategoryConfig) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', userId, 'settings', 'categories'),
    (snapshot) => callback(parseCategoryConfig(snapshot.data())),
    (error) => {
      console.error('Firestore categories snapshot error:', error);
      onError(error);
    }
  );
}

export async function saveCategoryConfig(
  userId: string,
  config: CategoryConfig,
  summary: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'users', userId, 'settings', 'categories'),
    withoutUndefined({ ...config, userId, updatedAt: new Date().toISOString() })
  );
  addActivityToBatch(batch, userId, { action: 'category', summary });
  await batch.commit();
}

/**
 * Real-time listener for the user's Finn chat history
 */
export function subscribeToChatHistory(
  userId: string,
  callback: (messages: ChatMessage[]) => void
): Unsubscribe {
  const docRef = chatDocRef(userId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      const messages = snapshot.data()?.messages;
      callback(Array.isArray(messages) ? (messages as ChatMessage[]) : []);
    },
    (error) => {
      console.error('Firestore chat snapshot error:', error);
    }
  );
}

export async function saveChatHistory(userId: string, messages: ChatMessage[]): Promise<void> {
  const docRef = chatDocRef(userId);
  await setDoc(
    docRef,
    withoutUndefined({
      messages: trimChatHistory(messages),
      userId,
      updatedAt: new Date().toISOString(),
    })
  );
}

export async function deleteChatHistory(userId: string): Promise<void> {
  await deleteDoc(chatDocRef(userId));
}

/**
 * Real-time listener for the latest financial audit
 */
export function subscribeToAuditResult(
  userId: string,
  callback: (audit: AuditResult | null) => void
): Unsubscribe {
  const docRef = doc(db, 'users', userId, 'settings', 'audit');

  return onSnapshot(
    docRef,
    (snapshot) => {
      const result = snapshot.data()?.result;
      callback(result ? (result as AuditResult) : null);
    },
    (error) => {
      console.error('Firestore audit snapshot error:', error);
    }
  );
}

export async function saveAuditResult(userId: string, audit: AuditResult): Promise<void> {
  const docRef = doc(db, 'users', userId, 'settings', 'audit');
  await setDoc(
    docRef,
    withoutUndefined({
      result: audit,
      userId,
      updatedAt: new Date().toISOString(),
    })
  );
}

/**
 * Moves chat and audit data saved by older versions out of this browser.
 * Local copies are removed only after their data is safely in Firestore.
 */
export async function migrateLocalInsights(userId: string): Promise<void> {
  const chatKey = 'fina_chat_history_v1';
  const auditKey = 'fina_audit_result_v1';

  const storedChat = localStorage.getItem(chatKey);
  if (storedChat !== null) {
    const chatRef = chatDocRef(userId);
    if (!(await getDoc(chatRef)).exists()) {
      const parsed = parseStoredJson(storedChat);
      const messages = Array.isArray(parsed)
        ? (parsed as ChatMessage[]).filter((message) => message.id !== 'msg-welcome')
        : [];
      if (messages.length > 0) {
        await saveChatHistory(userId, messages);
      }
    }
    localStorage.removeItem(chatKey);
  }

  const storedAudit = localStorage.getItem(auditKey);
  if (storedAudit !== null) {
    const auditRef = doc(db, 'users', userId, 'settings', 'audit');
    if (!(await getDoc(auditRef)).exists()) {
      const parsed = parseStoredJson(storedAudit);
      if (parsed && typeof parsed === 'object' && 'healthScore' in parsed) {
        await saveAuditResult(userId, parsed as AuditResult);
      }
    }
    localStorage.removeItem(auditKey);
  }
}

function parseStoredJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

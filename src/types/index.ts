export type TransactionType = 'income' | 'expense';

export type BudgetClassification = 'needs' | 'wants' | 'savings';

export type PaymentMethod =
  'Tunai' | 'Transfer Bank' | 'QRIS / E-Wallet' | 'Kartu Kredit' | 'Kartu Debit' | 'Lainnya';

export interface ReceiptItem {
  name: string;
  qty?: number;
  price?: number;
  total: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  subCategory?: string;
  merchant: string;
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod | string;
  notes?: string;
  budgetClassification: BudgetClassification;
  receiptImage?: string; // base64 image; new receipts keep it in a separate document
  hasReceiptImage?: boolean;
  items?: ReceiptItem[];
  createdAt: string;
  createdByName?: string; // Empty on records saved before Fina was shared.
  updatedByName?: string;
}

export interface BudgetSettings {
  monthlyIncomeTarget: number;
  emergencyFundTarget: number;
  currentEmergencyFund: number;
  needsPercentage: number; // default 50
  wantsPercentage: number; // default 30
  savingsPercentage: number; // default 20
}

export interface CategoryStat {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  savingsRate: number;
  needsTotal: number;
  wantsTotal: number;
  savingsTotal: number;
  topCategories: CategoryStat[];
  dailyTrends: Array<{ date: string; income: number; expense: number; net: number }>;
}

export interface SpendingLeak {
  title: string;
  description: string;
  estimatedMonthlyImpact?: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ActionRecommendation {
  priority: number;
  title: string;
  action: string;
  category?: string;
}

export interface AuditResult {
  healthScore: number;
  healthStatus: string;
  headline: string;
  rule50_30_20: {
    needsPercentage: number;
    wantsPercentage: number;
    savingsPercentage: number;
    analysis: string;
  };
  spendingLeaks: SpendingLeak[];
  emergencyFundEvaluation: {
    monthsCovered: number;
    targetMonths: number;
    statusMessage: string;
  };
  actionRecommendations: ActionRecommendation[];
  inspirationalQuote: string;
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  groundingSources?: Array<{ title?: string; uri?: string }>;
}

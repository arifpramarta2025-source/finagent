import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Loader2,
  Globe,
  Trash2,
  ExternalLink,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { ChatMessage, FinancialSummary, BudgetSettings, Transaction } from '../types';
import { askFinn } from '../services/finnChat';
import { ChatText } from './ChatText';
import {
  deleteChatHistory,
  saveChatHistory,
  subscribeToChatHistory,
} from '../services/firestoreService';

interface FinaBotViewProps {
  userId: string;
  summary: FinancialSummary;
  budgetSettings: BudgetSettings;
  transactions: Transaction[];
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'msg-welcome',
  role: 'assistant',
  content: `Halo! Saya **Finn**, asisten keuangan pribadi Anda.

Ada yang ingin didiskusikan? Misalnya mengevaluasi rencana pembelian, menghitung alokasi 50/30/20, atau meninjau pos pengeluaran yang boros.`,
  timestamp: '',
};

const SUGGESTED_PROMPTS = [
  'Apakah aman beli iPhone 16 seharga 16 juta dengan keuangan saya saat ini?',
  'Berapa total pengeluaran kopi & nongkrong saya bulan ini?',
  'Bagaimana evaluasi proporsi 50/30/20 dari pengeluaran saya?',
  'Berapa bulan dana darurat saya bisa bertahan jika terjadi hal tak terduga?',
  'Beri 3 strategi realistis memangkas kebocoran dana kecil (micro-spending)',
];

export const FinaBotView: React.FC<FinaBotViewProps> = ({
  userId,
  summary,
  budgetSettings,
  transactions,
}) => {
  const [savedMessages, setSavedMessages] = useState<ChatMessage[]>([]);
  const savedMessagesRef = useRef<ChatMessage[]>([]);
  const messages = savedMessages.length > 0 ? savedMessages : [WELCOME_MESSAGE];

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [enableSearch, setEnableSearch] = useState(false);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeToChatHistory(userId, (history) => {
      savedMessagesRef.current = history;
      setSavedMessages(history);
    });
  }, [userId]);

  useEffect(() => {
    // Only the chat area moves, so the page and the question stay in view on a phone.
    const area = messagesAreaRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [savedMessages, streamingText]);

  const appendMessage = (message: ChatMessage) => {
    const next = [...savedMessagesRef.current, message];
    savedMessagesRef.current = next;
    setSavedMessages(next);
    saveChatHistory(userId, next).catch((error) => {
      console.error('Failed saving chat history:', error);
    });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    const history = savedMessagesRef.current.slice(-8);
    appendMessage(userMsg);
    setInput('');
    setIsLoading(true);
    setChatError(null);

    try {
      // Build financial context
      const financialContext = {
        period: 'Bulan berjalan',
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netCashflow: summary.netCashflow,
        savingsRate: summary.savingsRate,
        needsTotal: summary.needsTotal,
        wantsTotal: summary.wantsTotal,
        savingsTotal: summary.savingsTotal,
        currentEmergencyFund: budgetSettings.currentEmergencyFund,
        emergencyFundTarget: budgetSettings.emergencyFundTarget,
        topExpenseCategories: summary.topCategories.slice(0, 6),
        recentTransactions: transactions.slice(0, 8).map((t) => ({
          date: t.date,
          merchant: t.merchant,
          category: t.category,
          amount: t.amount,
          type: t.type,
          classification: t.budgetClassification,
        })),
      };

      const json = await askFinn(
        {
          message: text,
          history: history.map((m) => ({ role: m.role, content: m.content })),
          financialContext,
          enableSearch,
        },
        setStreamingText
      );

      // Check grounding sources
      const sources: Array<{ title?: string; uri?: string }> = [];
      const groundChunks = json.groundingMetadata?.groundingChunks;
      if (Array.isArray(groundChunks)) {
        for (const chunk of groundChunks) {
          if (chunk.web?.uri?.startsWith('https://')) {
            sources.push({
              title: chunk.web.title || 'Sumber Web',
              uri: chunk.web.uri,
            });
          }
        }
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: json.isInterrupted
          ? `${json.reply}\n\n(Jawaban terputus. Silakan tanyakan lagi.)`
          : json.reply,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        groundingSources: sources.length > 0 ? sources : undefined,
      };

      appendMessage(botMsg);
    } catch (err: any) {
      // Show the failure plainly: a canned reply could be mistaken for real analysis.
      console.warn('Finn could not reply:', err);
      setChatError(err?.message || 'Finn belum bisa menjawab. Silakan coba lagi.');
    } finally {
      setStreamingText(null);
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Hapus seluruh riwayat percakapan dengan Finn?')) {
      savedMessagesRef.current = [];
      setSavedMessages([]);
      deleteChatHistory(userId).catch((error) => {
        console.error('Failed deleting chat history:', error);
      });
    }
  };

  return (
    <div className="h-[calc(100dvh-180px)] lg:h-[calc(100vh-140px)] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-blue-50/50 via-white to-emerald-50/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 text-sm truncate">Finn · Asisten AI</h2>
            <p className="text-xs text-emerald-700 flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate">Data keuangan terhubung</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Google Search Grounding Toggle */}
          <button
            type="button"
            onClick={() => setEnableSearch(!enableSearch)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              enableSearch
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Gunakan Google Search Grounding untuk mengecek harga barang terkini di internet"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search Grounding</span>
            <span
              className={`w-2 h-2 rounded-full ${
                enableSearch ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'
              }`}
            />
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Bersihkan riwayat obrolan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesAreaRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-xs shadow-xs'
                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-xs'
              }`}
            >
              <ChatText text={msg.content} />

              {/* Grounding Sources Citation if any */}
              {msg.groundingSources && msg.groundingSources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                  <span className="font-semibold block mb-1">Rujukan Google Search:</span>
                  <div className="flex flex-wrap gap-2">
                    {msg.groundingSources.slice(0, 3).map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{src.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <span
                className={`text-[10px] block mt-1.5 text-right ${
                  msg.role === 'user' ? 'text-slate-400' : 'text-slate-400'
                }`}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {streamingText !== null && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div
              aria-live="polite"
              className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tl-xs px-4 py-3 text-xs sm:text-sm leading-relaxed bg-white text-slate-800 border border-slate-200/80 shadow-xs"
            >
              <ChatText text={streamingText} />
              <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-blue-600 animate-pulse" />
            </div>
          </div>
        )}

        {isLoading && streamingText === null && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Finn sedang menganalisis buku kas & menghitung keputusan...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Quick Questions Bar */}
      <div className="px-4 py-2 border-t border-slate-100 bg-white overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            Ide Pertanyaan:
          </span>
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              disabled={isLoading}
              className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-3 py-1 rounded-full transition-colors shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {chatError && (
        <p
          role="alert"
          className="px-4 py-2 border-t border-rose-200 bg-rose-50 text-xs text-rose-700"
        >
          {chatError}
        </p>
      )}

      {/* Input Box Form */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Tanyakan soal keuangan Anda..."
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-xs"
            title="Kirim pesan"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

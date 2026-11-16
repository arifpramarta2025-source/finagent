import React from 'react';
import { Edit2, Eye, Trash2 } from 'lucide-react';
import { Transaction } from '../types';
import { formatDateIndo, formatIDR } from '../utils/constants';
import { recordedBy } from '../utils/members';

interface TransactionCardProps {
  tx: Transaction;
  onViewDetail: (tx: Transaction) => void;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
}

/** Layout of one transaction on screens too narrow for the table. */
export const TransactionCard: React.FC<TransactionCardProps> = ({
  tx,
  onViewDetail,
  onEdit,
  onDelete,
}) => {
  const isIncome = tx.type === 'income';
  const hasDetail = Boolean(tx.receiptImage || tx.hasReceiptImage || tx.items?.length);
  const categoryLine = [tx.category, tx.subCategory].filter(Boolean).join(' · ');
  const metaLine = [
    formatDateIndo(tx.date),
    tx.paymentMethod,
    isIncome ? '' : tx.budgetClassification.toUpperCase(),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
            isIncome ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {isIncome ? '+' : '-'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm font-bold text-slate-900 break-words">{tx.merchant}</p>
            <p
              className={`shrink-0 text-sm font-bold whitespace-nowrap ${
                isIncome ? 'text-teal-600' : 'text-slate-900'
              }`}
            >
              {isIncome ? '+' : '-'}
              {formatIDR(tx.amount)}
            </p>
          </div>

          <p className="mt-0.5 text-xs text-slate-700 break-words">{categoryLine}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 break-words">{metaLine}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Dicatat oleh <span className="font-semibold text-slate-700">{recordedBy(tx)}</span>
          </p>
          {tx.notes && <p className="mt-1 text-[11px] text-slate-500 break-words">{tx.notes}</p>}

          {(hasDetail || onEdit || onDelete) && (
            <div className="mt-1 -mr-2 flex items-center justify-end">
              {hasDetail && (
                <button
                  type="button"
                  onClick={() => onViewDetail(tx)}
                  aria-label={`Lihat detail ${tx.merchant}`}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(tx)}
                  aria-label={`Edit ${tx.merchant}`}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(tx)}
                  aria-label={`Hapus ${tx.merchant}`}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

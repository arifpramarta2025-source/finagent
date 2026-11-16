import React from 'react';
import { BudgetClassification, PaymentMethod } from '../types';
import { useCategories } from '../hooks/useCategories';
import { visibleCategoryNames } from '../utils/categories';
import { PAYMENT_METHODS, formatIDR, withCurrentOption } from '../utils/constants';
import { SubCategoryField } from './SubCategoryField';

export interface TransactionFieldValues {
  type: 'income' | 'expense';
  amount: number;
  merchant: string;
  category: string;
  subCategory?: string;
  date: string;
  paymentMethod: PaymentMethod | string;
  budgetClassification: BudgetClassification;
  notes?: string;
}

interface TransactionFieldsProps {
  value: TransactionFieldValues;
  onChange: (patch: Partial<TransactionFieldValues>) => void;
  /** A note under the date, e.g. when the date could not be read and today was used. */
  dateHint?: string | null;
}

const LABEL = 'block text-xs font-medium text-slate-700 mb-1';
const INPUT =
  'w-full px-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500';

/**
 * The transaction form shared by manual entry, Catat AI and Scan Struk. One component keeps the
 * fields in the same order with the same labels in every mode.
 */
export const TransactionFields: React.FC<TransactionFieldsProps> = ({
  value,
  onChange,
  dateHint,
}) => {
  const categories = useCategories();
  const isIncome = value.type === 'income';
  const stepAmount = (delta: number) =>
    onChange({ amount: Math.max(1, (value.amount || 0) + delta) });

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="tx-amount" className={LABEL}>
          Nominal (IDR)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-400">Rp</span>
          <input
            id="tx-amount"
            type="number"
            min="1"
            step="1"
            required
            value={value.amount || ''}
            onChange={(e) =>
              onChange({ amount: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
            }
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                stepAmount(e.key === 'ArrowUp' ? 1000 : -1000);
              }
            }}
            placeholder="0"
            className="w-full pl-10 pr-3.5 py-2.5 text-base font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        {value.amount > 0 && (
          <span className="text-[11px] text-emerald-600 mt-1 block">{formatIDR(value.amount)}</span>
        )}
      </div>

      <div>
        <label htmlFor="tx-merchant" className={LABEL}>
          Merchant / Sumber
        </label>
        <input
          id="tx-merchant"
          type="text"
          required
          value={value.merchant}
          onChange={(e) => onChange({ merchant: e.target.value })}
          placeholder={
            isIncome ? 'Contoh: PT ABC, Klien Freelance' : 'Contoh: Superindo, Starbucks, PLN'
          }
          className={`${INPUT} text-sm`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="tx-category" className={LABEL}>
            Kategori
          </label>
          <select
            id="tx-category"
            value={value.category}
            onChange={(e) => onChange({ category: e.target.value, subCategory: '' })}
            className={INPUT}
          >
            {withCurrentOption(visibleCategoryNames(categories, value.type), value.category).map(
              (cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              )
            )}
          </select>
        </div>

        <SubCategoryField
          category={value.category}
          value={value.subCategory || ''}
          onChange={(subCategory) => onChange({ subCategory })}
          labelClassName={LABEL}
          inputClassName={INPUT}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="tx-date" className={LABEL}>
            Tanggal
          </label>
          <input
            id="tx-date"
            type="date"
            required
            value={value.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="tx-payment" className={LABEL}>
            Metode Bayar
          </label>
          <select
            id="tx-payment"
            value={value.paymentMethod}
            onChange={(e) => onChange({ paymentMethod: e.target.value })}
            className={INPUT}
          >
            {withCurrentOption(PAYMENT_METHODS, value.paymentMethod).map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>
      </div>
      {dateHint && (
        <p role="status" className="-mt-1.5 text-[11px] text-amber-700">
          {dateHint}
        </p>
      )}

      {!isIncome && (
        <div>
          <label htmlFor="tx-allocation" className={LABEL}>
            Alokasi 50/30/20
          </label>
          <select
            id="tx-allocation"
            value={value.budgetClassification}
            onChange={(e) =>
              onChange({ budgetClassification: e.target.value as BudgetClassification })
            }
            className={INPUT}
          >
            <option value="needs">Needs (Kebutuhan Pokok - 50%)</option>
            <option value="wants">Wants (Keinginan - 30%)</option>
            <option value="savings">Savings (Tabungan / Investasi - 20%)</option>
          </select>
        </div>
      )}

      <div>
        <label htmlFor="tx-notes" className={LABEL}>
          Catatan (Opsional)
        </label>
        <input
          id="tx-notes"
          type="text"
          value={value.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Contoh: Beli tiket nonton bioskop bareng teman"
          className={INPUT}
        />
      </div>
    </div>
  );
};

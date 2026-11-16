import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Check } from 'lucide-react';
import { Transaction } from '../types';
import { getLocalDateString } from '../utils/constants';
import { useCategories } from '../hooks/useCategories';
import { defaultCategory } from '../utils/categories';
import { TransactionFields, TransactionFieldValues } from './TransactionFields';

interface ManualTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'createdAt'>, editId?: string) => Promise<void>;
  initialTransaction?: Transaction | null;
}

export const ManualTransactionModal: React.FC<ManualTransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTransaction,
}) => {
  const categories = useCategories();
  const emptyFields = (): TransactionFieldValues => ({
    type: 'expense',
    amount: 0,
    merchant: '',
    category: defaultCategory(categories, 'expense'),
    subCategory: '',
    date: getLocalDateString(),
    paymentMethod: 'QRIS / E-Wallet',
    budgetClassification: 'needs',
    notes: '',
  });

  const [fields, setFields] = useState<TransactionFieldValues>(emptyFields);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { type, amount, merchant } = fields;
  const updateFields = (patch: Partial<TransactionFieldValues>) =>
    setFields((current) => ({ ...current, ...patch }));

  useEffect(() => {
    setSaveError(null);
    setFields(
      initialTransaction
        ? {
            type: initialTransaction.type,
            amount: initialTransaction.amount,
            merchant: initialTransaction.merchant,
            category: initialTransaction.category,
            subCategory: initialTransaction.subCategory || '',
            date: initialTransaction.date,
            paymentMethod: initialTransaction.paymentMethod,
            budgetClassification: initialTransaction.budgetClassification,
            notes: initialTransaction.notes || '',
          }
        : emptyFields()
    );
  }, [initialTransaction, isOpen, categories]);

  // Adjust default category on type toggle
  const handleTypeChange = (newType: 'income' | 'expense') => {
    updateFields({
      type: newType,
      subCategory: '',
      category: defaultCategory(categories, newType),
      budgetClassification: newType === 'income' ? 'savings' : 'needs',
    });
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !merchant.trim() || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(
        {
          ...fields,
          merchant: merchant.trim(),
          subCategory: (fields.subCategory || '').trim(),
          budgetClassification: type === 'income' ? 'savings' : fields.budgetClassification,
          notes: (fields.notes || '').trim(),
        },
        initialTransaction?.id
      );
      onClose();
    } catch (error: any) {
      console.error('Failed saving transaction:', error);
      setSaveError(error?.message || 'Transaksi gagal disimpan. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">
                {initialTransaction ? 'Edit Transaksi' : 'Tambah Transaksi Manual'}
              </h3>
              <p className="text-xs text-slate-500">Isi rincian transaksi buku kas pribadi Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Income vs Expense Segmented Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'expense'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pemasukan
            </button>
          </div>

          <TransactionFields value={fields} onChange={updateFields} />

          {saveError && (
            <p role="alert" className="text-xs text-rose-600">
              {saveError}
            </p>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={amount <= 0 || !merchant.trim() || isSaving}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Check className="w-4 h-4" />
            <span>
              {isSaving
                ? 'Menyimpan...'
                : initialTransaction
                  ? 'Perbarui Transaksi'
                  : 'Simpan Transaksi'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};

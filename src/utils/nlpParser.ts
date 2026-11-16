import type { BudgetClassification, PaymentMethod, Transaction } from '../types';
import {
  FALLBACK_EXPENSE_CATEGORY,
  FALLBACK_INCOME_CATEGORY,
  getLocalDateString,
} from './constants.ts';
import { normalizeSpokenNumbers } from './spokenNumbers.ts';
import { findDateInText } from './dates.ts';

/**
 * Client-Side Smart Indonesian Financial NLP Parser
 * Ensures instant 0-second parsing without any network dependency or "failed to fetch" errors.
 */
export function parseTransactionLocally(
  text: string,
  todayStr?: string
): Omit<Transaction, 'id' | 'createdAt'> {
  const today = todayStr || getLocalDateString();
  // Date words come out first, so "3 November 2026" is not read as an amount of 2026.
  const foundDate = findDateInText(normalizeSpokenNumbers(text), today);
  const dateStr = foundDate?.date ?? today;
  const spokenText = foundDate?.rest ?? normalizeSpokenNumbers(text);
  const lower = spokenText.toLowerCase();

  // 1. Detect Nominal (IDR)
  let amount = 0;

  const toNumber = (value: string) => parseFloat(value.replace(',', '.'));

  // Match e.g. "1.5jt", "2 juta", "2,5 juta", "2 juta 500 ribu"
  const jtMatch = lower.match(
    /(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b(?:\s*(?:dan\s*)?(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b)?/
  );
  if (jtMatch) {
    const thousands = jtMatch[2] ? toNumber(jtMatch[2]) * 1000 : 0;
    amount = Math.round(toNumber(jtMatch[1]) * 1000000 + thousands);
  } else {
    // Match e.g. "25rb", "50k", "150rb", "25 ribu". The word boundary keeps "2 kopi" out.
    const rbMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/);
    if (rbMatch) {
      amount = Math.round(toNumber(rbMatch[1]) * 1000);
    } else {
      // Match raw numbers e.g. "25.000", "50000", "Rp 150000"
      const numMatch = lower.match(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d{4,})/);
      if (numMatch) {
        amount = parseInt(numMatch[1].replace(/\./g, ''), 10);
      }
    }
  }

  // 2. Detect Income vs Expense
  const isIncome =
    lower.includes('gaji') ||
    lower.includes('terima') ||
    lower.includes('masuk') ||
    lower.includes('freelance') ||
    lower.includes('pendapatan') ||
    lower.includes('bonus') ||
    lower.includes('hasil usaha') ||
    lower.includes('penjualan') ||
    lower.includes('dividen') ||
    lower.includes('cair');

  // 3. Detect Category
  let category: string = isIncome ? FALLBACK_INCOME_CATEGORY : FALLBACK_EXPENSE_CATEGORY;
  let subCategory = '';

  const hasAny = (...words: string[]) => words.some((word) => lower.includes(word));

  if (isIncome) {
    if (hasAny('gaji')) {
      category = 'Gaji';
    } else if (hasAny('bonus', 'insentif', 'thr')) {
      category = 'Insentif';
    } else if (hasAny('dividen', 'investasi')) {
      category = 'Investasi';
    } else if (hasAny('penjualan', 'hasil usaha')) {
      category = 'Penjualan';
    } else if (hasAny('refund', 'pengembalian')) {
      category = 'Pengembalian Dana';
    } else if (hasAny('freelance', 'fee', 'honor')) {
      category = 'Tambahan';
    }
  } else if (hasAny('snack', 'kopi', 'minum')) {
    category = 'Jajan';
    subCategory = lower.includes('snack') ? 'Makanan Ringan' : 'Minuman Ringan';
  } else if (hasAny('makan', 'warteg', 'restoran', 'bakso', 'soto', 'sarapan', 'mie', 'ayam')) {
    category = 'Konsumsi Pokok';
    subCategory = 'Makanan Pokok Diluar';
  } else if (
    hasAny(
      'bensin',
      'pertamax',
      'pertalite',
      'shell',
      'tol',
      'gojek',
      'grab',
      'ojol',
      'parkir',
      'servis'
    )
  ) {
    category = 'Transportasi';
  } else if (hasAny('listrik', 'pln')) {
    category = 'Kebutuhan Tempat Tinggal';
    subCategory = 'Listrik';
  } else if (hasAny('pdam', 'air')) {
    category = 'Kebutuhan Tempat Tinggal';
    subCategory = 'PAM';
  } else if (hasAny('wifi', 'internet', 'biznet', 'indihome')) {
    category = 'Kebutuhan Tempat Tinggal';
    subCategory = 'Wifi kontrakan';
  } else if (hasAny('kost', 'kos', 'sewa', 'kontrakan')) {
    category = 'Kebutuhan Tempat Tinggal';
    subCategory = 'Sewa Kontrakan';
  } else if (hasAny('beras', 'minyak', 'pasar')) {
    category = 'Konsumsi Pokok';
    subCategory = 'Bahan Makanan';
  } else if (hasAny('sabun', 'shampoo')) {
    category = 'Personal Care';
  } else if (hasAny('superindo', 'indomaret', 'alfamart', 'belanja', 'baju', 'sepatu', 'uniqlo')) {
    category = 'Belanja Barang';
  } else if (hasAny('obat', 'apotek', 'vitamin', 'dokter', 'klinik', 'k-24', 'kimia farma')) {
    category = 'Kesehatan';
  } else if (
    hasAny('reksadana', 'bibit', 'emas', 'antam', 'saham', 'investasi', 'deposito', 'nabung')
  ) {
    category = 'Tabungan dan Investasi';
  } else if (
    hasAny('netflix', 'spotify', 'nonton', 'bioskop', 'game', 'steam', 'karaoke', 'liburan')
  ) {
    category = 'Hiburan / Healing';
  } else if (hasAny('kursus', 'wpu', 'buku', 'kuliah', 'sekolah', 'udemy', 'belajar')) {
    category = 'Pengembangan Diri';
  }

  // 4. Detect Payment Method
  let paymentMethod: PaymentMethod = 'QRIS / E-Wallet';
  if (lower.includes('tunai') || lower.includes('cash') || lower.includes('uang pas')) {
    paymentMethod = 'Tunai';
  } else if (
    lower.includes('transfer') ||
    lower.includes('bca') ||
    lower.includes('mandiri') ||
    lower.includes('bri') ||
    lower.includes('bni') ||
    lower.includes('jago') ||
    lower.includes('seabank')
  ) {
    paymentMethod = 'Transfer Bank';
  } else if (lower.includes('kartu kredit') || lower.includes('cc') || lower.includes('credit')) {
    paymentMethod = 'Kartu Kredit';
  } else if (lower.includes('debit') || lower.includes('atm')) {
    paymentMethod = 'Kartu Debit';
  } else if (
    lower.includes('qris') ||
    lower.includes('gopay') ||
    lower.includes('ovo') ||
    lower.includes('shopeepay') ||
    lower.includes('dana')
  ) {
    paymentMethod = 'QRIS / E-Wallet';
  }

  // 5. Clean Merchant Name
  // Remove known words from merchant title
  let cleanedMerchant = spokenText
    .replace(/(?:rp\.?\s*)?\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)\b/gi, '')
    .replace(/(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d+)/gi, '')
    .replace(
      /\b(?:beli|bayar|isi|makan|minum|pake|pakai|lewat|transfer|qris|tunai|cash|debit|tadi|pagi|siang|malam|sore|kemarin|ke|di|pada|tanggal|tgl)\b/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedMerchant || cleanedMerchant.length < 2) {
    cleanedMerchant = category;
  } else {
    // Capitalize words
    cleanedMerchant = cleanedMerchant
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 35);
  }

  // 6. 50/30/20 classification
  let budgetClassification: BudgetClassification = 'needs';
  if (isIncome || category === 'Tabungan dan Investasi') {
    budgetClassification = 'savings';
  } else if (category === 'Jajan' || category === 'Hiburan / Healing') {
    budgetClassification = 'wants';
  }

  return {
    type: isIncome ? 'income' : 'expense',
    amount,
    category,
    subCategory,
    merchant: cleanedMerchant,
    date: dateStr,
    paymentMethod,
    notes: text,
    budgetClassification,
  };
}

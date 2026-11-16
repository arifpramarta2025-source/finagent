export const EXPENSE_CATEGORIES = [
  'Agenda Produktif',
  'Belanja Barang',
  'Hadiah / Kondangan',
  'Hiburan / Healing',
  'Hobi',
  'Jajan',
  'Kebutuhan Pasangan',
  'Kebutuhan Orang Tua',
  'Kebutuhan Tempat Tinggal',
  'Kesehatan',
  'Keuangan dan Administrasi',
  'Komunikasi',
  'Konsumsi Pokok',
  'Lain - lain Sekunder',
  'Lain - lain tersier',
  'Lain-lain Primer',
  'Pekerjaan',
  'Pengembangan Diri',
  'Perjalanan Dinas',
  'Personal Care',
  'Tabungan dan Investasi',
  'Transportasi',
  'ZIS dan Ibadah',
] as const;

export const INCOME_CATEGORIES = [
  'Gaji',
  'Insentif',
  'Investasi',
  'Lain-lain',
  'Pengembalian Dana',
  'Penjualan',
  'Tambahan',
] as const;

export const DEFAULT_EXPENSE_CATEGORY = 'Konsumsi Pokok';
export const FALLBACK_EXPENSE_CATEGORY = 'Lain-lain Primer';
export const DEFAULT_INCOME_CATEGORY = 'Gaji';
export const FALLBACK_INCOME_CATEGORY = 'Lain-lain';

export const SUBCATEGORIES: Record<string, readonly string[]> = {
  'Konsumsi Pokok': [
    'Bahan Makanan',
    'Buah',
    'Makanan Pokok',
    'Makanan Pokok Diluar',
    'Minuman Pokok',
    'Minuman Pokok Diluar',
  ],
  'Kebutuhan Tempat Tinggal': [
    'Alat Rumah Tangga',
    'Kebersihan',
    'Listrik',
    'PAM',
    'Sewa Kontrakan',
    'Wifi kontrakan',
  ],
  Jajan: ['Makanan Ringan', 'Minuman Kesehatan', 'Minuman Ringan'],
};

/** Keeps a value saved under an older list selectable when its transaction is edited. */
export function withCurrentOption(options: readonly string[], current?: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : [...options];
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Agenda Produktif': '#0EA5E9',
  'Belanja Barang': '#3B82F6',
  'Hadiah / Kondangan': '#F43F5E',
  'Hiburan / Healing': '#EC4899',
  Hobi: '#D946EF',
  Jajan: '#FB923C',
  'Kebutuhan Pasangan': '#E879F9',
  'Kebutuhan Orang Tua': '#A855F7',
  'Kebutuhan Tempat Tinggal': '#8B5CF6',
  Kesehatan: '#EF4444',
  'Keuangan dan Administrasi': '#475569',
  Komunikasi: '#22D3EE',
  'Konsumsi Pokok': '#F59E0B',
  'Lain - lain Sekunder': '#94A3B8',
  'Lain - lain tersier': '#CBD5E1',
  'Lain-lain Primer': '#64748B',
  Pekerjaan: '#2563EB',
  'Pengembangan Diri': '#6366F1',
  'Perjalanan Dinas': '#0D9488',
  'Personal Care': '#F472B6',
  'Tabungan dan Investasi': '#059669',
  Transportasi: '#10B981',
  'ZIS dan Ibadah': '#65A30D',
  Gaji: '#14B8A6',
  Insentif: '#F97316',
  Investasi: '#10B981',
  'Lain-lain': '#64748B',
  'Pengembalian Dana': '#06B6D4',
  Penjualan: '#84CC16',
  Tambahan: '#EAB308',
};

export const PAYMENT_METHODS = [
  'QRIS / E-Wallet',
  'Transfer Bank',
  'Tunai',
  'Kartu Kredit',
  'Kartu Debit',
  'Lainnya',
] as const;

/** Today's date on this device. toISOString() would give the UTC date instead. */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthKey(date: Date = new Date()): string {
  return getLocalDateString(date).slice(0, 7);
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateIndo(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

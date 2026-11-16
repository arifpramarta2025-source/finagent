/** POST /api/ai/parse-text: turns a sentence such as "beli kopi 25rb kemarin" into a draft transaction. */
import { Router, type Request, type Response } from 'express';
import { Type } from '@google/genai';
import { callGemini } from '../gemini.ts';
import { readCurrentDate } from '../requestDate.ts';
import { parseTransactionLocally } from '../../src/utils/nlpParser.ts';
import { normalizeDate } from '../../src/utils/dates.ts';
import { buildSubCategoryGuide, resolveAiCategoryLists } from '../../src/utils/categories.ts';

export const parseTextRouter = Router();
const router = parseTextRouter;

/**
 * 1. Parse Text Transaction
 * Converts natural Indonesian input like "beli kopi kenangan 25rb bayar gopay tadi pagi"
 * into a structured ledger entry.
 */
router.post('/parse-text', async (req: Request, res: Response) => {
  try {
    const { text, currentDate, categories } = req.body;
    if (!text || typeof text !== 'string' || text.length > 2000) {
      return res.status(400).json({ error: 'Teks transaksi wajib diisi, maksimal 2.000 karakter' });
    }

    const todayStr = readCurrentDate(currentDate);
    const lists = resolveAiCategoryLists(categories);

    const prompt = `Analisis teks transaksi keuangan berikut dalam Bahasa Indonesia:
"${text}"

Tanggal hari ini sebagai acuan: ${todayStr}
Aturan tanggal:
- Jika kalimat menyebut tanggal, pakai tanggal itu. "kemarin" = sehari sebelum acuan, "kemarin lusa" = dua hari sebelumnya.
- "tanggal 3" tanpa bulan berarti tanggal 3 terdekat yang belum lewat dari acuan, bulan ini atau bulan lalu.
- Tanggal tanpa tahun berarti tahun terdekat yang tidak melewati acuan.
- Hanya jika kalimat tidak menyebut tanggal sama sekali, pakai tanggal acuan.

Ekstrak dan klasifikasikan data transaksi secara akurat ke dalam format JSON sesuai schema.
Perhatikan kata-kata khas Indonesia:
- "rb", "k" = ribuan (misal 25rb = 25000, 50k = 50000)
- "jt" = jutaan (misal 1.5jt = 1500000)
- Kategori pengeluaran harus salah satu dari: ${lists.expense.join(', ')}
- Kategori pemasukan harus salah satu dari: ${lists.income.join(', ')}
- subCategory hanya diisi untuk kategori berikut dan harus sama persis dengan daftarnya. Untuk kategori lain, kosongkan.
${buildSubCategoryGuide(lists)}
- Jenis: 'expense' (pengeluaran) atau 'income' (pemasukan)
- Metode Pembayaran: 'Tunai', 'Transfer Bank', 'QRIS / E-Wallet', 'Kartu Kredit', 'Lainnya'
- SubKategori (contoh: "Kopi", "Groceries", "Bensin", "Langganan", dll)`;

    let parsedJson: any = null;

    try {
      const response = await callGemini({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "'expense' untuk pengeluaran, 'income' untuk pemasukan",
              },
              amount: {
                type: Type.INTEGER,
                description: 'Jumlah nominal dalam Rupiah (bilangan bulat tanpa titik/koma)',
              },
              category: {
                type: Type.STRING,
                enum: [...new Set([...lists.expense, ...lists.income])],
                description: 'Kategori utama pengeluaran/pemasukan',
              },
              subCategory: {
                type: Type.STRING,
                description:
                  'Subkategori dari daftar, kosong jika kategorinya tidak punya subkategori',
              },
              merchant: {
                type: Type.STRING,
                description:
                  'Nama toko, merchant, atau sumber dana (misal: Janji Jiwa, PT ABCD, Indomaret)',
              },
              date: {
                type: Type.STRING,
                description: 'Tanggal transaksi dalam format YYYY-MM-DD',
              },
              paymentMethod: {
                type: Type.STRING,
                description: 'Metode pembayaran yang digunakan',
              },
              notes: {
                type: Type.STRING,
                description: 'Ringkasan singkat atau deskripsi catatan transaksi',
              },
              budgetClassification: {
                type: Type.STRING,
                description:
                  "'needs' (kebutuhan pokok), 'wants' (keinginan/gaya hidup), atau 'savings' (tabungan/investasi)",
              },
            },
            required: ['type', 'amount', 'category', 'merchant', 'date', 'paymentMethod'],
          },
        },
      });

      parsedJson = JSON.parse(response.text || '{}');
      parsedJson.date = normalizeDate(parsedJson.date) ?? '';
    } catch (apiErr) {
      console.warn('Using intelligent offline fallback parser:', apiErr);
      parsedJson = parseTransactionLocally(text, todayStr);
    }

    return res.json({ success: true, data: parsedJson });
  } catch (error: any) {
    console.error('Error parsing text transaction:', error);
    return res.status(500).json({
      error: 'Gagal menganalisis teks transaksi',
      details: error?.message || 'Unknown error',
    });
  }
});

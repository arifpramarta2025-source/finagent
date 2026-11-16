/** POST /api/ai/parse-receipt: reads a receipt photo or PDF into a draft transaction. */
import { Router, type Request, type Response } from 'express';
import { Type } from '@google/genai';
import { callGemini, respondIfQuotaExhausted } from '../gemini.ts';
import { readCurrentDate } from '../requestDate.ts';
import { normalizeDate } from '../../src/utils/dates.ts';
import { buildSubCategoryGuide, resolveAiCategoryLists } from '../../src/utils/categories.ts';

export const parseReceiptRouter = Router();
const router = parseReceiptRouter;

/**
 * 2. Parse Receipt Image (Multimodal OCR Intelligence Parser)
 * Reads paper/digital receipts (Indomaret, Alfamart, restaurants, bills)
 * and extracts merchant, items, totals, date, and category.
 */
router.post('/parse-receipt', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', categories, currentDate } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'File struk atau PDF invoice wajib diunggah' });
    }
    if (typeof mimeType !== 'string') {
      return res.status(400).json({ error: 'Tipe file tidak valid' });
    }

    const lists = resolveAiCategoryLists(categories);
    const todayStr = readCurrentDate(currentDate);

    // Clean base64 prefix if present
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9\/\-+.]+;base64,/, '');

    const resolvedMimeType = mimeType.includes('pdf')
      ? 'application/pdf'
      : mimeType.includes('svg')
        ? 'image/png'
        : mimeType || 'image/jpeg';

    const documentPart = {
      inlineData: {
        mimeType: resolvedMimeType,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `Anda adalah OCR & Invoice/Receipt Financial Parser cerdas untuk FINA (WPU FinAgent).
Analisis gambar struk, bukti invoice digital, bukti transfer, atau dokumen PDF pembayaran ini secara teliti (misalnya invoice belanja Tokopedia, Shopee, Bukalapak, Blibli, tagihan listrik PLN, bukti transfer m-banking, bill restoran, atau struk fisik).

Ekstrak semua informasi penting:
1. Nama Merchant / Toko / Marketplace (misal: "Tokopedia", "Tokopedia - [Nama Toko]", "Indomaret", "PLN", dll)
2. Tanggal Transaksi yang tercetak di struk, dalam format YYYY-MM-DD. Struk Indonesia biasanya menulis hari/bulan/tahun, misalnya 03/11/26 atau 03-11-2026 berarti 3 November 2026. Tanggal hari ini ${todayStr} hanya untuk acuan tahun dua digit. Jika struk tidak mencantumkan tanggal, kosongkan, jangan isi tanggal hari ini.
3. Total Pembayaran Akhir / Grand Total (bilangan bulat Rupiah)
4. Subtotal produk dan Pajak / PPN / Biaya Pengiriman / Biaya Layanan jika tertera
5. Daftar Item / Produk yang dibeli berserta kuantitas (qty) dan harga satuan/total
6. Metode pembayaran jika tertera (BCA Virtual Account, GoPay, OVO, QRIS, Kartu Debit/Kredit, dll)
7. Kategori pengeluaran yang paling tepat dari daftar ini: ${lists.expense.join(', ')}
8. Subkategori. Hanya diisi untuk kategori berikut dan harus sama persis dengan daftarnya. Untuk kategori lain, kosongkan.
${buildSubCategoryGuide(lists)}
9. Klasifikasi anggaran: 'needs' (kebutuhan), 'wants' (keinginan), 'savings'`,
    };

    let parsedJson: any = null;

    try {
      const response = await callGemini({
        contents: { parts: [documentPart, textPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchant: { type: Type.STRING, description: 'Nama toko atau merchant struk' },
              date: { type: Type.STRING, description: 'Tanggal struk YYYY-MM-DD' },
              time: { type: Type.STRING, description: 'Waktu transaksi jika ada (HH:mm)' },
              totalAmount: {
                type: Type.INTEGER,
                description: 'Total akhir pembayaran dalam Rupiah bulat',
              },
              subtotal: {
                type: Type.INTEGER,
                description: 'Subtotal sebelum pajak/diskon jika ada',
              },
              taxAmount: { type: Type.INTEGER, description: 'Nilai pajak/service jika ada' },
              discountAmount: { type: Type.INTEGER, description: 'Nilai diskon jika ada' },
              category: {
                type: Type.STRING,
                enum: lists.expense,
                description: 'Kategori utama pengeluaran',
              },
              subCategory: {
                type: Type.STRING,
                description:
                  'Subkategori dari daftar, kosong jika kategorinya tidak punya subkategori',
              },
              paymentMethod: { type: Type.STRING, description: 'Metode pembayaran tertera' },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                    price: { type: Type.INTEGER },
                    total: { type: Type.INTEGER },
                  },
                  required: ['name', 'total'],
                },
              },
              notes: { type: Type.STRING, description: 'Catatan tambahan atau no. struk/invoice' },
              budgetClassification: { type: Type.STRING, description: "'needs' atau 'wants'" },
            },
            required: ['merchant', 'totalAmount', 'category'],
          },
        },
      });

      parsedJson = JSON.parse(response.text || '{}');
      parsedJson.date = normalizeDate(parsedJson.date) ?? '';
    } catch (ocrErr) {
      // Never invent a receipt: the owner must see that reading it failed.
      console.warn('Receipt OCR failed:', ocrErr);
      if (respondIfQuotaExhausted(ocrErr, res)) return;
      return res.status(502).json({ error: 'Struk belum bisa dibaca AI. Silakan coba lagi' });
    }

    return res.json({ success: true, data: parsedJson });
  } catch (error: any) {
    console.error('Error parsing receipt:', error);
    return res.status(500).json({
      error: 'Gagal membaca struk/nota pembayaran',
      details: error?.message || 'Unknown error',
    });
  }
});

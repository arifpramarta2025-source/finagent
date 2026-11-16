/** POST /api/ai/audit: a financial health review of the current month. */
import { Router, type Request, type Response } from 'express';
import { Type } from '@google/genai';
import { callGemini, respondIfQuotaExhausted } from '../gemini.ts';

export const auditRouter = Router();
const router = auditRouter;

/**
 * 3. Generative AI Financial Health Audit
 * Evaluates user's financial health, 50/30/20 ratio compliance,
 * emergency fund readiness, spending leaks, and gives proactive suggestions.
 */
router.post('/audit', async (req: Request, res: Response) => {
  try {
    const { summary, transactions, budgetSettings } = req.body;

    const prompt = `Anda adalah FinAudit Engine untuk FINA (WPU FinAgent), asisten keuangan cerdas yang dibuat terinspirasi oleh WPU (Web Programming Unpas).
Lakukan evaluasi menyeluruh terhadap keuangan pribadi pengguna berdasarkan data berikut:

Ringkasan Keuangan:
- Total Pemasukan Bulan Ini: Rp ${summary?.totalIncome?.toLocaleString('id-ID') || '0'}
- Total Pengeluaran Bulan Ini: Rp ${summary?.totalExpense?.toLocaleString('id-ID') || '0'}
- Sisa Saldo / Arus Kas Bersih: Rp ${(summary?.netCashflow ?? 0).toLocaleString('id-ID')}
- Target Pemasukan Bulanan: Rp ${budgetSettings?.monthlyIncomeTarget?.toLocaleString('id-ID') || '0'}
- Target Dana Darurat: Rp ${budgetSettings?.emergencyFundTarget?.toLocaleString('id-ID') || '0'}
- Dana Darurat Saat Ini: Rp ${budgetSettings?.currentEmergencyFund?.toLocaleString('id-ID') || '0'}
- Alokasi Anggaran Kebutuhan (Needs / Pokok): Rp ${summary?.needsTotal?.toLocaleString('id-ID') || '0'}
- Alokasi Anggaran Keinginan (Wants / Gaya Hidup): Rp ${summary?.wantsTotal?.toLocaleString('id-ID') || '0'}
- Alokasi Tabungan/Investasi (Savings): Rp ${summary?.savingsTotal?.toLocaleString('id-ID') || '0'}

Kategori Pengeluaran Terbesar:
${JSON.stringify(summary?.topCategories || [], null, 2)}

10 Transaksi Terakhir:
${JSON.stringify((transactions || []).slice(0, 10), null, 2)}

Tugas Anda:
1. Hitung Financial Health Score (skor 0 - 100) dan tentukan status ("Prima", "Sehat", "Perlu Waspada", "Kritis")
2. Evaluasi proporsi 50/30/20 saat ini (% Needs, % Wants, % Savings dari income)
3. Identifikasi minimal 3 potensi "Kebocoran Dana" (Spending Leaks) atau pos yang membengkak
4. Hitung kesiapan Dana Darurat (berapa bulan pengeluaran yang tercover)
5. Berikan 3-4 rekomendasi aksi taktis yang realistis untuk konteks masyarakat Indonesia
6. Berikan kalimat motivasi finansial yang menginspirasi dalam bahasa santai dan profesional`;

    const response = await callGemini({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            healthScore: { type: Type.INTEGER, description: 'Skor kesehatan keuangan 0-100' },
            healthStatus: { type: Type.STRING, description: 'Status kesehatan finansial' },
            headline: {
              type: Type.STRING,
              description: 'Ringkasan 1 kalimat tajam tentang kondisi keuangan saat ini',
            },
            rule50_30_20: {
              type: Type.OBJECT,
              properties: {
                needsPercentage: { type: Type.NUMBER },
                wantsPercentage: { type: Type.NUMBER },
                savingsPercentage: { type: Type.NUMBER },
                analysis: { type: Type.STRING },
              },
              required: ['needsPercentage', 'wantsPercentage', 'savingsPercentage', 'analysis'],
            },
            spendingLeaks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  estimatedMonthlyImpact: { type: Type.STRING },
                  severity: { type: Type.STRING, description: "'high', 'medium', 'low'" },
                },
                required: ['title', 'description', 'severity'],
              },
            },
            emergencyFundEvaluation: {
              type: Type.OBJECT,
              properties: {
                monthsCovered: { type: Type.NUMBER },
                targetMonths: { type: Type.NUMBER },
                statusMessage: { type: Type.STRING },
              },
              required: ['monthsCovered', 'statusMessage'],
            },
            actionRecommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  priority: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  action: { type: Type.STRING },
                  category: { type: Type.STRING },
                },
                required: ['priority', 'title', 'action'],
              },
            },
            inspirationalQuote: { type: Type.STRING },
          },
          required: [
            'healthScore',
            'healthStatus',
            'headline',
            'rule50_30_20',
            'spendingLeaks',
            'emergencyFundEvaluation',
            'actionRecommendations',
          ],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsedJson });
  } catch (error: any) {
    if (respondIfQuotaExhausted(error, res)) return;
    console.error('Error generating financial audit:', error);
    return res.status(500).json({
      error: 'Gagal melakukan audit keuangan AI',
      details: error?.message || 'Unknown error',
    });
  }
});

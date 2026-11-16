/** POST /api/ai/chat and /api/ai/chat/stream: Finn, the chat assistant. */
import { Router, type Request, type Response } from 'express';
import { callGemini, openGeminiStream, respondIfQuotaExhausted } from '../gemini.ts';
import { streamGeminiToResponse } from '../chatStream.ts';

export const chatRouter = Router();
const router = chatRouter;

/**
 * 4. FINA Bot (Interactive AI Financial Assistant "Finn")
 * Chatbot with contextual ledger awareness and optional Google Search grounding.
 */
function buildChatRequest(body: any): { contents: any; config: any } {
  const { message, history = [], financialContext, enableSearch = false } = body;

  const systemInstruction = `Anda adalah "Finn", Financial Agent AI cerdas dari FINA (WPU FinAgent), didesain dengan semangat edukasi modern ala Web Programming Unpas (Sandhika Galih).
Kepribadian Anda:
- Ramah, cermat, empatik, bijaksana, dan solutif.
- Menggunakan Bahasa Indonesia yang luwes, jelas, dan tidak kaku (bisa memanggil "kamu" atau "Anda" secara sopan).
- Anda memiliki akses langsung ke data riil keuangan pengguna saat ini yang terlampir di bawah.
- Jika pengguna bertanya tentang kemampuan membeli barang (misal gadget, kendaraan, liburan, investasi), hitung simulasi arus kas mereka dan berikan keputusan rasional (misal: "Aman", "Tunggu 2 bulan lagi", atau "Beresiko mengorbankan dana darurat").
- Selalu dukung saran dengan angka nyata dari kondisi pengguna.
- Berikan format teks rapi dengan poin-poin tebal (bullet points) jika dibutuhkan.

Kondisi Keuangan Terkini Pengguna:
${JSON.stringify(financialContext || {}, null, 2)}`;

  // Build contents for multi-turn chat
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  // Append prior history
  if (Array.isArray(history)) {
    for (const item of history.slice(-8)) {
      contents.push({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.content || '' }],
      });
    }
  }

  // Append current message
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  const config: any = {
    systemInstruction,
  };

  if (enableSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  return { contents, config };
}

function isValidChatMessage(message: unknown): boolean {
  return typeof message === 'string' && message.length > 0 && message.length <= 4000;
}

router.post('/chat', async (req: Request, res: Response) => {
  try {
    if (!isValidChatMessage(req.body.message)) {
      return res.status(400).json({ error: 'Pesan wajib diisi, maksimal 4.000 karakter' });
    }

    const response = await callGemini(buildChatRequest(req.body));

    const reply =
      response.text || 'Maaf, saya tidak dapat memproses jawaban saat ini. Silakan coba kembali.';

    return res.json({
      success: true,
      reply,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata || null,
    });
  } catch (error: any) {
    if (respondIfQuotaExhausted(error, res)) return;
    console.error('Error in FINA bot chat:', error);
    return res.status(500).json({
      error: 'Terjadi kendala saat menghubungi asisten AI Finn',
      details: error?.message || 'Unknown error',
    });
  }
});

router.post('/chat/stream', async (req: Request, res: Response) => {
  if (!isValidChatMessage(req.body.message)) {
    return res.status(400).json({ error: 'Pesan wajib diisi, maksimal 4.000 karakter' });
  }

  try {
    const chat = buildChatRequest(req.body);
    await streamGeminiToResponse(res, (signal) => openGeminiStream(chat, signal));
  } catch (error: any) {
    if (respondIfQuotaExhausted(error, res)) return;
    console.error('Error opening Finn stream:', error);
    res.status(500).json({ error: 'Terjadi kendala saat menghubungi asisten AI Finn' });
  }
});

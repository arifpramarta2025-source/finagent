/**
 * Stands in for the server's AI routes, so browser tests never call Gemini. A chat message
 * containing one of the trigger words below picks the failure the test wants to see.
 */

const STREAM_WORDS = ['Bulan ini ', 'pengeluaran ', 'Anda ', 'aman ', 'dan ', 'terkendali.'];
const WORD_DELAY_MS = 250;

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => resolve(JSON.parse(raw || '{}')));
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function streamChat(req, res, message) {
  if (message.includes('html')) {
    res.statusCode = 502;
    res.setHeader('content-type', 'text/html');
    return res.end('<h1>bad gateway</h1>');
  }
  if (message.includes('kuota')) {
    return sendJson(res, 429, {
      error: 'Kuota AI harian habis. AI tersedia lagi sekitar pukul 15.00 WIB.',
    });
  }

  res.setHeader('content-type', 'text/event-stream; charset=utf-8');
  res.flushHeaders();
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  if (message.includes('gagalawal')) {
    send({ error: 'Koneksi ke Finn terputus. Silakan coba lagi.' });
    return res.end();
  }

  for (const word of STREAM_WORDS) {
    send({ text: word });
    await wait(WORD_DELAY_MS);
    if (message.includes('putus') && word === 'Anda ') {
      return req.socket.destroy();
    }
  }

  const groundingMetadata = message.includes('sumber')
    ? { groundingChunks: [{ web: { uri: 'https://contoh.id', title: 'Contoh' } }] }
    : null;
  send({ done: true, groundingMetadata });
  res.end();
}

export function fakeAi() {
  // The receipt scan alternates: first a receipt with a printed date, then one without.
  let nextReceiptHasDate = true;

  return {
    name: 'fake-ai',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/ai/parse-') && !url.startsWith('/api/ai/chat')) {
          return next();
        }
        const body = await readJson(req);

        if (url.startsWith('/api/ai/parse-receipt')) {
          const date = nextReceiptHasDate ? '03/11/26' : '';
          nextReceiptHasDate = !nextReceiptHasDate;
          return sendJson(res, 200, {
            success: true,
            data: {
              merchant: 'Indomaret',
              date,
              totalAmount: 48500,
              category: 'Konsumsi Pokok',
              subCategory: 'Bahan Makanan',
              paymentMethod: 'Tunai',
              items: [{ name: 'Beras', qty: 1, total: 48500 }],
              notes: '',
              budgetClassification: 'needs',
            },
          });
        }

        if (url.startsWith('/api/ai/parse-text')) {
          // Like Gemini at its worst: it ignores the date in the sentence and echoes today.
          return sendJson(res, 200, {
            success: true,
            data: {
              type: 'expense',
              amount: 25000,
              category: 'Jajan',
              subCategory: 'Minuman Ringan',
              merchant: 'Kopi Kenangan',
              date: body.currentDate,
              paymentMethod: 'QRIS / E-Wallet',
              notes: body.text,
              budgetClassification: 'wants',
            },
          });
        }

        if (url.endsWith('/stream')) {
          return streamChat(req, res, body.message || '');
        }
        return sendJson(res, 200, {
          success: true,
          reply: 'Jawaban utuh dari rute biasa',
          groundingMetadata: null,
        });
      });
    },
  };
}

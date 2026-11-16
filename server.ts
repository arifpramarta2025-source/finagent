/**
 * Entry point. Google AI Studio runs this file with `node server.ts`, so it stays at the root.
 * The routes and helpers live in server/.
 */
// Must come first: it loads .env before server/gemini.ts reads GEMINI_API_KEY.
import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { limitAiRequests, requireOwner } from './server/auth.ts';
import { hasApiKey } from './server/gemini.ts';
import { attachWebApp } from './server/webApp.ts';
import { auditRouter } from './server/routes/audit.ts';
import { chatRouter } from './server/routes/chat.ts';
import { parseReceiptRouter } from './server/routes/parseReceipt.ts';
import { parseTextRouter } from './server/routes/parseText.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Every AI route needs a member's login. The body is parsed only after that check.
app.use('/api/ai', requireOwner, limitAiRequests, express.json({ limit: '12mb' }));
app.use('/api/ai', parseTextRouter, parseReceiptRouter, auditRouter, chatRouter);

// Health check. Reports whether the Gemini key was found, never the key itself.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: hasApiKey,
    service: 'fina-backend',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  const isProd = await attachWebApp(app);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `FINA App Server running at http://0.0.0.0:${PORT} [${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}]`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

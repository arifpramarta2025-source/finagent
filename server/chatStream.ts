import type { Response } from 'express';

const DEFAULT_IDLE_TIMEOUT_MS = 20_000;
const EMPTY_REPLY = 'Maaf, saya tidak dapat memproses jawaban saat ini. Silakan coba kembali.';
const STREAM_FAILED = 'Koneksi ke Finn terputus. Silakan coba lagi.';

interface GeminiChunk {
  text?: string;
  candidates?: Array<{ groundingMetadata?: unknown }>;
}

/**
 * Sends Gemini's answer to the browser as it is written. Errors before the first byte are thrown
 * so the route can still reply with a normal status. After that, they travel as stream events.
 * The request stops if Gemini goes silent or the browser leaves, which saves quota.
 */
export async function streamGeminiToResponse(
  res: Response,
  open: (signal: AbortSignal) => Promise<AsyncIterable<GeminiChunk>>,
  idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS
): Promise<void> {
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  const stream = await open(controller.signal);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
  };

  let hasText = false;
  let groundingMetadata: unknown = null;

  try {
    resetIdleTimer();
    for await (const chunk of stream) {
      resetIdleTimer();
      groundingMetadata = chunk.candidates?.[0]?.groundingMetadata ?? groundingMetadata;
      if (chunk.text) {
        hasText = true;
        send({ text: chunk.text });
      }
    }

    if (!hasText) send({ text: EMPTY_REPLY });
    send({ done: true, groundingMetadata });
  } catch (error) {
    if (!res.destroyed) {
      console.error('Finn stream failed:', error);
      send({ error: STREAM_FAILED });
    }
  } finally {
    clearTimeout(idleTimer);
    res.end();
  }
}

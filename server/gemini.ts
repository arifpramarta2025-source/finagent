/**
 * The server's only connection to Gemini. The key is read once from the GEMINI_API_KEY
 * secret, and every call goes through the quota-aware model picker in ./geminiQuota.ts.
 * server.ts loads .env before this file runs, so a local key is seen too.
 */
import type { Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import {
  QuotaExhaustedError,
  createCooldowns,
  createGeminiCaller,
  describeQuotaError,
} from './geminiQuota.ts';

// The key lives only in the server's GEMINI_API_KEY secret, never in this repository.
const geminiApiKey = (process.env.GEMINI_API_KEY ?? '').trim();
export const hasApiKey = geminiApiKey !== '' && geminiApiKey !== 'MY_GEMINI_API_KEY';

if (!hasApiKey) {
  console.error('GEMINI_API_KEY belum terpasang. Fitur AI dimatikan sampai secret diisi.');
}

// Initialize Google Gemini API server-side
const ai = new GoogleGenAI({
  apiKey: hasApiKey ? geminiApiKey : 'not-configured',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

class GeminiNotConfiguredError extends Error {}

// Shared by every request, because a quota limit outlives the request that hit it.
const geminiCooldowns = createCooldowns();

const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
const GEMINI_TIMEOUT_MS = 20_000;

// Calls Gemini with a fast timeout, skipping any model that has hit its quota.
export async function callGemini(params: { contents: any; config?: any }) {
  if (!hasApiKey) {
    throw new GeminiNotConfiguredError();
  }

  const call = createGeminiCaller({
    models: GEMINI_MODELS,
    timeoutMs: GEMINI_TIMEOUT_MS,
    cooldowns: geminiCooldowns,
    generate: (model, abortSignal) =>
      ai.models.generateContent({
        model,
        contents: params.contents,
        config: { ...params.config, abortSignal },
      }),
    onModelFailed: (model, err: any) => {
      console.warn(`Gemini attempt with ${model} failed:`, err?.message || err);
    },
  });

  return (await call()) as any;
}

// Opens a streamed reply. streamSignal stays in force after the first response headers arrive.
export async function openGeminiStream(
  params: { contents: any; config?: any },
  streamSignal: AbortSignal
) {
  if (!hasApiKey) {
    throw new GeminiNotConfiguredError();
  }

  const openStream = createGeminiCaller({
    models: GEMINI_MODELS,
    timeoutMs: GEMINI_TIMEOUT_MS,
    cooldowns: geminiCooldowns,
    generate: (model, timeoutSignal) =>
      ai.models.generateContentStream({
        model,
        contents: params.contents,
        config: { ...params.config, abortSignal: AbortSignal.any([timeoutSignal, streamSignal]) },
      }),
    onModelFailed: (model, err: any) => {
      console.warn(`Gemini stream with ${model} failed:`, err?.message || err);
    },
  });

  return openStream();
}

/** Sends a clear quota message when that was the cause. Returns false for any other error. */
export function respondIfQuotaExhausted(error: unknown, res: Response): boolean {
  if (error instanceof GeminiNotConfiguredError) {
    res
      .status(503)
      .json({ error: 'Kunci Gemini belum terpasang di server. Isi secret GEMINI_API_KEY.' });
    return true;
  }
  if (!(error instanceof QuotaExhaustedError)) return false;
  res.status(429).json({ error: describeQuotaError(error, Date.now()) });
  return true;
}

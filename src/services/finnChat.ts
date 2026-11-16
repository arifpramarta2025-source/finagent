import { auth } from './firebase';
import { postAi } from './api';
import { createSseParser } from '../utils/sse';

const STALL_TIMEOUT_MS = 45_000;

export interface FinnReply {
  reply: string;
  groundingMetadata: any;
  isInterrupted: boolean;
}

/** The server answered and refused, so asking again the other way would not help. */
class FinnRejectedError extends Error {}

/** Streaming did not start. Nothing was shown, so the ordinary route can answer instead. */
class StreamUnavailableError extends Error {}

async function openStream(body: unknown, signal: AbortSignal): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new FinnRejectedError('Silakan login terlebih dahulu');

  let response: Response;
  try {
    response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-Token': await user.getIdToken(),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    throw new StreamUnavailableError('Koneksi streaming gagal');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (response.ok && contentType.includes('text/event-stream') && response.body) {
    return response;
  }
  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => null);
    if (json?.error) throw new FinnRejectedError(json.error);
  }
  throw new StreamUnavailableError(`Respons streaming tidak dikenali (${response.status})`);
}

async function streamReply(body: unknown, onText: (text: string) => void): Promise<FinnReply> {
  const controller = new AbortController();
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  const watchForStall = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
  };

  let reply = '';
  let groundingMetadata: any = null;
  let isDone = false;
  let serverError: string | null = null;

  const parser = createSseParser((event) => {
    const data = event as {
      text?: string;
      done?: boolean;
      error?: string;
      groundingMetadata?: any;
    };
    if (data.text) {
      reply += data.text;
      onText(reply);
    }
    if (data.groundingMetadata) groundingMetadata = data.groundingMetadata;
    if (data.done) isDone = true;
    if (data.error) serverError = data.error;
  });

  try {
    watchForStall();
    const response = await openStream(body, controller.signal);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      watchForStall();
      parser(decoder.decode(value, { stream: true }));
    }
  } catch (error) {
    if (error instanceof FinnRejectedError || error instanceof StreamUnavailableError) throw error;
    console.warn('Finn stream dropped:', error);
  } finally {
    clearTimeout(stallTimer);
  }

  if (isDone) return { reply, groundingMetadata, isInterrupted: false };
  if (reply) return { reply, groundingMetadata, isInterrupted: true };
  if (serverError) throw new FinnRejectedError(serverError);
  throw new StreamUnavailableError('Stream berakhir tanpa jawaban');
}

async function requestWholeReply(body: unknown): Promise<FinnReply> {
  const response = await postAi('/api/ai/chat', body);
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Gagal menerima tanggapan dari Finn');
  }
  return { reply: json.reply, groundingMetadata: json.groundingMetadata, isInterrupted: false };
}

/** Shows the answer as it arrives, and falls back to one whole reply if streaming cannot start. */
export async function askFinn(body: unknown, onText: (text: string) => void): Promise<FinnReply> {
  try {
    return await streamReply(body, onText);
  } catch (error) {
    if (!(error instanceof StreamUnavailableError)) throw error;
    console.warn('Using the non-streaming Finn route:', error.message);
    return requestWholeReply(body);
  }
}

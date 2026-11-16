/**
 * Picks which Gemini model to call. A model that reported a quota limit is skipped until the
 * limit clears, so no request is wasted on it. Cooldowns live in memory: a new server instance
 * starts clean and may spend one failed request to learn the limit again.
 */

const DEFAULT_MINUTE_COOLDOWN_MS = 60_000;
const QUOTA_TIME_ZONE = 'America/Los_Angeles'; // Gemini daily quotas reset at midnight Pacific.
const DISPLAY_TIME_ZONE = 'Asia/Jakarta';

export type QuotaKind = 'daily' | 'minute';

export interface QuotaLimit {
  kind: QuotaKind;
  retryAfterMs: number;
}

export class QuotaExhaustedError extends Error {
  readonly kind: QuotaKind;
  readonly availableAt: number;

  constructor(kind: QuotaKind, availableAt: number) {
    super(`All Gemini models are over their ${kind} quota`);
    this.name = 'QuotaExhaustedError';
    this.kind = kind;
    this.availableAt = availableAt;
  }
}

export function msUntilQuotaReset(now: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: QUOTA_TIME_ZONE,
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(now));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const elapsedSeconds = read('hour') * 3600 + read('minute') * 60 + read('second');
  return (86_400 - elapsedSeconds) * 1000;
}

/** Returns the limit a Gemini error reports, or null when the error is not about quota. */
export function readQuotaLimit(error: unknown, now: number): QuotaLimit | null {
  const status = (error as { status?: unknown } | null)?.status;
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (status !== 429 && !message.includes('RESOURCE_EXHAUSTED')) {
    return null;
  }

  if (/per[_\s-]?day|perday|daily/i.test(message)) {
    return { kind: 'daily', retryAfterMs: msUntilQuotaReset(now) };
  }

  const delay = message.match(
    /retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s|retry in (\d+(?:\.\d+)?)\s*s/i
  );
  const seconds = Number(delay?.[1] ?? delay?.[2]);
  return {
    kind: 'minute',
    retryAfterMs: seconds > 0 ? Math.ceil(seconds * 1000) : DEFAULT_MINUTE_COOLDOWN_MS,
  };
}

export type Cooldowns = Map<string, { until: number; kind: QuotaKind }>;

/** One shared map, because a caller is built per request and limits must outlive it. */
export function createCooldowns(): Cooldowns {
  return new Map();
}

interface GeminiCallerOptions<T> {
  models: string[];
  timeoutMs: number;
  cooldowns?: Cooldowns;
  generate: (model: string, signal: AbortSignal) => Promise<T>;
  now?: () => number;
  onModelFailed?: (model: string, error: unknown) => void;
}

export function createGeminiCaller<T>({
  models,
  timeoutMs,
  cooldowns = createCooldowns(),
  generate,
  now = Date.now,
  onModelFailed,
}: GeminiCallerOptions<T>) {
  const activeCooldown = (model: string) => {
    const cooldown = cooldowns.get(model);
    return cooldown && cooldown.until > now() ? cooldown : null;
  };

  const callWithTimeout = async (model: string): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await generate(model, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  };

  return async function callGemini(): Promise<T> {
    let lastError: unknown;

    for (const model of models) {
      if (activeCooldown(model)) continue;

      try {
        return await callWithTimeout(model);
      } catch (error) {
        lastError = error;
        onModelFailed?.(model, error);
        const limit = readQuotaLimit(error, now());
        if (limit) {
          cooldowns.set(model, { until: now() + limit.retryAfterMs, kind: limit.kind });
        }
      }
    }

    const active = models.map(activeCooldown);
    if (active.every(Boolean)) {
      // The owner waits for whichever model comes back first.
      const soonest = active.reduce((a, b) => (b!.until < a!.until ? b : a))!;
      throw new QuotaExhaustedError(soonest.kind, soonest.until);
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Semua model Gemini sedang gagal merespons');
  };
}

/** Owner-facing message for an exhausted quota. */
export function describeQuotaError(error: QuotaExhaustedError, now: number): string {
  if (error.kind === 'daily') {
    const time = new Intl.DateTimeFormat('id-ID', {
      timeZone: DISPLAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(error.availableAt));
    return `Kuota AI harian habis. AI tersedia lagi sekitar pukul ${time} WIB.`;
  }

  const seconds = Math.max(1, Math.ceil((error.availableAt - now) / 1000));
  return `Batas AI per menit tercapai. Coba lagi dalam ${seconds} detik.`;
}

/** Helpers shared by every Firestore write. */

const WRITE_TIMEOUT_MS = 15_000;

export const RESTORE_BATCH_TIMEOUT_MS = 60_000;

/**
 * Resolves only after Firestore confirms a write. Offline writes would otherwise wait
 * in memory and disappear when the page closes.
 */
export async function confirmWrite<T>(
  write: () => Promise<T>,
  timeoutMs: number = WRITE_TIMEOUT_MS
): Promise<T> {
  if (!navigator.onLine) {
    throw new Error('Perangkat sedang offline. Data belum tersimpan.');
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Penyimpanan belum terkonfirmasi. Cek Riwayat sebelum mencoba lagi.')),
      timeoutMs
    );
  });

  try {
    return await Promise.race([write(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Firestore rejects undefined values, so optional fields are dropped before writing. */
export function withoutUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { NextFunction, Request, Response } from 'express';
import { findMember } from '../src/utils/members.ts';

// Must match projectId in firebase-applet-config.json.
export const FIREBASE_PROJECT_ID = 'your-firebase-project-id';

// Hosting layers may consume the Authorization header, so the token has its own header.
const FIREBASE_TOKEN_HEADER = 'x-firebase-token';

const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);

const firebaseKeys = createRemoteJWKSet(FIREBASE_JWKS_URL);

export interface AuthenticatedOwner {
  uid: string;
  email: string;
}

/** Verifies a Firebase ID token and accepts only Fina's members. Throws otherwise. */
export async function verifyOwnerToken(
  token: string,
  keys: JWTVerifyGetKey = firebaseKeys
): Promise<AuthenticatedOwner> {
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ['RS256'],
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!payload.sub || payload.email_verified !== true || !findMember(email)) {
    throw new Error('Token does not belong to a member');
  }

  return { uid: payload.sub, email };
}

export async function requireOwner(req: Request, res: Response, next: NextFunction) {
  const header = req.headers[FIREBASE_TOKEN_HEADER];
  const token = typeof header === 'string' ? header.trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu' });
  }

  try {
    res.locals.owner = await verifyOwnerToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesi login tidak valid. Silakan login kembali' });
  }
}

/** Fixed-window limiter. Counts are per server instance, which is enough for one owner. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const windows = new Map<string, { startedAt: number; count: number }>();

  return function isAllowed(key: string): boolean {
    const currentTime = now();
    const current = windows.get(key);

    if (!current || currentTime - current.startedAt >= windowMs) {
      windows.set(key, { startedAt: currentTime, count: 1 });
      return true;
    }

    current.count += 1;
    return current.count <= limit;
  };
}

const allowAiRequest = createRateLimiter(30, 60_000);

export function limitAiRequests(_req: Request, res: Response, next: NextFunction) {
  const owner = res.locals.owner as AuthenticatedOwner;
  if (!allowAiRequest(owner.uid)) {
    return res.status(429).json({ error: 'Terlalu banyak permintaan AI. Coba lagi sebentar lagi' });
  }
  return next();
}

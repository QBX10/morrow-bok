import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser, isSqlDatabaseConfigured } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { AuthProviderType } from '../types/agency.ts';

const AUTH_SECRET =
  process.env.AUTH_SESSION_SECRET ||
  process.env.GEMINI_API_KEY ||
  'flour_agency_local_hmac_secret_key_v2';

export interface AuthenticatedPrincipal {
  uid: string;
  provider: AuthProviderType;
  displayName: string;
  email?: string;
  username?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface AuthRequest extends Request {
  principal?: AuthenticatedPrincipal;
  user?: DecodedIdToken;
}

export function signSessionToken(payload: AuthenticatedPrincipal): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString(
    'base64url'
  );
  const sig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64url');
  return `sess.${body}.${sig}`;
}

export function verifySessionToken(
  token: string
): AuthenticatedPrincipal | null {
  if (!token.startsWith('sess.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as AuthenticatedPrincipal & { exp?: number };
    if (!parsed.uid || (parsed.exp && Date.now() > parsed.exp)) {
      return null;
    }
    return {
      uid: parsed.uid,
      provider: parsed.provider,
      displayName: parsed.displayName,
      email: parsed.email,
      username: parsed.username,
      phone: parsed.phone,
      avatarUrl: parsed.avatarUrl,
    };
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول أولًا.' });
    return;
  }

  const token = authHeader.slice(7).trim();

  // 1. Check local multi-auth HMAC session tokens first if prefixed with "sess."
  if (token.startsWith('sess.')) {
    const principal = verifySessionToken(token);
    if (!principal) {
      res
        .status(401)
        .json({ error: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.' });
      return;
    }
    req.principal = principal;
    if (isSqlDatabaseConfigured()) {
      try {
        await getOrCreateUser({
          uid: principal.uid,
          email: principal.email || `${principal.uid}@tabrex.local`,
          displayName: principal.displayName,
          avatarUrl: principal.avatarUrl ?? null,
          authProvider: principal.provider,
        });
      } catch (err) {
        console.error('Failed to sync local session user to Cloud SQL:', err);
      }
    }
    next();
    return;
  }

  // 2. Verify Firebase ID Token via Firebase Admin SDK
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const email = (decodedToken.email || `${decodedToken.uid}@firebase.local`).toLowerCase();
    const displayName =
      decodedToken.name || email.split('@')[0] || 'مستخدم Google';
    const avatarUrl =
      typeof decodedToken.picture === 'string' ? decodedToken.picture : undefined;

    req.principal = {
      uid: decodedToken.uid,
      provider: 'google',
      displayName,
      email,
      avatarUrl,
    };

    if (isSqlDatabaseConfigured()) {
      try {
        await getOrCreateUser({
          uid: decodedToken.uid,
          email,
          displayName,
          avatarUrl: avatarUrl ?? null,
          authProvider: 'google',
        });
      } catch (err) {
        console.error('Failed to upsert Firebase user to Cloud SQL:', err);
      }
    }
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res
      .status(401)
      .json({ error: 'تعذر التحقق من جلسة الدخول، يرجى إعادة التسجيل.' });
  }
};

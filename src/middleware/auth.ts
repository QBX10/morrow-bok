import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
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
}

export interface AuthRequest extends Request {
  principal?: AuthenticatedPrincipal;
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
    };
  } catch {
    return null;
  }
}

export const requireAuth = (
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
  const principal = verifySessionToken(token);
  if (!principal) {
    res
      .status(401)
      .json({ error: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.' });
    return;
  }

  req.principal = principal;
  next();
};

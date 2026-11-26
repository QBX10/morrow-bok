import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { resolveOrCreateLocalCanonicalUser } from '../db/localStore.ts';
import { getOrCreateUser, isSqlDatabaseConfigured } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { AuthProviderType } from '../types/agency.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');
const AUTH_SECRET =
  process.env.AUTH_SESSION_SECRET?.trim() || EPHEMERAL_FALLBACK_SECRET;

export const SESSION_COOKIE_NAME = 'morrow_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface AuthenticatedPrincipal {
  uid: string;
  provider: AuthProviderType;
  displayName: string;
  email?: string;
  username?: string;
  githubId?: string;
  avatarUrl?: string;
}

export interface AuthRequest extends Request {
  principal?: AuthenticatedPrincipal;
  user?: DecodedIdToken;
}

export function parseCookieHeader(
  cookieHeader?: string
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function isSecureRequest(req: Request): boolean {
  const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return (
    req.secure ||
    xfProto.includes('https') ||
    process.env.NODE_ENV === 'production'
  );
}

export function setSessionCookie(
  req: Request,
  res: Response,
  token: string,
  rememberMe = true
): void {
  const secure = isSecureRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) {
    parts.push('Secure', 'Partitioned');
  }
  if (rememberMe) {
    parts.push(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const secure = isSecureRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function signSessionToken(payload: AuthenticatedPrincipal): string {
  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
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
    const rawProvider = String(parsed.provider || 'username');
    const safeProvider: AuthProviderType =
      rawProvider === 'google' || rawProvider === 'github' ? rawProvider : 'username';
    return {
      uid: parsed.uid,
      provider: safeProvider,
      displayName: parsed.displayName,
      email: parsed.email,
      username: parsed.username,
      avatarUrl: parsed.avatarUrl,
    };
  } catch {
    return null;
  }
}

export async function verifyAuthToken(token: string): Promise<{
  principal: AuthenticatedPrincipal;
  decodedFirebaseToken?: DecodedIdToken;
} | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('sess.')) {
    const principal = verifySessionToken(trimmed);
    return principal ? { principal } : null;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(trimmed);
    const provider: AuthProviderType = 'google';
    const email = decodedToken.email
      ? decodedToken.email.toLowerCase()
      : `${decodedToken.uid}@firebase.local`;
    const displayName =
      decodedToken.name ||
      (email ? email.split('@')[0] : undefined) ||
      'مستخدم Google';
    const avatarUrl =
      typeof decodedToken.picture === 'string'
        ? decodedToken.picture
        : undefined;

    return {
      principal: {
        uid: decodedToken.uid,
        provider,
        displayName,
        email,
        avatarUrl,
      },
      decodedFirebaseToken: decodedToken,
    };
  } catch {
    return null;
  }
}

function normalizeProvider(raw: unknown, fallback: AuthProviderType): AuthProviderType {
  return raw === 'google' || raw === 'github' || raw === 'username' ? raw : fallback;
}

export async function resolveCanonicalPrincipal(
  principal: AuthenticatedPrincipal
): Promise<AuthenticatedPrincipal> {
  if (isSqlDatabaseConfigured()) {
    try {
      const canonical = await getOrCreateUser({
        uid: principal.uid,
        githubId: principal.githubId ?? null,
        email: principal.email || `${principal.uid}@tabrex.local`,
        username: principal.username ?? null,
        displayName: principal.displayName,
        avatarUrl: principal.avatarUrl ?? null,
        authProvider: principal.provider,
      });
      return {
        uid: canonical.uid,
        provider: normalizeProvider(canonical.authProvider, principal.provider),
        displayName: canonical.displayName || principal.displayName,
        email:
          canonical.email && !canonical.email.endsWith('.local')
            ? canonical.email
            : principal.email,
        username: canonical.username || principal.username,
        githubId: canonical.githubId || principal.githubId,
        avatarUrl: canonical.avatarUrl || principal.avatarUrl,
      };
    } catch (err) {
      console.error('Failed to sync authenticated user to Cloud SQL:', err);
    }
  }

  const localCanonical = resolveOrCreateLocalCanonicalUser({
    uid: principal.uid,
    githubId: principal.githubId ?? null,
    authProvider: principal.provider,
    displayName: principal.displayName,
    email: principal.email ?? null,
    username: principal.username ?? null,
    avatarUrl: principal.avatarUrl ?? null,
  });
  return {
    uid: localCanonical.uid,
    provider: normalizeProvider(localCanonical.authProvider, principal.provider),
    displayName: localCanonical.displayName,
    email: localCanonical.email || principal.email,
    username: localCanonical.username || principal.username,
    githubId: localCanonical.githubId || principal.githubId,
    avatarUrl: localCanonical.avatarUrl || principal.avatarUrl,
  };
}

function isSameOriginMutationAllowed(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }
  const originHeader = req.headers.origin;
  const hostHeader = String(
    req.headers['x-forwarded-host'] || req.headers.host || ''
  ).toLowerCase();
  if (originHeader && hostHeader) {
    try {
      const originHost = new URL(originHeader).host.toLowerCase();
      if (originHost !== hostHeader) {
        return false;
      }
    } catch {
      return false;
    }
  }
  const requestedWith = String(req.headers['x-requested-with'] || '');
  return Boolean(originHeader || requestedWith === 'MorrowApp');
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  let token = '';
  let authenticatedViaCookie = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookieHeader(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      token = cookies[SESSION_COOKIE_NAME];
      authenticatedViaCookie = true;
    }
  }

  if (!token) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول أولًا.' });
    return;
  }

  if (authenticatedViaCookie && !isSameOriginMutationAllowed(req)) {
    res.status(403).json({ error: 'طلب غير مصرح به من مصدر خارجي.' });
    return;
  }

  const verified = await verifyAuthToken(token);
  if (!verified) {
    res.status(401).json({
      error: token.startsWith('sess.')
        ? 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.'
        : 'تعذر التحقق من جلسة الدخول، يرجى إعادة التسجيل.',
    });
    return;
  }

  req.principal = await resolveCanonicalPrincipal(verified.principal);
  if (verified.decodedFirebaseToken) {
    req.user = verified.decodedFirebaseToken;
  }

  next();
};

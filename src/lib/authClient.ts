import type { AuthUser } from '../types/agency';

const LOCAL_AUTH_STORAGE_KEY = 'flour_agency_session_v2';

export interface StoredSession {
  token: string;
  user: AuthUser;
}

export function getStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.user?.uid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser): void {
  localStorage.setItem(
    LOCAL_AUTH_STORAGE_KEY,
    JSON.stringify({ token, user })
  );
}

export function clearSession(): void {
  localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
}

export async function loginWithPasswordApi(params: {
  mode: 'google' | 'username' | 'phone';
  identifier: string;
  password: string;
}): Promise<StoredSession> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تسجيل الدخول.');
  saveSession(data.token, data.user);
  return data;
}

export async function registerWithPasswordApi(params: {
  mode: 'google' | 'username' | 'phone';
  displayName: string;
  email?: string;
  username?: string;
  phone?: string;
  password: string;
}): Promise<StoredSession> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إنشاء الحساب.');
  saveSession(data.token, data.user);
  return data;
}

export async function googleQuickSignInApi(params: {
  email: string;
  displayName?: string;
}): Promise<StoredSession> {
  const res = await fetch('/api/auth/google-quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تسجيل الدخول بحساب Gmail.');
  saveSession(data.token, data.user);
  return data;
}

export async function requestPhoneOtpApi(phone: string): Promise<{
  ok: boolean;
  phone: string;
  demoCode?: string;
}> {
  const res = await fetch('/api/auth/phone/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إرسال رمز التحقق.');
  return data;
}

export async function verifyPhoneOtpApi(params: {
  phone: string;
  code: string;
  displayName?: string;
}): Promise<StoredSession> {
  const res = await fetch('/api/auth/phone/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر التحقق من رمز الهاتف.');
  saveSession(data.token, data.user);
  return data;
}

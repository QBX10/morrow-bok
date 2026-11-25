import type { AppearanceProfile, AuthProviderType, AuthUser } from '../types/agency';
import {
  getFirebaseIdToken,
  googleSignIn,
  logoutFirebase,
} from './firebase';
import { syncUserProfileToFirestore } from './firestoreSync';

const LOCAL_AUTH_STORAGE_KEY = 'flour_agency_session_v2';
const REMEMBERED_ACCOUNTS_KEY = 'morrow_remembered_accounts_v1';

export interface StoredSession {
  token: string;
  user: AuthUser;
}

export interface RememberedAccountSummary {
  uid: string;
  provider: AuthProviderType;
  displayName: string;
  email?: string;
  username?: string;
  phone?: string;
  avatarUrl?: string;
  lastUsedAt: string;
}

function parseSessionRaw(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.user?.uid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredSession(): StoredSession | null {
  try {
    const local = parseSessionRaw(localStorage.getItem(LOCAL_AUTH_STORAGE_KEY));
    if (local) return local;
    if (typeof sessionStorage !== 'undefined') {
      return parseSessionRaw(sessionStorage.getItem(LOCAL_AUTH_STORAGE_KEY));
    }
    return null;
  } catch {
    return null;
  }
}

export function getRememberedAccounts(): RememberedAccountSummary[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RememberedAccountSummary =>
        Boolean(item && typeof item.uid === 'string' && typeof item.displayName === 'string')
    );
  } catch {
    return [];
  }
}

export function saveRememberedAccount(user: AuthUser): void {
  try {
    const existing = getRememberedAccounts().filter((a) => a.uid !== user.uid);
    const entry: RememberedAccountSummary = {
      uid: user.uid,
      provider: user.provider,
      displayName: user.displayName,
      email: user.email,
      username: user.username,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      lastUsedAt: new Date().toISOString(),
    };
    localStorage.setItem(
      REMEMBERED_ACCOUNTS_KEY,
      JSON.stringify([entry, ...existing].slice(0, 5))
    );
  } catch {
    // ignore storage quota errors
  }
}

export function removeRememberedAccount(uid: string): RememberedAccountSummary[] {
  try {
    const next = getRememberedAccounts().filter((a) => a.uid !== uid);
    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function saveSession(
  token: string,
  user: AuthUser,
  rememberMe = true
): void {
  const payload = JSON.stringify({ token, user });
  try {
    if (rememberMe) {
      localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, payload);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
      }
      saveRememberedAccount(user);
    } else {
      localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(LOCAL_AUTH_STORAGE_KEY, payload);
      }
    }
  } catch {
    // Fallback to localStorage if sessionStorage fails
    localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, payload);
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  void logoutFirebase().catch(() => {});
}

export async function getActiveBearerToken(): Promise<string | null> {
  const firebaseToken = await getFirebaseIdToken();
  if (firebaseToken) return firebaseToken;
  return getStoredSession()?.token || null;
}

export async function signInWithFirebaseGoogle(options?: {
  selectAccount?: boolean;
  loginHint?: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const { user: fbUser, idToken } = await googleSignIn(options);

  let resolvedUser: AuthUser = {
    uid: fbUser.uid,
    provider: 'google',
    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'مستخدم Google',
    email: fbUser.email || undefined,
    avatarUrl: fbUser.photoURL || undefined,
    role: 'manager',
  };

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.user) {
        resolvedUser = {
          ...resolvedUser,
          ...data.user,
          avatarUrl: data.user.avatarUrl || resolvedUser.avatarUrl,
        };
      }
    }
  } catch {
    // Cloud SQL sync is optional if offline
  }

  void syncUserProfileToFirestore({
    uid: fbUser.uid,
    displayName: resolvedUser.displayName,
    email: resolvedUser.email,
    provider: 'google',
    avatarUrl: resolvedUser.avatarUrl,
  }).catch(() => {});

  saveSession(idToken, resolvedUser, options?.rememberMe ?? true);
  return { token: idToken, user: resolvedUser };
}

export async function updateUserProfileApi(patch: {
  displayName?: string;
  avatarUrl?: string;
}): Promise<AuthUser> {
  const token = await getActiveBearerToken();
  const current = getStoredSession();
  if (!token || !current) {
    throw new Error('يرجى تسجيل الدخول أولاً لتحديث الملف الشخصي.');
  }

  const nextUser: AuthUser = {
    ...current.user,
    displayName: patch.displayName?.trim() || current.user.displayName,
    avatarUrl:
      patch.avatarUrl !== undefined ? patch.avatarUrl : current.user.avatarUrl,
  };

  try {
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'تعذر حفظ بيانات الملف الشخصي.');
    }
    if (data?.user) {
      Object.assign(nextUser, data.user);
    }
  } catch (err) {
    if (token !== 'firebase') {
      saveSession(token, nextUser);
    }
    throw err;
  }

  void syncUserProfileToFirestore({
    uid: nextUser.uid,
    displayName: nextUser.displayName,
    email: nextUser.email,
    provider: nextUser.provider,
    avatarUrl: nextUser.avatarUrl,
  }).catch(() => {});

  saveSession(token, nextUser);
  return nextUser;
}

export async function fetchServerAppearanceProfiles(): Promise<AppearanceProfile[]> {
  const token = await getActiveBearerToken();
  if (!token) return [];
  const res = await fetch('/api/appearance-profiles', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.profiles) ? data.profiles : [];
}

export async function saveServerAppearanceProfile(
  profile: AppearanceProfile
): Promise<void> {
  const token = await getActiveBearerToken();
  if (!token) return;
  await fetch('/api/appearance-profiles', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ profile }),
  });
}

export async function deleteServerAppearanceProfile(id: string): Promise<void> {
  const token = await getActiveBearerToken();
  if (!token) return;
  await fetch(`/api/appearance-profiles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function loginWithPasswordApi(params: {
  mode: 'google' | 'username' | 'phone';
  identifier: string;
  password: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: params.mode,
      identifier: params.identifier,
      password: params.password,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تسجيل الدخول.');
  saveSession(data.token, data.user, params.rememberMe ?? true);
  return data;
}

export async function registerWithPasswordApi(params: {
  mode: 'google' | 'username' | 'phone';
  displayName: string;
  email?: string;
  username?: string;
  phone?: string;
  password: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: params.mode,
      displayName: params.displayName,
      email: params.email,
      username: params.username,
      phone: params.phone,
      password: params.password,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إنشاء الحساب.');
  saveSession(data.token, data.user, params.rememberMe ?? true);
  return data;
}

export async function googleQuickSignInApi(params: {
  email: string;
  displayName?: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const res = await fetch('/api/auth/google-quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      displayName: params.displayName,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تسجيل الدخول بحساب Gmail.');
  saveSession(data.token, data.user, params.rememberMe ?? true);
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
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const res = await fetch('/api/auth/phone/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: params.phone,
      code: params.code,
      displayName: params.displayName,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر التحقق من رمز الهاتف.');
  saveSession(data.token, data.user, params.rememberMe ?? true);
  return data;
}

export async function requestPasswordResetApi(params: {
  mode: 'google' | 'username' | 'phone';
  identifier: string;
}): Promise<{ ok: boolean; maskedTarget?: string; demoCode?: string }> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إرسال رمز الاستعادة.');
  return data;
}

export async function confirmPasswordResetApi(params: {
  mode: 'google' | 'username' | 'phone';
  identifier: string;
  code: string;
  newPassword: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: params.mode,
      identifier: params.identifier,
      code: params.code,
      newPassword: params.newPassword,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إعادة تعيين كلمة المرور.');
  saveSession(data.token, data.user, params.rememberMe ?? true);
  return data;
}

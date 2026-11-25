import type { AppearanceProfile, AuthProviderType, AuthUser } from '../types/agency';
import {
  getFirebaseIdToken,
  googleSignIn,
  logoutFirebase,
} from './firebase';
import { syncUserProfileToFirestore } from './firestoreSync';

const LEGACY_AUTH_STORAGE_KEY = 'flour_agency_session_v2';
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

// Strictly in-memory active session (never persisted in localStorage/sessionStorage)
let inMemorySession: StoredSession | null = null;

function purgeLegacyTokenStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    }
  } catch {
    // ignore storage access issues
  }
}

purgeLegacyTokenStorage();

export function getStoredSession(): StoredSession | null {
  return inMemorySession;
}

export function getRememberedAccounts(): RememberedAccountSummary[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RememberedAccountSummary =>
        Boolean(
          item &&
            typeof item.uid === 'string' &&
            typeof item.displayName === 'string'
        )
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
  purgeLegacyTokenStorage();
  inMemorySession = { token, user };
  if (rememberMe) {
    saveRememberedAccount(user);
  }
}

export function clearSession(): void {
  inMemorySession = null;
  purgeLegacyTokenStorage();
  if (typeof fetch === 'function') {
    void fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'MorrowApp' },
    }).catch(() => {});
  }
  void logoutFirebase().catch(() => {});
}

export async function getActiveBearerToken(): Promise<string | null> {
  if (inMemorySession?.token) return inMemorySession.token;
  const firebaseToken = await getFirebaseIdToken();
  if (firebaseToken) return firebaseToken;
  return null;
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getActiveBearerToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'MorrowApp');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export async function restoreSessionFromServer(): Promise<AuthUser | null> {
  try {
    const token = await getActiveBearerToken();
    const headers = new Headers({ 'X-Requested-With': 'MorrowApp' });
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch('/api/auth/me', {
      credentials: 'include',
      headers,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: AuthUser };
    if (!data?.user?.uid) return null;
    inMemorySession = { token: token || '', user: data.user };
    return data.user;
  } catch {
    return null;
  }
}

export async function signInWithFirebaseGoogle(options?: {
  selectAccount?: boolean;
  loginHint?: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const { user: fbUser, idToken } = await googleSignIn(options);
  const rememberMe = options?.rememberMe ?? true;

  let resolvedToken = idToken;
  let resolvedUser: AuthUser = {
    uid: fbUser.uid,
    provider: 'google',
    displayName:
      fbUser.displayName || fbUser.email?.split('@')[0] || 'مستخدم Google',
    email: fbUser.email || undefined,
    avatarUrl: fbUser.photoURL || undefined,
    role: 'manager',
  };

  try {
    const res = await fetch('/api/auth/firebase-session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'MorrowApp',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ rememberMe }),
    });
    if (res.ok) {
      const data = (await res.json()) as { token?: string; user?: AuthUser };
      if (data?.token) resolvedToken = data.token;
      if (data?.user) {
        resolvedUser = {
          ...resolvedUser,
          ...data.user,
          avatarUrl: data.user.avatarUrl || resolvedUser.avatarUrl,
        };
      }
    }
  } catch {
    // Cloud SQL / cookie sync is optional if offline
  }

  void syncUserProfileToFirestore({
    uid: fbUser.uid,
    displayName: resolvedUser.displayName,
    email: resolvedUser.email,
    provider: 'google',
    avatarUrl: resolvedUser.avatarUrl,
  }).catch(() => {});

  saveSession(resolvedToken, resolvedUser, rememberMe);
  return { token: resolvedToken, user: resolvedUser };
}

export async function updateUserProfileApi(patch: {
  displayName?: string;
  avatarUrl?: string;
}): Promise<AuthUser> {
  const current = getStoredSession();
  if (!current) {
    throw new Error('يرجى تسجيل الدخول أولاً لتحديث الملف الشخصي.');
  }

  const nextUser: AuthUser = {
    ...current.user,
    displayName: patch.displayName?.trim() || current.user.displayName,
    avatarUrl:
      patch.avatarUrl !== undefined ? patch.avatarUrl : current.user.avatarUrl,
  };

  const res = await authFetch('/api/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
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

  void syncUserProfileToFirestore({
    uid: nextUser.uid,
    displayName: nextUser.displayName,
    email: nextUser.email,
    provider: nextUser.provider,
    avatarUrl: nextUser.avatarUrl,
  }).catch(() => {});

  saveSession(current.token, nextUser);
  return nextUser;
}

export async function fetchServerAppearanceProfiles(): Promise<
  AppearanceProfile[]
> {
  const res = await authFetch('/api/appearance-profiles');
  if (!res.ok) return [];
  const data = (await res.json()) as {
    profiles?: Array<{
      profileKey?: string;
      name?: string;
      configJson?: string;
    }>;
  };
  if (!Array.isArray(data?.profiles)) return [];
  const parsed: AppearanceProfile[] = [];
  for (const row of data.profiles) {
    if (!row?.configJson) continue;
    try {
      const cfg = JSON.parse(row.configJson) as AppearanceProfile;
      if (cfg && typeof cfg.id === 'string') {
        parsed.push(cfg);
      }
    } catch {
      // skip malformed profile JSON
    }
  }
  return parsed;
}

export async function saveServerAppearanceProfile(
  profile: AppearanceProfile
): Promise<void> {
  await authFetch('/api/appearance-profiles', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profileKey: profile.id,
      name: profile.name,
      configJson: JSON.stringify(profile),
    }),
  });
}

export async function deleteServerAppearanceProfile(id: string): Promise<void> {
  await authFetch(`/api/appearance-profiles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function loginWithPasswordApi(params: {
  mode: 'auto' | 'google' | 'username' | 'phone';
  identifier: string;
  password: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const rememberMe = params.rememberMe ?? true;
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
    body: JSON.stringify({
      mode: params.mode,
      identifier: params.identifier,
      password: params.password,
      rememberMe,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تسجيل الدخول.');
  saveSession(data.token, data.user, rememberMe);
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
  const rememberMe = params.rememberMe ?? true;
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
    body: JSON.stringify({
      mode: params.mode,
      displayName: params.displayName,
      email: params.email,
      username: params.username,
      phone: params.phone,
      password: params.password,
      rememberMe,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إنشاء الحساب.');
  saveSession(data.token, data.user, rememberMe);
  return data;
}

export async function requestPhoneOtpApi(phone: string): Promise<{
  ok: boolean;
  phone: string;
  demoCode?: string;
}> {
  const res = await fetch('/api/auth/phone/request-otp', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
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
  const rememberMe = params.rememberMe ?? true;
  const res = await fetch('/api/auth/phone/verify-otp', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
    body: JSON.stringify({
      phone: params.phone,
      code: params.code,
      displayName: params.displayName,
      rememberMe,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر التحقق من رمز الهاتف.');
  saveSession(data.token, data.user, rememberMe);
  return data;
}

export async function requestPasswordResetApi(params: {
  mode: 'auto' | 'google' | 'username' | 'phone';
  identifier: string;
}): Promise<{ ok: boolean; maskedTarget?: string; demoCode?: string }> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إرسال رمز الاستعادة.');
  return data;
}

export async function confirmPasswordResetApi(params: {
  mode: 'auto' | 'google' | 'username' | 'phone';
  identifier: string;
  code: string;
  newPassword: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const rememberMe = params.rememberMe ?? true;
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
    body: JSON.stringify({
      mode: params.mode,
      identifier: params.identifier,
      code: params.code,
      newPassword: params.newPassword,
      rememberMe,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إعادة تعيين كلمة المرور.');
  saveSession(data.token, data.user, rememberMe);
  return data;
}


import type { AppearanceProfile, AuthUser } from '../types/agency';
import {
  getFirebaseIdToken,
  googleSignIn,
  logoutFirebase,
} from './firebase';
import { syncUserProfileToFirestore } from './firestoreSync';

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

  saveSession(idToken, resolvedUser);
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

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

export async function signInWithGithubPopup(options?: {
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const rememberMe = options?.rememberMe ?? true;
  const urlRes = await fetch(
    `/api/auth/github/url?rememberMe=${rememberMe ? '1' : '0'}`,
    {
      credentials: 'include',
      headers: { 'X-Requested-With': 'MorrowApp' },
    }
  );
  const urlData = (await urlRes.json().catch(() => ({}))) as {
    configured?: boolean;
    url?: string;
    callbackUrl?: string;
    error?: string;
  };
  if (!urlRes.ok || !urlData.url) {
    throw new Error(
      urlData.error ||
        'تسجيل الدخول عبر GitHub غير مفعّل بعد؛ يرجى ضبط بيانات تطبيق GitHub OAuth.'
    );
  }

  return new Promise<StoredSession>((resolve, reject) => {
    let settled = false;
    let closePoll: ReturnType<typeof setInterval> | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (closePoll) clearInterval(closePoll);
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };

    const onMessage = (event: MessageEvent) => {
      const originAllowed =
        event.origin === window.location.origin ||
        event.origin.endsWith('.run.app') ||
        event.origin.includes('localhost');
      if (!originAllowed) return;
      const msg = event.data as
        | {
            type?: string;
            payload?: { token?: string; user?: AuthUser };
            error?: string;
          }
        | undefined;
      if (!msg || typeof msg.type !== 'string') return;
      if (msg.type === 'GITHUB_AUTH_SUCCESS' && msg.payload?.user && msg.payload?.token) {
        if (settled) return;
        settled = true;
        cleanup();
        saveSession(msg.payload.token, msg.payload.user, rememberMe);
        resolve({ token: msg.payload.token, user: msg.payload.user });
      } else if (msg.type === 'GITHUB_AUTH_ERROR') {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(msg.error || 'تعذر إتمام المصادقة عبر GitHub.'));
      }
    };

    window.addEventListener('message', onMessage);

    const width = 540;
    const height = 700;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popup = window.open(
      urlData.url,
      'morrow_github_oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      settled = true;
      cleanup();
      reject(
        new Error(
          'تم حظر النافذة المنبثقة من المتصفح. يرجى السماح بالنوافذ المنبثقة ثم المحاولة مرة أخرى.'
        )
      );
      return;
    }

    closePoll = setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        cleanup();
        reject(new Error('تم إغلاق نافذة تسجيل الدخول عبر GitHub قبل إكمال العملية.'));
      }
    }, 450);

    timeoutHandle = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        try {
          if (!popup.closed) popup.close();
        } catch {
          // ignore cross-origin window close restrictions
        }
        reject(new Error('انتهت مهلة المصادقة عبر GitHub. يرجى المحاولة مرة أخرى.'));
      }
    }, 120000);
  });
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
  mode: 'auto' | 'google' | 'username';
  identifier: string;
  password: string;
  rememberMe?: boolean;
  botChallenge?: { challengeId: string; nonce: string };
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
      ...(params.botChallenge ? { botChallenge: params.botChallenge } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error || 'تعذر تسجيل الدخول.') as Error & {
      requiresChallenge?: boolean;
    };
    if (data?.requiresChallenge) {
      err.requiresChallenge = true;
    }
    throw err;
  }
  saveSession(data.token, data.user, rememberMe);
  return data;
}

export async function registerWithPasswordApi(params: {
  mode: 'google' | 'username';
  displayName: string;
  email?: string;
  username?: string;
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
      password: params.password,
      rememberMe,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إنشاء الحساب.');
  saveSession(data.token, data.user, rememberMe);
  return data;
}

export async function requestPasswordResetApi(params: {
  mode: 'auto' | 'google' | 'username';
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
  mode: 'auto' | 'google' | 'username';
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

export async function linkUsernameApi(params: {
  username: string;
  password?: string;
}): Promise<StoredSession> {
  const res = await authFetch('/api/auth/link-username', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر ربط اسم المستخدم.');
  saveSession(data.token, data.user, true);
  return data;
}

export async function fetchStorageStatusApi(): Promise<{
  cloudSqlConfigured: boolean;
  cloudSqlReachable: boolean;
  firebaseAuthConfigured: boolean;
  storageMode: 'cloud_sql' | 'local_fallback';
}> {
  const res = await fetch('/api/system/storage-status', {
    credentials: 'include',
    headers: { 'X-Requested-With': 'MorrowApp' },
  });
  if (!res.ok) {
    return {
      cloudSqlConfigured: false,
      cloudSqlReachable: false,
      firebaseAuthConfigured: true,
      storageMode: 'local_fallback',
    };
  }
  return res.json();
}

export async function pushWorkspaceLwwApi(params: {
  snapshot: unknown;
  clientUpdatedAt: string;
  deviceId: string;
  force?: boolean;
}): Promise<{
  ok: boolean;
  conflictResolved?: boolean;
  winner?: 'client' | 'server';
  snapshot?: unknown;
  updatedAt?: string;
  version?: number;
  storageMode?: 'cloud_sql' | 'local_fallback';
}> {
  const res = await authFetch('/api/workspace', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذرت المزامنة مع السحابة.');
  return data;
}

export async function fetchWorkspaceSnapshotApi(): Promise<{
  exists: boolean;
  snapshot: unknown;
  updatedAt?: string;
  version?: number;
  storageMode?: 'cloud_sql' | 'local_fallback';
}> {
  const res = await authFetch('/api/workspace');
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر جلب النسخة السحابية.');
  return data;
}

export async function pushSyncQueueOpsApi(params: {
  operations: Array<{
    id: string;
    type: string;
    entity: string;
    summary: string;
    updatedAt: string;
    deviceId: string;
  }>;
  auditEvents?: Array<{
    id: string;
    actionType: string;
    title: string;
    summary: string;
    deviceId: string;
    timestamp: string;
  }>;
}): Promise<{ ok: boolean; syncedIds: string[]; syncedAt: string }> {
  const res = await authFetch('/api/workspace/sync-ops', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إرسال عمليات المزامنة.');
  return data;
}

export async function exchangeFirebaseIdTokenApi(params: {
  idToken: string;
  rememberMe?: boolean;
  displayName?: string;
}): Promise<StoredSession> {
  const rememberMe = params.rememberMe ?? true;
  const res = await fetch('/api/auth/firebase-session', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      rememberMe,
      displayName: params.displayName,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'تعذر توثيق جلسة Firebase.');
  }
  saveSession(data.token, data.user, rememberMe);
  return data;
}


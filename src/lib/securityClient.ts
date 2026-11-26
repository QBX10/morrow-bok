import { authFetch, saveSession, type StoredSession } from './authClient';
import type {
  ActiveSessionRecord,
  BotChallengePayload,
  PasskeyCredentialSummary,
  PwnedPasswordCheckResult,
  QrPairingInitResponse,
  ReauthGrantStatus,
  RecoveryCodesStatus,
  SecurityAlertItem,
  ShareAccessLogEntry,
  ShareInviteRecord,
  ShareLinkRecord,
  ShareRole,
  StorageQuotaInfo,
  WorkspaceVersionRecord,
} from '../types/agency';
import type { ChunkTransportClient, DataChunkItem } from '../services/storage/chunkSyncEngine';

/**
 * Computes SHA-1 in browser memory and sends ONLY the 5-char hash prefix
 * to the server k-Anonymity proxy (password never leaves device in plain or full hash).
 */
export async function checkPasswordPwnedClient(
  password: string
): Promise<PwnedPasswordCheckResult> {
  if (!password || password.length < 4) {
    return { checked: false, pwned: false, count: 0 };
  }
  try {
    const encoded = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-1', encoded);
    const fullHex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const prefix = fullHex.slice(0, 5);
    const suffix = fullHex.slice(5);

    const res = await fetch('/api/auth/check-password-pwned', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'MorrowApp',
      },
      body: JSON.stringify({ prefix }),
    });
    if (!res.ok) {
      return { checked: false, pwned: false, count: 0, offlineFallback: true };
    }
    const data = (await res.json()) as {
      checked?: boolean;
      suffixCounts?: Record<string, number>;
      offlineFallback?: boolean;
    };
    const count = Number(data.suffixCounts?.[suffix] || 0);
    return {
      checked: Boolean(data.checked),
      pwned: count > 0,
      count,
      offlineFallback: data.offlineFallback,
    };
  } catch {
    return { checked: false, pwned: false, count: 0, offlineFallback: true };
  }
}

export async function fetchBotChallengeApi(): Promise<BotChallengePayload> {
  const res = await fetch('/api/auth/challenge', {
    credentials: 'include',
    headers: { 'X-Requested-With': 'MorrowApp' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تهيئة التحقق الأمني.');
  return data;
}

export async function solveBotChallengePow(
  challenge: BotChallengePayload
): Promise<{ challengeId: string; nonce: string }> {
  const targetPrefix = '0'.repeat(Math.max(1, Math.min(4, challenge.difficulty || 2)));
  let nonce = 0;
  while (nonce < 50000) {
    const candidate = `${challenge.prefix}:${nonce}`;
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(candidate)
    );
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (hex.startsWith(targetPrefix)) {
      return { challengeId: challenge.challengeId, nonce: String(nonce) };
    }
    nonce += 1;
  }
  return { challengeId: challenge.challengeId, nonce: String(nonce) };
}

// --- Sessions & Security Alerts ---
export async function fetchActiveSessionsApi(): Promise<ActiveSessionRecord[]> {
  const res = await authFetch('/api/auth/sessions');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.sessions) ? data.sessions : [];
}

export async function revokeSessionApi(sid: string): Promise<void> {
  const res = await authFetch(`/api/auth/sessions/${encodeURIComponent(sid)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'تعذر إنهاء الجلسة عن بُعد.');
  }
}

export async function revokeOtherSessionsApi(): Promise<number> {
  const res = await authFetch('/api/auth/sessions/revoke-others', {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تسجيل الخروج من الأجهزة الأخرى.');
  return Number(data.revokedCount || 0);
}

export interface SecurityAlertsFeedResponse {
  alerts: SecurityAlertItem[];
  emailAlertsEnabled: boolean;
  emailNotificationConfig: {
    configured: boolean;
    provider: 'smtp' | 'resend' | 'none';
    fromConfigured: boolean;
    fromAddressPreview?: string;
  };
}

export async function fetchSecurityAlertsWithConfigApi(): Promise<SecurityAlertsFeedResponse> {
  const res = await authFetch('/api/auth/security-alerts');
  if (!res.ok) {
    return {
      alerts: [],
      emailAlertsEnabled: true,
      emailNotificationConfig: {
        configured: false,
        provider: 'none',
        fromConfigured: false,
      },
    };
  }
  const data = await res.json();
  return {
    alerts: Array.isArray(data?.alerts) ? data.alerts : [],
    emailAlertsEnabled: data?.emailAlertsEnabled !== false,
    emailNotificationConfig: data?.emailNotificationConfig || {
      configured: false,
      provider: 'none',
      fromConfigured: false,
    },
  };
}

export async function fetchSecurityAlertsApi(): Promise<SecurityAlertItem[]> {
  const res = await fetchSecurityAlertsWithConfigApi();
  return res.alerts;
}

export async function updateEmailAlertsPreferenceApi(
  enabled: boolean
): Promise<{ emailAlertsEnabled: boolean }> {
  const res = await authFetch('/api/auth/security-alerts/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailAlertsEnabled: enabled }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر حفظ تفضيل تنبيهات البريد.');
  return data;
}

export async function sendTestSecurityEmailApi(): Promise<{
  status: string;
  provider: string;
  messageId?: string;
  error?: string;
  alert?: SecurityAlertItem;
}> {
  const res = await authFetch('/api/auth/security-alerts/test-email', {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إرسال رسالة الاختبار.');
  return data;
}

// --- Step-Up Re-Authentication ---
export async function verifyReauthApi(params: {
  password?: string;
}): Promise<ReauthGrantStatus> {
  const res = await authFetch('/api/auth/reauthenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر التحقق من كلمة المرور.');
  return data;
}

// --- Passkeys Management ---
export async function listPasskeysApi(): Promise<PasskeyCredentialSummary[]> {
  const res = await authFetch('/api/auth/passkeys');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.passkeys) ? data.passkeys : [];
}

export async function deletePasskeyApi(
  id: string,
  reauthToken?: string
): Promise<void> {
  const res = await authFetch(`/api/auth/passkeys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      ...(reauthToken ? { 'X-Reauth-Token': reauthToken } : {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'تعذر حذف مفتاح المرور.');
  }
}

// --- Recovery Codes ---
export async function getRecoveryCodesStatusApi(): Promise<RecoveryCodesStatus> {
  const res = await authFetch('/api/auth/recovery-codes/status');
  if (!res.ok) return { totalCount: 0, remainingCount: 0 };
  return res.json();
}

export async function generateRecoveryCodesApi(
  reauthToken: string
): Promise<{ codes: string[]; status: RecoveryCodesStatus }> {
  const res = await authFetch('/api/auth/recovery-codes/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Reauth-Token': reauthToken,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر توليد رموز الاسترجاع.');
  return data;
}

export async function loginWithRecoveryCodeApi(params: {
  identifier: string;
  recoveryCode: string;
  rememberMe?: boolean;
}): Promise<StoredSession> {
  const rememberMe = params.rememberMe ?? true;
  const res = await fetch('/api/auth/login-recovery-code', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
    body: JSON.stringify({
      identifier: params.identifier,
      recoveryCode: params.recoveryCode,
      rememberMe,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'رمز الاسترجاع غير صالح أو مستخدم مسبقاً.');
  saveSession(data.token, data.user, rememberMe);
  return data;
}

// --- QR Cross-Device Login ---
export async function initQrPairingApi(): Promise<QrPairingInitResponse> {
  const res = await fetch('/api/auth/qr/init', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'MorrowApp' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إنشاء رمز QR.');
  return data;
}

export async function pollQrPairingStatusApi(pairId: string): Promise<{
  status: 'pending' | 'approved' | 'expired';
  token?: string;
  user?: StoredSession['user'];
}> {
  const res = await fetch(`/api/auth/qr/status/${encodeURIComponent(pairId)}`, {
    credentials: 'include',
    headers: { 'X-Requested-With': 'MorrowApp' },
  });
  const data = await res.json();
  if (!res.ok) return { status: 'expired' };
  if (data.status === 'approved' && data.token && data.user) {
    saveSession(data.token, data.user, true);
  }
  return data;
}

export async function approveQrPairingApi(codeOrPairId: string): Promise<{ ok: boolean }> {
  const res = await authFetch('/api/auth/qr/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeOrPairId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تأكيد ربط الجهاز الجديد.');
  return data;
}

// --- Chunked Sync Transport + Quota + 30-Day Version History ---
export function createServerChunkTransport(): ChunkTransportClient {
  return {
    async checkMissingChunks(hashes: string[]): Promise<string[]> {
      const res = await authFetch('/api/sync/chunks/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'تعذر فحص القطع المفقودة.');
      return Array.isArray(data?.missingHashes) ? data.missingHashes : hashes;
    },
    async uploadChunk(chunk: DataChunkItem): Promise<void> {
      const res = await authFetch(`/api/sync/chunks/${encodeURIComponent(chunk.hash)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: chunk.base64Data,
          sizeBytes: chunk.sizeBytes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'فشل رفع إحدى قطع المزامنة.');
      }
    },
    async commitManifest(params) {
      const res = await authFetch('/api/sync/manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'تعذر تثبيت فهرس القطع.');
      return data;
    },
  };
}

export async function fetchStorageQuotaApi(): Promise<StorageQuotaInfo | null> {
  const res = await authFetch('/api/workspace/quota');
  if (!res.ok) return null;
  return res.json();
}

export async function fetchWorkspaceVersionsApi(): Promise<WorkspaceVersionRecord[]> {
  const res = await authFetch('/api/workspace/versions');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.versions) ? data.versions : [];
}

export async function restoreWorkspaceVersionApi(versionId: string): Promise<{
  ok: boolean;
  snapshot: unknown;
}> {
  const res = await authFetch(
    `/api/workspace/versions/${encodeURIComponent(versionId)}/restore`,
    { method: 'POST' }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر استرجاع الإصدار المطلوب.');
  return data;
}

// --- Sharing, Invites, RBAC & Audit ---
export async function fetchSharingOverviewApi(): Promise<{
  links: ShareLinkRecord[];
  invites: ShareInviteRecord[];
  accessLogs: ShareAccessLogEntry[];
}> {
  const res = await authFetch('/api/shares');
  if (!res.ok) return { links: [], invites: [], accessLogs: [] };
  const data = await res.json();
  return {
    links: Array.isArray(data?.links) ? data.links : [],
    invites: Array.isArray(data?.invites) ? data.invites : [],
    accessLogs: Array.isArray(data?.accessLogs) ? data.accessLogs : [],
  };
}

export async function createShareLinkApi(params: {
  label: string;
  role: 'viewer' | 'editor';
  expiresInHours?: number | null;
  password?: string;
}): Promise<ShareLinkRecord> {
  const res = await authFetch('/api/shares/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إنشاء رابط المشاركة.');
  return data.link;
}

export async function revokeShareLinkApi(linkId: string): Promise<void> {
  const res = await authFetch(`/api/shares/links/${encodeURIComponent(linkId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('تعذر إلغاء رابط المشاركة.');
}

export async function inviteShareMemberApi(params: {
  email: string;
  role: ShareRole;
}): Promise<ShareInviteRecord> {
  const res = await authFetch('/api/shares/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر إرسال الدعوة.');
  return data.invite;
}

export async function updateShareMemberRoleApi(
  inviteId: string,
  role: ShareRole
): Promise<void> {
  const res = await authFetch(`/api/shares/invites/${encodeURIComponent(inviteId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error('تعذر تحديث صلاحية العضو.');
}

export async function revokeShareInviteApi(inviteId: string): Promise<void> {
  const res = await authFetch(`/api/shares/invites/${encodeURIComponent(inviteId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('تعذر إلغاء الدعوة فوراً.');
}

export async function accessSharedLinkApi(params: {
  token: string;
  password?: string;
}): Promise<{
  role: ShareRole;
  label: string;
  ownerName: string;
  snapshotSummary: {
    agenciesCount: number;
    personsCount: number;
    notesCount: number;
    updatedAt?: string;
  };
}> {
  const res = await fetch(`/api/shares/access/${encodeURIComponent(params.token)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'MorrowApp',
    },
    body: JSON.stringify({ password: params.password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر فتح رابط المشاركة.');
  return data;
}

// --- GDPR Export & Permanent Account Deletion ---
export async function exportGdprDataApi(): Promise<{
  exportedAt: string;
  jsonText: string;
}> {
  const res = await authFetch('/api/account/gdpr-export');
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تصدير حزمة GDPR.');
  return {
    exportedAt: data.exportedAt || new Date().toISOString(),
    jsonText: JSON.stringify(data, null, 2),
  };
}

export async function deleteAccountPermanentlyApi(reauthToken: string): Promise<void> {
  const res = await authFetch('/api/account/delete-permanently', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Reauth-Token': reauthToken,
    },
    body: JSON.stringify({ confirmDelete: 'DELETE' }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'تعذر حذف الحساب نهائياً.');
  }
}

// --- Email Change with Step-up Verification ---
export async function changeAccountEmailApi(params: {
  newEmail: string;
  reauthToken: string;
}): Promise<StoredSession> {
  const res = await authFetch('/api/auth/change-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Reauth-Token': params.reauthToken,
    },
    body: JSON.stringify({ newEmail: params.newEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'تعذر تحديث البريد الإلكتروني.');
  saveSession(data.token, data.user, true);
  return data;
}

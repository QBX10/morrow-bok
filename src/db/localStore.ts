import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AuthProviderType } from '../types/agency.ts';

export interface StoredUserRecord {
  id: number;
  uid: string;
  githubId?: string | null;
  authProvider: AuthProviderType;
  displayName: string;
  email: string | null;
  username: string | null;
  avatarUrl?: string | null;
  passwordHash: string | null;
  role: 'manager' | 'viewer';
  emailAlertsEnabled?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface StoredWorkspaceSnapshot {
  userId: number;
  snapshotJson: string;
  recordCount: number;
  agencyCount: number;
  clientUpdatedAt: string;
  deviceId: string;
  version: number;
  checksum: string;
  updatedAt: string;
}

export interface StoredAuditEvent {
  userId: number;
  eventId: string;
  actionType: string;
  title: string;
  summary: string;
  deviceId: string;
  payloadJson?: string;
  createdAt: string;
}

export interface StoredUserPreferences {
  userId: number;
  preferencesJson: string;
  updatedAt: string;
}

export interface SoundSettingsRecord {
  soundEnabled: boolean;
  volume: number;
  updatedAt: string;
}

export interface StoredUserAudioNotificationSettings {
  masterSoundEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  smartPauseEnabled: boolean;
  pauseOnExit: boolean;
  effectsVolume: number;
  soundPack: 'rumi_warm' | 'crystal_glass' | 'studio_crisp' | 'minimal_soft';
  notificationTone: 'chime_duet' | 'bell_crystal' | 'harp_pluck' | 'soft_pulse' | 'silent';
  successErrorEnabled: boolean;
  motionSoundsEnabled: boolean;
  notificationSoundEnabled: boolean;
  notificationsMasterEnabled: boolean;
  channels: {
    security: true;
    reminders: boolean;
    sync: boolean;
    whats_new: boolean;
  };
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  updatedAt: string;
  updatedByDeviceId?: string;
  updatedByDeviceLabel?: string;
}

export interface StoredSessionRecord {
  sid: string;
  uid: string;
  provider: AuthProviderType;
  deviceLabel: string;
  browserLabel?: string;
  fingerprintHash?: string;
  userAgent: string;
  ipMasked: string;
  loginMethod: 'password' | 'passkey' | 'google' | 'github' | 'qr' | 'recovery_code';
  createdAt: string;
  lastActiveAt: string;
  revokedAt?: string | null;
}

export interface StoredSecurityAlert {
  id: string;
  uid: string;
  kind:
    | 'new_device_login'
    | 'unrecognized_login_attempt'
    | 'session_revoked'
    | 'recovery_code_used'
    | 'recovery_codes_rotated'
    | 'passkey_added'
    | 'passkey_removed'
    | 'account_linked'
    | 'reauth_verified';
  title: string;
  summary: string;
  deviceLabel?: string;
  browserLabel?: string;
  ipMasked?: string;
  attemptOutcome?: 'succeeded' | 'failed';
  recipientEmail?: string;
  emailDeliveryStatus?: 'sent' | 'failed' | 'skipped_no_email' | 'not_configured' | 'throttled';
  emailDeliveryProvider?: 'smtp' | 'resend' | 'none';
  emailDeliveryError?: string;
  emailMessageId?: string;
  emailSubject?: string;
  emailSentSimulated?: boolean;
  createdAt: string;
  read?: boolean;
}

export interface StoredPasskeyRecord {
  id: string;
  uid: string;
  credentialId: string;
  publicKeySpki: string;
  counter: number;
  label: string;
  transports: string[];
  deviceType: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface StoredRecoveryCodeRecord {
  id: string;
  uid: string;
  codeHash: string;
  usedAt?: string | null;
  createdAt: string;
}

export interface StoredChunkRecord {
  hash: string;
  sizeBytes: number;
  base64Data: string;
  refUids: string[];
  createdAt: string;
}

export interface StoredChunkManifestRecord {
  manifestId: string;
  uid: string;
  alg: string;
  rawBytes: number;
  compressedBytes: number;
  chunkHashes: string[];
  label: string;
  createdAt: string;
}

export interface StoredWorkspaceVersion {
  versionId: string;
  uid: string;
  versionNumber: number;
  label: string;
  source: 'auto_sync' | 'manual_snapshot' | 'pre_conflict' | 'chunk_manifest';
  deviceId: string;
  checksum: string;
  sizeBytes: number;
  recordCount: number;
  agencyCount: number;
  snapshotJson: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoredShareLinkRecord {
  id: string;
  ownerUid: string;
  token: string;
  label: string;
  role: 'viewer' | 'editor';
  passwordHash?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  accessCount: number;
  lastAccessedAt?: string | null;
}

export interface StoredShareInviteRecord {
  id: string;
  ownerUid: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  acceptedAt?: string | null;
}

export interface StoredShareAccessLog {
  id: string;
  ownerUid: string;
  actorLabel: string;
  actorUid?: string;
  via: 'link' | 'invite' | 'owner';
  role: 'owner' | 'editor' | 'viewer';
  action: string;
  reason: string;
  ipMasked?: string;
  timestamp: string;
}

interface LocalDbFile {
  users: StoredUserRecord[];
  snapshots: StoredWorkspaceSnapshot[];
  auditLogs?: StoredAuditEvent[];
  preferences?: StoredUserPreferences[];
  soundSettings?: SoundSettingsRecord;
  sessions?: StoredSessionRecord[];
  securityAlerts?: StoredSecurityAlert[];
  passkeys?: StoredPasskeyRecord[];
  recoveryCodes?: StoredRecoveryCodeRecord[];
  chunks?: StoredChunkRecord[];
  manifests?: StoredChunkManifestRecord[];
  workspaceVersions?: StoredWorkspaceVersion[];
  shareLinks?: StoredShareLinkRecord[];
  shareInvites?: StoredShareInviteRecord[];
  shareAccessLogs?: StoredShareAccessLog[];
  revokedSessionIds?: string[];
  deletedUidCutoffs?: Record<string, number>;
  userAudioSettings?: Record<string, StoredUserAudioNotificationSettings>;
}

const PRIMARY_DB_PATH = path.resolve(process.cwd(), 'data', 'local-db.json');
const FALLBACK_DB_PATH = path.join(os.tmpdir(), 'flour-agency-local-db.json');
let activeDbPath = PRIMARY_DB_PATH;
export const DEFAULT_ACCOUNT_QUOTA_BYTES = 50 * 1024 * 1024; // 50 MB
const VERSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readDb(): LocalDbFile {
  try {
    if (!fs.existsSync(activeDbPath)) {
      return {
        users: [],
        snapshots: [],
        auditLogs: [],
        preferences: [],
        sessions: [],
        securityAlerts: [],
        passkeys: [],
        recoveryCodes: [],
        chunks: [],
        manifests: [],
        workspaceVersions: [],
        shareLinks: [],
        shareInvites: [],
        shareAccessLogs: [],
        revokedSessionIds: [],
        deletedUidCutoffs: {},
      };
    }
    const raw = fs.readFileSync(activeDbPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalDbFile>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      securityAlerts: Array.isArray(parsed.securityAlerts) ? parsed.securityAlerts : [],
      passkeys: Array.isArray(parsed.passkeys) ? parsed.passkeys : [],
      recoveryCodes: Array.isArray(parsed.recoveryCodes) ? parsed.recoveryCodes : [],
      chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
      manifests: Array.isArray(parsed.manifests) ? parsed.manifests : [],
      workspaceVersions: Array.isArray(parsed.workspaceVersions) ? parsed.workspaceVersions : [],
      shareLinks: Array.isArray(parsed.shareLinks) ? parsed.shareLinks : [],
      shareInvites: Array.isArray(parsed.shareInvites) ? parsed.shareInvites : [],
      shareAccessLogs: Array.isArray(parsed.shareAccessLogs) ? parsed.shareAccessLogs : [],
      revokedSessionIds: Array.isArray(parsed.revokedSessionIds) ? parsed.revokedSessionIds : [],
      deletedUidCutoffs:
        parsed.deletedUidCutoffs &&
        typeof parsed.deletedUidCutoffs === 'object' &&
        !Array.isArray(parsed.deletedUidCutoffs)
          ? (parsed.deletedUidCutoffs as Record<string, number>)
          : {},
      soundSettings:
        parsed.soundSettings && typeof parsed.soundSettings.soundEnabled === 'boolean'
          ? {
              soundEnabled: parsed.soundSettings.soundEnabled,
              volume:
                typeof parsed.soundSettings.volume === 'number'
                  ? Math.max(0, Math.min(1, parsed.soundSettings.volume))
                  : 0.2,
              updatedAt:
                parsed.soundSettings.updatedAt || new Date().toISOString(),
            }
          : undefined,
      userAudioSettings:
        parsed.userAudioSettings &&
        typeof parsed.userAudioSettings === 'object' &&
        !Array.isArray(parsed.userAudioSettings)
          ? (parsed.userAudioSettings as Record<string, StoredUserAudioNotificationSettings>)
          : {},
    };
  } catch {
    return {
      users: [],
      snapshots: [],
      auditLogs: [],
      preferences: [],
      sessions: [],
      securityAlerts: [],
      passkeys: [],
      recoveryCodes: [],
      chunks: [],
      manifests: [],
      workspaceVersions: [],
      shareLinks: [],
      shareInvites: [],
      shareAccessLogs: [],
      revokedSessionIds: [],
      deletedUidCutoffs: {},
      userAudioSettings: {},
    };
  }
}

function writeDb(data: LocalDbFile): void {
  try {
    const dir = path.dirname(activeDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(activeDbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    activeDbPath = FALLBACK_DB_PATH;
    const dir = path.dirname(activeDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(activeDbPath, JSON.stringify(data, null, 2), 'utf8');
  }
}

export function computeJsonChecksum(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export function findUserByEmail(email: string): StoredUserRecord | null {
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  return (
    readDb().users.find((u) => (u.email || '').toLowerCase() === norm) || null
  );
}

export function findUserByUsername(username: string): StoredUserRecord | null {
  const norm = username.trim().toLowerCase();
  if (!norm) return null;
  return (
    readDb().users.find((u) => (u.username || '').toLowerCase() === norm) ||
    null
  );
}

export function findUserByUid(uid: string): StoredUserRecord | null {
  return readDb().users.find((u) => u.uid === uid) || null;
}

export function findUserByGithubId(githubId: string): StoredUserRecord | null {
  const norm = githubId.trim();
  if (!norm) return null;
  return readDb().users.find((u) => u.githubId === norm) || null;
}

export function createUserRecord(params: {
  uid: string;
  githubId?: string | null;
  authProvider: AuthProviderType;
  displayName: string;
  email?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  passwordHash?: string | null;
}): StoredUserRecord {
  const db = readDb();
  const nextId = db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
  const nowIso = new Date().toISOString();
  const created: StoredUserRecord = {
    id: nextId,
    uid: params.uid,
    githubId: params.githubId ? params.githubId.trim() : null,
    authProvider: params.authProvider,
    displayName: params.displayName,
    email: params.email ? params.email.trim().toLowerCase() : null,
    username: params.username ? params.username.trim().toLowerCase() : null,
    avatarUrl: params.avatarUrl ?? null,
    passwordHash: params.passwordHash ?? null,
    role: 'manager',
    lastLoginAt: nowIso,
    createdAt: nowIso,
  };
  db.users.push(created);
  writeDb(db);
  return created;
}

/**
 * Unifies returning users across providers SAFELY: matches uid first, then
 * githubId, then verified email ONLY when emailVerified===true. Never auto-merges
 * across unverified emails or arbitrary usernames (prevents account takeover).
 */
export function resolveOrCreateLocalCanonicalUser(params: {
  uid: string;
  githubId?: string | null;
  authProvider: AuthProviderType;
  displayName: string;
  email?: string | null;
  emailVerified?: boolean;
  username?: string | null;
  avatarUrl?: string | null;
}): StoredUserRecord {
  const db = readDb();
  const normGithubId = params.githubId ? params.githubId.trim() : null;
  const normEmail = params.email ? params.email.trim().toLowerCase() : null;
  const normUsername = params.username ? params.username.trim().toLowerCase() : null;

  let idx = db.users.findIndex((u) => u.uid === params.uid);
  if (idx === -1 && normGithubId) {
    idx = db.users.findIndex((u) => u.githubId === normGithubId);
  }
  if (
    idx === -1 &&
    params.emailVerified === true &&
    normEmail &&
    !normEmail.endsWith('.local')
  ) {
    idx = db.users.findIndex((u) => (u.email || '').toLowerCase() === normEmail);
  }

  const nowIso = new Date().toISOString();
  if (idx !== -1) {
    const existing = db.users[idx];
    const usernameConflict = normUsername
      ? db.users.some(
          (u, i) => i !== idx && (u.username || '').toLowerCase() === normUsername
        )
      : false;
    db.users[idx] = {
      ...existing,
      githubId: existing.githubId || normGithubId,
      displayName: existing.displayName || params.displayName,
      email: existing.email || normEmail,
      username: existing.username || (!usernameConflict ? normUsername : null),
      avatarUrl: params.avatarUrl ?? existing.avatarUrl ?? null,
      lastLoginAt: nowIso,
    };
    writeDb(db);
    return db.users[idx];
  }

  // Ensure a third-party provider's default handle doesn't fail or collide on username uniqueness
  const safeUsername =
    normUsername &&
    !db.users.some((u) => (u.username || '').toLowerCase() === normUsername)
      ? normUsername
      : null;

  return createUserRecord({
    uid: params.uid,
    githubId: normGithubId,
    authProvider: params.authProvider,
    displayName: params.displayName,
    email: normEmail,
    username: safeUsername,
    avatarUrl: params.avatarUrl,
  });
}

export function upsertLocalProfile(params: {
  uid: string;
  authProvider: AuthProviderType;
  displayName: string;
  email?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}): StoredUserRecord {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.uid === params.uid);
  if (idx !== -1) {
    db.users[idx] = {
      ...db.users[idx],
      displayName: params.displayName || db.users[idx].displayName,
      email: params.email ?? db.users[idx].email,
      username: params.username ?? db.users[idx].username,
      ...(params.avatarUrl !== undefined ? { avatarUrl: params.avatarUrl } : {}),
    };
    writeDb(db);
    return db.users[idx];
  }
  return createUserRecord(params);
}

export function linkLocalUsername(params: {
  uid: string;
  username: string;
  passwordHash?: string | null;
}): { ok: true; user: StoredUserRecord } | { ok: false; error: string; status: number } {
  const norm = params.username.trim().toLowerCase();
  const db = readDb();
  const conflict = db.users.find(
    (u) => (u.username || '').toLowerCase() === norm && u.uid !== params.uid
  );
  if (conflict) {
    return { ok: false, error: 'اسم المستخدم محجوز لحساب آخر بالفعل.', status: 409 };
  }
  const idx = db.users.findIndex((u) => u.uid === params.uid);
  if (idx === -1) {
    return { ok: false, error: 'لم يتم العثور على الحساب المطلوب.', status: 404 };
  }
  db.users[idx] = {
    ...db.users[idx],
    username: norm,
    ...(params.passwordHash ? { passwordHash: params.passwordHash } : {}),
  };
  writeDb(db);
  return { ok: true, user: db.users[idx] };
}

export function updateLocalUserEmail(params: {
  uid: string;
  newEmail: string;
}): { ok: true; user: StoredUserRecord } | { ok: false; error: string; status: number } {
  const norm = params.newEmail.trim().toLowerCase();
  const db = readDb();
  const conflict = db.users.find(
    (u) => (u.email || '').toLowerCase() === norm && u.uid !== params.uid
  );
  if (conflict) {
    return { ok: false, error: 'البريد الإلكتروني مسجل لحساب آخر بالفعل.', status: 409 };
  }
  const idx = db.users.findIndex((u) => u.uid === params.uid);
  if (idx === -1) {
    return { ok: false, error: 'لم يتم العثور على الحساب.', status: 404 };
  }
  db.users[idx] = {
    ...db.users[idx],
    email: norm,
  };
  writeDb(db);
  return { ok: true, user: db.users[idx] };
}

export function getWorkspaceSnapshot(
  userId: number
): StoredWorkspaceSnapshot | null {
  return (
    readDb().snapshots.find((s) => s.userId === userId) || null
  );
}

export function saveWorkspaceSnapshot(params: {
  userId: number;
  snapshotJson: string;
  recordCount: number;
  agencyCount: number;
  clientUpdatedAt?: string;
  deviceId?: string;
}): StoredWorkspaceSnapshot {
  const db = readDb();
  const idx = db.snapshots.findIndex((s) => s.userId === params.userId);
  const prevVersion = idx === -1 ? 0 : (db.snapshots[idx].version || 1);
  const nowIso = new Date().toISOString();
  const entry: StoredWorkspaceSnapshot = {
    userId: params.userId,
    snapshotJson: params.snapshotJson,
    recordCount: params.recordCount,
    agencyCount: params.agencyCount,
    clientUpdatedAt: params.clientUpdatedAt || nowIso,
    deviceId: params.deviceId || 'local',
    version: prevVersion + 1,
    checksum: computeJsonChecksum(params.snapshotJson),
    updatedAt: nowIso,
  };
  if (idx === -1) db.snapshots.push(entry);
  else db.snapshots[idx] = entry;
  writeDb(db);
  return entry;
}

export function syncLocalWorkspaceWithLww(params: {
  userId: number;
  snapshotJson: string;
  recordCount: number;
  agencyCount: number;
  clientUpdatedAt?: string;
  deviceId?: string;
  force?: boolean;
}): {
  conflictResolved: boolean;
  winner: 'client' | 'server';
  snapshot: StoredWorkspaceSnapshot;
} {
  const existing = getWorkspaceSnapshot(params.userId);
  if (existing && !params.force && params.clientUpdatedAt) {
    const incomingMs = Date.parse(params.clientUpdatedAt);
    const serverMs = Date.parse(existing.clientUpdatedAt || existing.updatedAt);
    if (
      Number.isFinite(incomingMs) &&
      Number.isFinite(serverMs) &&
      serverMs > incomingMs + 250 &&
      existing.checksum !== computeJsonChecksum(params.snapshotJson)
    ) {
      return {
        conflictResolved: true,
        winner: 'server',
        snapshot: existing,
      };
    }
  }
  const saved = saveWorkspaceSnapshot({
    userId: params.userId,
    snapshotJson: params.snapshotJson,
    recordCount: params.recordCount,
    agencyCount: params.agencyCount,
    clientUpdatedAt: params.clientUpdatedAt,
    deviceId: params.deviceId,
  });
  return {
    conflictResolved: false,
    winner: 'client',
    snapshot: saved,
  };
}

export function appendLocalAuditEvents(
  userId: number,
  events: Array<{
    eventId: string;
    actionType: string;
    title: string;
    summary?: string;
    deviceId?: string;
    payloadJson?: string;
    createdAt?: string;
  }>
): void {
  if (events.length === 0) return;
  const db = readDb();
  const list = db.auditLogs || [];
  const seenIds = new Set(list.map((e) => e.eventId));
  const additions: StoredAuditEvent[] = [];
  for (const ev of events) {
    if (!ev.eventId || seenIds.has(ev.eventId)) continue;
    seenIds.add(ev.eventId);
    additions.push({
      userId,
      eventId: ev.eventId,
      actionType: ev.actionType,
      title: ev.title,
      summary: ev.summary || '',
      deviceId: ev.deviceId || 'unknown',
      payloadJson: ev.payloadJson,
      createdAt: ev.createdAt || new Date().toISOString(),
    });
  }
  if (additions.length === 0) return;
  db.auditLogs = [...additions, ...list].slice(0, 300);
  writeDb(db);
}

export function listLocalAuditEvents(userId: number, limit = 60): StoredAuditEvent[] {
  const list = readDb().auditLogs || [];
  return list
    .filter((e) => e.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

export function saveLocalUserPreferences(
  userId: number,
  preferencesJson: string
): StoredUserPreferences {
  const db = readDb();
  const prefs = db.preferences || [];
  const entry: StoredUserPreferences = {
    userId,
    preferencesJson,
    updatedAt: new Date().toISOString(),
  };
  const idx = prefs.findIndex((p) => p.userId === userId);
  if (idx === -1) prefs.push(entry);
  else prefs[idx] = entry;
  db.preferences = prefs;
  writeDb(db);
  return entry;
}

export function getLocalUserPreferences(userId: number): StoredUserPreferences | null {
  return (readDb().preferences || []).find((p) => p.userId === userId) || null;
}

export function updateUserPasswordHash(
  uid: string,
  passwordHash: string
): StoredUserRecord | null {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.uid === uid);
  if (idx === -1) return null;
  db.users[idx] = {
    ...db.users[idx],
    passwordHash,
  };
  writeDb(db);
  return db.users[idx];
}

export function getSoundSettings(): SoundSettingsRecord {
  const existing = readDb().soundSettings;
  if (existing) return existing;
  return {
    soundEnabled: true,
    volume: 0.2,
    updatedAt: new Date().toISOString(),
  };
}

export function saveSoundSettings(patch: {
  soundEnabled: boolean;
  volume?: number;
}): SoundSettingsRecord {
  const db = readDb();
  const prev = db.soundSettings || getSoundSettings();
  const next: SoundSettingsRecord = {
    soundEnabled: Boolean(patch.soundEnabled),
    volume:
      typeof patch.volume === 'number' && Number.isFinite(patch.volume)
        ? Math.max(0, Math.min(1, patch.volume))
        : prev.volume,
    updatedAt: new Date().toISOString(),
  };
  db.soundSettings = next;
  writeDb(db);
  return next;
}

export function getLocalUserAudioSettings(
  uid: string
): StoredUserAudioNotificationSettings | null {
  if (!uid) return null;
  const map = readDb().userAudioSettings;
  if (!map || typeof map !== 'object') return null;
  return map[uid] || null;
}

export function saveLocalUserAudioSettings(
  uid: string,
  settings: StoredUserAudioNotificationSettings
): StoredUserAudioNotificationSettings {
  const db = readDb();
  const map = { ...(db.userAudioSettings || {}) };
  map[uid] = settings;
  db.userAudioSettings = map;
  writeDb(db);
  return settings;
}

// --- Sessions, Remote Logout & New Device Alerts ---

export function isKnownDeviceForUid(
  uid: string,
  deviceLabel: string,
  userAgent: string,
  fingerprintHash?: string
): { hasPriorSessions: boolean; isKnownDevice: boolean } {
  const list = readDb().sessions || [];
  const prevUserSessions = list.filter((s) => s.uid === uid);
  if (prevUserSessions.length === 0) {
    return { hasPriorSessions: false, isKnownDevice: true };
  }
  const seenDeviceBefore = prevUserSessions.some((s) => {
    if (fingerprintHash && s.fingerprintHash) {
      return s.fingerprintHash === fingerprintHash;
    }
    return s.deviceLabel === deviceLabel && s.userAgent === userAgent;
  });
  return { hasPriorSessions: true, isKnownDevice: seenDeviceBefore };
}

export function registerLocalSession(params: {
  sid: string;
  uid: string;
  provider: AuthProviderType;
  deviceLabel: string;
  browserLabel?: string;
  fingerprintHash?: string;
  userAgent: string;
  ipMasked: string;
  loginMethod: StoredSessionRecord['loginMethod'];
}): { session: StoredSessionRecord; isNewDevice: boolean } {
  const db = readDb();
  const list = db.sessions || [];
  const prevUserSessions = list.filter((s) => s.uid === params.uid);
  const seenDeviceBefore = prevUserSessions.some((s) => {
    if (params.fingerprintHash && s.fingerprintHash) {
      return s.fingerprintHash === params.fingerprintHash;
    }
    return s.deviceLabel === params.deviceLabel && s.userAgent === params.userAgent;
  });
  const isNewDevice = prevUserSessions.length > 0 && !seenDeviceBefore;
  const nowIso = new Date().toISOString();
  const record: StoredSessionRecord = {
    sid: params.sid,
    uid: params.uid,
    provider: params.provider,
    deviceLabel: params.deviceLabel,
    browserLabel: params.browserLabel,
    fingerprintHash: params.fingerprintHash,
    userAgent: params.userAgent,
    ipMasked: params.ipMasked,
    loginMethod: params.loginMethod,
    createdAt: nowIso,
    lastActiveAt: nowIso,
    revokedAt: null,
  };
  const withoutSameSid = list.filter((s) => s.sid !== params.sid);
  db.sessions = [record, ...withoutSameSid].slice(0, 400);
  writeDb(db);
  return { session: record, isNewDevice };
}

function hashUidForTombstone(uid: string): string {
  return crypto.createHash('sha256').update(uid).digest('hex');
}

export function isLocalSessionRevoked(sid?: string): boolean {
  if (!sid) return false;
  const db = readDb();
  if ((db.revokedSessionIds || []).includes(sid)) {
    return true;
  }
  const list = db.sessions || [];
  const found = list.find((s) => s.sid === sid);
  return Boolean(found && found.revokedAt);
}

export function isLocalUserDeletedAt(uid?: string, issuedAtMs?: number): boolean {
  if (!uid) return false;
  const db = readDb();
  const cutoffs = db.deletedUidCutoffs || {};
  const deletedAt = cutoffs[hashUidForTombstone(uid)];
  if (typeof deletedAt !== 'number') return false;
  if (typeof issuedAtMs !== 'number' || !Number.isFinite(issuedAtMs)) {
    return !db.users.some((u) => u.uid === uid);
  }
  return issuedAtMs <= deletedAt;
}

export function touchLocalSession(sid?: string): void {
  if (!sid) return;
  const db = readDb();
  const list = db.sessions || [];
  const idx = list.findIndex((s) => s.sid === sid);
  if (idx === -1 || list[idx].revokedAt) return;
  const lastMs = Date.parse(list[idx].lastActiveAt);
  if (Number.isFinite(lastMs) && Date.now() - lastMs < 60_000) return;
  list[idx] = { ...list[idx], lastActiveAt: new Date().toISOString() };
  db.sessions = list;
  writeDb(db);
}

export function listLocalSessionsForUid(uid: string): StoredSessionRecord[] {
  return (readDb().sessions || [])
    .filter((s) => s.uid === uid && !s.revokedAt)
    .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt));
}

export function revokeLocalSession(uid: string, sid: string): boolean {
  const db = readDb();
  const list = db.sessions || [];
  const idx = list.findIndex((s) => s.uid === uid && s.sid === sid);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], revokedAt: new Date().toISOString() };
  db.sessions = list;
  writeDb(db);
  return true;
}

export function revokeOtherLocalSessions(uid: string, currentSid?: string): string[] {
  const db = readDb();
  const list = db.sessions || [];
  const nowIso = new Date().toISOString();
  const revokedIds: string[] = [];
  db.sessions = list.map((s) => {
    if (s.uid === uid && !s.revokedAt && s.sid !== currentSid) {
      revokedIds.push(s.sid);
      return { ...s, revokedAt: nowIso };
    }
    return s;
  });
  writeDb(db);
  return revokedIds;
}

export function appendLocalSecurityAlert(
  alert: Omit<StoredSecurityAlert, 'id' | 'createdAt'>
): StoredSecurityAlert {
  const db = readDb();
  const record: StoredSecurityAlert = {
    ...alert,
    id: `alt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString(),
  };
  db.securityAlerts = [record, ...(db.securityAlerts || [])].slice(0, 300);
  writeDb(db);
  return record;
}

export function updateLocalSecurityAlertEmailDelivery(
  uid: string,
  alertId: string,
  patch: Partial<
    Pick<
      StoredSecurityAlert,
      | 'recipientEmail'
      | 'emailDeliveryStatus'
      | 'emailDeliveryProvider'
      | 'emailDeliveryError'
      | 'emailMessageId'
      | 'emailSubject'
      | 'emailSentSimulated'
    >
  >
): StoredSecurityAlert | null {
  const db = readDb();
  const alerts = db.securityAlerts || [];
  const idx = alerts.findIndex((a) => a.uid === uid && a.id === alertId);
  if (idx === -1) return null;
  alerts[idx] = { ...alerts[idx], ...patch };
  db.securityAlerts = alerts;
  writeDb(db);
  return alerts[idx];
}

export function isLocalUserEmailAlertsEnabled(uid: string): boolean {
  const user = readDb().users.find((u) => u.uid === uid);
  return user?.emailAlertsEnabled !== false;
}

export function setLocalUserEmailAlertsEnabled(uid: string, enabled: boolean): boolean {
  const db = readDb();
  const idx = db.users.findIndex((u) => u.uid === uid);
  if (idx === -1) return false;
  db.users[idx] = { ...db.users[idx], emailAlertsEnabled: Boolean(enabled) };
  writeDb(db);
  return true;
}

export function listLocalSecurityAlerts(uid: string, limit = 30): StoredSecurityAlert[] {
  return (readDb().securityAlerts || [])
    .filter((a) => a.uid === uid)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

// --- Passkeys (WebAuthn) ---

export function saveLocalPasskey(
  rec: Omit<StoredPasskeyRecord, 'id' | 'createdAt'>
): StoredPasskeyRecord {
  const db = readDb();
  const created: StoredPasskeyRecord = {
    ...rec,
    id: `pk_${crypto.randomBytes(6).toString('hex')}`,
    createdAt: new Date().toISOString(),
  };
  const filtered = (db.passkeys || []).filter(
    (p) => p.credentialId !== rec.credentialId
  );
  db.passkeys = [created, ...filtered].slice(0, 200);
  writeDb(db);
  return created;
}

export function listLocalPasskeys(uid: string): StoredPasskeyRecord[] {
  return (readDb().passkeys || []).filter((p) => p.uid === uid);
}

export function findLocalPasskeyByCredId(
  credentialId: string
): StoredPasskeyRecord | null {
  return (
    (readDb().passkeys || []).find((p) => p.credentialId === credentialId) || null
  );
}

export function touchLocalPasskeyUsage(credentialId: string, counter: number): void {
  const db = readDb();
  const list = db.passkeys || [];
  const idx = list.findIndex((p) => p.credentialId === credentialId);
  if (idx === -1) return;
  list[idx] = {
    ...list[idx],
    counter: Math.max(list[idx].counter || 0, counter),
    lastUsedAt: new Date().toISOString(),
  };
  db.passkeys = list;
  writeDb(db);
}

export function deleteLocalPasskey(uid: string, id: string): boolean {
  const db = readDb();
  const before = (db.passkeys || []).length;
  db.passkeys = (db.passkeys || []).filter((p) => !(p.uid === uid && p.id === id));
  if (db.passkeys.length === before) return false;
  writeDb(db);
  return true;
}

// --- Single-Use Recovery Codes ---

export function hashRecoveryCode(rawCode: string): string {
  const normalized = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(`rc::${normalized}`).digest('hex');
}

export function replaceLocalRecoveryCodes(uid: string, rawCodes: string[]): {
  totalCount: number;
  remainingCount: number;
  generatedAt: string;
} {
  const db = readDb();
  const nowIso = new Date().toISOString();
  const remaining = (db.recoveryCodes || []).filter((c) => c.uid !== uid);
  const newRows: StoredRecoveryCodeRecord[] = rawCodes.map((code, idx) => ({
    id: `rc_${Date.now().toString(36)}_${idx}`,
    uid,
    codeHash: hashRecoveryCode(code),
    usedAt: null,
    createdAt: nowIso,
  }));
  db.recoveryCodes = [...newRows, ...remaining];
  writeDb(db);
  return {
    totalCount: newRows.length,
    remainingCount: newRows.length,
    generatedAt: nowIso,
  };
}

export function getLocalRecoveryCodesStatus(uid: string): {
  totalCount: number;
  remainingCount: number;
  generatedAt?: string;
} {
  const rows = (readDb().recoveryCodes || []).filter((c) => c.uid === uid);
  return {
    totalCount: rows.length,
    remainingCount: rows.filter((c) => !c.usedAt).length,
    generatedAt: rows[0]?.createdAt,
  };
}

export function consumeLocalRecoveryCode(uid: string, rawCode: string): boolean {
  const targetHash = hashRecoveryCode(rawCode);
  const db = readDb();
  const list = db.recoveryCodes || [];
  const idx = list.findIndex(
    (c) => c.uid === uid && !c.usedAt && c.codeHash === targetHash
  );
  if (idx === -1) return false;
  list[idx] = { ...list[idx], usedAt: new Date().toISOString() };
  db.recoveryCodes = list;
  writeDb(db);
  return true;
}

// --- Content-Addressed Chunks, Manifests, Storage Quota & 30-Day Versions ---

export function findMissingLocalChunkHashes(hashes: string[]): string[] {
  const existing = new Set((readDb().chunks || []).map((c) => c.hash));
  return hashes.filter((h) => !existing.has(h));
}

export function upsertLocalChunk(params: {
  uid: string;
  hash: string;
  sizeBytes: number;
  base64Data: string;
}): StoredChunkRecord {
  const db = readDb();
  const list = db.chunks || [];
  const idx = list.findIndex((c) => c.hash === params.hash);
  if (idx !== -1) {
    const refs = new Set(list[idx].refUids || []);
    refs.add(params.uid);
    list[idx] = { ...list[idx], refUids: Array.from(refs) };
    db.chunks = list;
    writeDb(db);
    return list[idx];
  }
  const created: StoredChunkRecord = {
    hash: params.hash,
    sizeBytes: params.sizeBytes,
    base64Data: params.base64Data,
    refUids: [params.uid],
    createdAt: new Date().toISOString(),
  };
  db.chunks = [created, ...list].slice(0, 4000);
  writeDb(db);
  return created;
}

export function saveLocalChunkManifest(
  manifest: Omit<StoredChunkManifestRecord, 'createdAt'>
): StoredChunkManifestRecord {
  const db = readDb();
  const created: StoredChunkManifestRecord = {
    ...manifest,
    createdAt: new Date().toISOString(),
  };
  const filtered = (db.manifests || []).filter(
    (m) => !(m.uid === manifest.uid && m.manifestId === manifest.manifestId)
  );
  db.manifests = [created, ...filtered].slice(0, 400);
  writeDb(db);
  return created;
}

export function getLocalUserStorageQuota(uid: string) {
  const db = readDb();
  const nowMs = Date.now();
  const userChunks = (db.chunks || []).filter((c) => (c.refUids || []).includes(uid));
  const userManifests = (db.manifests || []).filter((m) => m.uid === uid);
  const versions = (db.workspaceVersions || []).filter(
    (v) => v.uid === uid && Date.parse(v.expiresAt) > nowMs
  );
  const userRec = db.users.find((u) => u.uid === uid);
  const snapshotBytes = userRec
    ? Buffer.byteLength(
        db.snapshots.find((s) => s.userId === userRec.id)?.snapshotJson || '',
        'utf8'
      )
    : 0;
  const chunkBytes = userChunks.reduce((s, c) => s + (c.sizeBytes || 0), 0);
  const logicalManifestBytes = userManifests.reduce(
    (s, m) => s + (m.rawBytes || 0),
    0
  );
  const usedBytes = Math.max(chunkBytes, snapshotBytes);
  const dedupSavedBytes = Math.max(0, logicalManifestBytes - chunkBytes);
  const usagePercent = Math.min(
    100,
    Math.round((usedBytes / DEFAULT_ACCOUNT_QUOTA_BYTES) * 1000) / 10
  );
  return {
    usedBytes,
    quotaBytes: DEFAULT_ACCOUNT_QUOTA_BYTES,
    chunkCount: userManifests.reduce((s, m) => s + m.chunkHashes.length, 0),
    uniqueChunkCount: userChunks.length,
    dedupSavedBytes,
    usagePercent,
    versionsCount: versions.length,
    updatedAt: new Date().toISOString(),
  };
}

export function saveLocalWorkspaceVersion(params: {
  uid: string;
  label: string;
  source: StoredWorkspaceVersion['source'];
  deviceId: string;
  snapshotJson: string;
  recordCount: number;
  agencyCount: number;
}): StoredWorkspaceVersion {
  const db = readDb();
  const nowMs = Date.now();
  const activeVersions = (db.workspaceVersions || []).filter(
    (v) => Date.parse(v.expiresAt) > nowMs
  );
  const userVersions = activeVersions.filter((v) => v.uid === params.uid);
  const checksum = computeJsonChecksum(params.snapshotJson);
  if (userVersions[0] && userVersions[0].checksum === checksum && params.source === 'auto_sync') {
    return userVersions[0];
  }
  const nextNumber =
    userVersions.reduce((m, v) => Math.max(m, v.versionNumber), 0) + 1;
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + VERSION_RETENTION_MS).toISOString();
  const entry: StoredWorkspaceVersion = {
    versionId: `ver_${nowMs.toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
    uid: params.uid,
    versionNumber: nextNumber,
    label: params.label,
    source: params.source,
    deviceId: params.deviceId,
    checksum,
    sizeBytes: Buffer.byteLength(params.snapshotJson, 'utf8'),
    recordCount: params.recordCount,
    agencyCount: params.agencyCount,
    snapshotJson: params.snapshotJson,
    createdAt,
    expiresAt,
  };
  const otherUsers = activeVersions.filter((v) => v.uid !== params.uid);
  const nextUserVersions = [entry, ...userVersions].slice(0, 40);
  db.workspaceVersions = [...nextUserVersions, ...otherUsers];
  writeDb(db);
  return entry;
}

export function listLocalWorkspaceVersions(uid: string): StoredWorkspaceVersion[] {
  const nowMs = Date.now();
  return (readDb().workspaceVersions || [])
    .filter((v) => v.uid === uid && Date.parse(v.expiresAt) > nowMs)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function getLocalWorkspaceVersionById(
  uid: string,
  versionId: string
): StoredWorkspaceVersion | null {
  const nowMs = Date.now();
  return (
    (readDb().workspaceVersions || []).find(
      (v) => v.uid === uid && v.versionId === versionId && Date.parse(v.expiresAt) > nowMs
    ) || null
  );
}

// --- Data Sharing (Links, Invites, RBAC & Audit Logs) ---

export function createLocalShareLink(params: {
  ownerUid: string;
  label: string;
  role: 'viewer' | 'editor';
  passwordHash?: string | null;
  expiresAt?: string | null;
}): StoredShareLinkRecord {
  const db = readDb();
  const created: StoredShareLinkRecord = {
    id: `sl_${crypto.randomBytes(6).toString('hex')}`,
    ownerUid: params.ownerUid,
    token: `shr_${crypto.randomBytes(16).toString('hex')}`,
    label: params.label,
    role: params.role,
    passwordHash: params.passwordHash ?? null,
    expiresAt: params.expiresAt ?? null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
    accessCount: 0,
    lastAccessedAt: null,
  };
  db.shareLinks = [created, ...(db.shareLinks || [])].slice(0, 200);
  writeDb(db);
  return created;
}

export function listLocalShareLinks(ownerUid: string): StoredShareLinkRecord[] {
  return (readDb().shareLinks || []).filter((l) => l.ownerUid === ownerUid);
}

export function findLocalShareLinkByToken(token: string): StoredShareLinkRecord | null {
  return (readDb().shareLinks || []).find((l) => l.token === token) || null;
}

export function recordLocalShareLinkAccess(linkId: string): void {
  const db = readDb();
  const list = db.shareLinks || [];
  const idx = list.findIndex((l) => l.id === linkId);
  if (idx === -1) return;
  list[idx] = {
    ...list[idx],
    accessCount: (list[idx].accessCount || 0) + 1,
    lastAccessedAt: new Date().toISOString(),
  };
  db.shareLinks = list;
  writeDb(db);
}

export function revokeLocalShareLink(ownerUid: string, linkId: string): boolean {
  const db = readDb();
  const list = db.shareLinks || [];
  const idx = list.findIndex((l) => l.ownerUid === ownerUid && l.id === linkId);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], revokedAt: new Date().toISOString() };
  db.shareLinks = list;
  writeDb(db);
  return true;
}

export function upsertLocalShareInvite(params: {
  ownerUid: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
}): StoredShareInviteRecord {
  const db = readDb();
  const normEmail = params.email.trim().toLowerCase();
  const list = db.shareInvites || [];
  const idx = list.findIndex(
    (inv) => inv.ownerUid === params.ownerUid && inv.email === normEmail
  );
  if (idx !== -1) {
    list[idx] = {
      ...list[idx],
      role: params.role,
      status: list[idx].status === 'revoked' ? 'pending' : list[idx].status,
    };
    db.shareInvites = list;
    writeDb(db);
    return list[idx];
  }
  const created: StoredShareInviteRecord = {
    id: `inv_${crypto.randomBytes(6).toString('hex')}`,
    ownerUid: params.ownerUid,
    email: normEmail,
    role: params.role,
    status: 'pending',
    createdAt: new Date().toISOString(),
    acceptedAt: null,
  };
  db.shareInvites = [created, ...list].slice(0, 200);
  writeDb(db);
  return created;
}

export function listLocalShareInvites(ownerUid: string): StoredShareInviteRecord[] {
  return (readDb().shareInvites || []).filter((i) => i.ownerUid === ownerUid);
}

export function updateLocalShareInviteRole(
  ownerUid: string,
  inviteId: string,
  role: 'owner' | 'editor' | 'viewer'
): boolean {
  const db = readDb();
  const list = db.shareInvites || [];
  const idx = list.findIndex((i) => i.ownerUid === ownerUid && i.id === inviteId);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], role };
  db.shareInvites = list;
  writeDb(db);
  return true;
}

export function revokeLocalShareInvite(ownerUid: string, inviteId: string): boolean {
  const db = readDb();
  const list = db.shareInvites || [];
  const idx = list.findIndex((i) => i.ownerUid === ownerUid && i.id === inviteId);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], status: 'revoked' };
  db.shareInvites = list;
  writeDb(db);
  return true;
}

export function appendLocalShareAccessLog(
  entry: Omit<StoredShareAccessLog, 'id' | 'timestamp'>
): StoredShareAccessLog {
  const db = readDb();
  const record: StoredShareAccessLog = {
    ...entry,
    id: `sal_${crypto.randomBytes(5).toString('hex')}`,
    timestamp: new Date().toISOString(),
  };
  db.shareAccessLogs = [record, ...(db.shareAccessLogs || [])].slice(0, 400);
  writeDb(db);
  return record;
}

export function listLocalShareAccessLogs(ownerUid: string, limit = 50): StoredShareAccessLog[] {
  return (readDb().shareAccessLogs || [])
    .filter((l) => l.ownerUid === ownerUid)
    .slice(0, limit);
}

// --- GDPR Export & Permanent Deletion ---

export function exportAllLocalUserData(uid: string) {
  const db = readDb();
  const user = db.users.find((u) => u.uid === uid) || null;
  const userId = user?.id;
  const snapshot = userId ? db.snapshots.find((s) => s.userId === userId) || null : null;
  let workspaceData: unknown = null;
  if (snapshot?.snapshotJson) {
    try {
      workspaceData = JSON.parse(snapshot.snapshotJson);
    } catch {
      workspaceData = null;
    }
  }
  return {
    exportedAt: new Date().toISOString(),
    gdprFormatVersion: 1,
    account: user
      ? {
          uid: user.uid,
          provider: user.authProvider,
          displayName: user.displayName,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        }
      : null,
    workspace: workspaceData,
    versions: listLocalWorkspaceVersions(uid).map((v) => ({
      versionId: v.versionId,
      versionNumber: v.versionNumber,
      label: v.label,
      source: v.source,
      sizeBytes: v.sizeBytes,
      createdAt: v.createdAt,
      expiresAt: v.expiresAt,
    })),
    sessions: (db.sessions || []).filter((s) => s.uid === uid),
    securityAlerts: listLocalSecurityAlerts(uid, 100),
    passkeys: listLocalPasskeys(uid).map((p) => ({
      id: p.id,
      label: p.label,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
    })),
    sharing: {
      links: listLocalShareLinks(uid).map(({ passwordHash: _ph, ...rest }) => rest),
      invites: listLocalShareInvites(uid),
      accessLogs: listLocalShareAccessLogs(uid, 100),
    },
    auditLogs: userId ? listLocalAuditEvents(userId, 200) : [],
  };
}

export function permanentlyDeleteLocalUser(uid: string): boolean {
  const db = readDb();
  const user = db.users.find((u) => u.uid === uid);
  if (!user) return false;
  const userSids = (db.sessions || [])
    .filter((s) => s.uid === uid && s.sid)
    .map((s) => s.sid);
  db.revokedSessionIds = Array.from(
    new Set([...userSids, ...(db.revokedSessionIds || [])])
  ).slice(0, 2000);
  const cutoffs = { ...(db.deletedUidCutoffs || {}) };
  cutoffs[hashUidForTombstone(uid)] = Date.now();
  const entries = Object.entries(cutoffs);
  if (entries.length > 2000) {
    entries.sort((a, b) => b[1] - a[1]);
    db.deletedUidCutoffs = Object.fromEntries(entries.slice(0, 2000));
  } else {
    db.deletedUidCutoffs = cutoffs;
  }
  db.users = db.users.filter((u) => u.uid !== uid);
  db.snapshots = db.snapshots.filter((s) => s.userId !== user.id);
  db.auditLogs = (db.auditLogs || []).filter((e) => e.userId !== user.id);
  db.preferences = (db.preferences || []).filter((p) => p.userId !== user.id);
  db.sessions = (db.sessions || []).filter((s) => s.uid !== uid);
  db.securityAlerts = (db.securityAlerts || []).filter((a) => a.uid !== uid);
  db.passkeys = (db.passkeys || []).filter((p) => p.uid !== uid);
  db.recoveryCodes = (db.recoveryCodes || []).filter((c) => c.uid !== uid);
  db.workspaceVersions = (db.workspaceVersions || []).filter((v) => v.uid !== uid);
  db.manifests = (db.manifests || []).filter((m) => m.uid !== uid);
  db.chunks = (db.chunks || [])
    .map((c) => ({
      ...c,
      refUids: (c.refUids || []).filter((id) => id !== uid),
    }))
    .filter((c) => c.refUids.length > 0);
  db.shareLinks = (db.shareLinks || []).filter((l) => l.ownerUid !== uid);
  db.shareInvites = (db.shareInvites || []).filter((i) => i.ownerUid !== uid);
  db.shareAccessLogs = (db.shareAccessLogs || []).filter((l) => l.ownerUid !== uid);
  if (db.userAudioSettings && uid in db.userAudioSettings) {
    const nextAudio = { ...db.userAudioSettings };
    delete nextAudio[uid];
    db.userAudioSettings = nextAudio;
  }
  writeDb(db);
  return true;
}

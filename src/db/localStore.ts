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

interface LocalDbFile {
  users: StoredUserRecord[];
  snapshots: StoredWorkspaceSnapshot[];
  auditLogs?: StoredAuditEvent[];
  preferences?: StoredUserPreferences[];
  soundSettings?: SoundSettingsRecord;
}

const PRIMARY_DB_PATH = path.resolve(process.cwd(), 'data', 'local-db.json');
const FALLBACK_DB_PATH = path.join(os.tmpdir(), 'flour-agency-local-db.json');
let activeDbPath = PRIMARY_DB_PATH;

function readDb(): LocalDbFile {
  try {
    if (!fs.existsSync(activeDbPath)) {
      return { users: [], snapshots: [], auditLogs: [], preferences: [] };
    }
    const raw = fs.readFileSync(activeDbPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalDbFile>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
      soundSettings:
        parsed.soundSettings && typeof parsed.soundSettings.soundEnabled === 'boolean'
          ? {
              soundEnabled: parsed.soundSettings.soundEnabled,
              volume:
                typeof parsed.soundSettings.volume === 'number'
                  ? Math.max(0, Math.min(1, parsed.soundSettings.volume))
                  : 0.27,
              updatedAt:
                parsed.soundSettings.updatedAt || new Date().toISOString(),
            }
          : undefined,
    };
  } catch {
    return { users: [], snapshots: [], auditLogs: [], preferences: [] };
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
 * Unifies returning users across providers/devices: matches uid first, then
 * githubId, verified email, or username so cross-provider
 * logins resolve cleanly to the existing canonical workspace account.
 */
export function resolveOrCreateLocalCanonicalUser(params: {
  uid: string;
  githubId?: string | null;
  authProvider: AuthProviderType;
  displayName: string;
  email?: string | null;
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
  if (idx === -1 && normEmail && !normEmail.endsWith('.local')) {
    idx = db.users.findIndex((u) => (u.email || '').toLowerCase() === normEmail);
  }
  if (idx === -1 && normUsername) {
    idx = db.users.findIndex((u) => (u.username || '').toLowerCase() === normUsername);
  }

  const nowIso = new Date().toISOString();
  if (idx !== -1) {
    const existing = db.users[idx];
    db.users[idx] = {
      ...existing,
      githubId: existing.githubId || normGithubId,
      displayName: existing.displayName || params.displayName,
      email: existing.email || normEmail,
      username: existing.username || normUsername,
      avatarUrl: params.avatarUrl ?? existing.avatarUrl ?? null,
      lastLoginAt: nowIso,
    };
    writeDb(db);
    return db.users[idx];
  }

  return createUserRecord({
    uid: params.uid,
    githubId: normGithubId,
    authProvider: params.authProvider,
    displayName: params.displayName,
    email: normEmail,
    username: normUsername,
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
    volume: 0.27,
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

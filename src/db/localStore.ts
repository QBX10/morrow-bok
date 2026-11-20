import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AuthProviderType } from '../types/agency.ts';

export interface StoredUserRecord {
  id: number;
  uid: string;
  authProvider: AuthProviderType;
  displayName: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  passwordHash: string | null;
  role: 'manager' | 'viewer';
  createdAt: string;
}

export interface StoredWorkspaceSnapshot {
  userId: number;
  snapshotJson: string;
  recordCount: number;
  agencyCount: number;
  updatedAt: string;
}

interface LocalDbFile {
  users: StoredUserRecord[];
  snapshots: StoredWorkspaceSnapshot[];
}

const PRIMARY_DB_PATH = path.resolve(process.cwd(), 'data', 'local-db.json');
const FALLBACK_DB_PATH = path.join(os.tmpdir(), 'flour-agency-local-db.json');
let activeDbPath = PRIMARY_DB_PATH;

function readDb(): LocalDbFile {
  try {
    if (!fs.existsSync(activeDbPath)) {
      return { users: [], snapshots: [] };
    }
    const raw = fs.readFileSync(activeDbPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalDbFile>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
    };
  } catch {
    return { users: [], snapshots: [] };
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

export function findUserByPhone(phone: string): StoredUserRecord | null {
  const norm = phone.trim();
  if (!norm) return null;
  return readDb().users.find((u) => u.phone === norm) || null;
}

export function findUserByUid(uid: string): StoredUserRecord | null {
  return readDb().users.find((u) => u.uid === uid) || null;
}

export function createUserRecord(params: {
  uid: string;
  authProvider: AuthProviderType;
  displayName: string;
  email?: string | null;
  username?: string | null;
  phone?: string | null;
  passwordHash?: string | null;
}): StoredUserRecord {
  const db = readDb();
  const nextId = db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
  const created: StoredUserRecord = {
    id: nextId,
    uid: params.uid,
    authProvider: params.authProvider,
    displayName: params.displayName,
    email: params.email ? params.email.trim().toLowerCase() : null,
    username: params.username ? params.username.trim().toLowerCase() : null,
    phone: params.phone ? params.phone.trim() : null,
    passwordHash: params.passwordHash ?? null,
    role: 'manager',
    createdAt: new Date().toISOString(),
  };
  db.users.push(created);
  writeDb(db);
  return created;
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
}): StoredWorkspaceSnapshot {
  const db = readDb();
  const entry: StoredWorkspaceSnapshot = {
    userId: params.userId,
    snapshotJson: params.snapshotJson,
    recordCount: params.recordCount,
    agencyCount: params.agencyCount,
    updatedAt: new Date().toISOString(),
  };
  const idx = db.snapshots.findIndex((s) => s.userId === params.userId);
  if (idx === -1) db.snapshots.push(entry);
  else db.snapshots[idx] = entry;
  writeDb(db);
  return entry;
}

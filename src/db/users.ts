import crypto from 'crypto';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  appearanceProfiles,
  syncAuditLogs,
  userPreferences,
  users,
  workspaceSnapshots,
} from './schema.ts';

export function isSqlDatabaseConfigured(): boolean {
  return Boolean(
    process.env.SQL_HOST &&
      process.env.SQL_DB_NAME &&
      process.env.SQL_USER &&
      process.env.SQL_PASSWORD
  );
}

export async function pingSqlDatabase(): Promise<boolean> {
  if (!isSqlDatabaseConfigured()) return false;
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

function computeChecksum(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export async function getOrCreateUser(params: {
  uid: string;
  email: string;
  emailVerified?: boolean;
  githubId?: string | null;
  username?: string | null;
  displayName?: string;
  avatarUrl?: string | null;
  authProvider?: string;
}) {
  try {
    const safeEmail = (params.email || `${params.uid}@tabrex.local`).trim().toLowerCase();
    const safeDisplay = (params.displayName || safeEmail.split('@')[0] || 'مستخدم').trim();
    const normUsername = params.username ? params.username.trim().toLowerCase() : null;
    const normGithubId = params.githubId ? params.githubId.trim() : null;

    // Unified lookup strictly by uid, githubId, or explicitly verified email (never arbitrary username)
    const existingByIdentity = await resolveExistingSqlUser({
      uid: params.uid,
      githubId: normGithubId,
      email:
        params.emailVerified && !safeEmail.endsWith('.local') ? safeEmail : null,
    });

    if (existingByIdentity) {
      const updated = await db
        .update(users)
        .set({
          displayName: existingByIdentity.displayName || safeDisplay,
          ...(params.avatarUrl !== undefined ? { avatarUrl: params.avatarUrl } : {}),
          ...(normGithubId && !existingByIdentity.githubId ? { githubId: normGithubId } : {}),
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByIdentity.id))
        .returning();
      return updated[0] || existingByIdentity;
    }

    const existingUsername = normUsername ? await findSqlUserByUsername(normUsername) : null;
    const safeUsername = existingUsername ? null : normUsername;

    const result = await db
      .insert(users)
      .values({
        uid: params.uid,
        githubId: normGithubId,
        email: safeEmail,
        username: safeUsername,
        displayName: safeDisplay,
        avatarUrl: params.avatarUrl ?? null,
        authProvider: params.authProvider || 'google',
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: safeEmail,
          displayName: safeDisplay,
          ...(normGithubId ? { githubId: normGithubId } : {}),
          ...(params.avatarUrl !== undefined ? { avatarUrl: params.avatarUrl } : {}),
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Database operation failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function resolveExistingSqlUser(params: {
  uid?: string | null;
  githubId?: string | null;
  email?: string | null;
}) {
  const uid = params.uid?.trim();
  const githubId = params.githubId?.trim();
  const email = params.email?.trim().toLowerCase();

  if (uid) {
    const byUid = await db.select().from(users).where(eq(users.uid, uid));
    if (byUid[0]) return byUid[0];
  }
  if (githubId) {
    const byGh = await db.select().from(users).where(eq(users.githubId, githubId));
    if (byGh[0]) return byGh[0];
  }
  if (email && !email.endsWith('.local')) {
    const byEmail = await db.select().from(users).where(eq(users.email, email));
    if (byEmail[0]) return byEmail[0];
  }
  return null;
}

export async function getSqlUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Database user lookup failed:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function findSqlUserByGithubId(githubId: string) {
  const norm = githubId.trim();
  if (!norm) return null;
  const rows = await db.select().from(users).where(eq(users.githubId, norm));
  return rows[0] || null;
}

export async function findSqlUserByEmail(email: string) {
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  const rows = await db.select().from(users).where(eq(users.email, norm));
  return rows[0] || null;
}

export async function findSqlUserByUsername(username: string) {
  const norm = username.trim().toLowerCase();
  if (!norm) return null;
  const rows = await db.select().from(users).where(eq(users.username, norm));
  return rows[0] || null;
}

export async function findSqlUserByAnyIdentifier(params: {
  email?: string;
  username?: string;
}) {
  const conditions = [];
  if (params.email) conditions.push(eq(users.email, params.email.trim().toLowerCase()));
  if (params.username) conditions.push(eq(users.username, params.username.trim().toLowerCase()));
  if (conditions.length === 0) return null;
  const rows = await db
    .select()
    .from(users)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions));
  return rows[0] || null;
}

export async function createSqlPasswordUser(params: {
  uid: string;
  authProvider: 'google' | 'github' | 'username';
  displayName: string;
  email?: string | null;
  username?: string | null;
  passwordHash: string | null;
}) {
  const safeEmail = (params.email || `${params.uid}@tabrex.local`).trim().toLowerCase();
  const rows = await db
    .insert(users)
    .values({
      uid: params.uid,
      email: safeEmail,
      username: params.username ? params.username.trim().toLowerCase() : null,
      passwordHash: params.passwordHash,
      displayName: params.displayName.trim(),
      authProvider: params.authProvider,
      role: 'manager',
      lastLoginAt: new Date(),
    })
    .returning();
  return rows[0];
}

export async function updateSqlUserPasswordHash(uid: string, passwordHash: string) {
  const rows = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.uid, uid))
    .returning();
  return rows[0] || null;
}

export async function linkSqlUsernameToUid(params: {
  uid: string;
  username: string;
  passwordHash?: string | null;
}): Promise<
  | { ok: true; user: typeof users.$inferSelect }
  | { ok: false; error: string; status: number }
> {
  const norm = params.username.trim().toLowerCase();
  const conflict = await db
    .select()
    .from(users)
    .where(eq(users.username, norm));
  if (conflict[0] && conflict[0].uid !== params.uid) {
    return { ok: false, error: 'اسم المستخدم محجوز لحساب آخر بالفعل.', status: 409 };
  }
  const updated = await db
    .update(users)
    .set({
      username: norm,
      ...(params.passwordHash ? { passwordHash: params.passwordHash } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.uid, params.uid))
    .returning();
  if (!updated[0]) {
    return { ok: false, error: 'لم يتم العثور على الحساب المطلوب.', status: 404 };
  }
  return { ok: true, user: updated[0] };
}

export async function updateSqlUserProfile(params: {
  uid: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
}) {
  try {
    const userRow = await getOrCreateUser({
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      avatarUrl: params.avatarUrl,
    });
    const updated = await db
      .update(users)
      .set({
        ...(params.displayName !== undefined ? { displayName: params.displayName } : {}),
        ...(params.avatarUrl !== undefined ? { avatarUrl: params.avatarUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userRow.id))
      .returning();
    return updated[0] || userRow;
  } catch (error) {
    console.error('Database user profile update failed:', error);
    throw new Error('Database update failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function getWorkspaceByUid(uid: string) {
  try {
    const rows = await db
      .select({
        id: workspaceSnapshots.id,
        userId: workspaceSnapshots.userId,
        snapshotJson: workspaceSnapshots.snapshotJson,
        recordCount: workspaceSnapshots.recordCount,
        agencyCount: workspaceSnapshots.agencyCount,
        clientUpdatedAt: workspaceSnapshots.clientUpdatedAt,
        deviceId: workspaceSnapshots.deviceId,
        version: workspaceSnapshots.version,
        checksum: workspaceSnapshots.checksum,
        updatedAt: workspaceSnapshots.updatedAt,
      })
      .from(workspaceSnapshots)
      .innerJoin(users, eq(workspaceSnapshots.userId, users.id))
      .where(eq(users.uid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Database workspace lookup failed:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function saveWorkspaceByUid(params: {
  uid: string;
  email: string;
  displayName?: string;
  authProvider?: string;
  snapshotJson: string;
  recordCount: number;
  agencyCount: number;
  clientUpdatedAt?: string;
  deviceId?: string;
}) {
  try {
    const userRow = await getOrCreateUser({
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      authProvider: params.authProvider,
    });
    const existing = await db
      .select()
      .from(workspaceSnapshots)
      .where(eq(workspaceSnapshots.userId, userRow.id));
    const nextVersion = existing[0] ? (existing[0].version || 1) + 1 : 1;
    const nowIso = params.clientUpdatedAt || new Date().toISOString();
    const checksum = computeChecksum(params.snapshotJson);

    const result = await db
      .insert(workspaceSnapshots)
      .values({
        userId: userRow.id,
        snapshotJson: params.snapshotJson,
        recordCount: params.recordCount,
        agencyCount: params.agencyCount,
        clientUpdatedAt: nowIso,
        deviceId: params.deviceId || 'web',
        version: nextVersion,
        checksum,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: workspaceSnapshots.userId,
        set: {
          snapshotJson: params.snapshotJson,
          recordCount: params.recordCount,
          agencyCount: params.agencyCount,
          clientUpdatedAt: nowIso,
          deviceId: params.deviceId || 'web',
          version: nextVersion,
          checksum,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database workspace save failed:', error);
    throw new Error('Database save failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function syncSqlWorkspaceWithLww(params: {
  uid: string;
  email: string;
  displayName?: string;
  authProvider?: string;
  snapshotJson: string;
  recordCount: number;
  agencyCount: number;
  clientUpdatedAt?: string;
  deviceId?: string;
  force?: boolean;
}) {
  const existing = await getWorkspaceByUid(params.uid);
  const incomingChecksum = computeChecksum(params.snapshotJson);

  if (existing && !params.force && params.clientUpdatedAt) {
    const incomingMs = Date.parse(params.clientUpdatedAt);
    const serverRef = existing.clientUpdatedAt || existing.updatedAt?.toISOString() || '';
    const serverMs = Date.parse(serverRef);
    if (
      Number.isFinite(incomingMs) &&
      Number.isFinite(serverMs) &&
      serverMs > incomingMs + 250 &&
      existing.checksum !== incomingChecksum
    ) {
      return {
        conflictResolved: true,
        winner: 'server' as const,
        snapshot: existing,
      };
    }
  }

  const saved = await saveWorkspaceByUid(params);
  return {
    conflictResolved: false,
    winner: 'client' as const,
    snapshot: saved,
  };
}

export async function appendSqlAuditEvents(
  uid: string,
  email: string,
  events: Array<{
    eventId: string;
    actionType: string;
    title: string;
    summary?: string;
    deviceId?: string;
    payloadJson?: string;
  }>
) {
  if (events.length === 0) return;
  const userRow = await getOrCreateUser({ uid, email });
  for (const ev of events) {
    if (!ev.eventId) continue;
    await db
      .insert(syncAuditLogs)
      .values({
        userId: userRow.id,
        eventId: ev.eventId,
        actionType: ev.actionType,
        title: ev.title,
        summary: ev.summary || '',
        deviceId: ev.deviceId || 'web',
        payloadJson: ev.payloadJson || null,
      })
      .onConflictDoNothing({ target: syncAuditLogs.eventId });
  }
}

export async function listSqlAuditEvents(uid: string, limit = 60) {
  const userRow = await getSqlUserByUid(uid);
  if (!userRow) return [];
  return db
    .select({
      eventId: syncAuditLogs.eventId,
      actionType: syncAuditLogs.actionType,
      title: syncAuditLogs.title,
      summary: syncAuditLogs.summary,
      deviceId: syncAuditLogs.deviceId,
      payloadJson: syncAuditLogs.payloadJson,
      createdAt: syncAuditLogs.createdAt,
    })
    .from(syncAuditLogs)
    .where(eq(syncAuditLogs.userId, userRow.id))
    .orderBy(desc(syncAuditLogs.createdAt))
    .limit(limit);
}

export async function saveSqlUserPreferences(
  uid: string,
  email: string,
  preferencesJson: string
) {
  const userRow = await getOrCreateUser({ uid, email });
  const rows = await db
    .insert(userPreferences)
    .values({
      userId: userRow.id,
      preferencesJson,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        preferencesJson,
        updatedAt: new Date(),
      },
    })
    .returning();
  return rows[0];
}

export async function getSqlUserPreferences(uid: string) {
  const rows = await db
    .select({
      preferencesJson: userPreferences.preferencesJson,
      updatedAt: userPreferences.updatedAt,
    })
    .from(userPreferences)
    .innerJoin(users, eq(userPreferences.userId, users.id))
    .where(eq(users.uid, uid));
  return rows[0] || null;
}

export async function listAppearanceProfilesByUid(uid: string) {
  try {
    return await db
      .select({
        id: appearanceProfiles.id,
        profileKey: appearanceProfiles.profileKey,
        name: appearanceProfiles.name,
        configJson: appearanceProfiles.configJson,
        createdAt: appearanceProfiles.createdAt,
      })
      .from(appearanceProfiles)
      .innerJoin(users, eq(appearanceProfiles.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(appearanceProfiles.createdAt));
  } catch (error) {
    console.error('Database appearance profiles list failed:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function saveAppearanceProfileByUid(params: {
  uid: string;
  email: string;
  displayName?: string;
  profileKey: string;
  name: string;
  configJson: string;
}) {
  try {
    const userRow = await getOrCreateUser({
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
    });
    const existing = await db
      .select()
      .from(appearanceProfiles)
      .where(
        and(
          eq(appearanceProfiles.userId, userRow.id),
          eq(appearanceProfiles.profileKey, params.profileKey)
        )
      );
    if (existing[0]) {
      const updated = await db
        .update(appearanceProfiles)
        .set({
          name: params.name,
          configJson: params.configJson,
        })
        .where(eq(appearanceProfiles.id, existing[0].id))
        .returning();
      return updated[0];
    }
    const inserted = await db
      .insert(appearanceProfiles)
      .values({
        userId: userRow.id,
        profileKey: params.profileKey,
        name: params.name,
        configJson: params.configJson,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database appearance profile save failed:', error);
    throw new Error('Database save failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function deleteAppearanceProfileByUid(uid: string, profileKey: string) {
  try {
    const userRow = await getSqlUserByUid(uid);
    if (!userRow) return false;
    await db
      .delete(appearanceProfiles)
      .where(
        and(
          eq(appearanceProfiles.userId, userRow.id),
          eq(appearanceProfiles.profileKey, profileKey)
        )
      );
    return true;
  } catch (error) {
    console.error('Database appearance profile delete failed:', error);
    throw new Error('Database delete failed. Please try again later.', {
      cause: error,
    });
  }
}

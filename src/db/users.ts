import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  appearanceProfiles,
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

export async function getOrCreateUser(params: {
  uid: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
  authProvider?: string;
}) {
  try {
    const safeEmail = (params.email || `${params.uid}@tabrex.local`).trim().toLowerCase();
    const safeDisplay = (params.displayName || safeEmail.split('@')[0] || 'مستخدم').trim();
    const result = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: safeEmail,
        displayName: safeDisplay,
        avatarUrl: params.avatarUrl ?? null,
        authProvider: params.authProvider || 'google',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: safeEmail,
          displayName: safeDisplay,
          ...(params.avatarUrl !== undefined ? { avatarUrl: params.avatarUrl } : {}),
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
}) {
  try {
    const userRow = await getOrCreateUser({
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      authProvider: params.authProvider,
    });
    const result = await db
      .insert(workspaceSnapshots)
      .values({
        userId: userRow.id,
        snapshotJson: params.snapshotJson,
        recordCount: params.recordCount,
        agencyCount: params.agencyCount,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: workspaceSnapshots.userId,
        set: {
          snapshotJson: params.snapshotJson,
          recordCount: params.recordCount,
          agencyCount: params.agencyCount,
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

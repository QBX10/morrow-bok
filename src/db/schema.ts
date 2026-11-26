import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    githubId: text('github_id'),
    email: text('email').notNull(),
    username: text('username'),
    phone: text('phone'),
    passwordHash: text('password_hash'),
    displayName: text('display_name').notNull().default(''),
    avatarUrl: text('avatar_url'),
    authProvider: text('auth_provider').notNull().default('google'),
    role: text('role').notNull().default('manager'),
    lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_github_id_idx').on(table.githubId),
    index('users_username_idx').on(table.username),
    index('users_phone_idx').on(table.phone),
  ]
);

export const workspaceSnapshots = pgTable('workspace_snapshots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  snapshotJson: text('snapshot_json').notNull(),
  recordCount: integer('record_count').notNull().default(0),
  agencyCount: integer('agency_count').notNull().default(0),
  clientUpdatedAt: text('client_updated_at').notNull().default(''),
  deviceId: text('device_id').notNull().default(''),
  version: integer('version').notNull().default(1),
  checksum: text('checksum').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const appearanceProfiles = pgTable('appearance_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  profileKey: text('profile_key').notNull(),
  name: text('name').notNull(),
  configJson: text('config_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const syncAuditLogs = pgTable('sync_audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  eventId: text('event_id').notNull().unique(),
  actionType: text('action_type').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull().default(''),
  deviceId: text('device_id').notNull().default(''),
  payloadJson: text('payload_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  preferencesJson: text('preferences_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaceSnapshots, {
    fields: [users.id],
    references: [workspaceSnapshots.userId],
  }),
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  appearanceProfiles: many(appearanceProfiles),
  auditLogs: many(syncAuditLogs),
}));

export const workspaceSnapshotsRelations = relations(
  workspaceSnapshots,
  ({ one }) => ({
    owner: one(users, {
      fields: [workspaceSnapshots.userId],
      references: [users.id],
    }),
  })
);

export const appearanceProfilesRelations = relations(
  appearanceProfiles,
  ({ one }) => ({
    owner: one(users, {
      fields: [appearanceProfiles.userId],
      references: [users.id],
    }),
  })
);

export const syncAuditLogsRelations = relations(
  syncAuditLogs,
  ({ one }) => ({
    owner: one(users, {
      fields: [syncAuditLogs.userId],
      references: [users.id],
    }),
  })
);

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    owner: one(users, {
      fields: [userPreferences.userId],
      references: [users.id],
    }),
  })
);

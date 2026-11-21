import { relations } from 'drizzle-orm';
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default(''),
  avatarUrl: text('avatar_url'),
  authProvider: text('auth_provider').notNull().default('google'),
  role: text('role').notNull().default('manager'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaceSnapshots = pgTable('workspace_snapshots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  snapshotJson: text('snapshot_json').notNull(),
  recordCount: integer('record_count').notNull().default(0),
  agencyCount: integer('agency_count').notNull().default(0),
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

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaceSnapshots, {
    fields: [users.id],
    references: [workspaceSnapshots.userId],
  }),
  appearanceProfiles: many(appearanceProfiles),
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

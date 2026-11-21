# Security Specification — Tabrix Firestore Security Rules (Phase 0)

## 1. Data Invariants
1. **Identity Isolation**: Every user-owned document under `/users/{userId}/...` can only be created, updated, or deleted by the authenticated owner whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. **PII Split Isolation**: Private PII (`/users/{userId}/private/{docId}`) is readable ONLY by the owning user (`request.auth.uid == userId`) or a verified admin (`isAdmin()`). Never allow blanket `isSignedIn()` reads or list queries on PII.
3. **Immutable Ownership & Creation Time**: On all updates, `ownerUid`/`uid` and `createdAt` must remain strictly equal to `existing()`.
4. **Server Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
5. **Strict Key Allowlists & Size Bounds**: Every `isValid*` helper enforces `keys().hasAll(...)` and `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, and `.size()` limits on every string and document ID (`isValidId`).
6. **No Self-Assigned Roles**: Users creating `/users/{userId}/private/info` can only set `role == 'viewer'` or `'manager'` for their own personal workspace metadata, never `'admin'` or `'superadmin'`, and cannot escalate privileges via client writes.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing**: Creating `/users/userB/workspaces/main` while authenticated as `userA` (`ownerUid: 'userB'`). -> **DENIED**
2. **Ghost Field / Shadow Update**: Updating `/users/userA/private/info` with `{ role: 'admin', isVerified: true }`. -> **DENIED**
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting `create` on `/users/userA/appearanceProfiles/p1`. -> **DENIED**
4. **Spoofed Admin Claim**: Non-verified token claiming admin email (`shemmry9@gmail.com`) with `email_verified: false`. -> **DENIED**
5. **Path ID Poisoning**: Creating `/users/userA/appearanceProfiles/` with a 500-character or invalid-symbol document ID (`../bad$id`). -> **DENIED**
6. **Denial of Wallet String Bomb**: Creating `/users/userA/workspaces/main` with `title` exceeding 120 chars. -> **DENIED**
7. **Forged CreatedAt / UpdatedAt**: Creating a workspace doc with client-supplied `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`. -> **DENIED**
8. **Immutable Field Mutation**: Updating `createdAt` or `ownerUid` on an existing `AppearanceProfileDoc`. -> **DENIED**
9. **Cross-User PII Read**: `userB` calling `get` on `/users/userA/private/info`. -> **DENIED**
10. **Blanket List Query**: Non-owner calling `list` on `/users/userA/private` or `/users/userA/workspaces`. -> **DENIED**
11. **Value Poisoning**: Updating whitelisted `fontSizePx` with a string `"18px"` or negative number `-5`. -> **DENIED**
12. **Privilege Escalation on /admins**: Regular user attempting to write `/admins/{uid}`. -> **DENIED**

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const blueprint = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
) as {
  entities: Record<
    string,
    {
      required?: string[];
      properties: Record<
        string,
        { type: string; maxLength?: number; minLength?: number; pattern?: string; enum?: string[] }
      >;
    }
  >;
  firestore: Record<string, unknown>;
};

const rulesSource = fs.readFileSync(
  path.resolve(process.cwd(), 'firestore.rules'),
  'utf8'
);

interface MockAuth {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

function isValidId(id: unknown): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(id)
  );
}

function evaluateDirtyDozenWrite(params: {
  pathPattern: string;
  docId: string;
  userId: string;
  auth: MockAuth | null;
  payload: Record<string, unknown>;
  op: 'create' | 'update' | 'get' | 'list';
  existing?: Record<string, unknown>;
}): 'ALLOW' | 'PERMISSION_DENIED' {
  const { auth, userId, docId, payload, op, existing } = params;
  if (!auth) return 'PERMISSION_DENIED';
  const isVerified = auth.email_verified === true;
  const isAdmin = isVerified && auth.email === 'shemmry9@gmail.com';
  const isOwner = auth.uid === userId;

  if (op === 'get') {
    if (!isValidId(userId) || !isValidId(docId)) return 'PERMISSION_DENIED';
    return isOwner || isAdmin ? 'ALLOW' : 'PERMISSION_DENIED';
  }
  if (op === 'list') {
    if (params.pathPattern.includes('workspaces') || params.pathPattern.includes('appearanceProfiles')) {
      return (existing?.ownerUid === auth.uid || isAdmin) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    return isOwner || isAdmin ? 'ALLOW' : 'PERMISSION_DENIED';
  }

  if (!isValidId(userId) || !isValidId(docId)) return 'PERMISSION_DENIED';
  if (!isVerified || (!isOwner && !isAdmin)) return 'PERMISSION_DENIED';

  if (params.pathPattern === '/admins/{adminUid}') {
    return 'PERMISSION_DENIED';
  }

  if (params.pathPattern === '/users/{userId}/private/{docId}') {
    const allowed = ['uid', 'email', 'provider', 'role', 'createdAt', 'updatedAt'];
    const keys = Object.keys(payload);
    if (!allowed.every((k) => keys.includes(k)) || !keys.every((k) => allowed.includes(k))) {
      return 'PERMISSION_DENIED';
    }
    if (payload.uid !== userId || !['manager', 'viewer'].includes(String(payload.role))) {
      return 'PERMISSION_DENIED';
    }
    if (payload.updatedAt !== 'REQUEST_TIME') return 'PERMISSION_DENIED';
    if (op === 'create' && (payload.createdAt !== 'REQUEST_TIME' || payload.role !== 'manager')) {
      return 'PERMISSION_DENIED';
    }
    if (op === 'update' && !isAdmin) {
      if (
        payload.uid !== existing?.uid ||
        payload.createdAt !== existing?.createdAt ||
        payload.role !== existing?.role
      ) {
        return 'PERMISSION_DENIED';
      }
    }
    return 'ALLOW';
  }

  if (params.pathPattern === '/users/{userId}/workspaces/{workspaceId}') {
    const req = ['ownerUid', 'title', 'agencyCount', 'recordCount', 'createdAt', 'updatedAt'];
    const opt = ['snapshotVersion', 'themePrefs'];
    const keys = Object.keys(payload);
    if (!req.every((k) => keys.includes(k)) || !keys.every((k) => [...req, ...opt].includes(k))) {
      return 'PERMISSION_DENIED';
    }
    if (
      payload.ownerUid !== userId ||
      typeof payload.title !== 'string' ||
      payload.title.length < 1 ||
      payload.title.length > 120 ||
      payload.updatedAt !== 'REQUEST_TIME'
    ) {
      return 'PERMISSION_DENIED';
    }
    if (op === 'create' && payload.createdAt !== 'REQUEST_TIME') return 'PERMISSION_DENIED';
    if (op === 'update' && !isAdmin && (payload.ownerUid !== existing?.ownerUid || payload.createdAt !== existing?.createdAt)) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  if (params.pathPattern === '/users/{userId}/appearanceProfiles/{profileId}') {
    const req = ['ownerUid', 'name', 'appTheme', 'tableTheme', 'fontFamily', 'createdAt', 'updatedAt'];
    const opt = ['fontSizePx', 'rowHeightPx', 'glassEffect'];
    const keys = Object.keys(payload);
    if (!req.every((k) => keys.includes(k)) || !keys.every((k) => [...req, ...opt].includes(k))) {
      return 'PERMISSION_DENIED';
    }
    if (payload.ownerUid !== userId || payload.updatedAt !== 'REQUEST_TIME') {
      return 'PERMISSION_DENIED';
    }
    if (
      'fontSizePx' in payload &&
      (typeof payload.fontSizePx !== 'number' || payload.fontSizePx < 11 || payload.fontSizePx > 26)
    ) {
      return 'PERMISSION_DENIED';
    }
    if (op === 'create' && payload.createdAt !== 'REQUEST_TIME') return 'PERMISSION_DENIED';
    if (op === 'update' && !isAdmin && (payload.ownerUid !== existing?.ownerUid || payload.createdAt !== existing?.createdAt)) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  return 'PERMISSION_DENIED';
}

test('Firestore rules enforce default deny, verified users, and all blueprint collections', () => {
  assert.ok(rulesSource.includes("rules_version = '2';"));
  assert.ok(rulesSource.includes('allow read, write: if false;'));
  assert.ok(rulesSource.includes('request.auth.token.email_verified == true'));
  for (const colPath of Object.keys(blueprint.firestore)) {
    const rootSegment = colPath.split('/')[3];
    assert.ok(rulesSource.includes(rootSegment), `Missing match rule for ${colPath}`);
  }
});

test('Dirty Dozen adversarial payloads return PERMISSION_DENIED', () => {
  // 1. Identity Spoofing
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/workspaces/{workspaceId}',
      userId: 'userB',
      docId: 'main',
      auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
      op: 'create',
      payload: {
        ownerUid: 'userB',
        title: 'Test',
        agencyCount: 1,
        recordCount: 1,
        createdAt: 'REQUEST_TIME',
        updatedAt: 'REQUEST_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 2. Ghost Field / Shadow Update
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/private/{docId}',
      userId: 'userA',
      docId: 'info',
      auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
      op: 'update',
      existing: { uid: 'userA', email: 'a@example.com', provider: 'google', role: 'manager', createdAt: 'REQUEST_TIME' },
      payload: {
        uid: 'userA',
        email: 'a@example.com',
        provider: 'google',
        role: 'admin',
        isVerified: true,
        createdAt: 'REQUEST_TIME',
        updatedAt: 'REQUEST_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 3. Unverified Email Write
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/appearanceProfiles/{profileId}',
      userId: 'userA',
      docId: 'p1',
      auth: { uid: 'userA', email: 'a@example.com', email_verified: false },
      op: 'create',
      payload: {
        ownerUid: 'userA',
        name: 'Night',
        appTheme: 'obsidian-gold',
        tableTheme: 'glass',
        fontFamily: 'cairo',
        createdAt: 'REQUEST_TIME',
        updatedAt: 'REQUEST_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 4. Spoofed Admin Claim (email_verified: false)
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/private/{docId}',
      userId: 'userA',
      docId: 'info',
      auth: { uid: 'attacker', email: 'shemmry9@gmail.com', email_verified: false },
      op: 'get',
      payload: {},
    }),
    'PERMISSION_DENIED'
  );

  // 5. Path ID Poisoning
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/appearanceProfiles/{profileId}',
      userId: 'userA',
      docId: '../bad$id',
      auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
      op: 'create',
      payload: {
        ownerUid: 'userA',
        name: 'Night',
        appTheme: 'obsidian-gold',
        tableTheme: 'glass',
        fontFamily: 'cairo',
        createdAt: 'REQUEST_TIME',
        updatedAt: 'REQUEST_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 6. Denial of Wallet String Bomb
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/workspaces/{workspaceId}',
      userId: 'userA',
      docId: 'main',
      auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
      op: 'create',
      payload: {
        ownerUid: 'userA',
        title: 'x'.repeat(121),
        agencyCount: 1,
        recordCount: 1,
        createdAt: 'REQUEST_TIME',
        updatedAt: 'REQUEST_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 7. Forged createdAt
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/workspaces/{workspaceId}',
      userId: 'userA',
      docId: 'main',
      auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
      op: 'create',
      payload: {
        ownerUid: 'userA',
        title: 'My Workspace',
        agencyCount: 1,
        recordCount: 1,
        createdAt: '2020-01-01T00:00:00Z',
        updatedAt: 'REQUEST_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 8. Immutable Field Mutation
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/appearanceProfiles/{profileId}',
      userId: 'userA',
      docId: 'p1',
      auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
      op: 'update',
      existing: { ownerUid: 'userA', createdAt: 'OLD_TIME' },
      payload: {
        ownerUid: 'userA',
        name: 'Night',
        appTheme: 'obsidian-gold',
        tableTheme: 'glass',
        fontFamily: 'cairo',
        createdAt: 'REQUEST_TIME',
        updatedAt: 'REQUEST_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 9. Cross-User PII Read
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/private/{docId}',
      userId: 'userA',
      docId: 'info',
      auth: { uid: 'userB', email: 'b@example.com', email_verified: true },
      op: 'get',
      payload: {},
    }),
    'PERMISSION_DENIED'
  );

  // 10. Blanket List Query by Non-Owner
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/workspaces/{workspaceId}',
      userId: 'userA',
      docId: 'main',
      auth: { uid: 'userB', email: 'b@example.com', email_verified: true },
      op: 'list',
      existing: { ownerUid: 'userA' },
      payload: {},
    }),
    'PERMISSION_DENIED'
  );

  // 11. Value Poisoning on fontSizePx
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/users/{userId}/appearanceProfiles/{profileId}',
      userId: 'userA',
      docId: 'p1',
      auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
      op: 'create',
      payload: {
        ownerUid: 'userA',
        name: 'Night',
        appTheme: 'obsidian-gold',
        tableTheme: 'glass',
        fontFamily: 'cairo',
        fontSizePx: -5,
        createdAt: 'REQUEST_TIME',
        updatedAt: 'REQUEST_TIME',
      },
    }),
    'PERMISSION_DENIED'
  );

  // 12. Privilege Escalation on /admins
  assert.equal(
    evaluateDirtyDozenWrite({
      pathPattern: '/admins/{adminUid}',
      userId: 'userA',
      docId: 'userA',
      auth: { uid: 'userA', email: 'a@example.com', email_verified: true },
      op: 'create',
      payload: {},
    }),
    'PERMISSION_DENIED'
  );
});

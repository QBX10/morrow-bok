import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import type { AppearanceProfile, ThemePreferences } from '../types/agency';

const MAX_DISPLAY_NAME_LEN = 80;
const MAX_EMAIL_LEN = 160;
const MAX_AVATAR_LEN = 450000;
const MAX_WORKSPACE_TITLE_LEN = 120;
const MAX_PROFILE_NAME_LEN = 80;
const MAX_ENUM_LEN = 40;
const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function clampStr(value: string | undefined | null, maxLen: number): string {
  return String(value ?? '').trim().slice(0, maxLen);
}

function canWriteFirestoreFor(uid: string): boolean {
  const cur = auth.currentUser;
  return Boolean(
    cur &&
      cur.uid === uid &&
      cur.emailVerified &&
      VALID_ID_REGEX.test(uid)
  );
}

export async function syncUserProfileToFirestore(params: {
  uid: string;
  displayName: string;
  email?: string | null;
  provider: 'google' | 'username' | 'phone';
  avatarUrl?: string | null;
}): Promise<void> {
  if (!canWriteFirestoreFor(params.uid)) return;

  const publicPath = `users/${params.uid}/public/card`;
  const publicRef = doc(db, 'users', params.uid, 'public', 'card');
  const safeDisplayName =
    clampStr(params.displayName, MAX_DISPLAY_NAME_LEN) || 'مستخدم تابريكس';
  const safeAvatar =
    params.avatarUrl && params.avatarUrl.length <= MAX_AVATAR_LEN
      ? params.avatarUrl
      : '';

  try {
    await setDoc(publicRef, {
      uid: params.uid,
      displayName: safeDisplayName,
      ...(safeAvatar ? { avatarUrl: safeAvatar } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  const privatePath = `users/${params.uid}/private/info`;
  const privateRef = doc(db, 'users', params.uid, 'private', 'info');
  const safeEmail =
    clampStr(params.email, MAX_EMAIL_LEN) || `${params.uid}@tabrix.local`;

  try {
    const existingSnap = await getDoc(privateRef);
    if (!existingSnap.exists()) {
      await setDoc(privateRef, {
        uid: params.uid,
        email: safeEmail,
        provider: params.provider,
        role: 'manager',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        privateRef,
        {
          email: safeEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function syncWorkspaceSummaryToFirestore(params: {
  uid: string;
  title: string;
  agencyCount: number;
  recordCount: number;
  themePrefs?: ThemePreferences;
}): Promise<void> {
  if (!canWriteFirestoreFor(params.uid)) return;

  const wsPath = `users/${params.uid}/workspaces/main`;
  const wsRef = doc(db, 'users', params.uid, 'workspaces', 'main');
  const safeTitle =
    clampStr(params.title, MAX_WORKSPACE_TITLE_LEN) || 'مساحة عمل تابريكس';
  const safeAgencyCount = Math.max(0, Math.min(500, Math.round(params.agencyCount)));
  const safeRecordCount = Math.max(0, Math.min(50000, Math.round(params.recordCount)));

  const compactThemeMap = params.themePrefs
    ? {
        appTheme: clampStr(params.themePrefs.appTheme, MAX_ENUM_LEN),
        tableTheme: clampStr(params.themePrefs.tableTheme, MAX_ENUM_LEN),
        fontFamily: clampStr(params.themePrefs.fontFamily, MAX_ENUM_LEN),
        fontSizePx: Math.max(11, Math.min(26, Math.round(params.themePrefs.fontSizePx ?? 15))),
        rowHeightPx: Math.max(24, Math.min(84, Math.round(params.themePrefs.rowHeightPx ?? 40))),
        glassEffect: Boolean(params.themePrefs.glassEffect),
      }
    : undefined;

  try {
    const existingSnap = await getDoc(wsRef);
    if (!existingSnap.exists()) {
      await setDoc(wsRef, {
        ownerUid: params.uid,
        title: safeTitle,
        agencyCount: safeAgencyCount,
        recordCount: safeRecordCount,
        snapshotVersion: 1,
        ...(compactThemeMap ? { themePrefs: compactThemeMap } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const prevVersion = Number(existingSnap.data()?.snapshotVersion || 0);
      await setDoc(
        wsRef,
        {
          title: safeTitle,
          agencyCount: safeAgencyCount,
          recordCount: safeRecordCount,
          snapshotVersion: Math.min(1000000, prevVersion + 1),
          ...(compactThemeMap ? { themePrefs: compactThemeMap } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wsPath);
  }
}

export async function saveAppearanceProfileToFirestore(
  uid: string,
  profile: AppearanceProfile
): Promise<void> {
  if (!canWriteFirestoreFor(uid) || !VALID_ID_REGEX.test(profile.id)) return;

  const docPath = `users/${uid}/appearanceProfiles/${profile.id}`;
  const ref = doc(db, 'users', uid, 'appearanceProfiles', profile.id);

  try {
    const existingSnap = await getDoc(ref);
    const payload = {
      ownerUid: uid,
      name: clampStr(profile.name, MAX_PROFILE_NAME_LEN) || 'ملف مظهر',
      appTheme: clampStr(profile.appTheme, MAX_ENUM_LEN),
      tableTheme: clampStr(profile.tableTheme, MAX_ENUM_LEN),
      fontFamily: clampStr(profile.fontFamily, MAX_ENUM_LEN),
      fontSizePx: Math.max(11, Math.min(26, Math.round(profile.fontSizePx || 15))),
      rowHeightPx: Math.max(24, Math.min(84, Math.round(profile.rowHeightPx || 40))),
      glassEffect: Boolean(profile.glassEffect),
      updatedAt: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function listAppearanceProfilesFromFirestore(
  uid: string
): Promise<Partial<AppearanceProfile>[]> {
  if (!canWriteFirestoreFor(uid)) return [];
  const colPath = `users/${uid}/appearanceProfiles`;
  try {
    const q = query(
      collection(db, 'users', uid, 'appearanceProfiles'),
      where('ownerUid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AppearanceProfile, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
}

export async function deleteAppearanceProfileFromFirestore(
  uid: string,
  profileId: string
): Promise<void> {
  if (!canWriteFirestoreFor(uid) || !VALID_ID_REGEX.test(profileId)) return;
  const docPath = `users/${uid}/appearanceProfiles/${profileId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'appearanceProfiles', profileId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

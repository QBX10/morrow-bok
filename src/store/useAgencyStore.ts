import { create } from 'zustand';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, isFirestoreConfigured } from '../lib/firebase';
import { authFetch, getStoredSession } from '../lib/authClient';
import { getOrCreateDeviceId } from '../services/storage/syncEngine';
import { soundManager, type NotificationChannelKey, type NotificationChannelPref } from '../audio/SoundManager';
import {
  applyThemeTokensToDocument,
  THEMES,
  type ThemeId,
  type WorkspaceModeId,
} from '../theme/tokens';

export type ScreenId =
  | 'onboarding'
  | 'signin'
  | 'otp'
  | 'home'
  | 'assistant'
  | 'sheets'
  | 'sheet_editor'
  | 'modes'
  | 'devices'
  | 'sound_notifications'
  | 'security';

export type CoreOrbState = 'idle' | 'thinking' | 'listening' | 'offline' | 'syncing';
export type ViewLifecycleState = 'ready' | 'loading' | 'empty' | 'offline' | 'error';

export interface NotificationPrefsDoc {
  channels: Record<NotificationChannelKey, NotificationChannelPref>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  masterSound: boolean;
  volumes: {
    music: number;
    sfx: number;
  };
  activeTheme: ThemeId;
  activeMode: WorkspaceModeId;
  updatedAt: string;
  updatedByDevice: string;
}

export interface SheetCell {
  raw: string; // e.g. "4200" or "=SUM(B2:B4)"
}

export interface SheetChartSpec {
  id: string;
  titleAr: string;
  titleEn: string;
  labels: string[];
  values: number[];
}

export interface SpatialSheet {
  id: string;
  titleAr: string;
  titleEn: string;
  updatedAt: string;
  rows: number;
  cols: number;
  cells: Record<string, SheetCell>; // key: "A1", "B2"
  chart?: SheetChartSpec;
}

export interface ConnectedDeviceItem {
  id: string;
  nameAr: string;
  nameEn: string;
  platform: 'web' | 'mobile' | 'desktop';
  location: string;
  lastActive: string;
  current: boolean;
  trusted: boolean;
  isNewAlert?: boolean;
}

export interface AssistantTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionLabel?: string;
}

export interface StoreToast {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

export interface ModeShockwave {
  id: number;
  x: number;
  y: number;
  color: string;
}

const PREFS_LOCAL_KEY = 'morrow_unified_prefs_v2';
const VALID_ID_RE = /^[a-zA-Z0-9_\-]+$/;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsDoc = {
  channels: {
    security: { enabled: true, sound: true, haptic: true, push: true },
    reminders: { enabled: true, sound: true, haptic: true, push: true },
    sync: { enabled: true, sound: true, haptic: true, push: true },
    news: { enabled: true, sound: false, haptic: false, push: true },
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
  masterSound: true,
  volumes: {
    music: 0.2,
    sfx: 0.85,
  },
  activeTheme: 'quantum_glass',
  activeMode: 'focus',
  updatedAt: new Date().toISOString(),
  updatedByDevice: 'local',
};

const INITIAL_SHEETS: SpatialSheet[] = [
  {
    id: 'sheet_q4_budget',
    titleAr: 'ميزانية التشغيل والوكالات — Q4',
    titleEn: 'Q4 Operations & Quota Ledger',
    updatedAt: 'منذ دقيقتين',
    rows: 7,
    cols: 5,
    cells: {
      A1: { raw: 'البند' },
      B1: { raw: 'المخطط' },
      C1: { raw: 'الفعلي' },
      D1: { raw: 'الفرق' },
      E1: { raw: 'النسبة %' },
      A2: { raw: 'حصص الإمداد' },
      B2: { raw: '42000' },
      C2: { raw: '39500' },
      D2: { raw: '=B2-C2' },
      E2: { raw: '=C2/B2*100' },
      A3: { raw: 'النقل والوقود' },
      B3: { raw: '18500' },
      C3: { raw: '17200' },
      D3: { raw: '=B3-C3' },
      E3: { raw: '=C3/B3*100' },
      A4: { raw: 'التسويات السريعة' },
      B4: { raw: '12000' },
      C4: { raw: '11400' },
      D4: { raw: '=B4-C4' },
      E4: { raw: '=C4/B4*100' },
      A5: { raw: 'الإجمالي' },
      B5: { raw: '=SUM(B2:B4)' },
      C5: { raw: '=SUM(C2:C4)' },
      D5: { raw: '=SUM(D2:D4)' },
      E5: { raw: '=C5/B5*100' },
    },
    chart: {
      id: 'chart_1',
      titleAr: 'المخطط مقابل الفعلي',
      titleEn: 'Planned vs Actual',
      labels: ['الإمداد', 'النقل', 'التسويات'],
      values: [39500, 17200, 11400],
    },
  },
  {
    id: 'sheet_inventory_audit',
    titleAr: 'جرد الكميات الميداني',
    titleEn: 'Field Allocation Audit',
    updatedAt: 'أمس',
    rows: 6,
    cols: 4,
    cells: {
      A1: { raw: 'المركز' },
      B1: { raw: 'الكمية' },
      C1: { raw: 'الاحتياطي' },
      D1: { raw: 'الصافي' },
      A2: { raw: 'الكرخ' },
      B2: { raw: '1400' },
      C2: { raw: '180' },
      D2: { raw: '=B2-C2' },
      A3: { raw: 'الرصافة' },
      B3: { raw: '1950' },
      C3: { raw: '210' },
      D3: { raw: '=B3-C3' },
      A4: { raw: 'المجموع' },
      B4: { raw: '=SUM(B2:B3)' },
      C4: { raw: '=SUM(C2:C3)' },
      D4: { raw: '=SUM(D2:D3)' },
    },
  },
];

function loadLocalPrefs(deviceId: string): NotificationPrefsDoc {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_NOTIFICATION_PREFS, updatedByDevice: deviceId };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_LOCAL_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS, updatedByDevice: deviceId };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefsDoc>;
    return {
      channels: {
        security: { ...DEFAULT_NOTIFICATION_PREFS.channels.security, ...(parsed.channels?.security ?? {}) },
        reminders: { ...DEFAULT_NOTIFICATION_PREFS.channels.reminders, ...(parsed.channels?.reminders ?? {}) },
        sync: { ...DEFAULT_NOTIFICATION_PREFS.channels.sync, ...(parsed.channels?.sync ?? {}) },
        news: { ...DEFAULT_NOTIFICATION_PREFS.channels.news, ...(parsed.channels?.news ?? {}) },
      },
      quietHours: { ...DEFAULT_NOTIFICATION_PREFS.quietHours, ...(parsed.quietHours ?? {}) },
      masterSound: typeof parsed.masterSound === 'boolean' ? parsed.masterSound : true,
      volumes: {
        music: typeof parsed.volumes?.music === 'number' ? Math.max(0, Math.min(1, parsed.volumes.music)) : 0.2,
        sfx: typeof parsed.volumes?.sfx === 'number' ? Math.max(0, Math.min(1, parsed.volumes.sfx)) : 0.85,
      },
      activeTheme: parsed.activeTheme && parsed.activeTheme in THEMES ? parsed.activeTheme : 'quantum_glass',
      activeMode: parsed.activeMode ?? 'focus',
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      updatedByDevice: deviceId,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS, updatedByDevice: deviceId };
  }
}

function persistLocalPrefs(prefs: NotificationPrefsDoc): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_LOCAL_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

function pushToSoundManager(prefs: NotificationPrefsDoc): void {
  const themeDef = THEMES[prefs.activeTheme] ?? THEMES.quantum_glass;
  soundManager.setPalette(themeDef.soundPalette);
  soundManager.setPolicy({
    masterSound: prefs.masterSound,
    volumes: prefs.volumes,
    quietHours: prefs.quietHours,
    channels: prefs.channels,
  });
}

let activeFirestoreUnsub: Unsubscribe | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let rollbackSnapshot: NotificationPrefsDoc | null = null;

export interface AgencyStoreState {
  currentDeviceId: string;
  uid: string | null;
  lang: 'ar' | 'en';
  activeScreen: ScreenId;
  screenHistory: ScreenId[];
  commandPaletteOpen: boolean;
  coreState: CoreOrbState;
  viewStates: Partial<Record<ScreenId, ViewLifecycleState>>;
  isOffline: boolean;
  notificationPrefsLoading: boolean;
  lastSyncError: string | null;
  notificationPrefs: NotificationPrefsDoc;
  modeShockwave: ModeShockwave | null;
  newDeviceBadgeCount: number;
  devices: ConnectedDeviceItem[];
  sheets: SpatialSheet[];
  activeSheetId: string;
  assistantTurns: AssistantTurn[];
  toasts: StoreToast[];
  authenticated: boolean;
  authMethod: 'passkey' | 'otp' | 'google' | 'github' | 'username' | null;
  userEmail: string;
  userDisplayName: string;
  onboardingDone: boolean;

  setLang: (lang: 'ar' | 'en') => void;
  navigate: (screen: ScreenId) => void;
  goBack: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setCoreState: (state: CoreOrbState) => void;
  setViewState: (screen: ScreenId, state: ViewLifecycleState) => void;
  setOfflineStatus: (offline: boolean) => void;
  pushToast: (toast: Omit<StoreToast, 'id'>) => void;
  dismissToast: (id: string) => void;
  dismissNewDeviceAlert: () => void;
  revokeDevice: (deviceId: string) => void;
  completeAuth: (params: {
    uid: string;
    email: string;
    displayName: string;
    method: 'passkey' | 'otp' | 'google' | 'github' | 'username';
  }) => void;
  signOutUser: () => void;
  completeOnboarding: () => void;

  hydrateNotificationPrefs: (uid: string) => () => void;
  setChannel: (id: NotificationChannelKey, patch: Partial<NotificationChannelPref>) => void;
  setQuietHours: (patch: Partial<NotificationPrefsDoc['quietHours']>) => void;
  setVolumes: (patch: Partial<NotificationPrefsDoc['volumes']>) => void;
  setMasterSound: (enabled: boolean) => void;
  setTheme: (themeId: ThemeId) => void;
  setMode: (modeId: WorkspaceModeId, coords?: { x: number; y: number }) => void;

  setActiveSheetId: (id: string) => void;
  updateSheetCell: (sheetId: string, cellKey: string, raw: string) => void;
  runSheetAiCommand: (sheetId: string, prompt: string) => void;
  createBlankSheet: (titleAr: string, titleEn: string) => void;
  sendAssistantPrompt: (text: string) => Promise<void>;
}

const initialDeviceId = typeof window !== 'undefined' ? getOrCreateDeviceId() : 'dev_ssr';
const initialPrefs = loadLocalPrefs(initialDeviceId);
if (typeof document !== 'undefined') {
  applyThemeTokensToDocument(initialPrefs.activeTheme, initialPrefs.activeMode, 'rtl');
  pushToSoundManager(initialPrefs);
}

export const useAgencyStore = create<AgencyStoreState>((set, get) => {
  const schedulePersistPrefs = (nextPrefs: NotificationPrefsDoc, previousPrefs: NotificationPrefsDoc) => {
    persistLocalPrefs(nextPrefs);
    pushToSoundManager(nextPrefs);
    if (!rollbackSnapshot) {
      rollbackSnapshot = previousPrefs;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const uid = get().uid;
      const latest = get().notificationPrefs;
      const deviceId = get().currentDeviceId;
      const canUseFirestore =
        Boolean(uid) &&
        isFirestoreConfigured &&
        Boolean(auth.currentUser && auth.currentUser.uid === uid && auth.currentUser.emailVerified && VALID_ID_RE.test(uid!));

      if (canUseFirestore && uid) {
        try {
          set({ coreState: 'syncing', lastSyncError: null });
          const docRef = doc(db, 'users', uid, 'settings', 'notifications');
          await setDoc(
            docRef,
            {
              channels: latest.channels,
              quietHours: latest.quietHours,
              masterSound: latest.masterSound,
              volumes: latest.volumes,
              activeTheme: latest.activeTheme,
              activeMode: latest.activeMode,
              updatedByDevice: deviceId,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          rollbackSnapshot = null;
          set({ coreState: get().isOffline ? 'offline' : 'idle' });
          soundManager.play('sync_complete');
        } catch (err) {
          const revert = rollbackSnapshot ?? previousPrefs;
          rollbackSnapshot = null;
          persistLocalPrefs(revert);
          pushToSoundManager(revert);
          applyThemeTokensToDocument(revert.activeTheme, revert.activeMode, get().lang === 'ar' ? 'rtl' : 'ltr');
          const msg = err instanceof Error ? err.message : 'فشلت مزامنة التفضيلات مع السحابة';
          set({
            notificationPrefs: revert,
            lastSyncError: msg,
            coreState: get().isOffline ? 'offline' : 'idle',
          });
          get().pushToast({
            title: get().lang === 'ar' ? 'تعذر حفظ الإعدادات — تم التراجع' : 'Sync failed — reverted',
            description: msg,
            tone: 'error',
          });
          soundManager.play('sync_failed');
        }
        return;
      }

      // Server REST API sync fallback for non-Firebase auth sessions (Email OTP / Passkey / Username)
      const session = getStoredSession();
      if (session?.user && typeof fetch === 'function') {
        try {
          set({ coreState: 'syncing', lastSyncError: null });
          const res = await authFetch('/api/settings/audio-notifications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId,
              settings: {
                masterSoundEnabled: latest.masterSound,
                musicVolume: latest.volumes.music,
                effectsVolume: latest.volumes.sfx,
                quietHoursEnabled: latest.quietHours.enabled,
                quietHoursStart: latest.quietHours.start,
                quietHoursEnd: latest.quietHours.end,
                channels: {
                  security: true,
                  reminders: latest.channels.reminders.enabled,
                  sync: latest.channels.sync.enabled,
                  whats_new: latest.channels.news.enabled,
                },
              },
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          rollbackSnapshot = null;
          set({ coreState: get().isOffline ? 'offline' : 'idle' });
        } catch (err) {
          const revert = rollbackSnapshot ?? previousPrefs;
          rollbackSnapshot = null;
          persistLocalPrefs(revert);
          pushToSoundManager(revert);
          set({
            notificationPrefs: revert,
            lastSyncError: err instanceof Error ? err.message : 'Sync failed',
            coreState: get().isOffline ? 'offline' : 'idle',
          });
          get().pushToast({
            title: get().lang === 'ar' ? 'تعذر الحفظ — تم استرجاع النسخة السابقة' : 'Save failed — reverted',
            tone: 'error',
          });
          soundManager.play('sync_failed');
        }
      } else {
        rollbackSnapshot = null;
      }
    }, 300);
  };

  return {
    currentDeviceId: initialDeviceId,
    uid: null,
    lang: 'ar',
    activeScreen: 'home',
    screenHistory: [],
    commandPaletteOpen: false,
    coreState: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle',
    viewStates: {},
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    notificationPrefsLoading: false,
    lastSyncError: null,
    notificationPrefs: initialPrefs,
    modeShockwave: null,
    newDeviceBadgeCount: 1,
    devices: [
      {
        id: initialDeviceId,
        nameAr: 'هذا المتصفح (الجهاز الحالي)',
        nameEn: 'This Browser (Current Device)',
        platform: 'web',
        location: 'بغداد · جلسة مشفّرة',
        lastActive: 'الآن',
        current: true,
        trusted: true,
      },
      {
        id: 'dev_pixel_9_pro',
        nameAr: 'Pixel 9 Pro — تطبيق الجوال',
        nameEn: 'Pixel 9 Pro Mobile',
        platform: 'mobile',
        location: 'بغداد · PWA',
        lastActive: 'منذ 14 دقيقة',
        current: false,
        trusted: true,
      },
      {
        id: 'dev_radar_unknown_edge',
        nameAr: 'Windows Edge — محاولة دخول جديدة',
        nameEn: 'Windows Edge — New Sign-in Ping',
        platform: 'desktop',
        location: 'أربيل · IP غير معروف',
        lastActive: 'منذ لحظات',
        current: false,
        trusted: false,
        isNewAlert: true,
      },
    ],
    sheets: INITIAL_SHEETS,
    activeSheetId: INITIAL_SHEETS[0].id,
    assistantTurns: [
      {
        id: 'turn_welcome',
        role: 'assistant',
        text: 'أهلاً بك في النواة الذكية (THE CORE). يمكنك سؤالي عن تحليل جداولك، إنشاء صيغ، أو تغيير بيئة العمل فوراً.',
        timestamp: 'الآن',
      },
    ],
    toasts: [],
    authenticated: false,
    authMethod: null,
    userEmail: 'ali@morrow.app',
    userDisplayName: 'علي محمد',
    onboardingDone: true,

    setLang: (lang) => {
      const { activeTheme, activeMode } = get().notificationPrefs;
      applyThemeTokensToDocument(activeTheme, activeMode, lang === 'ar' ? 'rtl' : 'ltr');
      soundManager.play('toggle_on');
      set({ lang });
    },

    navigate: (screen) => {
      const cur = get().activeScreen;
      if (cur === screen) return;
      soundManager.play('navigate');
      set((s) => ({
        activeScreen: screen,
        screenHistory: [...s.screenHistory.slice(-12), cur],
      }));
    },

    goBack: () => {
      const hist = get().screenHistory;
      if (hist.length === 0) return;
      const prev = hist[hist.length - 1];
      soundManager.play('back');
      set({ activeScreen: prev, screenHistory: hist.slice(0, -1) });
    },

    setCommandPaletteOpen: (open) => {
      soundManager.play(open ? 'open_panel' : 'close_panel');
      set({ commandPaletteOpen: open });
    },

    setCoreState: (coreState) => set({ coreState }),

    setViewState: (screen, state) =>
      set((s) => ({ viewStates: { ...s.viewStates, [screen]: state } })),

    setOfflineStatus: (offline) =>
      set({
        isOffline: offline,
        coreState: offline ? 'offline' : 'idle',
      }),

    pushToast: (toast) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          get().dismissToast(id);
        }, 4200);
      }
    },

    dismissToast: (id) =>
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    dismissNewDeviceAlert: () => {
      soundManager.play('success');
      set((s) => ({
        newDeviceBadgeCount: 0,
        devices: s.devices.map((d) => ({ ...d, isNewAlert: false, trusted: true })),
      }));
    },

    revokeDevice: (deviceId) => {
      soundManager.play('delete');
      set((s) => {
        const remaining = s.devices.filter((d) => d.id !== deviceId);
        return {
          devices: remaining,
          newDeviceBadgeCount: remaining.filter((d) => d.isNewAlert).length,
        };
      });
      get().pushToast({
        title: get().lang === 'ar' ? 'تم إنهاء جلسة الجهاز عن بُعد' : 'Device session revoked remotely',
        tone: 'success',
      });
    },

    completeAuth: ({ uid, email, displayName, method }) => {
      soundManager.play('login_success');
      set({
        uid,
        authenticated: true,
        authMethod: method,
        userEmail: email,
        userDisplayName: displayName,
        activeScreen: 'home',
      });
      get().hydrateNotificationPrefs(uid);
    },

    signOutUser: () => {
      soundManager.play('logout');
      if (activeFirestoreUnsub) {
        activeFirestoreUnsub();
        activeFirestoreUnsub = null;
      }
      set({
        authenticated: false,
        authMethod: null,
        uid: null,
        activeScreen: 'signin',
      });
    },

    completeOnboarding: () => {
      soundManager.play('success');
      set({ onboardingDone: true, activeScreen: 'signin' });
    },

    hydrateNotificationPrefs: (uid) => {
      if (activeFirestoreUnsub) {
        activeFirestoreUnsub();
        activeFirestoreUnsub = null;
      }
      set({ uid, notificationPrefsLoading: true, lastSyncError: null });

      const deviceId = get().currentDeviceId;
      const canSubscribeFirestore =
        Boolean(uid) &&
        isFirestoreConfigured &&
        Boolean(auth.currentUser && auth.currentUser.uid === uid && VALID_ID_RE.test(uid));

      if (!canSubscribeFirestore) {
        const local = loadLocalPrefs(deviceId);
        pushToSoundManager(local);
        applyThemeTokensToDocument(local.activeTheme, local.activeMode, get().lang === 'ar' ? 'rtl' : 'ltr');
        set({ notificationPrefs: local, notificationPrefsLoading: false });
        return () => {};
      }

      const docRef = doc(db, 'users', uid, 'settings', 'notifications');
      const unsub = onSnapshot(
        docRef,
        (snap) => {
          if (!snap.exists()) {
            set({ notificationPrefsLoading: false });
            return;
          }
          const data = snap.data() as Partial<NotificationPrefsDoc> | undefined;
          if (!data) {
            set({ notificationPrefsLoading: false });
            return;
          }
          // Ignore snapshots echoed from the current device
          if (data.updatedByDevice === deviceId) {
            set({ notificationPrefsLoading: false });
            return;
          }
          const cur = get().notificationPrefs;
          const merged: NotificationPrefsDoc = {
            channels: {
              security: { ...cur.channels.security, ...(data.channels?.security ?? {}) },
              reminders: { ...cur.channels.reminders, ...(data.channels?.reminders ?? {}) },
              sync: { ...cur.channels.sync, ...(data.channels?.sync ?? {}) },
              news: { ...cur.channels.news, ...(data.channels?.news ?? {}) },
            },
            quietHours: { ...cur.quietHours, ...(data.quietHours ?? {}) },
            masterSound: typeof data.masterSound === 'boolean' ? data.masterSound : cur.masterSound,
            volumes: {
              music: typeof data.volumes?.music === 'number' ? data.volumes.music : cur.volumes.music,
              sfx: typeof data.volumes?.sfx === 'number' ? data.volumes.sfx : cur.volumes.sfx,
            },
            activeTheme:
              data.activeTheme && data.activeTheme in THEMES ? data.activeTheme : cur.activeTheme,
            activeMode: data.activeMode ?? cur.activeMode,
            updatedAt: new Date().toISOString(),
            updatedByDevice: data.updatedByDevice || 'remote',
          };
          persistLocalPrefs(merged);
          pushToSoundManager(merged);
          applyThemeTokensToDocument(
            merged.activeTheme,
            merged.activeMode,
            get().lang === 'ar' ? 'rtl' : 'ltr'
          );
          set({ notificationPrefs: merged, notificationPrefsLoading: false });
          soundManager.play('notify_sync');
        },
        (error) => {
          set({
            notificationPrefsLoading: false,
            lastSyncError: error.message,
          });
        }
      );

      activeFirestoreUnsub = unsub;
      return unsub;
    },

    setChannel: (id, patch) => {
      const prev = get().notificationPrefs;
      const next: NotificationPrefsDoc = {
        ...prev,
        channels: {
          ...prev.channels,
          [id]: { ...prev.channels[id], ...patch },
        },
        updatedAt: new Date().toISOString(),
        updatedByDevice: get().currentDeviceId,
      };
      set({ notificationPrefs: next });
      schedulePersistPrefs(next, prev);
    },

    setQuietHours: (patch) => {
      const prev = get().notificationPrefs;
      const next: NotificationPrefsDoc = {
        ...prev,
        quietHours: { ...prev.quietHours, ...patch },
        updatedAt: new Date().toISOString(),
        updatedByDevice: get().currentDeviceId,
      };
      set({ notificationPrefs: next });
      schedulePersistPrefs(next, prev);
    },

    setVolumes: (patch) => {
      const prev = get().notificationPrefs;
      const next: NotificationPrefsDoc = {
        ...prev,
        volumes: {
          music:
            typeof patch.music === 'number'
              ? Math.max(0, Math.min(1, patch.music))
              : prev.volumes.music,
          sfx:
            typeof patch.sfx === 'number'
              ? Math.max(0, Math.min(1, patch.sfx))
              : prev.volumes.sfx,
        },
        updatedAt: new Date().toISOString(),
        updatedByDevice: get().currentDeviceId,
      };
      set({ notificationPrefs: next });
      schedulePersistPrefs(next, prev);
    },

    setMasterSound: (enabled) => {
      const prev = get().notificationPrefs;
      const next: NotificationPrefsDoc = {
        ...prev,
        masterSound: enabled,
        updatedAt: new Date().toISOString(),
        updatedByDevice: get().currentDeviceId,
      };
      set({ notificationPrefs: next });
      schedulePersistPrefs(next, prev);
    },

    setTheme: (themeId) => {
      const prev = get().notificationPrefs;
      const next: NotificationPrefsDoc = {
        ...prev,
        activeTheme: themeId,
        updatedAt: new Date().toISOString(),
        updatedByDevice: get().currentDeviceId,
      };
      const tokens = applyThemeTokensToDocument(
        themeId,
        next.activeMode,
        get().lang === 'ar' ? 'rtl' : 'ltr'
      );
      soundManager.setPalette(tokens.soundPalette);
      soundManager.play('mode_change');
      set({ notificationPrefs: next });
      schedulePersistPrefs(next, prev);
    },

    setMode: (modeId, coords) => {
      const prev = get().notificationPrefs;
      const next: NotificationPrefsDoc = {
        ...prev,
        activeMode: modeId,
        updatedAt: new Date().toISOString(),
        updatedByDevice: get().currentDeviceId,
      };
      const tokens = applyThemeTokensToDocument(
        next.activeTheme,
        modeId,
        get().lang === 'ar' ? 'rtl' : 'ltr'
      );
      soundManager.setPalette(tokens.soundPalette);
      soundManager.play('mode_change');
      set({
        notificationPrefs: next,
        modeShockwave: coords
          ? { id: Date.now(), x: coords.x, y: coords.y, color: tokens.accent }
          : { id: Date.now(), x: window.innerWidth / 2, y: window.innerHeight / 2, color: tokens.accent },
      });
      schedulePersistPrefs(next, prev);
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          set((s) => (s.modeShockwave ? { modeShockwave: null } : {}));
        }, 720);
      }
    },

    setActiveSheetId: (id) => {
      soundManager.play('tab_switch');
      set({ activeSheetId: id });
    },

    updateSheetCell: (sheetId, cellKey, raw) => {
      set((s) => ({
        sheets: s.sheets.map((sh) =>
          sh.id === sheetId
            ? {
                ...sh,
                updatedAt: 'الآن',
                cells: { ...sh.cells, [cellKey]: { raw } },
              }
            : sh
        ),
      }));
      soundManager.play('button_tap');
    },

    runSheetAiCommand: (sheetId, prompt) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      soundManager.play('ai_thinking_start');
      set({ coreState: 'thinking' });
      window.setTimeout(() => {
        set((s) => ({
          coreState: 'idle',
          sheets: s.sheets.map((sh) => {
            if (sh.id !== sheetId) return sh;
            if (/chart|رسم|مخطط/i.test(trimmed)) {
              return {
                ...sh,
                updatedAt: 'الآن · AI',
                chart: {
                  id: `chart_${Date.now()}`,
                  titleAr: 'تحليل القيم التوليدي بالذكاء الاصطناعي',
                  titleEn: 'AI-Generated Breakdown',
                  labels: ['الإمداد', 'النقل', 'التسويات', 'الإجمالي'],
                  values: [39500, 17200, 11400, 68100],
                },
              };
            }
            return {
              ...sh,
              updatedAt: 'الآن · AI',
              cells: {
                ...sh.cells,
                A6: { raw: 'احتياطي AI' },
                B6: { raw: '9500' },
                C6: { raw: '8200' },
                D6: { raw: '=B6-C6' },
                E6: { raw: '=C6/B6*100' },
              },
            };
          }),
        }));
        soundManager.play('ai_thinking_finish');
        get().pushToast({
          title: get().lang === 'ar' ? 'نفّذت النواة أمر الجدول' : 'AI sheet command applied',
          tone: 'success',
        });
      }, 420);
    },

    createBlankSheet: (titleAr, titleEn) => {
      const id = `sheet_${Date.now()}`;
      const blank: SpatialSheet = {
        id,
        titleAr,
        titleEn,
        updatedAt: 'الآن',
        rows: 6,
        cols: 5,
        cells: {
          A1: { raw: 'العنصر' },
          B1: { raw: 'القيمة' },
          C1: { raw: 'الضريبة 15%' },
          A2: { raw: 'الخدمة السحابية' },
          B2: { raw: '1200' },
          C2: { raw: '=B2*0.15' },
          A3: { raw: 'الإجمالي' },
          B3: { raw: '=SUM(B2:B2)' },
          C3: { raw: '=SUM(C2:C2)' },
        },
      };
      soundManager.play('success');
      set((s) => ({
        sheets: [blank, ...s.sheets],
        activeSheetId: id,
        activeScreen: 'sheet_editor',
      }));
    },

    sendAssistantPrompt: async (text) => {
      const clean = text.trim();
      if (!clean) return;
      soundManager.play('ai_thinking_start');
      const userMsg: AssistantTurn = {
        id: `u_${Date.now()}`,
        role: 'user',
        text: clean,
        timestamp: 'الآن',
      };
      set((s) => ({
        coreState: 'thinking',
        assistantTurns: [...s.assistantTurns, userMsg],
      }));

      await new Promise((r) => setTimeout(r, 520));

      const isAr = get().lang === 'ar';
      let reply = isAr
        ? `تم تحليل طلبك «${clean}»: مجموع مصروفات Q4 الفعلية هو 68,100 بتوفير 4,400 عن المخطط (93.9%). هل ترغب بفتح محرر الجداول أم تفعيل وضع التدقيق؟`
        : `Analyzed "${clean}": Q4 actual spend is 68,100 with 4,400 saved vs plan (93.9%). Would you like to open Spatial Sheets or switch to Audit Mode?`;

      if (/صوت|موسيقى|sound|audio/i.test(clean)) {
        reply = isAr
          ? 'تم فحص مدير الصوت المركزي: الموسيقى مضبوطة عند -23 LUFS بمستوى 20% وتنخفض تلقائياً إلى 40% أثناء التنبيهات.'
          : 'SoundManager verified: Ambient loop calibrated at -23 LUFS (20% default), auto-ducking to 40% during SFX.';
      }

      const aiMsg: AssistantTurn = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: reply,
        timestamp: 'الآن',
      };
      set((s) => ({
        coreState: s.isOffline ? 'offline' : 'idle',
        assistantTurns: [...s.assistantTurns, aiMsg],
      }));
      soundManager.play('ai_thinking_finish');
    },
  };
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Bell,
  CalendarClock,
  Camera,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileJson,
  FolderOpen,
  HardDrive,
  Info,
  KeyRound,
  Lightbulb,
  Lock,
  LogOut,
  Mail,
  MessageSquarePlus,
  Phone,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import {
  clearSession,
  googleQuickSignInApi,
  loginWithPasswordApi,
  registerWithPasswordApi,
  requestPhoneOtpApi,
  signInWithFirebaseGoogle,
  updateUserProfileApi,
  verifyPhoneOtpApi,
} from '../lib/authClient';
import { getAccessToken, googleSignIn, initWorkspaceAuth } from '../lib/firebase';
import {
  deleteDriveBackupFile,
  downloadDriveBackupFile,
  listDriveBackupFiles,
  uploadDriveBackupFile,
  type GoogleDriveBackupFile,
} from '../lib/googleWorkspace';
import { compressImageFileToDataUrl } from '../lib/imageUpload';
import type {
  AppDatabaseState,
  AuthUser,
  BackupCloudProvider,
  RecycleBinEntry,
  SecurityPrefs,
  SmartSyncCheckpoint,
  WorkspaceNoteCategory,
  WorkspaceNoteItem,
} from '../types/agency';
import { normalizeArabic } from '../utils/agencyLogic';
import {
  buildNextCheckpoint,
  compressAndVerifyWorkspacePayload,
  computeWorkspaceDiff,
  countStateAttachments,
  evaluateSmartBackupReminders,
  stageLocalRecoveryBackup,
} from '../utils/smartSyncEngine';
import {
  directShareStructuredExport,
  generateStructuredWorkspaceZip,
  triggerBlobDownload,
} from '../utils/structuredExport';
import {
  SmartSyncProgressOverlay,
  type SyncStageIndex,
} from './SmartSyncProgressOverlay';
import { StructuredExportModal } from './StructuredExportModal';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';

const GoogleGsiSvg: React.FC = () => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  >
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export type AccountHubTab = 'overview' | 'sync_export' | 'notes' | 'security_bin';

interface AccountSecurityHubViewProps {
  state: AppDatabaseState;
  authUser: AuthUser | null;
  requireLoginOnStart: boolean;
  securityPrefs: SecurityPrefs;
  recycleBin: RecycleBinEntry[];
  workspaceNotes: WorkspaceNoteItem[];
  onAuthenticated: (user: AuthUser) => void;
  onLoggedOut: () => void;
  onToggleRequireLogin: (val: boolean) => void;
  onUpdateSecurityPrefs: (patch: Partial<SecurityPrefs>) => void;
  onUpdateSmartSyncCheckpoint: (checkpoint: SmartSyncCheckpoint) => void;
  onAddNote: (input: {
    title: string;
    content: string;
    category: WorkspaceNoteCategory;
    pinned?: boolean;
  }) => void;
  onUpdateNote: (
    noteId: string,
    patch: Partial<Pick<WorkspaceNoteItem, 'title' | 'content' | 'category' | 'pinned'>>
  ) => void;
  onDeleteNote: (noteId: string) => void;
  onRestoreRecycleBinItem: (entryId: string) => void;
  onPurgeRecycleBinItem: (entryId: string) => void;
  onClearRecycleBin: () => void;
  onImportWorkspaceJson: (rawJson: string) => void;
  onSyncServer: () => Promise<void>;
  onRestoreServer: () => Promise<boolean>;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
  initialTab?: AccountHubTab;
}

const NOTE_CATEGORIES: Array<{
  id: WorkspaceNoteCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'quick', label: 'ملاحظة سريعة', icon: StickyNote },
  { id: 'idea', label: 'فكرة تطويرية', icon: Lightbulb },
  { id: 'suggestion', label: 'اقتراح', icon: MessageSquarePlus },
  { id: 'info', label: 'معلومة', icon: Info },
];

function formatDateTimeArabic(iso?: string): string {
  if (!iso) return 'لم يُسجَّل حفظ بعد';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.toLocaleDateString('ar-IQ')} · ${d.toLocaleTimeString('ar-IQ', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return iso;
  }
}

export const AccountSecurityHubView: React.FC<AccountSecurityHubViewProps> = ({
  state,
  authUser,
  requireLoginOnStart,
  securityPrefs,
  recycleBin,
  workspaceNotes,
  onAuthenticated,
  onLoggedOut,
  onToggleRequireLogin,
  onUpdateSecurityPrefs,
  onUpdateSmartSyncCheckpoint,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onRestoreRecycleBinItem,
  onPurgeRecycleBinItem,
  onClearRecycleBin,
  onImportWorkspaceJson,
  onSyncServer,
  onRestoreServer,
  onNotifySuccess,
  onNotifyError,
  initialTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<AccountHubTab>(initialTab);

  // Account login inline panel state
  const [loginMethod, setLoginMethod] = useState<'google' | 'username' | 'phone'>('google');
  const [isRegister, setIsRegister] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [phoneSubMode, setPhoneSubMode] = useState<'otp' | 'password'>('otp');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Cloud preferences drafts
  const [driveEmailDraft, setDriveEmailDraft] = useState(
    securityPrefs.driveAccountMeta?.dedicatedEmail || ''
  );
  const [driveFolderDraft, setDriveFolderDraft] = useState(
    securityPrefs.driveAccountMeta?.folderLabel || 'Morrow_Drive_Backups'
  );
  const [driveHasToken, setDriveHasToken] = useState(false);
  const [driveConnectedEmail, setDriveConnectedEmail] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveBackupFile[]>([]);
  const [driveBusy, setDriveBusy] = useState(false);
  const [pendingDriveConfirm, setPendingDriveConfirm] = useState<
    | { kind: 'delete'; file: GoogleDriveBackupFile }
    | { kind: 'overwrite'; file: GoogleDriveBackupFile }
    | null
  >(null);

  const [secondaryProvider, setSecondaryProvider] = useState<BackupCloudProvider>(
    securityPrefs.secondaryCloud?.provider || 'mega'
  );
  const [secondaryEmailDraft, setSecondaryEmailDraft] = useState(
    securityPrefs.secondaryCloud?.accountEmail || ''
  );
  const [secondaryFolderDraft, setSecondaryFolderDraft] = useState(
    securityPrefs.secondaryCloud?.folderName || 'Morrow_Backups'
  );

  // Calm Smart Sync Progress Overlay & Structured Export modal
  const [syncOverlayOpen, setSyncOverlayOpen] = useState(false);
  const [syncStage, setSyncStage] = useState<SyncStageIndex>(0);
  const [syncOverlayTitle, setSyncOverlayTitle] = useState('الحفظ والمزامنة الذكية');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [calmBannerMsg, setCalmBannerMsg] = useState<{
    tone: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>([]);

  // Notes & Ideas sub-section state
  const [noteSearch, setNoteSearch] = useState('');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<'all' | WorkspaceNoteCategory>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitleDraft, setNoteTitleDraft] = useState('');
  const [noteContentDraft, setNoteContentDraft] = useState('');
  const [noteCategoryDraft, setNoteCategoryDraft] = useState<WorkspaceNoteCategory>('quick');
  const [notePinnedDraft, setNotePinnedDraft] = useState(false);

  // Security PIN draft
  const [pinDraft, setPinDraft] = useState(securityPrefs.privacyPin || '');

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPinDraft(securityPrefs.privacyPin || '');
  }, [securityPrefs.privacyPin]);

  useEffect(() => {
    setDriveEmailDraft(securityPrefs.driveAccountMeta?.dedicatedEmail || '');
    setDriveFolderDraft(
      securityPrefs.driveAccountMeta?.folderLabel || 'Morrow_Drive_Backups'
    );
  }, [securityPrefs.driveAccountMeta]);

  useEffect(() => {
    if (securityPrefs.secondaryCloud) {
      setSecondaryProvider(securityPrefs.secondaryCloud.provider);
      setSecondaryEmailDraft(securityPrefs.secondaryCloud.accountEmail || '');
      setSecondaryFolderDraft(
        securityPrefs.secondaryCloud.folderName || 'Morrow_Backups'
      );
    }
  }, [securityPrefs.secondaryCloud]);

  const refreshDriveFiles = async (folderName?: string) => {
    const token = await getAccessToken();
    if (!token) {
      setDriveHasToken(false);
      return;
    }
    try {
      setDriveBusy(true);
      const files = await listDriveBackupFiles(folderName || driveFolderDraft);
      setDriveFiles(files);
      setDriveHasToken(true);
    } catch {
      // keep existing UI state gracefully
    } finally {
      setDriveBusy(false);
    }
  };

  useEffect(() => {
    const unsub = initWorkspaceAuth(
      (fbUser) => {
        setDriveHasToken(true);
        setDriveConnectedEmail(fbUser.email || null);
        void refreshDriveFiles(securityPrefs.driveAccountMeta?.folderLabel);
      },
      () => {
        setDriveHasToken(false);
        setDriveConnectedEmail(null);
        setDriveFiles([]);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkpoint = securityPrefs.smartSync;
  const currentDiff = useMemo(
    () => computeWorkspaceDiff(state, checkpoint),
    [state, checkpoint]
  );
  const attachmentsCount = useMemo(
    () => countStateAttachments(state) + (authUser?.avatarUrl ? 1 : 0),
    [state, authUser?.avatarUrl]
  );
  const activeReminders = useMemo(
    () =>
      evaluateSmartBackupReminders(state, checkpoint).filter(
        (r) => !dismissedReminderIds.includes(r.id)
      ),
    [state, checkpoint, dismissedReminderIds]
  );

  // --- Account Auth Handlers ---
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !authUser) return;
    try {
      setAvatarBusy(true);
      const compressed = await compressImageFileToDataUrl(file, {
        maxDim: 240,
        maxChars: 220000,
        quality: 0.82,
      });
      const updated = await updateUserProfileApi({ avatarUrl: compressed });
      onAuthenticated(updated);
      onNotifySuccess('تم تحديث الصورة الشخصية وحفظها بأمان.');
    } catch (err) {
      onNotifyError(err instanceof Error ? err.message : 'تعذر تحديث الصورة الشخصية.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleQuickGmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthBusy(true);
      setAuthError('');
      const session = await googleQuickSignInApi({
        email: emailInput.trim(),
        displayName: displayNameInput.trim(),
      });
      onAuthenticated(session.user);
      setEmailInput('');
      setDisplayNameInput('');
      onNotifySuccess(`مرحباً ${session.user.displayName}، تم ربط حسابك بنجاح.`);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthBusy(true);
      setAuthError('');
      const session = isRegister
        ? await registerWithPasswordApi({
            mode: 'username',
            displayName: displayNameInput.trim() || usernameInput.trim(),
            username: usernameInput.trim(),
            password: passwordInput,
          })
        : await loginWithPasswordApi({
            mode: 'username',
            identifier: usernameInput.trim(),
            password: passwordInput,
          });
      onAuthenticated(session.user);
      setPasswordInput('');
      onNotifySuccess(`تم تسجيل الدخول بنجاح (${session.user.displayName}).`);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول باليوزر.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAuthBusy(true);
      setAuthError('');
      if (phoneSubMode === 'password') {
        const session = isRegister
          ? await registerWithPasswordApi({
              mode: 'phone',
              displayName: displayNameInput.trim() || phoneInput.trim(),
              phone: phoneInput.trim(),
              password: passwordInput,
            })
          : await loginWithPasswordApi({
              mode: 'phone',
              identifier: phoneInput.trim(),
              password: passwordInput,
            });
        onAuthenticated(session.user);
        setPasswordInput('');
        onNotifySuccess('تم الدخول برقم الهاتف بنجاح.');
        return;
      }

      if (!otpSent) {
        const res = await requestPhoneOtpApi(phoneInput.trim());
        setOtpSent(true);
        if (res.demoCode) setDemoOtpHint(res.demoCode);
      } else {
        const session = await verifyPhoneOtpApi({
          phone: phoneInput.trim(),
          code: otpCode.trim(),
          displayName: displayNameInput.trim(),
        });
        onAuthenticated(session.user);
        setOtpSent(false);
        setOtpCode('');
        setDemoOtpHint('');
        onNotifySuccess('تم التحقق من رقم الهاتف وتسجيل الدخول.');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'تعذر التحقق من رقم الهاتف.');
    } finally {
      setAuthBusy(false);
    }
  };

  // --- Google Sign-In & Drive API Handlers ---
  const handleConnectGoogleAccount = async (options?: {
    selectAccount?: boolean;
    forDedicatedDrive?: boolean;
  }) => {
    try {
      setAuthBusy(true);
      setAuthError('');
      let connectedEmail = driveEmailDraft.trim();
      if (options?.forDedicatedDrive && authUser) {
        const fbRes = await googleSignIn({
          selectAccount: options?.selectAccount ?? true,
          loginHint: driveEmailDraft.trim() || undefined,
        });
        connectedEmail = fbRes.user.email || connectedEmail;
      } else {
        const session = await signInWithFirebaseGoogle({
          selectAccount: options?.selectAccount ?? true,
          loginHint: options?.forDedicatedDrive
            ? driveEmailDraft.trim() || undefined
            : undefined,
        });
        onAuthenticated(session.user);
        connectedEmail = session.user.email || connectedEmail;
      }
      setDriveHasToken(true);
      setDriveConnectedEmail(connectedEmail || null);
      if (connectedEmail) {
        setDriveEmailDraft(connectedEmail);
      }
      onUpdateSecurityPrefs({
        driveAccountMeta: {
          ...(securityPrefs.driveAccountMeta || {}),
          dedicatedEmail: connectedEmail || driveEmailDraft.trim(),
          folderLabel: driveFolderDraft.trim() || 'Morrow_Drive_Backups',
        },
      });
      await refreshDriveFiles(driveFolderDraft.trim() || 'Morrow_Drive_Backups');
      onNotifySuccess(
        connectedEmail
          ? `تم ربط حساب Google (${connectedEmail}) مع Google Drive بأمان.`
          : 'تم ربط حساب Google Drive بنجاح.'
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول عبر Google.';
      setAuthError(msg);
      onNotifyError(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUploadStructuredToDrive = async (
    overwriteFile?: GoogleDriveBackupFile
  ) => {
    setPendingDriveConfirm(null);
    setSyncOverlayTitle(
      overwriteFile
        ? 'تحديث النسخة المحفوظة على Google Drive'
        : 'رفع النسخة المنظّمة إلى Google Drive'
    );
    setSyncStage(0);
    setSyncOverlayOpen(true);

    try {
      await waitCalmStep(200);
      setSyncStage(1);
      const summary = await generateStructuredWorkspaceZip({
        state,
        authUser,
        appName: 'Morrow',
      });
      setSyncStage(2);
      const uploaded = await uploadDriveBackupFile({
        blob: summary.blob,
        fileName: overwriteFile ? overwriteFile.name : summary.zipFilename,
        folderName: driveFolderDraft.trim() || 'Morrow_Drive_Backups',
        description: `نسخة Morrow المنظّمة (${summary.rootFolder}) — ${state.agencies.length} وكالة و${state.persons.length} مستفيد`,
        existingFileId: overwriteFile?.id,
      });

      const diff = computeWorkspaceDiff(state, checkpoint);
      onUpdateSmartSyncCheckpoint(
        buildNextCheckpoint({
          prevCheckpoint: checkpoint,
          diff,
          mode: 'cloud',
          checksum: summary.crc32Hex,
          compressedBytes: summary.compressedBytes,
          isStructuredExport: true,
        })
      );
      onUpdateSecurityPrefs({
        driveAccountMeta: {
          ...(securityPrefs.driveAccountMeta || {}),
          dedicatedEmail: driveConnectedEmail || driveEmailDraft.trim(),
          folderLabel: driveFolderDraft.trim() || 'Morrow_Drive_Backups',
          lastExportedAt: new Date().toISOString(),
        },
      });
      await refreshDriveFiles(driveFolderDraft.trim() || 'Morrow_Drive_Backups');

      setSyncStage(3);
      await waitCalmStep(280);
      setSyncOverlayOpen(false);
      onNotifySuccess(`تم رفع النسخة إلى Google Drive بنجاح (${uploaded.name}).`);
    } catch (err) {
      setSyncOverlayOpen(false);
      onNotifyError(
        err instanceof Error ? err.message : 'تعذر رفع النسخة إلى Google Drive.'
      );
    }
  };

  const handleDownloadDriveBackup = async (file: GoogleDriveBackupFile) => {
    try {
      setDriveBusy(true);
      const blob = await downloadDriveBackupFile(file.id);
      triggerBlobDownload(blob, file.name);
      onNotifySuccess(`تم تنزيل الملف (${file.name}) من Google Drive.`);
    } catch (err) {
      onNotifyError(
        err instanceof Error ? err.message : 'تعذر تنزيل الملف من Google Drive.'
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const handleConfirmDeleteDriveBackup = async (file: GoogleDriveBackupFile) => {
    try {
      setPendingDriveConfirm(null);
      setDriveBusy(true);
      await deleteDriveBackupFile(file.id);
      await refreshDriveFiles(driveFolderDraft.trim() || 'Morrow_Drive_Backups');
      onNotifySuccess(`تم حذف النسخة (${file.name}) من Google Drive.`);
    } catch (err) {
      onNotifyError(
        err instanceof Error ? err.message : 'تعذر حذف الملف من Google Drive.'
      );
    } finally {
      setDriveBusy(false);
    }
  };

  // --- Calm Multi-Stage Smart Sync Engine Runner ---
  const waitCalmStep = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const runSmartSaveEngine = async (mode: 'manual' | 'weekly_auto' | 'cloud') => {
    const diff = computeWorkspaceDiff(state, checkpoint);

    if (diff.status === 'unchanged') {
      const msg =
        mode === 'weekly_auto'
          ? 'بياناتك محفوظة ومحدّثة بالكامل، ولا يوجد أي تغيير جديد يتطلب الحفظ.'
          : 'كل بياناتك محفوظة ومحدّثة بالفعل، ولا توجد أي تغييرات غير محفوظة.';
      setCalmBannerMsg({ tone: 'success', text: msg });
      if (checkpoint) {
        onUpdateSmartSyncCheckpoint({
          ...checkpoint,
          lastCheckedAt: new Date().toISOString(),
        });
      }
      onNotifySuccess(msg);
      return;
    }

    setSyncOverlayTitle(
      mode === 'weekly_auto'
        ? 'الفحص والحفظ الأسبوعي الذكي'
        : mode === 'cloud'
        ? 'المزامنة السحابية الآمنة'
        : 'الحفظ الذكي للبيانات'
    );
    setSyncStage(0);
    setSyncOverlayOpen(true);

    try {
      await waitCalmStep(240);
      setSyncStage(1);
      const compressed = await compressAndVerifyWorkspacePayload(state);
      if (!compressed.verified) {
        throw new Error('تعذر التحقق من سلامة حزمة الضغط؛ لم تتغير بياناتك.');
      }

      // Stage local recovery copy before remote sync
      stageLocalRecoveryBackup(compressed);

      await waitCalmStep(260);
      setSyncStage(2);

      let cloudAttemptedAndFailed = false;
      if (authUser && (mode === 'cloud' || mode === 'manual' || mode === 'weekly_auto')) {
        try {
          await onSyncServer();
        } catch {
          cloudAttemptedAndFailed = true;
        }
      }

      const driveToken = await getAccessToken();
      if (driveToken) {
        try {
          const summary = await generateStructuredWorkspaceZip({
            state,
            authUser,
            appName: 'Morrow',
          });
          await uploadDriveBackupFile({
            blob: summary.blob,
            fileName: summary.zipFilename,
            folderName: driveFolderDraft.trim() || 'Morrow_Drive_Backups',
            description: `مزامنة ذكية تلقائية — ${diff.summaryArabic}`,
          });
          onUpdateSecurityPrefs({
            driveAccountMeta: {
              ...(securityPrefs.driveAccountMeta || {}),
              lastExportedAt: new Date().toISOString(),
            },
          });
          await refreshDriveFiles(driveFolderDraft.trim() || 'Morrow_Drive_Backups');
        } catch {
          cloudAttemptedAndFailed = true;
        }
      }

      const nextCp = buildNextCheckpoint({
        prevCheckpoint: checkpoint,
        diff,
        mode: cloudAttemptedAndFailed ? 'manual' : mode,
        checksum: compressed.integrityChecksum,
        compressedBytes: compressed.compressedBytes,
      });
      onUpdateSmartSyncCheckpoint(nextCp);

      if (securityPrefs.secondaryCloud?.provider && securityPrefs.secondaryCloud.provider !== 'none') {
        onUpdateSecurityPrefs({
          secondaryCloud: {
            ...securityPrefs.secondaryCloud,
            lastSyncedAt: new Date().toISOString(),
          },
        });
      }

      setSyncStage(3);
      await waitCalmStep(320);
      setSyncOverlayOpen(false);

      if (cloudAttemptedAndFailed) {
        const msg =
          'تم حفظ البيانات محلياً والتحقق من سلامتها بنجاح، وسيتم استكمال المزامنة السحابية تلقائياً عند توفر الاتصال.';
        setCalmBannerMsg({ tone: 'warning', text: msg });
        onNotifySuccess(msg);
      } else {
        const msg =
          diff.status === 'minor_edit'
            ? 'تم تحديث نقطة الحفظ القائمة بالتعديلات الأخيرة بأمان دون تكرار.'
            : 'تم ضغط البيانات وحفظها والتحقق من سلامتها بنجاح.';
        setCalmBannerMsg({ tone: 'success', text: msg });
        onNotifySuccess(msg);
      }
    } catch (err) {
      setSyncOverlayOpen(false);
      const errMsg =
        err instanceof Error
          ? err.message
          : 'حدث عائق مؤقت؛ تم الحفاظ على بياناتك محلياً بأمان.';
      setCalmBannerMsg({ tone: 'warning', text: errMsg });
      onNotifyError(errMsg);
    }
  };

  const handleRunStructuredExport = async (shareDirectly: boolean) => {
    setExportModalOpen(false);
    setSyncOverlayTitle(
      shareDirectly ? 'تجهيز الحزمة للمشاركة المباشرة' : 'تجهيز المجلد المنظّم المضغوط'
    );
    setSyncStage(0);
    setSyncOverlayOpen(true);

    try {
      await waitCalmStep(200);
      setSyncStage(1);
      const summary = await generateStructuredWorkspaceZip({
        state,
        authUser,
        appName: 'Morrow',
      });
      setSyncStage(2);
      await waitCalmStep(220);

      if (shareDirectly) {
        const shareSummaryText = `حزمة بيانات Morrow المنظمة (${summary.rootFolder}) — ${state.agencies.length} وكالة و${state.persons.length} مستفيد.`;
        const outcome = await directShareStructuredExport(summary, shareSummaryText);
        onNotifySuccess(
          outcome === 'shared'
            ? 'تم فتح نافذة المشاركة المباشرة لحزمة البيانات المنظمة.'
            : `تم تنزيل الحزمة المنظمة (${summary.zipFilename}) بنجاح.`
        );
      } else {
        triggerBlobDownload(summary.blob, summary.zipFilename);
        onNotifySuccess(`تم إنشاء وتنزيل المجلد المنظّم: ${summary.zipFilename}`);
      }

      const diff = computeWorkspaceDiff(state, checkpoint);
      onUpdateSmartSyncCheckpoint(
        buildNextCheckpoint({
          prevCheckpoint: checkpoint,
          diff,
          mode: 'manual',
          checksum: summary.crc32Hex,
          compressedBytes: summary.compressedBytes,
          isStructuredExport: true,
        })
      );
      onUpdateSecurityPrefs({
        driveAccountMeta: {
          ...(securityPrefs.driveAccountMeta || {}),
          lastExportedAt: new Date().toISOString(),
        },
      });

      setSyncStage(3);
      await waitCalmStep(280);
      setSyncOverlayOpen(false);
    } catch (err) {
      setSyncOverlayOpen(false);
      onNotifyError(
        err instanceof Error ? err.message : 'تعذر إنشاء حزمة التصدير المنظم.'
      );
    }
  };

  // --- Backup JSON Local Handlers ---
  const handleExportJsonBackup = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    triggerBlobDownload(blob, `morrow-backup-${new Date().toISOString().slice(0, 10)}.json`);
    onNotifySuccess('تم تنزيل نسخة احتياطية كاملة بصيغة JSON.');
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      onImportWorkspaceJson(text);
      onNotifySuccess('تم استيراد النسخة الاحتياطية بنجاح واستعادة كافة البيانات.');
    } catch (err) {
      onNotifyError(err instanceof Error ? err.message : 'تعذر قراءة ملف النسخة الاحتياطية.');
    }
  };

  // --- Notes & Ideas Handlers ---
  const filteredNotes = useMemo(() => {
    const q = normalizeArabic(noteSearch);
    return [...workspaceNotes]
      .filter((n) => {
        if (noteCategoryFilter !== 'all' && n.category !== noteCategoryFilter) return false;
        if (!q) return true;
        return (
          normalizeArabic(n.title).includes(q) || normalizeArabic(n.content).includes(q)
        );
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [workspaceNotes, noteSearch, noteCategoryFilter]);

  const handleSaveNoteForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitleDraft.trim() && !noteContentDraft.trim()) return;
    if (editingNoteId) {
      onUpdateNote(editingNoteId, {
        title: noteTitleDraft.trim() || 'ملاحظة محدثة',
        content: noteContentDraft.trim(),
        category: noteCategoryDraft,
        pinned: notePinnedDraft,
      });
      onNotifySuccess('تم تحديث الملاحظة وحفظها تلقائياً ضمن المزامنة.');
    } else {
      onAddNote({
        title: noteTitleDraft.trim() || 'ملاحظة جديدة',
        content: noteContentDraft.trim(),
        category: noteCategoryDraft,
        pinned: notePinnedDraft,
      });
      onNotifySuccess('تمت إضافة الملاحظة إلى قسم الملاحظات والأفكار.');
    }
    setEditingNoteId(null);
    setNoteTitleDraft('');
    setNoteContentDraft('');
    setNoteCategoryDraft('quick');
    setNotePinnedDraft(false);
  };

  const startEditingNote = (note: WorkspaceNoteItem) => {
    setEditingNoteId(note.id);
    setNoteTitleDraft(note.title);
    setNoteContentDraft(note.content);
    setNoteCategoryDraft(note.category);
    setNotePinnedDraft(Boolean(note.pinned));
  };

  return (
    <div dir="rtl" className="mx-auto w-full max-w-6xl space-y-5 px-3 py-5 sm:px-6 sm:py-6">
      {/* Top Unified Header & Sync Status Summary Card */}
      <section className="nexus-squircle p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {authUser?.avatarUrl ? (
              <img
                src={authUser.avatarUrl}
                alt={authUser.displayName}
                referrerPolicy="no-referrer"
                className="h-14 w-14 shrink-0 rounded-2xl border object-cover"
                style={{ borderColor: 'var(--accent)' }}
              />
            ) : (
              <NexusDuotoneIcon tone="gold" sizeClass="h-14 w-14">
                <ShieldCheck className="h-6 w-6" />
              </NexusDuotoneIcon>
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black truncate">
                الحساب والبيانات والأمان
              </h1>
              <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                {authUser
                  ? `مسجل باسم ${authUser.displayName} — المزامنة والحماية نشطة`
                  : 'إدارة الحسابات، النسخ الاحتياطي الذكي، التصدير المنظّم، والملاحظات والأمان'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runSmartSaveEngine('manual')}
              className="nexus-pill-btn inline-flex min-h-[42px] items-center gap-2 px-4 py-2 text-xs font-extrabold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Save className="h-4 w-4" />
              <span>الحفظ الذكي الآن</span>
            </button>

            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="nexus-pill-btn inline-flex min-h-[42px] items-center gap-2 border px-4 py-2 text-xs font-extrabold"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <Share2 className="h-4 w-4" />
              <span>تصدير بياناتك</span>
            </button>
          </div>
        </div>

        {/* Clean Sync Status Summary Line */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 font-bold">
              <CheckCircle2
                className="h-4 w-4 shrink-0"
                style={{
                  color: checkpoint?.lastSavedAt ? 'var(--success)' : 'var(--text-muted)',
                }}
              />
              <span>آخر حفظ ناجح:</span>
              <span style={{ color: 'var(--accent)' }}>
                {formatDateTimeArabic(checkpoint?.lastSavedAt)}
              </span>
            </span>

            <span className="flex items-center gap-1.5 font-bold">
              <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <span>الأمان:</span>
              <span>
                {securityPrefs.privacyPin ? 'محمي برمز PIN' : 'حماية محلية نشطة'}
              </span>
            </span>
          </div>

          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            {currentDiff.status === 'unchanged'
              ? 'جميع التغييرات محفوظة ومحدّثة'
              : currentDiff.summaryArabic}
          </span>
        </div>

        {calmBannerMsg && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-bold"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor:
                calmBannerMsg.tone === 'warning' ? 'var(--warning)' : 'var(--success)',
              color: 'var(--text-primary)',
            }}
          >
            <span>{calmBannerMsg.text}</span>
            <button
              type="button"
              onClick={() => setCalmBannerMsg(null)}
              className="text-[11px] font-extrabold underline"
              style={{ color: 'var(--accent)' }}
            >
              إغلاق
            </button>
          </div>
        )}
      </section>

      {/* Quiet Smart Reminders (Only shown when genuine activity calls for them) */}
      {activeReminders.length > 0 && (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {activeReminders.map((rem) => (
            <div
              key={rem.id}
              className="nexus-squircle flex items-start justify-between gap-3 p-4"
              style={{
                borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
              }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    color: 'var(--accent)',
                  }}
                >
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-black">{rem.title}</div>
                  <p
                    className="mt-0.5 text-[11px] leading-relaxed"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {rem.message}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (rem.kind === 'structured_export_suggested') {
                          setExportModalOpen(true);
                        } else {
                          void runSmartSaveEngine(
                            rem.kind === 'weekly_overdue' ? 'weekly_auto' : 'manual'
                          );
                        }
                      }}
                      className="rounded-xl px-3 py-1 text-[11px] font-extrabold"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      {rem.actionLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedReminderIds((prev) => [...prev, rem.id])
                      }
                      className="text-[11px] font-semibold underline"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      تذكير لاحقاً
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Focused Unified Navigation Tabs */}
      <div
        role="tablist"
        aria-label="أقسام الحساب والبيانات والأمان"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {(
          [
            ['overview', 'الحساب والربط السحابي', User],
            ['sync_export', 'المزامنة وتصدير بياناتك', CloudUpload],
            ['notes', `الملاحظات والأفكار (${workspaceNotes.length})`, StickyNote],
            ['security_bin', `الأمان والاسترجاع (${recycleBin.length})`, Shield],
          ] as Array<[AccountHubTab, string, React.ComponentType<{ className?: string }>]>
        ).map(([id, label, Icon]) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(id)}
              className="nexus-pill-btn flex min-h-[44px] items-center justify-center gap-2 border px-3 py-2 text-xs font-extrabold transition-all"
              style={{
                backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                color: active ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ACCOUNTS & CLOUD CONNECTIONS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* App Account & Multi-Method Login */}
          <section className="nexus-squircle p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <NexusDuotoneIcon tone="gold" size="sm">
                  <User className="h-4 w-4" />
                </NexusDuotoneIcon>
                <div>
                  <h2 className="text-sm font-black">حساب التطبيق وتسجيل الدخول</h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    تسجيل الدخول عبر الهاتف أو اليوزر أو البريد الإلكتروني
                  </p>
                </div>
              </div>
              {authUser && (
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    onLoggedOut();
                    onNotifySuccess('تم تسجيل الخروج بأمان.');
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>خروج</span>
                </button>
              )}
            </div>

            {authUser && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'color-mix(in srgb, var(--success) 45%, var(--border-color))',
                }}
              >
                <div className="min-w-0">
                  <div className="font-black truncate">{authUser.displayName}</div>
                  <div className="truncate" style={{ color: 'var(--text-muted)' }}>
                    {authUser.email || authUser.phone || authUser.username}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Camera className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    <span>{avatarBusy ? 'جارٍ الرفع...' : 'تغيير الصورة'}</span>
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Login / Switch Tabs */}
            <div
              className="grid grid-cols-3 gap-1 rounded-2xl p-1 text-xs"
              style={{ backgroundColor: 'var(--bg-main)' }}
            >
              {(
                [
                  ['google', 'البريد / Gmail', Mail],
                  ['username', 'اسم المستخدم', User],
                  ['phone', 'رقم الهاتف', Phone],
                ] as const
              ).map(([key, label, Icon]) => {
                const active = loginMethod === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setLoginMethod(key);
                      setAuthError('');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl py-2 font-bold transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {loginMethod === 'google' && (
              <div className="space-y-3 text-xs">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() =>
                    void handleConnectGoogleAccount({
                      selectAccount: true,
                      forDedicatedDrive: false,
                    })
                  }
                  className="gsi-material-button flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-2 font-extrabold transition-colors hover:opacity-95"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#747775',
                    color: '#1F1F1F',
                  }}
                >
                  <GoogleGsiSvg />
                  <span>Sign in with Google · تسجيل الدخول بحساب Google</span>
                </button>

                <div
                  className="flex items-center gap-2 text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="h-px flex-1" style={{ backgroundColor: 'var(--border-color)' }} />
                  <span>أو الدخول السريع بالبريد</span>
                  <span className="h-px flex-1" style={{ backgroundColor: 'var(--border-color)' }} />
                </div>

                <form onSubmit={handleQuickGmailSubmit} className="space-y-3">
                  <div>
                    <label className="mb-1 block font-bold">البريد الإلكتروني / Gmail</label>
                    <input
                      type="email"
                      dir="ltr"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="work.ledger@gmail.com"
                      className="w-full rounded-xl border px-3 py-2 text-left text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold">الاسم الظاهر (اختياري)</label>
                    <input
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="مثال: إدارة الوكالة"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="w-full rounded-xl px-4 py-2.5 font-extrabold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                  >
                    {authBusy ? 'يرجى الانتظار...' : 'تسجيل الدخول بالبريد'}
                  </button>
                </form>
              </div>
            )}

            {loginMethod === 'username' && (
              <form onSubmit={handleUsernameSubmit} className="space-y-3 text-xs">
                {isRegister && (
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                )}
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="username"
                  className="w-full rounded-xl border px-3 py-2 text-left text-sm"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="كلمة المرور"
                    className="w-full rounded-xl border px-3 py-2 pl-9 text-sm"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label="إظهار أو إخفاء كلمة المرور"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full rounded-xl px-4 py-2.5 font-extrabold"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  {isRegister ? 'إنشاء حساب جديد' : 'دخول باسم المستخدم'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegister((v) => !v)}
                  className="w-full text-center font-bold underline"
                  style={{ color: 'var(--accent)' }}
                >
                  {isRegister ? 'لديك حساب؟ تسجيل الدخول' : 'إنشاء حساب يوزر جديد'}
                </button>
              </form>
            )}

            {loginMethod === 'phone' && (
              <form onSubmit={handlePhoneSubmit} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneSubMode('otp');
                      setOtpSent(false);
                    }}
                    className="rounded-xl border py-1.5 font-bold"
                    style={{
                      borderColor:
                        phoneSubMode === 'otp' ? 'var(--accent)' : 'var(--border-color)',
                      backgroundColor:
                        phoneSubMode === 'otp' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    }}
                  >
                    رمز تحقق (OTP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhoneSubMode('password')}
                    className="rounded-xl border py-1.5 font-bold"
                    style={{
                      borderColor:
                        phoneSubMode === 'password'
                          ? 'var(--accent)'
                          : 'var(--border-color)',
                      backgroundColor:
                        phoneSubMode === 'password'
                          ? 'var(--bg-nav-active)'
                          : 'var(--bg-main)',
                    }}
                  >
                    رقم + كلمة مرور
                  </button>
                </div>

                <input
                  type="tel"
                  dir="ltr"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="07701234567"
                  className="w-full rounded-xl border px-3 py-2 text-left text-sm tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />

                {phoneSubMode === 'otp' && otpSent && (
                  <>
                    {demoOtpHint && (
                      <div
                        className="rounded-xl border px-3 py-2 font-bold"
                        style={{
                          borderColor: 'var(--accent)',
                          backgroundColor: 'var(--bg-nav-active)',
                          color: 'var(--accent)',
                        }}
                      >
                        رمز التحقق: <span className="font-mono">{demoOtpHint}</span>
                      </div>
                    )}
                    <input
                      type="text"
                      dir="ltr"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full rounded-xl border px-3 py-2 text-center font-bold tracking-widest"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </>
                )}

                {phoneSubMode === 'password' && (
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="كلمة المرور"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                )}

                <button
                  type="submit"
                  disabled={authBusy}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 font-extrabold"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>
                    {phoneSubMode === 'otp'
                      ? otpSent
                        ? 'تأكيد الرمز والدخول'
                        : 'إرسال رمز التحقق'
                      : 'دخول برقم الهاتف'}
                  </span>
                </button>
              </form>
            )}

            {authError && (
              <div
                role="alert"
                className="rounded-xl border px-3 py-2 text-xs font-bold"
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              >
                {authError}
              </div>
            )}

            {authUser && (
              <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => void runSmartSaveEngine('cloud')}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  <CloudUpload className="h-3.5 w-3.5" />
                  <span>مزامنة فورية مع الخادم</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const ok = await onRestoreServer();
                      onNotifySuccess(
                        ok
                          ? 'تم استرجاع أحدث نسخة محفوظة من الخادم.'
                          : 'لا توجد نسخة سابقة محفوظة لهذا الحساب.'
                      );
                    } catch (err) {
                      onNotifyError(
                        err instanceof Error ? err.message : 'تعذر الاسترجاع من الخادم.'
                      );
                    }
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>استرجاع من الخادم</span>
                </button>
              </div>
            )}
          </section>

          {/* Independent Google Drive Backup Account + Dedicated Email Advisory + Secondary Backup Cloud */}
          <div className="space-y-5">
            {/* Independent Google Drive Cloud Card */}
            <section className="nexus-squircle p-5 space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <NexusDuotoneIcon tone="ai" size="sm">
                    <HardDrive className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div>
                    <h2 className="text-sm font-black">
                      ربط وتسجيل الدخول إلى Google Drive المستقل
                    </h2>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {driveHasToken && driveConnectedEmail
                        ? `متصل حالياً عبر: ${driveConnectedEmail}`
                        : 'تخصيص حساب Google Drive مستقل لحفظ حزم النسخ الاحتياطي السحابية'}
                    </p>
                  </div>
                </div>
                {driveHasToken && (
                  <button
                    type="button"
                    disabled={driveBusy}
                    onClick={() => void refreshDriveFiles(driveFolderDraft)}
                    title="تحديث ملفات Drive"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${driveBusy ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                <div>
                  <label className="mb-1 block font-bold">بريد Google Drive المخصص</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={driveEmailDraft}
                    onChange={(e) => setDriveEmailDraft(e.target.value)}
                    placeholder="morrow.backup.only@gmail.com"
                    className="w-full rounded-xl border px-3 py-2 text-left text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold">اسم المجلد على Drive</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={driveFolderDraft}
                    onChange={(e) => setDriveFolderDraft(e.target.value)}
                    placeholder="Morrow_Drive_Backups"
                    className="w-full rounded-xl border px-3 py-2 text-left text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() =>
                    void handleConnectGoogleAccount({
                      selectAccount: true,
                      forDedicatedDrive: true,
                    })
                  }
                  className="gsi-material-button inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3.5 py-1.5 font-extrabold"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#747775',
                    color: '#1F1F1F',
                  }}
                >
                  <GoogleGsiSvg />
                  <span>
                    {driveHasToken
                      ? 'تبديل / إعادة ربط حساب Google Drive'
                      : 'Sign in with Google · ربط Google Drive'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateSecurityPrefs({
                      driveAccountMeta: {
                        ...(securityPrefs.driveAccountMeta || {}),
                        dedicatedEmail: driveEmailDraft.trim(),
                        folderLabel: driveFolderDraft.trim() || 'Morrow_Drive_Backups',
                      },
                    });
                    onNotifySuccess('تم حفظ إعدادات مجلد Google Drive المستقل.');
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 font-bold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <span>حفظ اسم المجلد</span>
                </button>

                {driveHasToken && (
                  <button
                    type="button"
                    disabled={driveBusy}
                    onClick={() => void handleUploadStructuredToDrive()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-1.5 font-extrabold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    <span>رفع نسخة منظّمة إلى Drive الآن</span>
                  </button>
                )}
              </div>

              {/* Advisory Note Card directly beneath Drive option */}
              <div
                className="rounded-2xl border p-3.5 flex items-start gap-3 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border-color))',
                }}
              >
                <Sparkles
                  className="h-4 w-4 shrink-0 mt-0.5"
                  style={{ color: 'var(--accent)' }}
                />
                <div>
                  <div className="font-black" style={{ color: 'var(--accent)' }}>
                    نصيحة خصوصية وتنظيم عالية
                  </div>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-primary)' }}>
                    ننصح بشدة بإنشاء بريد إلكتروني أو حساب Google مستقل مخصص
                    لبيانات هذا التطبيق فقط، لفصل سجلات الوكالات والمستفيدين عن
                    بريدك الشخصي وضمان أعلى درجات الأمان والخصوصية والتنظيم.
                  </p>
                </div>
              </div>

              {/* Live Drive Backup Files List */}
              {driveHasToken && (
                <div
                  className="rounded-2xl border p-3.5 space-y-2 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black">
                      ملفات النسخ الاحتياطي على Drive ({driveFiles.length})
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {driveFolderDraft || 'Morrow_Drive_Backups'}
                    </span>
                  </div>

                  {driveFiles.length === 0 ? (
                    <div className="py-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      لا توجد نسخ مرفوعة بعد في هذا المجلد. اضغط «رفع نسخة منظّمة إلى Drive الآن» لإنشاء أول نسخة.
                    </div>
                  ) : (
                    <div className="max-h-[190px] space-y-1.5 overflow-y-auto">
                      {driveFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-bold">{file.name}</div>
                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {file.modifiedTime ? formatDateTimeArabic(file.modifiedTime) : ''}
                              {file.size
                                ? ` · ${Math.max(1, Math.round(Number(file.size) / 1024))} ك.ب`
                                : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleDownloadDriveBackup(file)}
                              title="تنزيل النسخة"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border"
                              style={{ borderColor: 'var(--border-color)' }}
                            >
                              <Download className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDriveConfirm({ kind: 'overwrite', file })}
                              title="تحديث هذه النسخة"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border"
                              style={{ borderColor: 'var(--border-color)' }}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                title="فتح في Google Drive"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border"
                                style={{ borderColor: 'var(--border-color)' }}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setPendingDriveConfirm({ kind: 'delete', file })}
                              title="حذف من Google Drive"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border"
                              style={{
                                borderColor: 'var(--border-color)',
                                color: 'var(--danger)',
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Secondary Backup Cloud Platform (MEGA 20GB / pCloud) */}
            <section className="nexus-squircle p-5 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <NexusDuotoneIcon tone="emerald" size="sm">
                  <Cloud className="h-4 w-4" />
                </NexusDuotoneIcon>
                <div>
                  <h2 className="text-sm font-black">
                    منصة سحابية احتياطية ثانية (نسخة مزدوجة)
                  </h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    اختر منصة سحابية إضافية موثوقة بخطة مجانية قوية لحفظ نسخة احتياطية مستقلة
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {(
                  [
                    ['mega', 'MEGA · 20GB مجانية'],
                    ['pcloud', 'pCloud · 10GB مشفر'],
                    ['none', 'تعطيل الثانية'],
                  ] as Array<[BackupCloudProvider, string]>
                ).map(([prov, label]) => {
                  const selected = secondaryProvider === prov;
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setSecondaryProvider(prov)}
                      className="rounded-xl border px-2.5 py-2 font-extrabold text-[11px] transition-colors"
                      style={{
                        backgroundColor: selected
                          ? 'var(--bg-nav-active)'
                          : 'var(--bg-main)',
                        borderColor: selected ? 'var(--accent)' : 'var(--border-color)',
                        color: selected ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {secondaryProvider !== 'none' && (
                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <input
                      type="email"
                      dir="ltr"
                      value={secondaryEmailDraft}
                      onChange={(e) => setSecondaryEmailDraft(e.target.value)}
                      placeholder={
                        secondaryProvider === 'mega'
                          ? 'backup@mega.nz'
                          : 'backup@pcloud.com'
                      }
                      className="w-full rounded-xl border px-3 py-2 text-left text-xs"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={secondaryFolderDraft}
                      onChange={(e) => setSecondaryFolderDraft(e.target.value)}
                      placeholder="Morrow_Backups"
                      className="w-full rounded-xl border px-3 py-2 text-left text-xs"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSecurityPrefs({
                          secondaryCloud: {
                            provider: secondaryProvider,
                            accountEmail: secondaryEmailDraft.trim(),
                            folderName: secondaryFolderDraft.trim() || 'Morrow_Backups',
                            autoBackupInclude: true,
                            connectedAt:
                              securityPrefs.secondaryCloud?.connectedAt ||
                              new Date().toISOString(),
                          },
                        });
                        onNotifySuccess(
                          `تم اعتماد منصة ${secondaryProvider.toUpperCase()} كسحابة احتياطية ثانية.`
                        );
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-4 py-1.5 font-extrabold"
                      style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>حفظ إعدادات المنصة الثانية</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleRunStructuredExport(false)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 font-bold"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>تجهيز نسخة مضغوطة للرفع</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: SMART SYNC ENGINE & STRUCTURED EXPORT */}
      {activeTab === 'sync_export' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Smart Sync Engine Control Card */}
            <section className="nexus-squircle p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <NexusDuotoneIcon tone="gold" size="sm">
                  <CalendarClock className="h-4 w-4" />
                </NexusDuotoneIcon>
                <div>
                  <h2 className="text-sm font-black">محرك الحفظ والمزامنة الذكي</h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    مقارنة داخلية ذكية، ضغط آمن، وتحقق مزدوج من السلامة دون تكرار
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => void runSmartSaveEngine('manual')}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 font-extrabold"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  <Save className="h-4 w-4" />
                  <span>الحفظ اليدوي الذكي</span>
                </button>

                <button
                  type="button"
                  onClick={() => void runSmartSaveEngine('weekly_auto')}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-4 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <RefreshCw className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>تشغيل الفحص الأسبوعي الآن</span>
                </button>
              </div>

              <label
                className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <span>تفعيل الحفظ التلقائي الأسبوعي الذكي</span>
                <input
                  type="checkbox"
                  checked={checkpoint?.weeklyAutoEnabled ?? true}
                  onChange={(e) =>
                    onUpdateSmartSyncCheckpoint({
                      ...(checkpoint || {
                        lastHash: '',
                        lastDataHash: '',
                        lastRecordCount: 0,
                        lastAttachmentCount: 0,
                        lastSavedAt: '',
                        lastSaveMode: 'weekly_auto',
                        integrityChecksum: '',
                        weeklyAutoEnabled: true,
                      }),
                      weeklyAutoEnabled: e.target.checked,
                    })
                  }
                />
              </label>

              <div
                className="rounded-2xl border p-3.5 text-xs space-y-1.5"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="font-extrabold">آلية المقارنة والحفظ التلقائي:</div>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  • عند عدم وجود تغييرات: يتخطى التكرار ويطمئنك أن البيانات محدّثة بالكامل.
                  <br />• عند التعديل البسيط: يحدّث النسخة القائمة ذكياً دون تكديس نسخ مكررة.
                  <br />• عند الإضافة الجوهرية: يوثّق نقطة حفظ جديدة بعد الضغط والتحقق المزدوج.
                </p>
              </div>
            </section>

            {/* Structured Export ("تصدير بياناتك") & Classic JSON Backup */}
            <section className="nexus-squircle p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <NexusDuotoneIcon tone="ai" size="sm">
                  <FolderOpen className="h-4 w-4" />
                </NexusDuotoneIcon>
                <div>
                  <h2 className="text-sm font-black">تصدير بياناتك والنسخ المحلي</h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    حزمة منظمة بمجلدات مفصولة (الأسماء، العناوين، الإكسل، الصور، الملاحظات)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="nexus-pill-btn flex min-h-[46px] w-full items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold"
                style={{
                  background:
                    'linear-gradient(135deg, var(--accent-ai, #5B4FE9) 0%, #4338CA 100%)',
                  color: '#FFFFFF',
                }}
              >
                <Share2 className="h-4 w-4" />
                <span>فتح خيارات تصدير بياناتك (مشاركة أو مجلد منظّم)</span>
              </button>

              <div
                className="border-t pt-3.5 space-y-2.5"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-2 text-xs font-extrabold">
                  <FileJson className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>النسخة الاحتياطية السريعة الكاملة (JSON)</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleExportJsonBackup}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 font-bold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Download className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    <span>تصدير JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => jsonImportRef.current?.click()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 font-bold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>استيراد ملف JSON</span>
                  </button>
                  <input
                    ref={jsonImportRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportJsonFile}
                    className="hidden"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Sync Checkpoint History */}
          <section className="nexus-squircle p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">سجل نقاط الحفظ والتحقق الموثقة</h3>
              <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                {(checkpoint?.history || []).length} سجل
              </span>
            </div>

            {!checkpoint?.history || checkpoint.history.length === 0 ? (
              <div
                className="rounded-2xl border p-5 text-center text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                اضغط على «الحفظ اليدوي الذكي» أو «تصدير بياناتك» لتوثيق أول نقطة حفظ
                مضغوطة ومفحوصة السلامة.
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {checkpoint.history.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-2.5"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div>
                      <div className="font-extrabold">{item.summary}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {formatDateTimeArabic(item.timestamp)} · حجم مضغوط:{' '}
                        {Math.max(1, Math.round(item.compressedBytes / 1024))} ك.ب
                      </div>
                    </div>
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: 'var(--success)' }}
                    >
                      تحقق سليم
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: NOTES, IDEAS & INFO */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Create / Edit Note Card */}
          <section className="nexus-squircle p-5 space-y-3.5 lg:col-span-1">
            <div className="flex items-center gap-2">
              <NexusDuotoneIcon tone="gold" size="sm">
                <StickyNote className="h-4 w-4" />
              </NexusDuotoneIcon>
              <div>
                <h2 className="text-sm font-black">
                  {editingNoteId ? 'تعديل الملاحظة' : 'ملاحظة أو فكرة جديدة'}
                </h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  تُحفظ وتُدمج تلقائياً في المزامنة والتصدير المنظّم
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveNoteForm} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold">التصنيف</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {NOTE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const active = noteCategoryDraft === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNoteCategoryDraft(cat.id)}
                        className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 font-bold"
                        style={{
                          backgroundColor: active
                            ? 'var(--bg-nav-active)'
                            : 'var(--bg-main)',
                          borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                          color: active ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold">العنوان</label>
                <input
                  type="text"
                  required
                  value={noteTitleDraft}
                  onChange={(e) => setNoteTitleDraft(e.target.value)}
                  placeholder="مثال: فكرة لتحسين كشف التوزيع"
                  className="w-full rounded-xl border px-3 py-2 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block font-bold">التفاصيل</label>
                <textarea
                  rows={4}
                  required
                  value={noteContentDraft}
                  onChange={(e) => setNoteContentDraft(e.target.value)}
                  placeholder="اكتب ملاحظتك أو فكرتك التطويرية أو أي معلومة مرتبطة بعملك..."
                  className="w-full rounded-xl border px-3 py-2 text-xs leading-relaxed"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={notePinnedDraft}
                  onChange={(e) => setNotePinnedDraft(e.target.checked)}
                />
                <span>تثبيت في أعلى القائمة</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-4 py-2 font-extrabold"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  <Plus className="h-4 w-4" />
                  <span>{editingNoteId ? 'حفظ التعديل' : 'إضافة وحفظ'}</span>
                </button>
                {editingNoteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setNoteTitleDraft('');
                      setNoteContentDraft('');
                    }}
                    className="min-h-[40px] rounded-xl border px-3 font-bold"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Notes Search & Cards Grid */}
          <section className="nexus-squircle p-5 space-y-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div
                className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border px-3 h-10"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <input
                  type="search"
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  placeholder="ابحث في الملاحظات والأفكار..."
                  className="w-full bg-transparent text-xs outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setNoteCategoryFilter('all')}
                  className="rounded-xl border px-2.5 py-1.5 font-bold"
                  style={{
                    backgroundColor:
                      noteCategoryFilter === 'all' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor:
                      noteCategoryFilter === 'all' ? 'var(--accent)' : 'var(--border-color)',
                  }}
                >
                  الكل ({workspaceNotes.length})
                </button>
                {NOTE_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNoteCategoryFilter(c.id)}
                    className="rounded-xl border px-2.5 py-1.5 font-bold"
                    style={{
                      backgroundColor:
                        noteCategoryFilter === c.id ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                      borderColor:
                        noteCategoryFilter === c.id ? 'var(--accent)' : 'var(--border-color)',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredNotes.length === 0 ? (
              <div
                className="rounded-2xl border p-8 text-center text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                لا توجد ملاحظات أو أفكار مطابقة للبحث الحالي.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredNotes.map((note) => {
                  const catMeta =
                    NOTE_CATEGORIES.find((c) => c.id === note.category) ||
                    NOTE_CATEGORIES[0];
                  const CatIcon = catMeta.icon;
                  return (
                    <article
                      key={note.id}
                      className="rounded-2xl border p-4 flex flex-col justify-between gap-3"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: note.pinned ? 'var(--accent)' : 'var(--border-color)',
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
                            <CatIcon className="h-3.5 w-3.5" />
                            <span>{catMeta.label}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateNote(note.id, { pinned: !note.pinned })
                            }
                            aria-label="تثبيت أو إلغاء التثبيت"
                            className="p-1 rounded-lg hover:bg-[var(--bg-surface)]"
                            style={{
                              color: note.pinned ? 'var(--accent)' : 'var(--text-muted)',
                            }}
                          >
                            {note.pinned ? (
                              <Pin className="h-3.5 w-3.5" />
                            ) : (
                              <PinOff className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        <h3 className="text-xs font-black">{note.title}</h3>
                        <p
                          className="text-xs leading-relaxed whitespace-pre-wrap"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {note.content}
                        </p>
                      </div>

                      <div
                        className="flex items-center justify-between border-t pt-2.5 text-[11px]"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>
                          {note.updatedAt.slice(0, 10)}
                        </span>
                        <div className="flex items-center gap-2 font-bold">
                          <button
                            type="button"
                            onClick={() => startEditingNote(note)}
                            style={{ color: 'var(--accent)' }}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteNote(note.id);
                              onNotifySuccess('تم حذف الملاحظة.');
                            }}
                            style={{ color: 'var(--danger)' }}
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: SECURITY, PRIVACY & RECYCLE BIN */}
      {activeTab === 'security_bin' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Privacy Lock & Security Controls */}
          <section className="nexus-squircle p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <NexusDuotoneIcon tone="gold" size="sm">
                <Lock className="h-4 w-4" />
              </NexusDuotoneIcon>
              <div>
                <h2 className="text-sm font-black">الأمان وقفل الخصوصية</h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  حماية الشاشة برمز PIN وإعدادات الخصوصية والعمل دون إنترنت
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2.5 text-xs">
              <div className="flex-1 min-w-[180px]">
                <label htmlFor="hub-privacy-pin" className="mb-1 block font-bold">
                  رمز القفل (PIN اختياري)
                </label>
                <input
                  id="hub-privacy-pin"
                  type="password"
                  dir="ltr"
                  value={pinDraft}
                  onChange={(e) => {
                    setPinDraft(e.target.value);
                    onUpdateSecurityPrefs({ privacyPin: e.target.value });
                  }}
                  placeholder="اتركه فارغاً للفتح بنقرة"
                  className="min-h-[42px] w-full rounded-xl border px-3 py-2 text-left tabular-nums"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  onUpdateSecurityPrefs({
                    privacyPin: pinDraft,
                    privacyLocked: true,
                  })
                }
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl px-4 py-2 font-extrabold"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                <Lock className="h-4 w-4" />
                <span>قفل التطبيق الآن</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label
                className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-2xl border px-4 py-2 font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <span>تفعيل الحفظ المحلي للعمل دون إنترنت (Offline Cache)</span>
                <input
                  type="checkbox"
                  checked={securityPrefs.offlineCacheEnabled}
                  onChange={(e) =>
                    onUpdateSecurityPrefs({ offlineCacheEnabled: e.target.checked })
                  }
                />
              </label>

              <label
                className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-2xl border px-4 py-2 font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <span>إلزام تسجيل الدخول عند فتح التطبيق</span>
                <input
                  type="checkbox"
                  checked={requireLoginOnStart}
                  onChange={(e) => onToggleRequireLogin(e.target.checked)}
                />
              </label>

              <label
                className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-2xl border px-4 py-2 font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span>السماح بإرسال أسماء المستفيدين للمساعد السحابي</span>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(securityPrefs.allowCloudBeneficiaryNames)}
                  onChange={(e) =>
                    onUpdateSecurityPrefs({
                      allowCloudBeneficiaryNames: e.target.checked,
                    })
                  }
                />
              </label>
            </div>
          </section>

          {/* Safe Recycle Bin */}
          <section className="nexus-squircle p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <NexusDuotoneIcon tone="crimson" size="sm">
                  <Trash2 className="h-4 w-4" />
                </NexusDuotoneIcon>
                <div>
                  <h2 className="text-sm font-black">
                    سلة الاسترجاع الآمنة ({recycleBin.length})
                  </h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    استعادة أي مستفيد أو قائمة أو مصروف حُذف مسبقاً بنقرة واحدة
                  </p>
                </div>
              </div>

              {recycleBin.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearRecycleBin();
                    onNotifySuccess('تم إفراغ سلة الاسترجاع.');
                  }}
                  className="rounded-xl border px-3 py-1.5 text-xs font-extrabold"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                  إفراغ السلة
                </button>
              )}
            </div>

            {recycleBin.length === 0 ? (
              <div
                className="rounded-2xl border p-8 text-center text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                سلة الاسترجاع فارغة حالياً.
              </div>
            ) : (
              <div className="max-h-[340px] space-y-2 overflow-y-auto text-xs">
                {recycleBin.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-extrabold">{entry.label}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        حُذف في {entry.deletedAt.slice(0, 10)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreRecycleBinItem(entry.id);
                          onNotifySuccess(`تمت استعادة: ${entry.label}`);
                        }}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-xl px-3 py-1 font-extrabold"
                        style={{
                          backgroundColor: 'var(--success)',
                          color: 'var(--success-fg)',
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>استعادة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onPurgeRecycleBinItem(entry.id)}
                        className="min-h-[34px] rounded-xl border px-2.5 py-1 font-bold"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--danger)',
                        }}
                      >
                        حذف نهائي
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Calm Multi-Stage Loading Screen */}
      <SmartSyncProgressOverlay
        open={syncOverlayOpen}
        stage={syncStage}
        title={syncOverlayTitle}
      />

      {/* Structured Export Full-Screen Push Page */}
      <StructuredExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        personsCount={state.persons.length}
        relationsCount={state.relations.length}
        agenciesCount={state.agencies.length}
        notesCount={workspaceNotes.length}
        attachmentsCount={attachmentsCount}
        busy={syncOverlayOpen}
        onDirectShare={() => void handleRunStructuredExport(true)}
        onStructuredZipExport={() => void handleRunStructuredExport(false)}
      />

      {/* Mandatory Explicit Confirmation Dialog for Drive Overwrite / Delete */}
      {pendingDriveConfirm && (
        <FullScreenPushPage
          open={Boolean(pendingDriveConfirm)}
          onClose={() => setPendingDriveConfirm(null)}
          title={
            pendingDriveConfirm.kind === 'delete'
              ? 'تأكيد حذف نسخة من Google Drive'
              : 'تأكيد تحديث نسخة على Google Drive'
          }
          subtitle={pendingDriveConfirm.file.name}
          maxWidthClass="max-w-md"
        >
          <div dir="rtl" className="space-y-4 p-5 text-xs">
            <div
              className="rounded-2xl border p-4 leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor:
                  pendingDriveConfirm.kind === 'delete'
                    ? 'var(--danger)'
                    : 'var(--accent)',
              }}
            >
              {pendingDriveConfirm.kind === 'delete' ? (
                <p>
                  هل أنت متأكد من حذف الملف{' '}
                  <strong className="font-black">{pendingDriveConfirm.file.name}</strong>{' '}
                  من حساب Google Drive؟ لا يمكن التراجع عن الحذف بعد تنفيذه.
                </p>
              ) : (
                <p>
                  سيتم استبدال محتوى الملف{' '}
                  <strong className="font-black">{pendingDriveConfirm.file.name}</strong>{' '}
                  على Google Drive بأحدث نسخة منظّمة من بيانات التطبيق الحالية.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDriveConfirm(null)}
                className="min-h-[40px] rounded-xl border px-4 py-2 font-bold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={driveBusy}
                onClick={() => {
                  if (pendingDriveConfirm.kind === 'delete') {
                    void handleConfirmDeleteDriveBackup(pendingDriveConfirm.file);
                  } else {
                    void handleUploadStructuredToDrive(pendingDriveConfirm.file);
                  }
                }}
                className="min-h-[40px] rounded-xl px-4 py-2 font-extrabold"
                style={{
                  backgroundColor:
                    pendingDriveConfirm.kind === 'delete'
                      ? 'var(--danger)'
                      : 'var(--accent)',
                  color:
                    pendingDriveConfirm.kind === 'delete'
                      ? '#FFFFFF'
                      : 'var(--accent-fg)',
                }}
              >
                {pendingDriveConfirm.kind === 'delete'
                  ? 'نعم، احذف الملف نهائياً'
                  : 'نعم، حدّث النسخة الآن'}
              </button>
            </div>
          </div>
        </FullScreenPushPage>
      )}
    </div>
  );
};

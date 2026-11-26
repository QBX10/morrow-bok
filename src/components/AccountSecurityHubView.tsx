import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Archive,
  AtSign,
  Bell,
  CalendarClock,
  Camera,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileJson,
  Fingerprint,
  FolderOpen,
  HardDrive,
  History,
  Info,
  KeyRound,
  Lightbulb,
  Link2,
  Lock,
  LogOut,
  Mail,
  MessageSquarePlus,
  Pin,
  PinOff,
  Plus,
  QrCode,
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
  UserPlus,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  linkUsernameApi,
  loginWithPasswordApi,
  registerWithPasswordApi,
  signInWithFirebaseGoogle,
  signInWithGithubPopup,
  updateUserProfileApi,
} from '../lib/authClient';
import {
  accessSharedLinkApi,
  approveQrPairingApi,
  changeAccountEmailApi,
  createShareLinkApi,
  deleteAccountPermanentlyApi,
  deletePasskeyApi,
  exportGdprDataApi,
  fetchActiveSessionsApi,
  fetchSecurityAlertsWithConfigApi,
  fetchSharingOverviewApi,
  fetchWorkspaceVersionsApi,
  generateRecoveryCodesApi,
  getRecoveryCodesStatusApi,
  inviteShareMemberApi,
  listPasskeysApi,
  restoreWorkspaceVersionApi,
  revokeOtherSessionsApi,
  revokeSessionApi,
  revokeShareInviteApi,
  revokeShareLinkApi,
  sendTestSecurityEmailApi,
  updateEmailAlertsPreferenceApi,
  updateShareMemberRoleApi,
  verifyReauthApi,
} from '../lib/securityClient';
import {
  isWebAuthnSupported,
  registerPasskeyWithServer,
} from '../lib/webauthnClient';
import { getRemainingRecycleDays } from '../utils/recycleBin';
import {
  getAccessToken,
  googleSignIn,
  initWorkspaceAuth,
} from '../lib/firebase';
import {
  deleteDriveBackupFile,
  downloadDriveBackupFile,
  listDriveBackupFiles,
  uploadDriveBackupFile,
  type GoogleDriveBackupFile,
} from '../lib/googleWorkspace';
import { compressImageFileToDataUrl } from '../lib/imageUpload';
import {
  createMemoryVaultExport,
  type MorrowMemoryVaultEnvelope,
} from '../services/storage/memoryVault';
import { TabrixSubViewTransition } from './ui/TabrixMotionPrimitives';
import {
  TABRIX_SPRING,
  useTabrixOrderedDirection,
  useTabrixReducedMotion,
} from '../utils/tabrixMotion';
import type {
  ActiveSessionRecord,
  AppDatabaseState,
  AuditCheckpointEvent,
  AuthUser,
  BackupCloudProvider,
  ConflictCopyEntry,
  PasskeyCredentialSummary,
  RecycleBinEntry,
  RecycleBinItemKind,
  RecoveryCodesStatus,
  SecurityAlertItem,
  SecurityPrefs,
  SelectiveSyncPrefs,
  ShareAccessLogEntry,
  ShareInviteRecord,
  ShareLinkRecord,
  ShareRole,
  SmartSyncCheckpoint,
  StorageQuotaInfo,
  StorageSystemStatus,
  SyncQueueOperation,
  WorkspaceNoteCategory,
  WorkspaceNoteItem,
  WorkspaceSyncStatus,
  WorkspaceVersionRecord,
} from '../types/agency';
import { normalizeArabic } from '../utils/agencyLogic';
import {
  normalizeUsernameInput,
  validateAuthUsername,
} from '../utils/surface2dConfig';
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
import {
  runWithSignatureLoader,
  useDelayedLoading,
} from '../utils/delayedLoader';

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
  onRestoreAllRecycleBinItems?: () => void;
  onPurgeRecycleBinItem: (entryId: string) => void;
  onClearRecycleBin: () => void;
  onImportWorkspaceJson: (rawJson: string) => void | Promise<void>;
  onSyncServer: () => Promise<void>;
  onRestoreServer: () => Promise<boolean>;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
  initialTab?: AccountHubTab;
  syncStatus?: WorkspaceSyncStatus;
  realtimeConnected?: boolean;
  storageStatus?: StorageSystemStatus | null;
  storageQuota?: StorageQuotaInfo | null;
  onRefreshStorageQuota?: () => Promise<StorageQuotaInfo | null>;
  conflictCopies?: ConflictCopyEntry[];
  onResolveConflictCopy?: (
    copyId: string,
    action: 'keep_current' | 'restore_copy'
  ) => void;
  onApplyServerSnapshot?: (rawSnapshot: unknown) => Promise<boolean>;
  syncQueue?: SyncQueueOperation[];
  isOnline?: boolean;
  auditLog?: AuditCheckpointEvent[];
  onForceSyncNow?: () => Promise<void>;
  onExportMemoryVaultJson?: () => {
    envelope: MorrowMemoryVaultEnvelope;
    jsonText: string;
  };
  onRestoreAuditCheckpoint?: (eventId: string) => boolean;
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
  onRestoreAllRecycleBinItems,
  onPurgeRecycleBinItem,
  onClearRecycleBin,
  onImportWorkspaceJson,
  onSyncServer,
  onRestoreServer,
  onNotifySuccess,
  onNotifyError,
  initialTab = 'overview',
  syncStatus = 'local_only',
  realtimeConnected = false,
  storageStatus = null,
  storageQuota = null,
  onRefreshStorageQuota,
  conflictCopies = [],
  onResolveConflictCopy,
  onApplyServerSnapshot,
  syncQueue = [],
  isOnline = true,
  auditLog = [],
  onForceSyncNow,
  onExportMemoryVaultJson,
  onRestoreAuditCheckpoint,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [activeTab, setActiveTab] = useState<AccountHubTab>(initialTab);
  const tabDirection = useTabrixOrderedDirection(activeTab, {
    overview: 0,
    sync_export: 1,
    notes: 2,
    security_bin: 3,
  });

  // Account login inline panel state
  const [loginMethod, setLoginMethod] = useState<'google' | 'username'>('google');
  const [isRegister, setIsRegister] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [linkUsernameDraft, setLinkUsernameDraft] = useState(authUser?.username || '');
  const [linkUsernamePassDraft, setLinkUsernamePassDraft] = useState('');
  const [linkUsernameBusy, setLinkUsernameBusy] = useState(false);
  const [forceSyncBusy, setForceSyncBusy] = useState(false);

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
  useDelayedLoading(
    authBusy || avatarBusy,
    'جاري توثيق وتحديث الحساب...',
    {
      immediate: true,
      subtitle: 'يتم تأمين بيانات الحساب وتجهيز مساحة العمل المرتبطة...',
    }
  );
  useDelayedLoading(driveBusy, 'جاري المزامنة مع Google Drive...');
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

  // Enterprise Security, Passkeys, Recovery Codes, Sessions, Versions & Sharing State
  const passkeySupported = useMemo(() => isWebAuthnSupported(), []);
  const [passkeys, setPasskeys] = useState<PasskeyCredentialSummary[]>([]);
  const [passkeyLabelDraft, setPasskeyLabelDraft] = useState('');
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryCodesStatus>({
    totalCount: 0,
    remainingCount: 0,
  });
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);

  const [activeSessions, setActiveSessions] = useState<ActiveSessionRecord[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlertItem[]>([]);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [emailProviderConfig, setEmailProviderConfig] = useState<{
    configured: boolean;
    provider: 'smtp' | 'resend' | 'none';
    fromConfigured: boolean;
    fromAddressPreview?: string;
  }>({ configured: false, provider: 'none', fromConfigured: false });
  const [testEmailBusy, setTestEmailBusy] = useState(false);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [recycleKindFilter, setRecycleKindFilter] = useState<'all' | RecycleBinItemKind>('all');
  const [recycleSearchQuery, setRecycleSearchQuery] = useState('');
  const [confirmClearBin, setConfirmClearBin] = useState(false);

  const [qrApproveCodeDraft, setQrApproveCodeDraft] = useState('');
  const [qrApproveBusy, setQrApproveBusy] = useState(false);

  const [newEmailDraft, setNewEmailDraft] = useState('');

  const [serverVersions, setServerVersions] = useState<WorkspaceVersionRecord[]>([]);
  const [versionsBusy, setVersionsBusy] = useState(false);

  const [shareLinks, setShareLinks] = useState<ShareLinkRecord[]>([]);
  const [shareInvites, setShareInvites] = useState<ShareInviteRecord[]>([]);
  const [shareLogs, setShareLogs] = useState<ShareAccessLogEntry[]>([]);
  const [shareLinkLabel, setShareLinkLabel] = useState('رابط عرض الفريق');
  const [shareLinkRole, setShareLinkRole] = useState<'viewer' | 'editor'>('viewer');
  const [shareLinkHours, setShareLinkHours] = useState('72');
  const [shareLinkPass, setShareLinkPass] = useState('');
  const [shareInviteEmail, setShareInviteEmail] = useState('');
  const [shareInviteRole, setShareInviteRole] = useState<ShareRole>('viewer');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareTestToken, setShareTestToken] = useState('');
  const [shareTestPass, setShareTestPass] = useState('');
  const [shareTestPreview, setShareTestPreview] = useState<{
    role: ShareRole;
    label: string;
    ownerName: string;
    agenciesCount: number;
    personsCount: number;
    notesCount: number;
  } | null>(null);

  const [pendingStepUp, setPendingStepUp] = useState<
    | { kind: 'generate_recovery' }
    | { kind: 'delete_passkey'; credentialId: string }
    | { kind: 'change_email'; newEmail: string }
    | { kind: 'delete_account' }
    | null
  >(null);
  const [reauthPassInput, setReauthPassInput] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [stepUpBusy, setStepUpBusy] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPinDraft(securityPrefs.privacyPin || '');
  }, [securityPrefs.privacyPin]);

  useEffect(() => {
    setLinkUsernameDraft(authUser?.username || '');
  }, [authUser?.username]);

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

  const refreshEnterpriseSecurityData = async () => {
    if (!authUser) {
      setPasskeys([]);
      setRecoveryStatus({ totalCount: 0, remainingCount: 0 });
      setActiveSessions([]);
      setSecurityAlerts([]);
      setServerVersions([]);
      setShareLinks([]);
      setShareInvites([]);
      setShareLogs([]);
      return;
    }
    try {
      const [pk, rc, sess, alertsRes, vers, sharing] = await Promise.all([
        listPasskeysApi(),
        getRecoveryCodesStatusApi(),
        fetchActiveSessionsApi(),
        fetchSecurityAlertsWithConfigApi(),
        fetchWorkspaceVersionsApi(),
        fetchSharingOverviewApi(),
      ]);
      setPasskeys(pk);
      setRecoveryStatus(rc);
      setActiveSessions(sess);
      setSecurityAlerts(alertsRes.alerts);
      setEmailAlertsEnabled(alertsRes.emailAlertsEnabled);
      setEmailProviderConfig(alertsRes.emailNotificationConfig);
      setServerVersions(vers);
      setShareLinks(sharing.links);
      setShareInvites(sharing.invites);
      setShareLogs(sharing.accessLogs);
      if (onRefreshStorageQuota) {
        void onRefreshStorageQuota();
      }
    } catch {
      // ignore transient network errors
    }
  };

  useEffect(() => {
    void refreshEnterpriseSecurityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.uid]);

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

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (passwordInput.length < 6) {
      setAuthError('يرجى إدخال كلمة مرور لا تقل عن 6 أحرف.');
      return;
    }
    try {
      setAuthBusy(true);
      setAuthError('');
      const session = isRegister
        ? await registerWithPasswordApi({
            mode: 'google',
            displayName: displayNameInput.trim() || cleanEmail.split('@')[0],
            email: cleanEmail,
            password: passwordInput,
          })
        : await loginWithPasswordApi({
            mode: 'google',
            identifier: cleanEmail,
            password: passwordInput,
          });
      onAuthenticated(session.user);
      setEmailInput('');
      setDisplayNameInput('');
      setPasswordInput('');
      onNotifySuccess(`مرحباً ${session.user.displayName}، تم تسجيل الدخول بنجاح.`);
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

  const handleLinkUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    const check = validateAuthUsername(linkUsernameDraft);
    if (!check.valid) {
      onNotifyError(check.error || 'يرجى إدخال اسم مستخدم صالح.');
      return;
    }
    if (linkUsernamePassDraft && linkUsernamePassDraft.length < 6) {
      onNotifyError('كلمة المرور الاختيارية يجب أن لا تقل عن 6 أحرف.');
      return;
    }
    try {
      setLinkUsernameBusy(true);
      const session = await linkUsernameApi({
        username: check.normalized,
        password: linkUsernamePassDraft || undefined,
      });
      onAuthenticated(session.user);
      setLinkUsernamePassDraft('');
      onNotifySuccess(`تم ربط المعرّف الفريد (@${session.user.username}) بحسابك الموحّد.`);
    } catch (err) {
      onNotifyError(err instanceof Error ? err.message : 'تعذر ربط اسم المستخدم.');
    } finally {
      setLinkUsernameBusy(false);
    }
  };

  const handleManualForceSync = async () => {
    try {
      setForceSyncBusy(true);
      if (onForceSyncNow) {
        await onForceSyncNow();
      } else {
        await onSyncServer();
      }
      onNotifySuccess('تمت المزامنة الفورية مع السحابة وتأمين التغييرات بنجاح.');
    } catch (err) {
      onNotifyError(
        err instanceof Error ? err.message : 'تعذرت المزامنة الفورية حالياً.'
      );
    } finally {
      setForceSyncBusy(false);
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

  const handleConnectGithubAccount = async () => {
    try {
      setAuthBusy(true);
      setAuthError('');
      const session = await signInWithGithubPopup({ rememberMe: true });
      onAuthenticated(session.user);
      onNotifySuccess(
        `تم تسجيل الدخول بحساب GitHub (${session.user.displayName}) بنجاح.`
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'تعذر تسجيل الدخول عبر GitHub.';
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
    try {
      const uploaded = await runWithSignatureLoader(
        {
          label: overwriteFile
            ? 'جاري تحديث ونشر النسخة على Google Drive...'
            : 'جاري تجهيز ونشر الحزمة إلى Google Drive...',
          subtitle: 'يتم ضغط البيانات والملفات والتحقق من سلامتها قبل الرفع السحابي...',
        },
        async () => {
          const summary = await generateStructuredWorkspaceZip({
            state,
            authUser,
            appName: 'Morrow',
          });
          const res = await uploadDriveBackupFile({
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
          return res;
        }
      );
      onNotifySuccess(`تم رفع النسخة إلى Google Drive بنجاح (${uploaded.name}).`);
    } catch (err) {
      onNotifyError(
        err instanceof Error ? err.message : 'تعذر رفع النسخة إلى Google Drive.'
      );
    }
  };

  const handleDownloadDriveBackup = async (file: GoogleDriveBackupFile) => {
    try {
      await runWithSignatureLoader(
        {
          label: `جاري تنزيل واستيراد «${file.name}» من Drive...`,
          subtitle: 'يتم جلب النسخة السحابية الآمنة وتجهيزها للتنزيل...',
        },
        async () => {
          const blob = await downloadDriveBackupFile(file.id);
          triggerBlobDownload(blob, file.name);
        }
      );
      onNotifySuccess(`تم تنزيل الملف (${file.name}) من Google Drive.`);
    } catch (err) {
      onNotifyError(
        err instanceof Error ? err.message : 'تعذر تنزيل الملف من Google Drive.'
      );
    }
  };

  const handleConfirmDeleteDriveBackup = async (file: GoogleDriveBackupFile) => {
    try {
      setPendingDriveConfirm(null);
      await runWithSignatureLoader(
        {
          label: `جاري حذف النسخة السحابية «${file.name}»...`,
          subtitle: 'يتم تحديث سجل النسخ المحفوظة على Google Drive...',
        },
        async () => {
          await deleteDriveBackupFile(file.id);
          await refreshDriveFiles(driveFolderDraft.trim() || 'Morrow_Drive_Backups');
        }
      );
      onNotifySuccess(`تم حذف النسخة (${file.name}) من Google Drive.`);
    } catch (err) {
      onNotifyError(
        err instanceof Error ? err.message : 'تعذر حذف الملف من Google Drive.'
      );
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
    try {
      const result = await runWithSignatureLoader(
        {
          label: shareDirectly
            ? 'جاري تجهيز الحزمة للمشاركة المباشرة...'
            : 'جاري تجهيز وتصدير المجلد المنظّم المضغوط...',
          subtitle: 'يتم تجميع السجلات والمرفقات والتحقق من التوقيع الرقمي للحزمة...',
        },
        async () => {
          const summary = await generateStructuredWorkspaceZip({
            state,
            authUser,
            appName: 'Morrow',
          });

          let outcome: 'shared' | 'downloaded' = 'downloaded';
          if (shareDirectly) {
            const shareSummaryText = `حزمة بيانات Morrow المنظمة (${summary.rootFolder}) — ${state.agencies.length} وكالة و${state.persons.length} مستفيد.`;
            outcome = await directShareStructuredExport(summary, shareSummaryText);
          } else {
            triggerBlobDownload(summary.blob, summary.zipFilename);
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

          return { summary, outcome };
        }
      );

      if (shareDirectly) {
        onNotifySuccess(
          result.outcome === 'shared'
            ? 'تم فتح نافذة المشاركة المباشرة لحزمة البيانات المنظمة.'
            : `تم تنزيل الحزمة المنظمة (${result.summary.zipFilename}) بنجاح.`
        );
      } else {
        onNotifySuccess(`تم إنشاء وتنزيل المجلد المنظّم: ${result.summary.zipFilename}`);
      }
    } catch (err) {
      onNotifyError(
        err instanceof Error ? err.message : 'تعذر إنشاء حزمة التصدير المنظم.'
      );
    }
  };

  // --- Backup JSON / Memory Vault Local Handlers ---
  const handleExportJsonBackup = async () => {
    await runWithSignatureLoader(
      {
        label: 'جاري تجهيز وتصدير لقطة الذاكرة الكاملة (Memory Vault)...',
        subtitle: 'يتم تجميع جميع الوكالات والسجلات والتفضيلات وسجل التدقيق مع بصمة التحقق...',
      },
      () => {
        const exported = onExportMemoryVaultJson
          ? onExportMemoryVaultJson()
          : createMemoryVaultExport(state);
        const blob = new Blob([exported.jsonText], {
          type: 'application/json;charset=utf-8',
        });
        triggerBlobDownload(
          blob,
          `morrow-memory-vault-${new Date().toISOString().slice(0, 10)}.json`
        );
      }
    );
    onNotifySuccess('تم تنزيل لقطة الذاكرة الكاملة (Memory Vault JSON) بنجاح.');
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await onImportWorkspaceJson(text);
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
    <div
      dir="rtl"
      data-assistant-target="account-security-root"
      className="mx-auto w-full max-w-6xl space-y-5 px-3 py-5 sm:px-6 sm:py-6"
    >
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
            {authUser && (
              <button
                type="button"
                disabled={forceSyncBusy || syncStatus === 'syncing' || !isOnline}
                onClick={() => void handleManualForceSync()}
                className="nexus-pill-btn inline-flex min-h-[42px] items-center gap-2 border px-4 py-2 text-xs font-extrabold disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    forceSyncBusy || syncStatus === 'syncing' ? 'animate-spin' : ''
                  }`}
                  style={{ color: 'var(--accent)' }}
                />
                <span>
                  {forceSyncBusy || syncStatus === 'syncing'
                    ? 'جاري المزامنة...'
                    : 'مزامنة فورية'}
                </span>
              </button>
            )}

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
              {!isOnline || syncStatus === 'pending_offline' ? (
                <WifiOff className="h-4 w-4 shrink-0" style={{ color: 'var(--warning)' }} />
              ) : syncStatus === 'cloud_synced' ? (
                <Cloud className="h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />
              ) : (
                <CheckCircle2
                  className="h-4 w-4 shrink-0"
                  style={{
                    color: checkpoint?.lastSavedAt ? 'var(--success)' : 'var(--text-muted)',
                  }}
                />
              )}
              <span>حالة المزامنة:</span>
              <span style={{ color: 'var(--accent)' }}>
                {!isOnline || syncStatus === 'pending_offline'
                  ? `معلق دون إنترنت (${syncQueue.filter((q) => q.status !== 'synced').length})`
                  : syncStatus === 'conflict_saved'
                  ? `تعارض محفوظ — نسختان (${conflictCopies.length})`
                  : syncStatus === 'syncing'
                  ? 'جاري المزامنة السحابية...'
                  : syncStatus === 'cloud_synced'
                  ? realtimeConnected
                    ? 'متزامن الآن · حي (WS)'
                    : 'متزامن سحابياً عبر الأجهزة'
                  : 'محفوظ محلياً'}
              </span>
            </span>

            <span className="flex items-center gap-1.5 font-bold">
              <CheckCircle2
                className="h-4 w-4 shrink-0"
                style={{
                  color: checkpoint?.lastSavedAt ? 'var(--success)' : 'var(--text-muted)',
                }}
              />
              <span>آخر حفظ ناجح:</span>
              <span style={{ color: 'var(--accent)' }}>
                {formatDateTimeArabic(checkpoint?.lastSavedAt || state.lastSyncedAt)}
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

        {/* Cloud SQL Fallback Warning Banner */}
        {storageStatus?.storageMode === 'local_fallback' && (
          <div
            role="status"
            className="flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3 text-xs"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--warning) 10%, var(--bg-main))',
              borderColor: 'color-mix(in srgb, var(--warning) 45%, var(--border-color))',
            }}
          >
            <Database
              className="h-4 w-4 shrink-0 mt-0.5"
              style={{ color: 'var(--warning)' }}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="font-black" style={{ color: 'var(--warning)' }}>
                وضع التخزين السحابي المؤقت (قاعدة البيانات السحابية غير مهيأة بعد)
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                تُحفظ التعديلات تلقائياً بأمان داخل المتصفح (IndexedDB) وفي سجل الخادم المحلي؛ وعند ضبط متغيرات Cloud SQL في بيئة النشر ستنتقل المزامنة تلقائياً عبر جميع الأجهزة دون فقدان أي بيانات.
              </p>
            </div>
          </div>
        )}

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
              className="nexus-pill-btn relative flex min-h-[44px] items-center justify-center gap-2 overflow-hidden border px-3 py-2 text-xs font-extrabold transition-all"
              style={{
                backgroundColor: active ? 'transparent' : 'var(--bg-surface)',
                borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                color: active ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              {active && (
                <motion.span
                  layoutId="account-hub-tab-pill"
                  transition={reducedMotion ? { duration: 0.05 } : TABRIX_SPRING}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ backgroundColor: 'var(--bg-nav-active)' }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4 shrink-0" />
              <span className="relative z-10 truncate">{label}</span>
            </button>
          );
        })}
      </div>

      <TabrixSubViewTransition viewKey={activeTab} direction={tabDirection}>
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
                    تسجيل الدخول عبر Google أو GitHub أو اليوزر أو البريد الإلكتروني
                  </p>
                </div>
              </div>
              {authUser && (
                <button
                  type="button"
                  onClick={() => {
                    onLoggedOut();
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
              <div className="space-y-3">
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
                      {authUser.email || authUser.username}
                      {authUser.username && authUser.email
                        ? ` · @${authUser.username}`
                        : ''}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      المعرّف الموحّد: {authUser.uid}
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

                {/* Username Linking Card for Unified Cross-Provider Login */}
                <form
                  onSubmit={handleLinkUsernameSubmit}
                  className="rounded-2xl border p-3.5 space-y-2.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-black">
                      <AtSign className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                      <span>ربط اسم المستخدم الفريد بالحساب الموحّد</span>
                    </div>
                    {authUser.username && (
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: 'var(--success)' }}
                        dir="ltr"
                      >
                        @{authUser.username}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    اربط اسم مستخدم فريد (مثل ali_90) لتتمكن من الدخول إلى نفس البيانات من أي جهاز حتى بدون Google أو GitHub.
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={linkUsernameDraft}
                      onChange={(e) =>
                        setLinkUsernameDraft(normalizeUsernameInput(e.target.value))
                      }
                      placeholder="ali_agency90"
                      className="w-full rounded-xl border px-3 py-2 text-left text-xs"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <input
                      type="password"
                      dir="ltr"
                      value={linkUsernamePassDraft}
                      onChange={(e) => setLinkUsernamePassDraft(e.target.value)}
                      placeholder="كلمة مرور اختيارية (6+ أحرف)"
                      className="w-full rounded-xl border px-3 py-2 text-left text-xs"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={linkUsernameBusy || !linkUsernameDraft.trim()}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 font-extrabold disabled:opacity-50"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  >
                    <AtSign className="h-3.5 w-3.5" />
                    <span>
                      {linkUsernameBusy
                        ? 'جاري الربط...'
                        : authUser.username
                        ? 'تحديث اسم المستخدم'
                        : 'ربط اسم المستخدم الآن'}
                    </span>
                  </button>
                </form>
              </div>
            )}
            {/* Login / Switch Tabs */}
            <div
              className="grid grid-cols-2 gap-1 rounded-2xl p-1 text-xs"
              style={{ backgroundColor: 'var(--bg-main)' }}
            >
              {(
                [
                  ['google', 'Google / GitHub / البريد', Mail],
                  ['username', 'اسم المستخدم', User],
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

                <button
                  type="button"
                  data-testid="hub-github-login-btn"
                  disabled={authBusy}
                  onClick={() => void handleConnectGithubAccount()}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-2 font-extrabold transition-colors hover:opacity-95"
                  style={{
                    backgroundColor: '#161b22',
                    borderColor: '#30363d',
                    color: '#f0f6fc',
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>Sign in with GitHub · تسجيل الدخول بحساب GitHub</span>
                </button>

                <div
                  className="flex items-center gap-2 text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="h-px flex-1" style={{ backgroundColor: 'var(--border-color)' }} />
                  <span>أو الدخول بالبريد وكلمة المرور</span>
                  <span className="h-px flex-1" style={{ backgroundColor: 'var(--border-color)' }} />
                </div>

                <form onSubmit={handleEmailPasswordSubmit} className="space-y-3">
                  <div>
                    <label className="mb-1 block font-bold">البريد الإلكتروني</label>
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
                  {isRegister && (
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
                  )}
                  <div>
                    <label className="mb-1 block font-bold">كلمة المرور</label>
                    <input
                      type="password"
                      dir="ltr"
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border px-3 py-2 text-left text-sm"
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
                    {authBusy
                      ? 'يرجى الانتظار...'
                      : isRegister
                      ? 'إنشاء حساب بالبريد'
                      : 'تسجيل الدخول بالبريد'}
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

          {authUser && (
            <>
              {/* Passkeys, Recovery Codes, Email Change & QR Cross-Device Approval */}
              <section className="nexus-squircle p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <NexusDuotoneIcon tone="gold" size="sm">
                    <Fingerprint className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div>
                    <h2 className="text-sm font-black">
                      مفاتيح المرور (Passkeys) ورموز الاسترجاع وربط الأجهزة
                    </h2>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      دخول بالبصمة/Face ID، رموز طوارئ أحادية، وموافقة سريعة على دخول QR
                    </p>
                  </div>
                </div>

                {/* Passkeys Section */}
                <div
                  className="rounded-2xl border p-3.5 space-y-2.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-black">
                      <Fingerprint className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <span>مفاتيح المرور Passkeys ({passkeys.length})</span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {passkeySupported ? 'WebAuthn مدعوم في متصفحك' : 'غير مدعوم بهذا المتصفح'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={passkeyLabelDraft}
                      onChange={(e) => setPasskeyLabelDraft(e.target.value)}
                      placeholder="اسم الجهاز (مثال: iPhone / MacBook)"
                      className="min-w-[170px] flex-1 rounded-xl border px-3 py-1.5 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <button
                      type="button"
                      disabled={passkeyBusy || !passkeySupported}
                      onClick={async () => {
                        try {
                          setPasskeyBusy(true);
                          await registerPasskeyWithServer(passkeyLabelDraft.trim() || undefined);
                          setPasskeyLabelDraft('');
                          await refreshEnterpriseSecurityData();
                          onNotifySuccess('تم تسجيل مفتاح المرور (Passkey) بنجاح.');
                        } catch (err) {
                          onNotifyError(
                            err instanceof Error ? err.message : 'تعذر إضافة مفتاح المرور.'
                          );
                        } finally {
                          setPasskeyBusy(false);
                        }
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-extrabold disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{passkeyBusy ? 'جاري التسجيل...' : 'إضافة Passkey'}</span>
                    </button>
                  </div>

                  {passkeys.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {passkeys.map((pk) => (
                        <div
                          key={pk.id}
                          className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-bold">{pk.label}</div>
                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              أُضيف {formatDateTimeArabic(pk.createdAt)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setReauthPassInput('');
                              setPendingStepUp({ kind: 'delete_passkey', credentialId: pk.id });
                            }}
                            className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--danger)' }}
                          >
                            إزالة
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recovery Codes Section */}
                <div
                  className="rounded-2xl border p-3.5 space-y-2.5 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-black">
                      <KeyRound className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <span>رموز الاسترجاع أحادية الاستخدام</span>
                    </div>
                    <span
                      className="font-mono text-[11px] font-bold"
                      style={{
                        color:
                          recoveryStatus.remainingCount > 0 ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      المتبقي: {recoveryStatus.remainingCount} / {recoveryStatus.totalCount || 8}
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    احفظ رموز الطوارئ في مكان آمن لاستعادة الحساب عند فقدان البريد أو الجهاز.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReauthPassInput('');
                      setPendingStepUp({ kind: 'generate_recovery' });
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 font-extrabold"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>توليد 8 رموز استرجاع جديدة</span>
                  </button>

                  {generatedCodes && generatedCodes.length > 0 && (
                    <div
                      className="rounded-xl border p-3 space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--accent)',
                      }}
                    >
                      <div className="text-[11px] font-black" style={{ color: 'var(--accent)' }}>
                        احتفظ بهذه الرموز الآن (تُعرض مرة واحدة فقط):
                      </div>
                      <div dir="ltr" className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs font-black">
                        {generatedCodes.map((code) => (
                          <div
                            key={code}
                            className="rounded-lg border px-2 py-1 text-center"
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            {code}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(generatedCodes.join('\n'));
                              onNotifySuccess('تم نسخ رموز الاسترجاع إلى الحافظة.');
                            } catch {
                              onNotifyError('تعذر النسخ التلقائي.');
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>نسخ الكل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob(
                              [
                                `Morrow Recovery Codes (${authUser.displayName})\nGenerated: ${new Date().toISOString()}\n\n${generatedCodes.join('\n')}\n`,
                              ],
                              { type: 'text/plain;charset=utf-8' }
                            );
                            triggerBlobDownload(blob, 'morrow-recovery-codes.txt');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-bold"
                          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>تنزيل TXT</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* QR Cross-Device Approval & Email Change */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                  <div
                    className="rounded-2xl border p-3 space-y-2"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 font-black">
                      <QrCode className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <span>تأكيد دخول جهاز جديد (QR)</span>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        dir="ltr"
                        value={qrApproveCodeDraft}
                        onChange={(e) => setQrApproveCodeDraft(e.target.value.toUpperCase())}
                        placeholder="QR8-CODE"
                        className="w-full rounded-xl border px-3 py-1.5 font-mono text-left text-xs"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                      <button
                        type="button"
                        disabled={qrApproveBusy || !qrApproveCodeDraft.trim()}
                        onClick={async () => {
                          try {
                            setQrApproveBusy(true);
                            await approveQrPairingApi(qrApproveCodeDraft.trim());
                            setQrApproveCodeDraft('');
                            await refreshEnterpriseSecurityData();
                            onNotifySuccess('تمت الموافقة على دخول الجهاز الجديد فوراً.');
                          } catch (err) {
                            onNotifyError(
                              err instanceof Error ? err.message : 'رمز QR غير صالح أو منتهي.'
                            );
                          } finally {
                            setQrApproveBusy(false);
                          }
                        }}
                        className="shrink-0 rounded-xl px-3 py-1.5 font-extrabold disabled:opacity-50"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                      >
                        موافقة
                      </button>
                    </div>
                  </div>

                  <div
                    className="rounded-2xl border p-3 space-y-2"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 font-black">
                      <Mail className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <span>تغيير البريد الإلكتروني</span>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="email"
                        dir="ltr"
                        value={newEmailDraft}
                        onChange={(e) => setNewEmailDraft(e.target.value)}
                        placeholder={authUser.email || 'new@example.com'}
                        className="w-full rounded-xl border px-3 py-1.5 text-left text-xs"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                      <button
                        type="button"
                        disabled={!newEmailDraft.trim().includes('@')}
                        onClick={() => {
                          setReauthPassInput('');
                          setPendingStepUp({
                            kind: 'change_email',
                            newEmail: newEmailDraft.trim(),
                          });
                        }}
                        className="shrink-0 rounded-xl border px-3 py-1.5 font-extrabold disabled:opacity-50"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                      >
                        تحديث
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Active Sessions (Remote Logout) & New-Device Security Alerts */}
              <section className="nexus-squircle p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <NexusDuotoneIcon tone="emerald" size="sm">
                      <ShieldCheck className="h-4 w-4" />
                    </NexusDuotoneIcon>
                    <div>
                      <h2 className="text-sm font-black">
                        الجلسات النشطة والتنبيهات الأمنية ({activeSessions.length})
                      </h2>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        إدارة الأجهزة المسجلة، تسجيل الخروج عن بُعد، وسجل التنبيهات الفوري
                      </p>
                    </div>
                  </div>

                  {activeSessions.length > 1 && (
                    <button
                      type="button"
                      disabled={sessionsBusy}
                      onClick={async () => {
                        try {
                          setSessionsBusy(true);
                          const count = await revokeOtherSessionsApi();
                          await refreshEnterpriseSecurityData();
                          onNotifySuccess(
                            `تم تسجيل الخروج عن بُعد من ${count} جلسة أخرى بنجاح.`
                          );
                        } catch (err) {
                          onNotifyError(
                            err instanceof Error ? err.message : 'تعذر إنهاء الجلسات الأخرى.'
                          );
                        } finally {
                          setSessionsBusy(false);
                        }
                      }}
                      className="rounded-xl border px-3 py-1.5 text-[11px] font-extrabold"
                      style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    >
                      إنهاء كل الجلسات الأخرى
                    </button>
                  )}
                </div>

                <div className="max-h-[210px] space-y-1.5 overflow-y-auto text-xs">
                  {activeSessions.length === 0 ? (
                    <div
                      className="rounded-xl border p-4 text-center text-[11px]"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      لا توجد جلسات أخرى نشطة حالياً.
                    </div>
                  ) : (
                    activeSessions.map((sess) => (
                      <div
                        key={sess.sid}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: sess.isCurrent ? 'var(--accent)' : 'var(--border-color)',
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 font-bold">
                            <span className="truncate">{sess.deviceLabel}</span>
                            {sess.isCurrent && (
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-black"
                                style={{
                                  backgroundColor: 'var(--bg-nav-active)',
                                  color: 'var(--accent)',
                                }}
                              >
                                هذا الجهاز
                              </span>
                            )}
                          </div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            آخر نشاط: {formatDateTimeArabic(sess.lastActiveAt)}
                          </div>
                        </div>
                        {!sess.isCurrent && (
                          <button
                            type="button"
                            disabled={sessionsBusy}
                            onClick={async () => {
                              try {
                                setSessionsBusy(true);
                                await revokeSessionApi(sess.sid);
                                await refreshEnterpriseSecurityData();
                                onNotifySuccess('تم إنهاء الجلسة عن بُعد وإبطال رمزها فوراً.');
                              } catch (err) {
                                onNotifyError(
                                  err instanceof Error ? err.message : 'تعذر إنهاء الجلسة.'
                                );
                              } finally {
                                setSessionsBusy(false);
                              }
                            }}
                            className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--danger)' }}
                          >
                            خروج عن بُعد
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Email Security Notifications & Alerts Feed */}
                <div
                  className="border-t pt-3 space-y-2.5 text-xs"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-black">
                    <span className="flex items-center gap-1.5">
                      <Bell className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                      <span>إشعارات البريد وتنبيهات الأجهزة غير المعروفة ({securityAlerts.length})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={testEmailBusy}
                        onClick={async () => {
                          try {
                            setTestEmailBusy(true);
                            const res = await sendTestSecurityEmailApi();
                            if (res.status === 'sent') {
                              onNotifySuccess(`تم إرسال بريد التنبيه التجريبي بنجاح (${res.provider}).`);
                            } else if (res.status === 'not_configured') {
                              onNotifyError('سُجّل التنبيه محلياً؛ أضف SMTP_HOST أو RESEND_API_KEY في أسرار الخادم لتفعيل الإرسال الفعلي.');
                            } else if (res.status === 'skipped_no_email') {
                              onNotifyError('أضف بريدك الإلكتروني في إعدادات الحساب أولاً لاستلام التنبيهات.');
                            } else {
                              onNotifyError(res.error || 'تعذر إرسال رسالة الاختبار.');
                            }
                            await refreshEnterpriseSecurityData();
                          } catch (err) {
                            onNotifyError(err instanceof Error ? err.message : 'فشل اختبار الإرسال.');
                          } finally {
                            setTestEmailBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--accent)' }}
                      >
                        <Mail className="h-3 w-3" />
                        <span>{testEmailBusy ? 'جارٍ الإرسال…' : 'بريد تجريبي'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void refreshEnterpriseSecurityData()}
                        className="text-[11px] font-bold"
                        style={{ color: 'var(--accent)' }}
                      >
                        تحديث
                      </button>
                    </div>
                  </div>

                  {/* Email Notification Transport & Preference Bar */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px]"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold">
                        {emailProviderConfig.configured
                          ? `خادم البريد نشط (${emailProviderConfig.provider.toUpperCase()}${emailProviderConfig.fromAddressPreview ? ` · ${emailProviderConfig.fromAddressPreview}` : ''})`
                          : 'إرسال البريد الفعلي بانتظار ضبط متغيرات SMTP أو RESEND_API_KEY'}
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        يُرسل تنبيه فوري عند أي محاولة دخول ناجحة أو فاشلة من متصفح أو جهاز جديد
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = !emailAlertsEnabled;
                        try {
                          await updateEmailAlertsPreferenceApi(next);
                          setEmailAlertsEnabled(next);
                          onNotifySuccess(
                            next
                              ? 'تم تفعيل تنبيهات البريد للدخول من أجهزة غير معروفة.'
                              : 'تم إيقاف إشعارات البريد الفورية مؤقتاً.'
                          );
                        } catch (err) {
                          onNotifyError(err instanceof Error ? err.message : 'تعذر التحديث.');
                        }
                      }}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
                      style={{
                        backgroundColor: emailAlertsEnabled
                          ? 'var(--success)'
                          : 'var(--bg-nav-active)',
                        color: emailAlertsEnabled ? 'var(--success-fg)' : 'var(--text-muted)',
                      }}
                    >
                      {emailAlertsEnabled ? 'تنبيهات البريد مفعّلة' : 'تنبيهات البريد متوقفة'}
                    </button>
                  </div>

                  <div className="max-h-[210px] space-y-1.5 overflow-y-auto">
                    {securityAlerts.length === 0 ? (
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        لم تُسجّل أي تنبيهات أمنية بعد.
                      </div>
                    ) : (
                      securityAlerts.slice(0, 15).map((alert) => {
                        const emailBadgeText =
                          alert.emailDeliveryStatus === 'sent'
                            ? `أُرسل بالبريد (${(alert.emailDeliveryProvider || 'smtp').toUpperCase()})`
                            : alert.emailDeliveryStatus === 'failed'
                              ? 'فشل الإرسال البريدي'
                              : alert.emailDeliveryStatus === 'skipped_no_email'
                                ? 'الحساب بلا بريد'
                                : alert.emailDeliveryStatus === 'throttled'
                                  ? 'مؤجّل لمنع التكرار'
                                  : alert.emailDeliveryStatus === 'not_configured'
                                    ? 'SMTP غير مضبوط'
                                    : null;
                        return (
                          <div
                            key={alert.id}
                            className="rounded-xl border px-3 py-2 space-y-1"
                            style={{
                              backgroundColor: 'var(--bg-main)',
                              borderColor:
                                alert.attemptOutcome === 'failed'
                                  ? 'var(--danger)'
                                  : 'var(--border-color)',
                            }}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span className="font-bold">{alert.title}</span>
                              <div className="flex flex-wrap items-center gap-1">
                                {alert.attemptOutcome && (
                                  <span
                                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                                    style={{
                                      backgroundColor: 'var(--bg-nav-active)',
                                      color:
                                        alert.attemptOutcome === 'failed'
                                          ? 'var(--danger)'
                                          : 'var(--success)',
                                    }}
                                  >
                                    {alert.attemptOutcome === 'failed' ? 'محاولة فاشلة' : 'دخول ناجح'}
                                  </span>
                                )}
                                {emailBadgeText && (
                                  <span
                                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                                    style={{
                                      backgroundColor: 'var(--bg-nav-active)',
                                      color:
                                        alert.emailDeliveryStatus === 'sent'
                                          ? 'var(--success)'
                                          : alert.emailDeliveryStatus === 'failed'
                                            ? 'var(--danger)'
                                            : 'var(--accent)',
                                    }}
                                  >
                                    {emailBadgeText}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {alert.summary}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              <span>{formatDateTimeArabic(alert.createdAt)}</span>
                              {alert.browserLabel && <span>· {alert.browserLabel}</span>}
                              {alert.ipMasked && <span dir="ltr">· {alert.ipMasked}</span>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
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
                  disabled={forceSyncBusy || syncStatus === 'syncing' || !isOnline}
                  onClick={() => void handleManualForceSync()}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-4 py-2 font-extrabold disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                  }}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      forceSyncBusy || syncStatus === 'syncing' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {forceSyncBusy || syncStatus === 'syncing'
                      ? 'جاري المزامنة الفورية...'
                      : 'مزامنة فورية الآن (Force Sync)'}
                  </span>
                </button>

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

              {/* Sync Queue Metrics */}
              {syncQueue.length > 0 && (
                <div
                  className="grid grid-cols-3 gap-2 rounded-2xl border p-3 text-center text-[11px]"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div>
                    <div className="font-black tabular-nums" style={{ color: 'var(--warning)' }}>
                      {syncQueue.filter((q) => q.status === 'pending').length}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>قيد الانتظار</div>
                  </div>
                  <div>
                    <div className="font-black tabular-nums" style={{ color: 'var(--success)' }}>
                      {syncQueue.filter((q) => q.status === 'synced').length}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>متزامنة</div>
                  </div>
                  <div>
                    <div className="font-black tabular-nums" style={{ color: 'var(--danger)' }}>
                      {syncQueue.filter((q) => q.status === 'failed').length}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>تحتاج إعادة</div>
                  </div>
                </div>
              )}

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
                    'linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%)',
                  color: 'var(--accent-fg, #021712)',
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
                  <span>خزنة الذاكرة الكاملة (Memory Vault · JSON)</span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  تصدير أو استيراد لقطة الذاكرة الشاملة متضمنة جميع السجلات والتفضيلات الذكية وسجل التدقيق مع بصمة فحص السلامة.
                </p>
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
                    <span>تصدير لقطة الذاكرة JSON</span>
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
                    <span>استيراد لقطة الذاكرة</span>
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

          {/* 50MB Storage Quota + Chunk Deduplication + Selective Sync + Real-Time Push */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="nexus-squircle p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <NexusDuotoneIcon tone="emerald" size="sm">
                    <HardDrive className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div>
                    <h2 className="text-sm font-black">حصة التخزين ومنع تكرار القطع (Chunk Dedup)</h2>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      تقسيم البيانات لقطع 32 ك.ب بـ SHA-256 ورفع الجزء المتغير فقط
                    </p>
                  </div>
                </div>
                {authUser && onRefreshStorageQuota && (
                  <button
                    type="button"
                    onClick={() => void onRefreshStorageQuota()}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border"
                    style={{ borderColor: 'var(--border-color)' }}
                    title="تحديث الحصة"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {storageQuota ? (
                <div
                  className="rounded-2xl border p-3.5 space-y-2 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      المستخدم: {(storageQuota.usedBytes / (1024 * 1024)).toFixed(2)} MB من{' '}
                      {(storageQuota.quotaBytes / (1024 * 1024)).toFixed(0)} MB
                    </span>
                    <span className="font-mono" style={{ color: 'var(--accent)' }}>
                      {Math.min(
                        100,
                        Math.round(
                          (storageQuota.usedBytes / Math.max(1, storageQuota.quotaBytes)) * 100
                        )
                      )}
                      %
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--bg-surface)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            2,
                            Math.round(
                              (storageQuota.usedBytes / Math.max(1, storageQuota.quotaBytes)) *
                                100
                            )
                          )
                        )}%`,
                        backgroundColor: 'var(--accent)',
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span>عدد القطع المخزنة: {storageQuota.chunkCount}</span>
                    <span style={{ color: 'var(--success)' }}>
                      وفّر التكرار الذكي: {Math.round(storageQuota.dedupSavedBytes / 1024)} KB
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-2xl border p-4 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  سجّل الدخول لعرض حصة التخزين السحابي وحجم القطع الممنوعة التكرار.
                </div>
              )}

              {/* Selective Sync Toggles & Browser Push Notifications */}
              <div className="space-y-2 text-xs">
                <div className="font-black">المزامنة الانتقائية حسب نوع البيانات:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(
                    [
                      ['syncRecords', 'الوكالات والمستفيدون والمالية'],
                      ['syncAttachments', 'الصور والمستندات المرفقة'],
                      ['syncArchives', 'الأرشيف الشهري'],
                      ['syncNotes', 'الملاحظات والأفكار'],
                      ['syncSettings', 'الإعدادات والمظهر'],
                    ] as Array<[keyof SelectiveSyncPrefs, string]>
                  ).map(([key, label]) => {
                    const current = securityPrefs.selectiveSync || {
                      syncRecords: true,
                      syncAttachments: true,
                      syncArchives: true,
                      syncNotes: true,
                      syncSettings: true,
                    };
                    return (
                      <label
                        key={key}
                        className="flex min-h-[38px] cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-1.5 font-bold"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <span className="truncate">{label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(current[key])}
                          onChange={(e) =>
                            onUpdateSecurityPrefs({
                              selectiveSync: {
                                ...current,
                                [key]: e.target.checked,
                              },
                            })
                          }
                        />
                      </label>
                    );
                  })}
                </div>

                <label
                  className="flex min-h-[42px] cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    <span>تفعيل إشعارات Push الفورية للتعديلات الأمنية والمزامنة</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(securityPrefs.pushAlertsEnabled)}
                    onChange={async (e) => {
                      const nextVal = e.target.checked;
                      if (
                        nextVal &&
                        typeof window !== 'undefined' &&
                        'Notification' in window &&
                        Notification.permission === 'default'
                      ) {
                        try {
                          await Notification.requestPermission();
                        } catch {
                          // ignore denied or restricted browser notification dialog
                        }
                      }
                      onUpdateSecurityPrefs({ pushAlertsEnabled: nextVal });
                    }}
                  />
                </label>
              </div>
            </section>

            {/* Dual-Copy Conflict Resolver ("نسختان") & 30-Day Server Version History */}
            <section className="nexus-squircle p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <NexusDuotoneIcon tone="gold" size="sm">
                    <History className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div>
                    <h2 className="text-sm font-black">
                      سجل الإصدارات (30 يوماً) وحل التعارضات ({serverVersions.length})
                    </h2>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      دمج CRDT للنصوص والملاحظات، وحفظ نسختين عند التعارض، واستعادة إصدارات السيرفر
                    </p>
                  </div>
                </div>
                {authUser && (
                  <button
                    type="button"
                    disabled={versionsBusy}
                    onClick={async () => {
                      setVersionsBusy(true);
                      try {
                        const list = await fetchWorkspaceVersionsApi();
                        setServerVersions(list);
                      } finally {
                        setVersionsBusy(false);
                      }
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${versionsBusy ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {/* Preserved Dual-Copy Conflict Resolution Box */}
              {conflictCopies.length > 0 && (
                <div
                  className="rounded-2xl border p-3.5 space-y-2 text-xs"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--warning) 10%, var(--bg-main))',
                    borderColor: 'var(--warning)',
                  }}
                >
                  <div className="font-black" style={{ color: 'var(--warning)' }}>
                    تعارضات محفوظة على هيئة نسختين ({conflictCopies.length})
                  </div>
                  {conflictCopies.map((copy) => (
                    <div
                      key={copy.id}
                      className="rounded-xl border p-2.5 space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="font-bold">
                        {copy.entityLabel} — {copy.reason}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        جهاز {copy.localDeviceId} ↔ {copy.remoteDeviceId} ·{' '}
                        {formatDateTimeArabic(copy.createdAt)}
                      </div>
                      {onResolveConflictCopy && (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => onResolveConflictCopy(copy.id, 'keep_current')}
                            className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            إبقاء النسخة الحالية
                          </button>
                          <button
                            type="button"
                            onClick={() => onResolveConflictCopy(copy.id, 'restore_copy')}
                            className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
                            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                          >
                            استعادة النسخة المحفوظة
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Server 30-Day Version History List */}
              {!authUser ? (
                <div
                  className="rounded-2xl border p-5 text-center text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  سجّل الدخول لعرض سجل إصدارات الخادم خلال آخر 30 يوماً.
                </div>
              ) : serverVersions.length === 0 ? (
                <div
                  className="rounded-2xl border p-5 text-center text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  لا توجد إصدارات سحابية محفوظة بعد؛ تُنشأ تلقائياً مع كل مزامنة.
                </div>
              ) : (
                <div className="max-h-[245px] space-y-2 overflow-y-auto text-xs">
                  {serverVersions.slice(0, 20).map((ver) => (
                    <div
                      key={ver.versionId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">
                          #{ver.versionNumber} · {ver.label} ({ver.recordCount} سجل / {ver.agencyCount} وكالة)
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {formatDateTimeArabic(ver.createdAt)} · الجهاز: {ver.deviceId} ·{' '}
                          {Math.max(1, Math.round(ver.sizeBytes / 1024))} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={versionsBusy}
                        onClick={async () => {
                          try {
                            setVersionsBusy(true);
                            const res = await restoreWorkspaceVersionApi(ver.versionId);
                            if (onApplyServerSnapshot && res.snapshot) {
                              await onApplyServerSnapshot(res.snapshot);
                            }
                            onNotifySuccess('تمت استعادة الإصدار المختار من السحابة بنجاح.');
                          } catch (err) {
                            onNotifyError(
                              err instanceof Error ? err.message : 'تعذر استرجاع الإصدار.'
                            );
                          } finally {
                            setVersionsBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>استرجاع</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Server-Enforced Sharing Links, Member Invites (RBAC) & Access Audit Log */}
          {authUser && (
            <section className="nexus-squircle p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <NexusDuotoneIcon tone="ai" size="sm">
                    <Users className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div>
                    <h2 className="text-sm font-black">
                      المشاركة الآمنة والصلاحيات على الخادم (RBAC)
                    </h2>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      روابط بصلاحية عرض/تعديل وتاريخ انتهاء وكلمة مرور، دعوات مالك/محرر/مشاهد، وإلغاء فوري
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 text-xs">
                {/* Create Share Link */}
                <div
                  className="rounded-2xl border p-4 space-y-2.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-1.5 font-black">
                    <Link2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>إنشاء رابط مشاركة محمي</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={shareLinkLabel}
                      onChange={(e) => setShareLinkLabel(e.target.value)}
                      placeholder="وصف الرابط"
                      className="rounded-xl border px-3 py-1.5"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <select
                      value={shareLinkRole}
                      onChange={(e) =>
                        setShareLinkRole(e.target.value as 'viewer' | 'editor')
                      }
                      className="rounded-xl border px-3 py-1.5 font-bold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <option value="viewer">مشاهد فقط (Viewer)</option>
                      <option value="editor">محرر (Editor)</option>
                    </select>
                    <input
                      type="number"
                      dir="ltr"
                      min={1}
                      max={720}
                      value={shareLinkHours}
                      onChange={(e) => setShareLinkHours(e.target.value)}
                      placeholder="الانتهاء بالساعات (72)"
                      className="rounded-xl border px-3 py-1.5 text-left"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <input
                      type="password"
                      dir="ltr"
                      value={shareLinkPass}
                      onChange={(e) => setShareLinkPass(e.target.value)}
                      placeholder="كلمة مرور اختيارية"
                      className="rounded-xl border px-3 py-1.5 text-left"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={shareBusy}
                    onClick={async () => {
                      try {
                        setShareBusy(true);
                        await createShareLinkApi({
                          label: shareLinkLabel.trim() || 'رابط مشاركة',
                          role: shareLinkRole,
                          expiresInHours: Number(shareLinkHours) || 72,
                          password: shareLinkPass.trim() || undefined,
                        });
                        setShareLinkPass('');
                        await refreshEnterpriseSecurityData();
                        onNotifySuccess('تم إنشاء رابط المشاركة وتأمين صلاحياته على الخادم.');
                      } catch (err) {
                        onNotifyError(
                          err instanceof Error ? err.message : 'تعذر إنشاء الرابط.'
                        );
                      } finally {
                        setShareBusy(false);
                      }
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-4 py-1.5 font-extrabold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>توليد رابط مشاركة</span>
                  </button>

                  {shareLinks.length > 0 && (
                    <div className="space-y-1.5 pt-2 max-h-[160px] overflow-y-auto">
                      {shareLinks.map((lnk) => (
                        <div
                          key={lnk.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: lnk.revokedAt ? 'var(--danger)' : 'var(--border-color)',
                            opacity: lnk.revokedAt ? 0.6 : 1,
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold truncate">
                              {lnk.label} · ({lnk.role === 'editor' ? 'محرر' : 'مشاهد'})
                            </div>
                            <div dir="ltr" className="font-mono text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {lnk.token} {lnk.hasPassword ? '🔒' : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!lnk.revokedAt && (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setShareTestToken(lnk.token);
                                    try {
                                      await navigator.clipboard.writeText(lnk.token);
                                      onNotifySuccess('تم نسخ رمز الرابط وتجهيزه للاختبار.');
                                    } catch {
                                      onNotifySuccess('تم تحديد رمز الرابط للاختبار.');
                                    }
                                  }}
                                  className="rounded-lg border px-2 py-1 text-[10px] font-bold"
                                  style={{ borderColor: 'var(--border-color)' }}
                                >
                                  نسخ / فحص
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await revokeShareLinkApi(lnk.id);
                                    await refreshEnterpriseSecurityData();
                                    onNotifySuccess('تم إلغاء رابط المشاركة فوراً.');
                                  }}
                                  className="rounded-lg border px-2 py-1 text-[10px] font-bold"
                                  style={{ borderColor: 'var(--border-color)', color: 'var(--danger)' }}
                                >
                                  إلغاء فوري
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email Member Invites & Audit Log */}
                <div
                  className="rounded-2xl border p-4 space-y-2.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-1.5 font-black">
                    <UserPlus className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    <span>دعوة مستخدمين بالبريد وإدارة الأدوار</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="email"
                      dir="ltr"
                      value={shareInviteEmail}
                      onChange={(e) => setShareInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="min-w-[160px] flex-1 rounded-xl border px-3 py-1.5 text-left"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <select
                      value={shareInviteRole}
                      onChange={(e) => setShareInviteRole(e.target.value as ShareRole)}
                      className="rounded-xl border px-2.5 py-1.5 font-bold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <option value="viewer">مشاهد</option>
                      <option value="editor">محرر</option>
                      <option value="owner">مالك مشارك</option>
                    </select>
                    <button
                      type="button"
                      disabled={shareBusy || !shareInviteEmail.includes('@')}
                      onClick={async () => {
                        try {
                          setShareBusy(true);
                          await inviteShareMemberApi({
                            email: shareInviteEmail.trim(),
                            role: shareInviteRole,
                          });
                          setShareInviteEmail('');
                          await refreshEnterpriseSecurityData();
                          onNotifySuccess('تمت دعوة العضو وتثبيت صلاحيته على الخادم.');
                        } catch (err) {
                          onNotifyError(
                            err instanceof Error ? err.message : 'تعذر إرسال الدعوة.'
                          );
                        } finally {
                          setShareBusy(false);
                        }
                      }}
                      className="rounded-xl px-3.5 py-1.5 font-extrabold disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                    >
                      دعوة
                    </button>
                  </div>

                  {shareInvites.length > 0 && (
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                      {shareInvites.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-1.5"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <span dir="ltr" className="font-bold truncate">
                            {inv.email}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={inv.role}
                              onChange={async (e) => {
                                await updateShareMemberRoleApi(
                                  inv.id,
                                  e.target.value as ShareRole
                                );
                                await refreshEnterpriseSecurityData();
                                onNotifySuccess('تم تحديث الدور بنجاح.');
                              }}
                              className="rounded-lg border px-2 py-0.5 text-[11px] font-bold"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <option value="viewer">مشاهد</option>
                              <option value="editor">محرر</option>
                              <option value="owner">مالك</option>
                            </select>
                            <button
                              type="button"
                              onClick={async () => {
                                await revokeShareInviteApi(inv.id);
                                await refreshEnterpriseSecurityData();
                                onNotifySuccess('تم إلغاء صلاحية العضو فوراً.');
                              }}
                              className="rounded-lg border px-2 py-0.5 text-[10px] font-bold"
                              style={{ borderColor: 'var(--border-color)', color: 'var(--danger)' }}
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Share Access Verifier + Audit Log */}
                  <div className="border-t pt-2 space-y-1.5" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="font-bold">فحص رابط مشاركة & سجل الوصول ({shareLogs.length}):</div>
                    <div className="flex flex-wrap gap-1.5">
                      <input
                        type="text"
                        dir="ltr"
                        value={shareTestToken}
                        onChange={(e) => setShareTestToken(e.target.value)}
                        placeholder="رمز الرابط..."
                        className="flex-1 min-w-[110px] rounded-lg border px-2.5 py-1 text-left"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                      <input
                        type="password"
                        dir="ltr"
                        value={shareTestPass}
                        onChange={(e) => setShareTestPass(e.target.value)}
                        placeholder="كلمة المرور إن وجدت"
                        className="w-28 rounded-lg border px-2.5 py-1 text-left"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                      <button
                        type="button"
                        disabled={!shareTestToken.trim()}
                        onClick={async () => {
                          try {
                            const preview = await accessSharedLinkApi({
                              token: shareTestToken.trim(),
                              password: shareTestPass || undefined,
                            });
                            setShareTestPreview({
                              role: preview.role,
                              label: preview.label,
                              ownerName: preview.ownerName,
                              ...preview.snapshotSummary,
                            });
                            await refreshEnterpriseSecurityData();
                          } catch (err) {
                            setShareTestPreview(null);
                            onNotifyError(
                              err instanceof Error ? err.message : 'تم رفض الوصول من الخادم.'
                            );
                          }
                        }}
                        className="rounded-lg border px-2.5 py-1 font-bold"
                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                      >
                        اختبار الوصول
                      </button>
                    </div>
                    {shareTestPreview && (
                      <div
                        className="rounded-lg border px-2.5 py-1.5 text-[11px]"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--success)',
                        }}
                      >
                        مصرح ({shareTestPreview.role}) · {shareTestPreview.ownerName} —{' '}
                        {shareTestPreview.agenciesCount} وكالة / {shareTestPreview.personsCount}{' '}
                        مستفيد
                      </div>
                    )}
                    {shareLogs.length > 0 && (
                      <div className="max-h-[95px] space-y-1 overflow-y-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {shareLogs.slice(0, 8).map((log) => (
                          <div key={log.id} className="truncate">
                            • {log.actorLabel} — {log.action} ({log.role}) ·{' '}
                            {formatDateTimeArabic(log.timestamp)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

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
                <span>تفعيل الكاش المحلي الإضافي للعمل دون إنترنت (الحفظ التلقائي الشامل مفعّل دائماً)</span>
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

          {/* Safe Recycle Bin (30-Day Retention) */}
          <section className="nexus-squircle p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <NexusDuotoneIcon tone="crimson" size="sm">
                  <Trash2 className="h-4 w-4" />
                </NexusDuotoneIcon>
                <div>
                  <h2 className="text-sm font-black">
                    سلة المحذوفات الآمنة — احتفاظ 30 يوماً ({recycleBin.length})
                  </h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    تُحفظ العناصر المحذوفة لمدة 30 يوماً مع خيار الاستعادة الكاملة قبل الحذف النهائي التلقائي
                  </p>
                </div>
              </div>

              {recycleBin.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {onRestoreAllRecycleBinItems && (
                    <button
                      type="button"
                      onClick={() => {
                        onRestoreAllRecycleBinItems();
                        setConfirmClearBin(false);
                        onNotifySuccess('تمت استعادة جميع العناصر من سلة المحذوفات.');
                      }}
                      className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-extrabold"
                      style={{ backgroundColor: 'var(--success)', color: 'var(--success-fg)' }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>استعادة الكل</span>
                    </button>
                  )}
                  {confirmClearBin ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onClearRecycleBin();
                          setConfirmClearBin(false);
                          onNotifySuccess('تم إفراغ سلة المحذوفات نهائياً.');
                        }}
                        className="rounded-xl px-3 py-1.5 text-xs font-extrabold"
                        style={{ backgroundColor: 'var(--danger)', color: '#ffffff' }}
                      >
                        تأكيد الإفراغ النهائي
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearBin(false)}
                        className="rounded-xl border px-2.5 py-1.5 text-xs font-bold"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearBin(true)}
                      className="rounded-xl border px-3 py-1.5 text-xs font-extrabold"
                      style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    >
                      إفراغ السلة
                    </button>
                  )}
                </div>
              )}
            </div>

            {recycleBin.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative min-w-[180px] flex-1">
                  <Search
                    className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={recycleSearchQuery}
                    onChange={(e) => setRecycleSearchQuery(e.target.value)}
                    placeholder="ابحث داخل سلة المحذوفات…"
                    className="w-full rounded-xl border py-1.5 pl-3 pr-8 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      ['all', 'الكل'],
                      ['person', 'مستفيدون'],
                      ['agency', 'وكالات'],
                      ['ready_list', 'قوائم'],
                      ['expense', 'مصاريف'],
                      ['relation', 'علاقات'],
                      ['note', 'ملاحظات'],
                    ] as const
                  ).map(([kindId, label]) => (
                    <button
                      key={kindId}
                      type="button"
                      onClick={() => setRecycleKindFilter(kindId)}
                      className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                      style={{
                        borderColor:
                          recycleKindFilter === kindId ? 'var(--accent)' : 'var(--border-color)',
                        backgroundColor:
                          recycleKindFilter === kindId ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                        color:
                          recycleKindFilter === kindId ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {recycleBin.length === 0 ? (
              <div
                className="rounded-2xl border p-8 text-center text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                سلة المحذوفات فارغة حالياً. أي سجل أو وكالة أو ملاحظة يتم حذفها ستُحفظ هنا لمدة 30 يوماً قبل الحذف النهائي.
              </div>
            ) : (
              <div className="max-h-[340px] space-y-2 overflow-y-auto text-xs">
                {recycleBin
                  .filter((entry) => {
                    if (recycleKindFilter !== 'all' && entry.kind !== recycleKindFilter) {
                      return false;
                    }
                    const q = recycleSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return entry.label.toLowerCase().includes(q);
                  })
                  .map((entry) => {
                    const daysLeft = getRemainingRecycleDays(entry);
                    const kindLabel =
                      entry.kind === 'person'
                        ? 'مستفيد'
                        : entry.kind === 'agency'
                          ? 'وكالة'
                          : entry.kind === 'note'
                            ? 'ملاحظة'
                            : entry.kind === 'ready_list'
                              ? 'قائمة جاهزة'
                              : entry.kind === 'relation'
                                ? 'علاقة'
                                : 'مصروف';
                    return (
                      <div
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-extrabold">{entry.label}</span>
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                backgroundColor: 'var(--bg-nav-active)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {kindLabel}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            <span>حُذف في {entry.deletedAt.slice(0, 10)}</span>
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                backgroundColor: 'var(--bg-nav-active)',
                                color: daysLeft <= 5 ? 'var(--danger)' : 'var(--accent)',
                              }}
                            >
                              متبقي {daysLeft} يوم للاستعادة
                            </span>
                            {entry.expiresAt && (
                              <span>· الحذف التلقائي {entry.expiresAt.slice(0, 10)}</span>
                            )}
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
                            onClick={() => {
                              onPurgeRecycleBinItem(entry.id);
                              onNotifySuccess(`تم الحذف النهائي للعنصر: ${entry.label}`);
                            }}
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
                    );
                  })}
              </div>
            )}
          </section>

          {/* GDPR Data Portability Export & Permanent Account Deletion */}
          {authUser && (
            <section className="nexus-squircle p-5 space-y-3.5 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <NexusDuotoneIcon tone="crimson" size="sm">
                    <ShieldAlert className="h-4 w-4" />
                  </NexusDuotoneIcon>
                  <div>
                    <h2 className="text-sm font-black">الخصوصية وتصدير GDPR وحذف الحساب نهائياً</h2>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      نزّل نسخة شاملة بكل بياناتك المخزنة في الخادم، أو احذف الحساب وجميع بياناته نهائياً بعد تأكيد الهوية
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const gdpr = await exportGdprDataApi();
                        const blob = new Blob([gdpr.jsonText], {
                          type: 'application/json;charset=utf-8',
                        });
                        triggerBlobDownload(
                          blob,
                          `morrow-gdpr-export-${gdpr.exportedAt.slice(0, 10)}.json`
                        );
                        onNotifySuccess('تم تنزيل حزمة تصدير GDPR الشاملة بنجاح.');
                      } catch (err) {
                        onNotifyError(
                          err instanceof Error ? err.message : 'تعذر تصدير حزمة GDPR.'
                        );
                      }
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 py-2 font-extrabold"
                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  >
                    <Download className="h-4 w-4" />
                    <span>تصدير كل بياناتك (GDPR JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReauthPassInput('');
                      setDeleteConfirmText('');
                      setPendingStepUp({ kind: 'delete_account' });
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 py-2 font-extrabold"
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>حذف الحساب نهائياً</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Smart Audit & Recovery Log */}
          <section className="nexus-squircle p-5 space-y-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <NexusDuotoneIcon tone="ai" size="sm">
                  <History className="h-4 w-4" />
                </NexusDuotoneIcon>
                <div>
                  <h2 className="text-sm font-black">
                    سجل التدقيق والاسترجاع الذكي ({auditLog.length})
                  </h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    توثيق تلقائي للتغييرات والمزامنة وحل تعارضات الأجهزة مع نقاط استرجاع فورية
                  </p>
                </div>
              </div>
            </div>

            {auditLog.length === 0 ? (
              <div
                className="rounded-2xl border p-6 text-center text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                لا توجد أحداث مسجلة بعد في سجل التدقيق؛ ستظهر هنا تلقائياً عند إجراء أي تعديل أو مزامنة.
              </div>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-y-auto text-xs">
                {auditLog.slice(0, 30).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: ev.conflictResolved
                        ? 'color-mix(in srgb, var(--warning) 45%, var(--border-color))'
                        : 'var(--border-color)',
                    }}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold">{ev.title}</span>
                        {ev.conflictResolved && (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
                            style={{
                              backgroundColor: 'var(--bg-nav-active)',
                              color: 'var(--warning)',
                            }}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            <span>حل تعارض LWW</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {ev.summary}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {formatDateTimeArabic(ev.timestamp)} · الجهاز: {ev.deviceId}
                      </div>
                    </div>

                    {ev.restorableData && onRestoreAuditCheckpoint && (
                      <button
                        type="button"
                        onClick={() => {
                          const ok = onRestoreAuditCheckpoint(ev.id);
                          if (ok) {
                            onNotifySuccess(`تم استرجاع نقطة الذاكرة: ${ev.title}`);
                          } else {
                            onNotifyError('تعذر استرجاع هذه النقطة.');
                          }
                        }}
                        className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-xl border px-3 py-1 font-extrabold"
                        style={{
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>استرجاع هذه النقطة</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      </TabrixSubViewTransition>

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

      {/* Step-Up Re-Authentication Modal for Sensitive Operations */}
      {pendingStepUp && (
        <FullScreenPushPage
          open={Boolean(pendingStepUp)}
          onClose={() => setPendingStepUp(null)}
          title="تأكيد الهوية للعملية الحساسة"
          subtitle="مطلوب إعادة التحقق قبل تنفيذ التغيير"
          maxWidthClass="max-w-md"
        >
          <div dir="rtl" className="space-y-4 p-5 text-xs">
            <div
              className="rounded-2xl border p-3.5 leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor:
                  pendingStepUp.kind === 'delete_account'
                    ? 'var(--danger)'
                    : 'var(--accent)',
              }}
            >
              {pendingStepUp.kind === 'delete_account'
                ? 'سيتم حذف حسابك وجميع مساحات العمل والنسخ والروابط والجلسات نهائياً دون إمكانية التراجع.'
                : pendingStepUp.kind === 'change_email'
                ? `سيتم تحديث بريد حسابك الإلكتروني إلى (${pendingStepUp.newEmail}).`
                : pendingStepUp.kind === 'delete_passkey'
                ? 'سيتم إزالة مفتاح المرور المختار ولن يعد صالحاً لتسجيل الدخول.'
                : 'سيتم توليد 8 رموز استرجاع جديدة وإبطال أي رموز سابقة.'}
            </div>

            <div>
              <label className="mb-1 block font-bold">
                كلمة المرور الحالية (اتركه فارغاً لحسابات Google/GitHub بدون كلمة مرور)
              </label>
              <input
                type="password"
                dir="ltr"
                value={reauthPassInput}
                onChange={(e) => setReauthPassInput(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border px-3 py-2 text-left text-sm"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
            </div>

            {pendingStepUp.kind === 'delete_account' && (
              <div>
                <label className="mb-1 block font-bold" style={{ color: 'var(--danger)' }}>
                  اكتب كلمة DELETE للتأكيد النهائي
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-xl border px-3 py-2 text-left font-mono text-sm font-black"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--danger)',
                  }}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingStepUp(null)}
                className="min-h-[40px] rounded-xl border px-4 py-2 font-bold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={
                  stepUpBusy ||
                  (pendingStepUp.kind === 'delete_account' &&
                    deleteConfirmText.trim().toUpperCase() !== 'DELETE')
                }
                onClick={async () => {
                  try {
                    setStepUpBusy(true);
                    const grant = await verifyReauthApi({
                      password: reauthPassInput || undefined,
                    });
                    if (pendingStepUp.kind === 'generate_recovery') {
                      const res = await generateRecoveryCodesApi(grant.reauthToken);
                      setGeneratedCodes(res.codes);
                      setRecoveryStatus(res.status);
                      onNotifySuccess('تم توليد رموز الاسترجاع الجديدة بنجاح.');
                    } else if (pendingStepUp.kind === 'delete_passkey') {
                      await deletePasskeyApi(
                        pendingStepUp.credentialId,
                        grant.reauthToken
                      );
                      await refreshEnterpriseSecurityData();
                      onNotifySuccess('تمت إزالة مفتاح المرور بنجاح.');
                    } else if (pendingStepUp.kind === 'change_email') {
                      const session = await changeAccountEmailApi({
                        newEmail: pendingStepUp.newEmail,
                        reauthToken: grant.reauthToken,
                      });
                      setNewEmailDraft('');
                      onAuthenticated(session.user);
                      await refreshEnterpriseSecurityData();
                      onNotifySuccess('تم تغيير البريد الإلكتروني بنجاح.');
                    } else if (pendingStepUp.kind === 'delete_account') {
                      await deleteAccountPermanentlyApi(grant.reauthToken);
                      setPendingStepUp(null);
                      onNotifySuccess('تم حذف الحساب نهائياً وتنظيف كافة البيانات.');
                      onLoggedOut();
                      return;
                    }
                    setPendingStepUp(null);
                  } catch (err) {
                    onNotifyError(
                      err instanceof Error ? err.message : 'فشل التحقق من الهوية.'
                    );
                  } finally {
                    setStepUpBusy(false);
                  }
                }}
                className="min-h-[40px] rounded-xl px-4 py-2 font-extrabold disabled:opacity-50"
                style={{
                  backgroundColor:
                    pendingStepUp.kind === 'delete_account'
                      ? 'var(--danger)'
                      : 'var(--accent)',
                  color:
                    pendingStepUp.kind === 'delete_account'
                      ? '#FFFFFF'
                      : 'var(--accent-fg)',
                }}
              >
                {stepUpBusy ? 'جارٍ التحقق...' : 'تأكيد وتنفيذ'}
              </button>
            </div>
          </div>
        </FullScreenPushPage>
      )}
    </div>
  );
};

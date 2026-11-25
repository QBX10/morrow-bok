import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CloudUpload,
  Download,
  FileJson,
  Lock,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { DEFAULT_SECURITY_PREFS } from '../../../data/seedData';
import type {
  AppDatabaseState,
  AuthUser,
  RecycleBinEntry,
  SecurityPrefs,
} from '../../../types/agency';
import type {
  AssistantConnectivityState,
  AssistantSettingsConfig,
} from '../../../types/assistant';
import {
  DEFAULT_ASSISTANT_SETTINGS,
  type QuotaCheckResult,
} from '../../../utils/assistantQuota';
import type {
  HierarchyBadgeContext,
  HierarchyNode,
} from '../../../utils/hierarchyRegistry';
import { resolveHierarchyNodeBadge } from '../../../utils/hierarchyRegistry';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  useTabrixReducedMotion,
} from '../../../utils/tabrixMotion';
import { NodeCard } from '../NodeCard';
import { NodeView } from '../NodeView';
import { AiModelsArchitectureStudio } from './AiModelsArchitectureStudio';
import { runWithSignatureLoader } from '../../../utils/delayedLoader';

interface SecurityCapsulesProps {
  sectionNode: HierarchyNode;
  activeNode: HierarchyNode;
  activeCapsuleId: string | null;
  displayMode: 'fullscreen' | 'contained';
  badgeContext: HierarchyBadgeContext;
  state: AppDatabaseState;
  securityPrefs: SecurityPrefs;
  recycleBin: RecycleBinEntry[];
  authUser: AuthUser | null;
  assistantSettings?: AssistantSettingsConfig;
  assistantConnectivity?: AssistantConnectivityState;
  assistantQuotaInfo?: QuotaCheckResult;
  assistantCacheCount?: number;
  onUpdateSecurityPrefs: (patch: Partial<SecurityPrefs>) => void;
  onRestoreRecycleBinItem: (entryId: string) => void;
  onPurgeRecycleBinItem: (entryId: string) => void;
  onClearRecycleBin: () => void;
  onImportWorkspaceJson: (rawJson: string) => void | Promise<void>;
  onSyncServer: () => Promise<void>;
  onRestoreServer: () => Promise<boolean>;
  onOpenAuth: () => void;
  onUpdateAssistantSettings?: (patch: Partial<AssistantSettingsConfig>) => void;
  onResetAssistantQuota?: () => void;
  onClearAssistantCache?: () => void;
  onOpenCapsule: (capsuleId: string | null) => void;
  onNotifySuccess: (msg: string) => void;
  onNotifyError: (msg: string) => void;
}

export const SecurityCapsules: React.FC<SecurityCapsulesProps> = ({
  sectionNode,
  activeNode,
  activeCapsuleId,
  displayMode,
  badgeContext,
  state,
  securityPrefs,
  recycleBin,
  authUser,
  assistantSettings = DEFAULT_ASSISTANT_SETTINGS,
  assistantConnectivity = 'offline',
  assistantQuotaInfo,
  assistantCacheCount = 0,
  onUpdateSecurityPrefs,
  onRestoreRecycleBinItem,
  onPurgeRecycleBinItem,
  onClearRecycleBin,
  onImportWorkspaceJson,
  onSyncServer,
  onRestoreServer,
  onOpenAuth,
  onUpdateAssistantSettings,
  onResetAssistantQuota,
  onClearAssistantCache,
  onOpenCapsule,
  onNotifySuccess,
  onNotifyError,
}) => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [pinDraft, setPinDraft] = useState(securityPrefs.privacyPin || '');
  const reducedMotion = useTabrixReducedMotion();

  useEffect(() => {
    setPinDraft(securityPrefs.privacyPin || '');
  }, [securityPrefs.privacyPin]);

  const handleExportJsonBackup = async () => {
    await runWithSignatureLoader(
      {
        label: 'جاري تجهيز وتصدير النسخة الاحتياطية (JSON)...',
        subtitle: 'يتم تجميع كافة الوكالات والسجلات والإعدادات في ملف آمن...',
      },
      () => {
        const payload = JSON.stringify(state, null, 2);
        const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `morrow-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    );
    onNotifySuccess('تم تنزيل نسخة احتياطية كاملة بصيغة JSON.');
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
      onNotifyError(
        err instanceof Error ? err.message : 'تعذر قراءة ملف النسخة الاحتياطية.'
      );
    }
  };

  // Level 3 Hub
  if (!activeCapsuleId) {
    return (
      <NodeView
        node={sectionNode}
        displayMode={displayMode}
        liveStatusText={
          securityPrefs.privacyLocked
            ? 'القفل مفعّل'
            : `المهملات: ${recycleBin.length}`
        }
        onResetBranch={() => {
          onUpdateSecurityPrefs({
            offlineCacheEnabled: DEFAULT_SECURITY_PREFS.offlineCacheEnabled,
            allowCloudBeneficiaryNames:
              DEFAULT_SECURITY_PREFS.allowCloudBeneficiaryNames,
          });
          onUpdateAssistantSettings?.(DEFAULT_ASSISTANT_SETTINGS);
          onNotifySuccess(
            'تمت استعادة تفضيلات الأمان والمساعد الافتراضية دون المساس بالنسخ أو سلة الاسترجاع.'
          );
        }}
        resetBranchLabel="استعادة افتراضي الخصوصية"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectionNode.children.map((child) => {
            const badge = resolveHierarchyNodeBadge(child, badgeContext);
            let preview: React.ReactNode = null;

            if (child.id === 'sec_cloud_sync_cap') {
              preview = (
                <div className="flex items-center justify-between font-bold">
                  <span>{authUser ? authUser.displayName : 'غير متصل'}</span>
                  <span style={{ color: 'var(--accent)' }}>مزامنة سحابية</span>
                </div>
              );
            } else if (child.id === 'sec_backup_json_cap') {
              preview = (
                <div className="flex items-center justify-between font-bold">
                  <span>حفظ تلقائي دائم + JSON</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {securityPrefs.offlineCacheEnabled
                      ? 'Cache + حفظ تلقائي'
                      : 'حفظ تلقائي أساسي'}
                  </span>
                </div>
              );
            } else if (child.id === 'sec_ai_assistant_cap') {
              preview = (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>
                    {assistantSettings.onlineDisabled
                      ? 'أوفلاين 100%'
                      : 'الدماغ الثلاثي'}
                  </span>
                  <span style={{ color: 'var(--accent)' }}>
                    {assistantQuotaInfo?.dailyUsed ?? 0} /{' '}
                    {assistantSettings.dailyRequestLimit}
                  </span>
                </div>
              );
            } else if (child.id === 'sec_privacy_lock_cap') {
              preview = (
                <div className="flex items-center justify-between font-bold">
                  <span>
                    {securityPrefs.privacyPin ? 'محمي برمز PIN' : 'بدون رمز'}
                  </span>
                  <span style={{ color: 'var(--accent)' }}>
                    {securityPrefs.privacyLocked ? 'مقفول' : 'مفتوح'}
                  </span>
                </div>
              );
            } else if (child.id === 'sec_recycle_bin_cap') {
              preview = (
                <div className="flex items-center justify-between font-bold tabular-nums">
                  <span>العناصر القابلة للاستعادة</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {recycleBin.length} عنصر
                  </span>
                </div>
              );
            }

            return (
              <NodeCard
                key={child.id}
                node={child}
                badge={badge}
                preview={preview}
                actionLabel="فتح الأداة"
                onOpen={(n) => onOpenCapsule(n.id)}
              />
            );
          })}
        </div>
      </NodeView>
    );
  }

  // Level 4A: Cloud Account & Sync
  if (activeCapsuleId === 'sec_cloud_sync_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={authUser ? authUser.displayName : 'تسجيل الدخول'}
      >
        <section
          className="capsule-glass-card border p-5 space-y-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold">الحساب والمزامنة السحابية</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {authUser ? (
                  <>
                    مسجل حاليًا باسم:{' '}
                    <span dir="auto">{authUser.displayName}</span>
                  </>
                ) : (
                  'سجّل عبر Gmail أو اسم المستخدم أو رقم الهاتف لحفظ نسختك على الخادم.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[44px] rounded-xl border px-4 py-2 text-xs font-extrabold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              {authUser ? 'إدارة الحساب' : 'تسجيل الدخول المتعدد'}
            </button>
          </div>

          {authUser && (
            <div className="flex flex-wrap gap-2.5 pt-1 text-xs">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onSyncServer();
                    onNotifySuccess('تم حفظ البيانات على الخادم بنجاح.');
                  } catch (err) {
                    onNotifyError(
                      err instanceof Error ? err.message : 'تعذرت المزامنة.'
                    );
                  }
                }}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-4 py-2 font-bold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <CloudUpload className="h-4 w-4" />
                <span>حفظ في الخادم</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const ok = await onRestoreServer();
                    onNotifySuccess(
                      ok
                        ? 'تم استرجاع النسخة من الخادم.'
                        : 'لا توجد نسخة محفوظة مسبقًا لهذا الحساب.'
                    );
                  } catch (err) {
                    onNotifyError(
                      err instanceof Error ? err.message : 'تعذر الاسترجاع.'
                    );
                  }
                }}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-4 py-2 font-bold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <RefreshCw className="h-4 w-4" />
                <span>استرجاع من الخادم</span>
              </button>
            </div>
          )}
        </section>
      </NodeView>
    );
  }

  // Level 4B: Local JSON Backup & Offline Privacy
  if (activeCapsuleId === 'sec_backup_json_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        onResetBranch={() => {
          onUpdateSecurityPrefs({
            offlineCacheEnabled: DEFAULT_SECURITY_PREFS.offlineCacheEnabled,
            allowCloudBeneficiaryNames:
              DEFAULT_SECURITY_PREFS.allowCloudBeneficiaryNames,
          });
          onNotifySuccess('تمت استعادة خيارات الحفظ والخصوصية الافتراضية.');
        }}
      >
        <section
          className="capsule-glass-card border p-5 space-y-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="text-base font-extrabold">
                النسخ الاحتياطي المحلي واستعادة البيانات (JSON)
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                تصدير واستيراد قاعدة البيانات الكاملة (الوكالات، المستفيدين، القوائم، العلاقات، والإعدادات)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={handleExportJsonBackup}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 font-extrabold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Download className="h-4 w-4" />
              <span>تصدير نسخة احتياطية (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2 font-extrabold"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Upload className="h-4 w-4" />
              <span>استيراد من ملف (JSON)</span>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportJsonFile}
              className="hidden"
            />
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 pt-1 text-xs font-bold">
            <input
              type="checkbox"
              checked={securityPrefs.offlineCacheEnabled}
              onChange={(e) =>
                onUpdateSecurityPrefs({ offlineCacheEnabled: e.target.checked })
              }
            />
            <span>تفعيل التخزين المؤقت الإضافي دون إنترنت (الحفظ التلقائي الشامل على الجهاز يعمل دائماً)</span>
          </label>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={Boolean(securityPrefs.allowCloudBeneficiaryNames)}
              onChange={(e) =>
                onUpdateSecurityPrefs({
                  allowCloudBeneficiaryNames: e.target.checked,
                })
              }
            />
            <span>
              السماح بإرسال أسماء المستفيدين للمساعد السحابي (اختياري — افتراضياً محجوب للخصوصية)
            </span>
          </label>
        </section>
      </NodeView>
    );
  }

  // Level 4C: AI Models Architecture & Task Routing Studio
  if (activeCapsuleId === 'sec_ai_assistant_cap') {
    return (
      <NodeView
        node={activeNode}
        displayMode={displayMode}
        liveStatusText={
          assistantConnectivity === 'online'
            ? 'متصل (أونلاين)'
            : assistantConnectivity === 'quota_exhausted'
            ? 'الحصة خلصت — يعمل محلياً'
            : 'أوفلاين (محلي)'
        }
        onResetBranch={() => {
          onUpdateAssistantSettings?.(structuredClone(DEFAULT_ASSISTANT_SETTINGS));
          onNotifySuccess('تمت استعادة معمارية النماذج والتوجيه الافتراضية.');
        }}
      >
        <AiModelsArchitectureStudio
          assistantSettings={assistantSettings}
          assistantConnectivity={assistantConnectivity}
          assistantQuotaInfo={assistantQuotaInfo}
          assistantCacheCount={assistantCacheCount}
          onUpdateAssistantSettings={onUpdateAssistantSettings}
          onResetAssistantQuota={onResetAssistantQuota}
          onClearAssistantCache={onClearAssistantCache}
          onNotifySuccess={onNotifySuccess}
          onNotifyError={onNotifyError}
        />
      </NodeView>
    );
  }

  // Level 4D: Privacy Lock
  if (activeCapsuleId === 'sec_privacy_lock_cap') {
    return (
      <NodeView node={activeNode} displayMode={displayMode}>
        <section
          className="capsule-glass-card border p-5 space-y-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="text-base font-extrabold">قفل الخصوصية السريع</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                اقفل شاشة التطبيق فوراً لحماية السجلات عند ترك الجهاز، برمز اختياري أو قفل مباشر
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 text-xs">
            <div>
              <label
                htmlFor="privacy-pin-input"
                className="mb-1.5 block font-extrabold"
              >
                رمز القفل (اختياري)
              </label>
              <input
                id="privacy-pin-input"
                type="password"
                dir="ltr"
                value={pinDraft}
                onChange={(e) => {
                  const v = e.target.value;
                  setPinDraft(v);
                  onUpdateSecurityPrefs({ privacyPin: v });
                }}
                placeholder="اتركه فارغاً لفتح بنقرة"
                className="min-h-[44px] w-52 rounded-xl border px-3 py-2 text-left tabular-nums"
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
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-5 py-2 font-extrabold"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Lock className="h-4 w-4" />
              <span>تفعيل القفل الآن</span>
            </button>
          </div>
        </section>
      </NodeView>
    );
  }

  // Level 4E: Safe Recycle Bin
  return (
    <NodeView
      node={activeNode}
      displayMode={displayMode}
      liveStatusText={`${recycleBin.length} عنصر`}
    >
      <section
        aria-label="سلة الاسترجاع الآمنة"
        className="capsule-glass-card border p-5 space-y-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="text-base font-extrabold">
                سلة الاسترجاع الآمنة ({recycleBin.length})
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                كل سجل يُحذف من الوكالات أو القوائم أو المصاريف يُحفظ هنا لاستعادته في أي وقت
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
              className="min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs font-extrabold"
              style={{
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
              }}
            >
              إفراغ السلة
            </button>
          )}
        </div>

        {recycleBin.length === 0 ? (
          <div
            className="rounded-2xl border p-6 text-center text-xs"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            سلة الاسترجاع فارغة حالياً.
          </div>
        ) : (
          <div className="space-y-2.5 text-xs">
            <AnimatePresence initial={false}>
              {recycleBin.map((entry) => {
                const kindLabel =
                  entry.kind === 'person'
                    ? 'مستفيد'
                    : entry.kind === 'ready_list'
                    ? 'قائمة جاهزة'
                    : entry.kind === 'relation'
                    ? 'علاقة متابعة'
                    : 'مصروف مالي';
                return (
                  <motion.div
                    key={entry.id}
                    layout={!reducedMotion}
                    variants={
                      reducedMotion
                        ? TABRIX_REDUCED_VARIANTS
                        : TABRIX_POPOVER_VARIANTS
                    }
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3.5"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div>
                      <span className="font-extrabold">{entry.label}</span>
                      <span
                        className="mx-2 text-[11px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        ({kindLabel}) · حُذف في {entry.deletedAt.slice(0, 10)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreRecycleBinItem(entry.id);
                          onNotifySuccess(`تمت استعادة: ${entry.label}`);
                        }}
                        className="inline-flex min-h-[38px] items-center gap-1 rounded-xl px-3.5 py-1.5 font-extrabold"
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
                        className="min-h-[38px] rounded-xl border px-3 py-1.5 font-bold"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--danger)',
                        }}
                      >
                        حذف نهائي
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </NodeView>
  );
};

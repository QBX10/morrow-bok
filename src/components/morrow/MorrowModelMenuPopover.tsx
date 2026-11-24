import React from 'react';
import {
  Check,
  FolderKanban,
  GitMerge,
  LayoutPanelLeft,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { Agency } from '../../types/agency';
import type {
  AiCollaborationMode,
  AssistantBrainMode,
  AssistantConnectivityState,
  AssistantResponseStyle,
} from '../../types/assistant';
import type { ApprovedCloudModelId, ModelHealthRecord } from '../../lib/aiConfig';

export interface BrainOptionItem {
  id: AssistantBrainMode;
  label: string;
  shortLabel: string;
  desc: string;
  modelId?: ApprovedCloudModelId;
  icon: React.ReactNode;
}

export interface CollaborationOptionItem {
  id: AiCollaborationMode;
  label: string;
  shortLabel: string;
  desc: string;
}

interface MorrowModelMenuPopoverProps {
  open: boolean;
  onClose: () => void;
  brainMode: AssistantBrainMode;
  onChangeBrainMode: (mode: AssistantBrainMode) => void;
  brainOptions: BrainOptionItem[];
  collaborationMode: AiCollaborationMode;
  onChangeCollaborationMode?: (mode: AiCollaborationMode) => void;
  collaborationOptions: CollaborationOptionItem[];
  responseStyle?: AssistantResponseStyle;
  onChangeResponseStyle?: (style: AssistantResponseStyle) => void;
  connectivity: AssistantConnectivityState;
  modelHealthSnapshots: Array<ModelHealthRecord & { status: 'healthy' | 'cooldown' }>;
  agencies: Agency[];
  activeAgencyId?: number | null;
  onSelectActiveAgency?: (agencyId: number) => void;
  onOpenCanvas?: () => void;
  onOpenModelsStudio?: () => void;
}

const RESPONSE_STYLE_OPTIONS: Array<{
  id: AssistantResponseStyle;
  label: string;
  desc: string;
}> = [
  { id: 'balanced', label: 'متوازن وعملي', desc: 'وضوح وتفصيل مناسب لكل المهام' },
  { id: 'concise', label: 'مختصر فوري', desc: 'خلاصة مباشرة بأقل أسطر' },
  { id: 'financial_auditor', label: 'مدقق مالي', desc: 'دقة الأكياس والمبالغ والفروقات' },
  { id: 'deep_advisor', label: 'مستشار معمّق', desc: 'تقييم مخاطر وتوصيات استراتيجية' },
];

export const MorrowModelMenuPopover: React.FC<MorrowModelMenuPopoverProps> = ({
  open,
  onClose,
  brainMode,
  onChangeBrainMode,
  brainOptions,
  collaborationMode,
  onChangeCollaborationMode,
  collaborationOptions,
  responseStyle = 'balanced',
  onChangeResponseStyle,
  connectivity,
  modelHealthSnapshots,
  agencies,
  activeAgencyId,
  onSelectActiveAgency,
  onOpenCanvas,
  onOpenModelsStudio,
}) => {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-sheet)] flex items-start justify-center sm:justify-start pt-[60px] px-3 sm:pr-16 sm:pl-6"
      role="dialog"
      aria-modal="true"
      aria-label="قائمة نماذج وإعدادات Morrow"
    >
      <div
        onClick={onClose}
        className="fixed inset-0"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.28)',
          backdropFilter: 'blur(2px)',
        }}
      />

      <div
        data-testid="morrow-brand-panel"
        className="relative z-10 w-full max-w-lg rounded-2xl border shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Top Bar */}
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3.5"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight">Morrow</span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                · اختيار النموذج والقسم
              </span>
            </div>
            <div
              className="mt-0.5 flex items-center gap-1.5 text-[11px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <span
                className="inline-flex items-center gap-1 font-semibold"
                style={{
                  color: connectivity === 'online' ? 'var(--success)' : 'var(--warning)',
                }}
              >
                {connectivity === 'online' ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                <span>
                  {connectivity === 'online'
                    ? 'متصل سحابياً'
                    : connectivity === 'quota_exhausted'
                      ? 'حصة مؤقتة · محلي'
                      : 'الوضع المحلي جاهز'}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span>التحويل التلقائي والمرجع المحلي مفعّلان</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق قائمة Morrow"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[78vh] overflow-y-auto p-3.5 space-y-3">
          {/* Model Selection List (Gemini Switcher Style) */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              النموذج النشط للمحادثة
            </div>
            <div
              className="divide-y rounded-xl border overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              {brainOptions.map((opt) => {
                const selected = brainMode === opt.id;
                const snap = opt.modelId
                  ? modelHealthSnapshots.find((h) => h.modelId === opt.modelId)
                  : undefined;
                const cooling = snap?.status === 'cooldown';

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChangeBrainMode(opt.id);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-right transition-colors hover:bg-[var(--bg-surface)]"
                    style={{
                      backgroundColor: selected ? 'var(--bg-nav-active)' : 'transparent',
                    }}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="mt-0.5 shrink-0"
                        style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)' }}
                      >
                        {opt.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
                          <span style={{ color: selected ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {opt.label}
                          </span>
                          {snap && (
                            <span
                              className="text-[10px] font-semibold tabular-nums"
                              style={{ color: cooling ? 'var(--warning)' : 'var(--success)' }}
                            >
                              · {cooling ? 'تبريد' : 'جاهز'}
                              {snap.avgLatencyMs
                                ? ` ${(snap.avgLatencyMs / 1000).toFixed(1)}s`
                                : ''}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                          {opt.desc}
                        </div>
                      </div>
                    </div>

                    {selected && (
                      <Check className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Collaboration Mode */}
          {onChangeCollaborationMode && (
            <div className="space-y-1.5 border-t pt-2.5" style={{ borderColor: 'var(--border-color)' }}>
              <div
                className="flex items-center gap-1.5 text-[11px] font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                <GitMerge className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>نمط تعاون النماذج والتدقيق</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {collaborationOptions.map((col) => {
                  const active = collaborationMode === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => onChangeCollaborationMode(col.id)}
                      title={col.desc}
                      className="rounded-xl border px-2.5 py-1.5 text-center text-[11px] font-bold transition-colors whitespace-nowrap"
                      style={{
                        backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                        borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                        color: active ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                    >
                      {col.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reasoning & Response Lens */}
          {onChangeResponseStyle && (
            <div className="space-y-1.5 border-t pt-2.5" style={{ borderColor: 'var(--border-color)' }}>
              <div
                className="flex items-center gap-1.5 text-[11px] font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>أسلوب التفكير وصياغة الرد</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {RESPONSE_STYLE_OPTIONS.map((opt) => {
                  const active = responseStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeResponseStyle(opt.id)}
                      className="rounded-xl border px-3 py-1.5 text-right transition-colors hover:border-[var(--accent)]"
                      style={{
                        backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                        borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                      }}
                    >
                      <div
                        className="text-[11px] font-extrabold"
                        style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}
                      >
                        {opt.label}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Agency Context */}
          {agencies.length > 0 && onSelectActiveAgency && (
            <div className="space-y-1.5 border-t pt-2.5" style={{ borderColor: 'var(--border-color)' }}>
              <div
                className="flex items-center gap-1.5 text-[11px] font-bold"
                style={{ color: 'var(--text-muted)' }}
              >
                <FolderKanban className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>سياق الوكالة النشطة</span>
              </div>
              <select
                aria-label="اختيار الوكالة النشطة من قائمة Morrow"
                value={activeAgencyId ?? agencies[0].id}
                onChange={(e) => onSelectActiveAgency(Number(e.target.value))}
                className="w-full rounded-xl border px-3 py-2 text-xs font-bold outline-none focus:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {agencies.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer Quick Links to Full Morrow Models & Canvas */}
        <div
          className="flex flex-wrap items-center gap-2 border-t px-4 py-3"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {onOpenCanvas && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCanvas();
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <LayoutPanelLeft className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>اللوحة التفاعلية</span>
            </button>
          )}

          {onOpenModelsStudio && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenModelsStudio();
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold whitespace-nowrap transition-opacity hover:opacity-95"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>استوديو النماذج والتوجيه</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

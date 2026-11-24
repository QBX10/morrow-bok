import React from 'react';
import {
  Check,
  FolderKanban,
  GitMerge,
  LayoutPanelLeft,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Agency } from '../../types/agency';
import type {
  AiCollaborationMode,
  AssistantBrainMode,
  AssistantConnectivityState,
  AssistantResponseStyle,
} from '../../types/assistant';
import type { ApprovedCloudModelId, ModelHealthRecord } from '../../lib/aiConfig';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import { NexusDuotoneIcon } from '../ui/NexusDuotoneIcon';

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
  return (
    <FullScreenPushPage
      open={open}
      onBack={onClose}
      title="Morrow · اختيار النموذج والقسم"
      subtitle="التحويل التلقائي والمرجع المحلي مفعّلان"
      icon={
        <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
          <SlidersHorizontal className="h-4 w-4" />
        </NexusDuotoneIcon>
      }
      maxWidthClass="max-w-2xl"
      zIndexClass="z-[var(--z-sheet)]"
      ariaLabel="قائمة نماذج وإعدادات Morrow"
      headerActions={
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap"
          style={{
            color: connectivity === 'online' ? 'var(--success)' : 'var(--warning)',
          }}
        >
          {connectivity === 'online' ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          <span>
            {connectivity === 'online'
              ? 'متصل سحابياً'
              : connectivity === 'quota_exhausted'
                ? 'حصة مؤقتة · محلي'
                : 'الوضع المحلي جاهز'}
          </span>
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {onOpenCanvas && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCanvas();
              }}
              className="nexus-pill-btn inline-flex h-10 flex-1 items-center justify-center gap-1.5 border px-4 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <LayoutPanelLeft className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
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
              className="nexus-pill-btn inline-flex h-10 flex-1 items-center justify-center gap-1.5 px-4 text-xs font-extrabold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent-ai, #5B4FE9)',
                color: '#FFFFFF',
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>استوديو النماذج والتوجيه</span>
            </button>
          )}
        </div>
      }
    >
      <div data-testid="morrow-brand-panel" className="space-y-4">
        {/* Model Selection List */}
        <section className="nexus-squircle p-4 sm:p-5 space-y-2.5">
          <div className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
            النموذج النشط للمحادثة
          </div>
          <div
            className="divide-y rounded-2xl border overflow-hidden"
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
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-right transition-colors hover:bg-[var(--bg-surface)]"
                  style={{
                    backgroundColor: selected ? 'var(--bg-nav-active)' : 'transparent',
                  }}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className="mt-0.5 shrink-0"
                      style={{
                        color: selected ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-muted)',
                      }}
                    >
                      {opt.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
                        <span
                          style={{
                            color: selected
                              ? 'var(--accent-ai, #5B4FE9)'
                              : 'var(--text-primary)',
                          }}
                        >
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
                    <Check
                      className="h-4 w-4 shrink-0"
                      style={{ color: 'var(--accent-ai, #5B4FE9)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Collaboration Mode */}
        {onChangeCollaborationMode && (
          <section className="nexus-squircle p-4 sm:p-5 space-y-2.5">
            <div
              className="flex items-center gap-1.5 text-xs font-extrabold"
              style={{ color: 'var(--text-muted)' }}
            >
              <GitMerge className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
              <span>نمط تعاون النماذج والتدقيق</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {collaborationOptions.map((col) => {
                const active = collaborationMode === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onChangeCollaborationMode(col.id)}
                    title={col.desc}
                    className="nexus-pill-btn border px-3 py-2 text-center text-[11px] font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                      borderColor: active
                        ? 'var(--accent-ai, #5B4FE9)'
                        : 'var(--border-color)',
                      color: active ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)',
                    }}
                  >
                    {col.shortLabel}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Reasoning & Response Lens */}
        {onChangeResponseStyle && (
          <section className="nexus-squircle p-4 sm:p-5 space-y-2.5">
            <div
              className="flex items-center gap-1.5 text-xs font-extrabold"
              style={{ color: 'var(--text-muted)' }}
            >
              <SlidersHorizontal
                className="h-3.5 w-3.5"
                style={{ color: 'var(--accent-ai, #5B4FE9)' }}
              />
              <span>أسلوب التفكير وصياغة الرد</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {RESPONSE_STYLE_OPTIONS.map((opt) => {
                const active = responseStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeResponseStyle(opt.id)}
                    className="rounded-2xl border px-3.5 py-2.5 text-right transition-colors hover:border-[var(--accent-ai)]"
                    style={{
                      backgroundColor: active ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                      borderColor: active
                        ? 'var(--accent-ai, #5B4FE9)'
                        : 'var(--border-color)',
                    }}
                  >
                    <div
                      className="text-xs font-extrabold"
                      style={{
                        color: active ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)',
                      }}
                    >
                      {opt.label}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {opt.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Active Agency Context */}
        {agencies.length > 0 && onSelectActiveAgency && (
          <section className="nexus-squircle p-4 sm:p-5 space-y-2.5">
            <div
              className="flex items-center gap-1.5 text-xs font-extrabold"
              style={{ color: 'var(--text-muted)' }}
            >
              <FolderKanban
                className="h-3.5 w-3.5"
                style={{ color: 'var(--accent-ai, #5B4FE9)' }}
              />
              <span>سياق الوكالة النشطة</span>
            </div>
            <select
              aria-label="اختيار الوكالة النشطة من قائمة Morrow"
              value={activeAgencyId ?? agencies[0].id}
              onChange={(e) => onSelectActiveAgency(Number(e.target.value))}
              className="w-full rounded-2xl border px-3.5 py-2.5 text-xs font-bold outline-none focus:border-[var(--accent-ai)]"
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
          </section>
        )}
      </div>
    </FullScreenPushPage>
  );
};

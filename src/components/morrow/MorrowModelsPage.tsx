import React from 'react';
import {
  Check,
  GitMerge,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  AiCollaborationMode,
  AssistantBrainMode,
  AssistantConnectivityState,
  AssistantResponseStyle,
} from '../../types/assistant';
import {
  CORE_SIX_SPECIALIZED_MODELS,
  type ApprovedCloudModelId,
  type ModelHealthRecord,
} from '../../lib/aiConfig';
import type {
  BrainOptionItem,
  CollaborationOptionItem,
} from './MorrowModelMenuPopover';
import { MorrowSubPageHeader } from './MorrowSubPageHeader';

interface MorrowModelsPageProps {
  brainMode: AssistantBrainMode;
  onChangeBrainMode: (mode: AssistantBrainMode) => void;
  brainOptions: BrainOptionItem[];
  collaborationMode: AiCollaborationMode;
  onChangeCollaborationMode?: (mode: AiCollaborationMode) => void;
  collaborationOptions: CollaborationOptionItem[];
  responseStyle: AssistantResponseStyle;
  onChangeResponseStyle?: (style: AssistantResponseStyle) => void;
  connectivity: AssistantConnectivityState;
  modelHealthSnapshots: Array<ModelHealthRecord & { status: 'healthy' | 'cooldown' }>;
  onOpenAppAiStudio?: () => void;
  onBackToChat: () => void;
}

const STYLE_CARDS: Array<{
  id: AssistantResponseStyle;
  label: string;
  desc: string;
}> = [
  { id: 'balanced', label: 'متوازن وعملي', desc: 'تفصيل واضح ومتوازن لكل الأسئلة اليومية' },
  { id: 'concise', label: 'مختصر فوري', desc: 'إجابة مباشرة ومكثفة بأقل أسطر' },
  { id: 'financial_auditor', label: 'مدقق مالي', desc: 'تركيز صارم على الأكياس والمبالغ والفروقات' },
  { id: 'deep_advisor', label: 'مستشار معمّق', desc: 'تحليل أسباب، مخاطر، وتوصيات تنفيذية' },
];

export const MorrowModelsPage: React.FC<MorrowModelsPageProps> = ({
  brainMode,
  onChangeBrainMode,
  brainOptions,
  collaborationMode,
  onChangeCollaborationMode,
  collaborationOptions,
  responseStyle,
  onChangeResponseStyle,
  connectivity,
  modelHealthSnapshots,
  onOpenAppAiStudio,
  onBackToChat,
}) => {
  return (
    <main
      aria-label="النماذج الذكية ومحرك الاحتياط التلقائي"
      data-testid="morrow-models-page"
      className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
    >
      <MorrowSubPageHeader
        title="النماذج الذكية ومحرك التوجيه التلقائي"
        subtitle="اختيار النموذج النشط، سلسلة التحويل الاحتياطي 6+1، ونمط التعاون"
        onBack={onBackToChat}
        rightSlot={
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold"
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
                  ? 'السحابة متصلة'
                  : connectivity === 'quota_exhausted'
                    ? 'حصة مؤقتة · محلي'
                    : 'الوضع المحلي'}
              </span>
            </span>

            {onOpenAppAiStudio && (
              <button
                type="button"
                onClick={onOpenAppAiStudio}
                className="nexus-pill-btn inline-flex h-9 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span>إعدادات التوجيه المتقدمة</span>
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        {/* Primary Brain & Model Picker */}
        <section className="space-y-3">
          <h2 className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
            اختيار المحرك النشط للمحادثة
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  onClick={() => onChangeBrainMode(opt.id)}
                  className="nexus-squircle nexus-squircle-interactive flex flex-col justify-between gap-2.5 p-4 text-right"
                  style={{
                    backgroundColor: selected
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-surface)',
                    borderColor: selected ? 'var(--accent-ai, #5B4FE9)' : 'var(--border-color)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {opt.icon}
                      </span>
                      <span
                        className="truncate text-sm font-extrabold"
                        style={{ color: selected ? 'var(--accent)' : 'var(--text-primary)' }}
                      >
                        {opt.label}
                      </span>
                    </div>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                    )}
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {opt.desc}
                  </p>

                  {snap && (
                    <div
                      className="text-[11px] font-bold tabular-nums"
                      style={{ color: cooling ? 'var(--warning)' : 'var(--success)' }}
                    >
                      {cooling ? 'في فترة تبريد' : 'جاهز للاستجابة'}
                      {snap.avgLatencyMs ? ` · ${(snap.avgLatencyMs / 1000).toFixed(1)}s` : ''}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Collaboration & Response Style */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {onChangeCollaborationMode && (
            <section className="nexus-squircle p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold">
                <GitMerge className="h-4 w-4" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span>تعاون النماذج والتدقيق المتبادل (AI Council)</span>
              </div>
              <div className="space-y-2">
                {collaborationOptions.map((col) => {
                  const active = collaborationMode === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => onChangeCollaborationMode(col.id)}
                      className="flex w-full items-start justify-between gap-3 rounded-2xl border p-3.5 text-right transition-colors hover:border-[var(--accent-ai)]"
                      style={{
                        backgroundColor: active
                          ? 'var(--bg-nav-active)'
                          : 'var(--bg-main)',
                        borderColor: active ? 'var(--accent-ai, #5B4FE9)' : 'var(--border-color)',
                      }}
                    >
                      <div className="min-w-0">
                        <div
                          className="text-xs font-extrabold"
                          style={{ color: active ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)' }}
                        >
                          {col.label}
                        </div>
                        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {col.desc}
                        </div>
                      </div>
                      {active && <Check className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {onChangeResponseStyle && (
            <section className="nexus-squircle p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold">
                <SlidersHorizontal className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <span>أسلوب التفكير وصياغة الردود</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {STYLE_CARDS.map((st) => {
                  const active = responseStyle === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onChangeResponseStyle(st.id)}
                      className="rounded-2xl border p-3.5 text-right transition-colors hover:border-[var(--accent)]"
                      style={{
                        backgroundColor: active
                          ? 'var(--bg-nav-active)'
                          : 'rgba(19, 20, 26, 0.7)',
                        borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                      }}
                    >
                      <div
                        className="text-xs font-extrabold"
                        style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}
                      >
                        {st.label}
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {st.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Fallback Chain & Live Model Health Table */}
        <section className="nexus-squircle p-5 space-y-3">
          <div>
            <h2 className="text-sm font-extrabold">سلسلة النماذج الستة الاحتياطية</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              عند انشغال أي نموذج أو انتهاء حصته اللحظية يتحول الطلب تلقائياً للنموذج التالي مع بقاء محرك Morrow المحلي كمرجع مضمون.
            </p>
          </div>
          <div
            className="divide-y rounded-2xl border overflow-hidden"
            style={{
              backgroundColor: 'rgba(19, 20, 26, 0.72)',
              borderColor: 'var(--border-color)',
            }}
          >
            {CORE_SIX_SPECIALIZED_MODELS.map((spec) => {
              const snap = modelHealthSnapshots.find(
                (h) => h.modelId === (spec.id as ApprovedCloudModelId)
              );
              const cooling = snap?.status === 'cooldown';
              return (
                <div
                  key={spec.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-extrabold">{spec.shortLabel}</div>
                    <div dir="ltr" className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {spec.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    {snap?.avgLatencyMs ? (
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {(snap.avgLatencyMs / 1000).toFixed(1)}s
                      </span>
                    ) : null}
                    <span
                      className="font-extrabold"
                      style={{ color: cooling ? 'var(--warning)' : 'var(--success)' }}
                    >
                      {cooling ? 'تبريد تلقائي' : 'متاح وجاهز'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
};

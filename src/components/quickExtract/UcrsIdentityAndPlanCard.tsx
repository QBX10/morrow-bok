import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Compass,
  Edit3,
  EyeOff,
  FileSearch,
  MapPin,
  Calendar,
  Sparkles,
} from 'lucide-react';
import type {
  UcrsContentIdentity,
  UcrsIntentMode,
  UcrsReadingPlan,
  UcrsRelevanceLevel,
} from '../../types/agency';
import { Tabrix3DTiltSurface } from '../ui/TabrixMotionPrimitives';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface UcrsIdentityAndPlanCardProps {
  identity: UcrsContentIdentity;
  plan: UcrsReadingPlan;
  onUpdatePlan: (next: UcrsReadingPlan) => void;
  onApproveAndExecute: (overrideIntent?: UcrsIntentMode) => void;
  onDiscardSession: () => void;
}

const RELEVANCE_META: Record<
  UcrsRelevanceLevel,
  { label: string; color: string; bg: string }
> = {
  important: {
    label: 'مهم ويطابق عملك مباشرة',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  useful: {
    label: 'مفيد محتمل كمرجع',
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
  },
  neutral: {
    label: 'محايد — محتوى عام',
    color: 'var(--text-primary)',
    bg: 'var(--bg-main)',
  },
  irrelevant: {
    label: 'لا يخص جداول عملك',
    color: 'var(--danger)',
    bg: 'var(--danger-bg)',
  },
};

export const UcrsIdentityAndPlanCard: React.FC<UcrsIdentityAndPlanCardProps> = ({
  identity,
  plan,
  onUpdatePlan,
  onApproveAndExecute,
  onDiscardSession,
}) => {
  const [editingPlan, setEditingPlan] = useState(false);
  const rel = RELEVANCE_META[identity.relevanceLevel] || RELEVANCE_META.useful;
  const reducedMotion = useTabrixReducedMotion();
  const editorVariants = reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS;

  return (
    <section
      aria-label="بطاقة هوية المحتوى وخطة القراءة"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      {/* Content Identity & Discovery Card */}
      <Tabrix3DTiltSurface
        maxTiltX={3.8}
        maxTiltY={4.5}
        className="space-y-3 rounded-xl border p-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="text-sm font-bold">هوية المحتوى وتقرير الاكتشاف</h2>
              <div
                className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>{identity.contentType}</span>
                <span aria-hidden="true">·</span>
                <span>{identity.topic}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  الجودة: {identity.qualityScore}% ({identity.qualityLabel})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quantitative Discovery Summary */}
        <div
          className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-xs sm:grid-cols-4"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)' }}>صفوف مرصودة</div>
            <div className="mt-0.5 font-bold tabular-nums">
              {identity.estimatedTotalRows}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>ثقة عالية</div>
            <div className="mt-0.5 font-bold tabular-nums" style={{ color: 'var(--success)' }}>
              {identity.estimatedConfidentCount}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>مشكوكة</div>
            <div className="mt-0.5 font-bold tabular-nums" style={{ color: 'var(--warning)' }}>
              {identity.estimatedDoubtfulCount}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>غير مقروءة</div>
            <div className="mt-0.5 font-bold tabular-nums" style={{ color: 'var(--danger)' }}>
              {identity.estimatedUnreadableCount}
            </div>
          </div>
        </div>

        {/* Relevance Judge Box */}
        <div
          className="space-y-1.5 rounded-lg border p-3 text-xs"
          style={{
            backgroundColor: rel.bg,
            borderColor: rel.color,
            color: rel.color,
          }}
        >
          <div className="flex items-center gap-1.5 font-bold">
            {identity.relevanceLevel === 'important' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>حكم القيمة: {rel.label}</span>
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {identity.opinionAndRecommendation}
          </p>
          {identity.relevanceReasons.length > 0 && (
            <ul
              className="list-disc space-y-0.5 pr-4"
              style={{ color: 'var(--text-primary)' }}
            >
              {identity.relevanceReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Extra detected entities (Dates, Locations, Words) */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <span className="inline-flex items-center gap-1 tabular-nums">
            <BookOpen className="h-3.5 w-3.5" />
            <span>الكلمات: {identity.wordCount}</span>
          </span>
          {identity.detectedDates.length > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Calendar className="h-3.5 w-3.5" />
              <span>التواريخ: {identity.detectedDates.slice(0, 3).join('، ')}</span>
            </span>
          )}
          {identity.detectedLocations.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>الأماكن: {identity.detectedLocations.slice(0, 3).join('، ')}</span>
            </span>
          )}
        </div>

        {/* Suggested Discovery Quick Actions */}
        {identity.suggestedActions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {identity.suggestedActions.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => onApproveAndExecute(act.intent)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-85"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {act.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onDiscardSession}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>تجاهل المحتوى</span>
            </button>
          </div>
        )}
      </Tabrix3DTiltSurface>

      {/* Reading Plan Card */}
      <Tabrix3DTiltSurface
        maxTiltX={3.8}
        maxTiltY={4.5}
        className="flex flex-col justify-between space-y-3 rounded-xl border p-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold">خطة القراءة والتنفيذ</h2>
            </div>
            <button
              type="button"
              onClick={() => setEditingPlan((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{editingPlan ? 'إخفاء التعديل' : 'تعديل الخطة'}</span>
            </button>
          </div>

          <div
            className="grid grid-cols-1 gap-3 rounded-lg border p-3 text-xs sm:grid-cols-2"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div>
              <div className="mb-1 font-bold" style={{ color: 'var(--success)' }}>
                ما سيُستخرج:
              </div>
              <ul className="list-disc space-y-0.5 pr-4">
                {plan.willExtract.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 font-bold" style={{ color: 'var(--text-muted)' }}>
                ما سيُتجاهل:
              </div>
              <ul className="list-disc space-y-0.5 pr-4" style={{ color: 'var(--text-muted)' }}>
                {plan.willIgnore.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {editingPlan && (
              <motion.div
                key="ucrs-plan-editor"
                variants={editorVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-2.5 rounded-lg border p-3 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--accent)',
                }}
              >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold">النية / الوضع</label>
                  <select
                    value={plan.intent}
                    onChange={(e) =>
                      onUpdatePlan({
                        ...plan,
                        intent: e.target.value as UcrsIntentMode,
                      })
                    }
                    className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <option value="extract_all">استخراج كامل للجدول</option>
                    <option value="extract_useful">استخراج ما يفيدني فقط</option>
                    <option value="discover">وضع الاكتشاف والتحليل</option>
                    <option value="understand_book">قراءة وفهم مستند / كتاب</option>
                    <option value="focus_notes">التركيز على الملاحظات فقط</option>
                    <option value="semantic_search">بحث دلالي موجه</option>
                    <option value="custom">أمر مخصص</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold">
                    الحد الأدنى للتغطية قبل الترحيل ({plan.minCoverageThreshold}%)
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={plan.minCoverageThreshold}
                    onChange={(e) =>
                      onUpdatePlan({
                        ...plan,
                        minCoverageThreshold: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={plan.autoApplyLearningRules}
                  onChange={(e) =>
                    onUpdatePlan({
                      ...plan,
                      autoApplyLearningRules: e.target.checked,
                    })
                  }
                />
                <span>تطبيق قواعد التعلم الذاتي المكتسبة من تصحيحاتك تلقائيًا</span>
              </label>
            </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            حد أمان التغطية: {plan.minCoverageThreshold}%
          </div>
          <button
            type="button"
            onClick={() => onApproveAndExecute()}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            {plan.approved ? (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>تحديث الاستخراج وفق الخطة</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>اعتماد الخطة وتطبيقها</span>
              </>
            )}
          </button>
        </div>
      </Tabrix3DTiltSurface>
    </section>
  );
};

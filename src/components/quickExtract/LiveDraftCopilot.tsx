import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  InferredDocumentMetadata,
  QuickExtractEvaluatedRow,
} from '../../types/agency';
import type { AiTaskRoutingMap } from '../../types/assistant';
import { computeRowZeroTrustSummary } from '../../utils/zeroTrustExtract';

export interface CopilotOperation {
  type:
    | 'filter_blocked'
    | 'filter_large_families'
    | 'filter_doubtful'
    | 'filter_clear'
    | 'highlight_row'
    | 'delete_row'
    | 'update_row'
    | 'hide_empty_columns'
    | 'show_all_columns'
    | 'update_metadata';
  rowIndex?: number | null;
  name?: string | null;
  individuals?: number | null;
  decreaseCount?: number | null;
  addOrDeleteCount?: number | null;
  addOrDeleteAction?: 'إضافة' | 'حذف' | 'لا يوجد' | null;
  notes?: string | null;
  rowDate?: string | null;
  agencyName?: string | null;
  tableDateLabel?: string | null;
  centerOrAgencyNumber?: string | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  appliedActions?: string[];
}

interface LiveDraftCopilotProps {
  draftRows: QuickExtractEvaluatedRow[];
  inferredMetadata?: InferredDocumentMetadata | null;
  documentSummary: string;
  sourceImageUrl?: string;
  presetPrompt?: string | null;
  onClearPresetPrompt?: () => void;
  onApplyOperations: (ops: CopilotOperation[]) => string[];
  onCloseMobile?: () => void;
  defaultCollapsed?: boolean;
  taskRouting?: AiTaskRoutingMap;
}

function runClientFallbackCopilot(
  query: string,
  draftRows: QuickExtractEvaluatedRow[],
  inferredMetadata?: InferredDocumentMetadata | null
): { reply: string; operations: CopilotOperation[] } {
  const norm = query.trim();
  const ops: CopilotOperation[] = [];

  if (/اخفاء.*اعمد|إخفاء.*أعمد|الاعمدة الفارغة|الأعمدة الفارغة/i.test(norm)) {
    ops.push({ type: 'hide_empty_columns' });
    return { reply: 'تم إخفاء الأعمدة الفارغة فوراً في جدول المسودة.', operations: ops };
  }
  if (/اظهار.*كل.*اعمد|إظهار.*كل.*أعمد/i.test(norm)) {
    ops.push({ type: 'show_all_columns' });
    return { reply: 'تم إظهار كافة الأعمدة.', operations: ops };
  }
  if (/عائلات كبيرة|الكبيرة/i.test(norm)) {
    const cnt = draftRows.filter((r) => (r.resolvedIndividuals ?? 0) >= 5).length;
    ops.push({ type: 'filter_large_families' });
    return { reply: `تمت تصفية المسودة للعائلات الكبيرة (≥5 أفراد): ${cnt} صف.`, operations: ops };
  }
  if (/محجوب|نزول/i.test(norm) && !/كم/.test(norm)) {
    const cnt = draftRows.filter((r) => (r.resolvedDecreaseCount ?? 0) > 0).length;
    ops.push({ type: 'filter_blocked' });
    return { reply: `تمت تصفية المسودة للمحجوبين/النزول فقط (${cnt} صف).`, operations: ops };
  }
  if (/مشكوك|شك|تعارض/i.test(norm)) {
    const doubtful = draftRows.filter((r) => computeRowZeroTrustSummary(r).anyDoubt);
    if (!/كم/.test(norm)) {
      ops.push({ type: 'filter_doubtful' });
    }
    return {
      reply:
        doubtful.length === 0
          ? 'جميع الصفوف مؤكدة ≥99% ولا توجد أي تعارضات رياضية.'
          : `عدد الصفوف المشكوك فيها أو ذات التعارض الرياضي: (${doubtful.length}) صف (أرقام: ${doubtful
              .slice(0, 8)
              .map((r) => r.rowIndex)
              .join('، ')}).`,
      operations: ops,
    };
  }
  if (/تاريخ|شهر|وكالة/i.test(norm)) {
    return {
      reply: `الهوية المستنتجة: الوكالة «${inferredMetadata?.agencyName || 'غير محددة'}»، التاريخ/الشهر «${inferredMetadata?.tableDateLabel || 'غير محدد'}».`,
      operations: ops,
    };
  }
  const rowNumMatch = norm.match(/(?:صف|سطر|رقم)\s*(\d+)/);
  if (rowNumMatch) {
    const idx = Number(rowNumMatch[1]);
    const target = draftRows.find((r) => r.rowIndex === idx);
    if (target) {
      ops.push({ type: 'highlight_row', rowIndex: idx });
      return {
        reply: `السطر #${idx}: «${target.resolvedName}» — الأفراد ${target.resolvedIndividuals ?? '—'}، المحجوب ${target.resolvedDecreaseCount ?? 0}. تم تمييزه.`,
        operations: ops,
      };
    }
  }
  return {
    reply: `يحتوي الكشف على ${draftRows.length} صف. جرب: «كم عدد الصفوف المشكوك فيها؟» أو «اخفِ الأعمدة الفارغة».`,
    operations: ops,
  };
}

export const LiveDraftCopilot: React.FC<LiveDraftCopilotProps> = ({
  draftRows,
  inferredMetadata,
  documentSummary,
  sourceImageUrl,
  presetPrompt,
  onClearPresetPrompt,
  onApplyOperations,
  onCloseMobile,
  defaultCollapsed = false,
  taskRouting,
}) => {
  const firstDoubtRowIndex =
    draftRows.find((r) => !r.zeroTrustConfirmed)?.rowIndex ??
    draftRows[0]?.rowIndex ??
    1;

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'أهلاً بك في مساعد المختبر (Morrow Copilot). يمكنك سؤالي عن الصفوف المشكوك فيها أو طلب إخفاء الأعمدة الفارغة أو تصفية الجدول فوراً.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resilienceNote, setResilienceNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (presetPrompt) {
      setCollapsed(false);
      setInput(presetPrompt);
      inputRef.current?.focus();
      onClearPresetPrompt?.();
    }
  }, [presetPrompt, onClearPresetPrompt]);

  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, collapsed]);

  const sendMessage = async (textOverride?: string) => {
    const query = (textOverride ?? input).trim();
    if (!query || loading) return;

    setCollapsed(false);
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: query,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) setInput('');
    setResilienceNote(null);
    setLoading(true);

    try {
      const resp = await fetch('/api/quick-extract/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          documentSummary,
          inferredMetadata: inferredMetadata || null,
          sourceImageBase64: sourceImageUrl?.startsWith('data:image/')
            ? sourceImageUrl
            : undefined,
          sourceMimeType: sourceImageUrl?.startsWith('data:image/png')
            ? 'image/png'
            : sourceImageUrl?.startsWith('data:image/webp')
              ? 'image/webp'
              : 'image/jpeg',
          draftRows: draftRows.map((r) => ({
            id: r.id,
            rowIndex: r.rowIndex,
            resolvedName: r.resolvedName,
            resolvedIndividuals: r.resolvedIndividuals,
            resolvedEligibleIndividuals: r.resolvedEligibleIndividuals ?? null,
            resolvedDecreaseCount: r.resolvedDecreaseCount,
            resolvedAddOrDeleteCount: r.resolvedAddOrDeleteCount,
            resolvedAddOrDeleteAction: r.resolvedAddOrDeleteAction,
            resolvedRowDate: r.resolvedRowDate,
            notes: r.notes,
            nameConfidence: r.nameConfidence,
            numbersConfidence: r.numbersConfidence,
            zeroTrustConfirmed: r.zeroTrustConfirmed,
            mathIssuesCount: r.mathIssues.length,
          })),
          history: nextHistory.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          taskRouting,
        }),
      });

      const data = (await resp.json()) as {
        reply?: string;
        operations?: CopilotOperation[];
        modelId?: string;
        modelLabel?: string;
        fallbackUsed?: boolean | 'primary' | 'local' | string;
      };

      if (!resp.ok) {
        throw new Error('cloud_busy');
      }

      if (data.fallbackUsed === 'local' || data.modelId === 'morrow-local') {
        setResilienceNote('تم التنفيذ محلياً (morrow-local) بدون انقطاع.');
      } else if (data.modelId) {
        setResilienceNote(
          data.fallbackUsed
            ? `تم التحويل التلقائي والرد عبر: ${data.modelId}`
            : `النموذج المنفّذ: ${data.modelId}`
        );
      }

      const ops = Array.isArray(data.operations) ? data.operations : [];
      const appliedActions = ops.length > 0 ? onApplyOperations(ops) : [];

      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: data.reply || 'تمت المراجعة.',
          appliedActions,
        },
      ]);
    } catch {
      const localResult = runClientFallbackCopilot(query, draftRows, inferredMetadata);
      const appliedActions =
        localResult.operations.length > 0
          ? onApplyOperations(localResult.operations)
          : [];
      setResilienceNote('تمت الاستجابة عبر المحلل الذكي المحلي.');
      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: localResult.reply,
          appliedActions,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'كم عدد الصفوف المشكوك فيها؟',
    'قم بإخفاء الأعمدة الفارغة',
    'اسحب الذين لديهم محجوبين فقط',
    `من هو الشخص رقم ${firstDoubtRowIndex}؟`,
  ];

  return (
    <aside
      aria-label="المساعد الجانبي للمختبر (Morrow Copilot)"
      className="flex flex-col overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-200"
      style={{
        backgroundColor:
          'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5"
        style={{
          borderColor: collapsed ? 'transparent' : 'var(--border-color)',
          backgroundColor:
            'color-mix(in srgb, var(--bg-main) 75%, transparent)',
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex flex-1 items-center gap-2 text-right"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor:
                'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
              color: 'var(--accent)',
            }}
          >
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold">المساعد الجانبي (Morrow Copilot)</div>
            <div className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {collapsed
                ? `انقر للفتح — متصل بالجدول (${draftRows.length} صف)`
                : `متصل بصرياً بالصورة والجدول المستخرج (${draftRows.length} صف)`}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            aria-label={collapsed ? 'توسيع المساعد' : 'طي المساعد'}
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>فتح</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>طي</span>
              </>
            )}
          </button>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded p-1 lg:hidden"
              style={{ color: 'var(--text-muted)' }}
              aria-label="إغلاق الدردشة"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div
            className="flex flex-wrap gap-1.5 border-b px-3 py-2"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void sendMessage(q)}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <Sparkles className="h-2.5 w-2.5" style={{ color: 'var(--accent)' }} />
                {q}
              </button>
            ))}
          </div>

          <div className="max-h-[300px] flex-1 space-y-2.5 overflow-y-auto p-3 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col gap-1 ${
                  m.role === 'user' ? 'items-start' : 'items-end'
                }`}
              >
                <div
                  className="max-w-[92%] rounded-xl border px-3 py-2 leading-relaxed"
                  style={{
                    backgroundColor:
                      m.role === 'user' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div>{m.text}</div>
                  {m.appliedActions && m.appliedActions.length > 0 && (
                    <div
                      className="mt-2 space-y-1 border-t pt-1.5"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      {m.appliedActions.map((act, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 text-[11px] font-medium"
                          style={{ color: 'var(--success)' }}
                        >
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>{act}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div
                className="flex items-center gap-2 text-[11px]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>جاري تحليل المسودة وتنفيذ الطلب...</span>
              </div>
            )}

            {resilienceNote && (
              <div
                className="rounded-lg border px-2.5 py-1.5 text-[11px]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                {resilienceNote}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="flex items-center gap-2 border-t p-2.5"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اسأل المساعد (مثال: كم عدد الصفوف المشكوك فيها؟)..."
              className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Send className="h-3.5 w-3.5" />
              إرسال
            </button>
          </form>
        </>
      )}
    </aside>
  );
};

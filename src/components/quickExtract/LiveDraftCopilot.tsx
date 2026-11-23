import React, { useEffect, useRef, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Send, Sparkles, X } from 'lucide-react';
import type {
  InferredDocumentMetadata,
  QuickExtractEvaluatedRow,
} from '../../types/agency';

export interface CopilotOperation {
  type:
    | 'filter_blocked'
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
}) => {
  const firstDoubtRowIndex =
    draftRows.find((r) => !r.zeroTrustConfirmed)?.rowIndex ??
    draftRows[0]?.rowIndex ??
    1;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'أهلاً بك في مسودة السحب. أنا متصل بصرياً بالصورة والترويسة والجدول — يمكنك سؤالي عن أي رقم أو تاريخ أو طلب تعديل فوري على المسودة.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (presetPrompt) {
      setInput(presetPrompt);
      inputRef.current?.focus();
      onClearPresetPrompt?.();
    }
  }, [presetPrompt, onClearPresetPrompt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (textOverride?: string) => {
    const query = (textOverride ?? input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: query,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) setInput('');
    setErrorMsg(null);
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
            resolvedDecreaseCount: r.resolvedDecreaseCount,
            resolvedAddOrDeleteCount: r.resolvedAddOrDeleteCount,
            resolvedAddOrDeleteAction: r.resolvedAddOrDeleteAction,
            resolvedRowDate: r.resolvedRowDate,
            notes: r.notes,
            nameConfidence: r.nameConfidence,
            numbersConfidence: r.numbersConfidence,
            zeroTrustConfirmed: r.zeroTrustConfirmed,
          })),
          history: nextHistory.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = (await resp.json()) as {
        reply?: string;
        operations?: CopilotOperation[];
        error?: string;
      };

      if (!resp.ok) {
        throw new Error(data.error || 'تعذر تواصل المساعد الحي.');
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
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر تواصل المساعد الحي.'
      );
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'ما هو تاريخ هذا الجدول؟',
    `من هو الشخص رقم ${firstDoubtRowIndex}؟`,
    'قم بتصفية الأسماء التي لديها أفراد محجوبين فقط',
    'يا مساعد، قم بإخفاء الأعمدة الفارغة',
  ];

  return (
    <aside
      className="flex h-full min-h-[460px] flex-col rounded-xl border"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3.5 py-2.5"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <div>
            <div className="text-xs font-bold">المساعد الحي للمسودة</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              متصل بالصورة والجدول المستخرج ({draftRows.length} صف)
            </div>
          </div>
        </div>
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

      <div className="flex flex-wrap gap-1.5 border-b px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>
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

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3 text-xs max-h-[420px]">
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
                <div className="mt-2 space-y-1 border-t pt-1.5" style={{ borderColor: 'var(--border-color)' }}>
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
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>جاري فحص الصورة ومسودة الجدول...</span>
          </div>
        )}

        {errorMsg && (
          <div
            className="rounded-lg border px-2.5 py-1.5 text-[11px]"
            style={{
              backgroundColor: 'var(--danger-bg)',
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
            }}
          >
            {errorMsg}
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
          placeholder="اسأل المساعد أو اطلب تعديلاً على المسودة..."
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
    </aside>
  );
};

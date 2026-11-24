import React from 'react';
import {
  ArrowUpLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  LayoutPanelLeft,
  Navigation,
  Pin,
  Radio,
  RefreshCw,
  RotateCcw,
  Sparkles,
  StickyNote,
  Volume2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type {
  AssistantCanvasHandoff,
  AssistantChoiceChip,
  AssistantEngineSource,
  AssistantMessage,
} from '../../types/assistant';
import { getEngineDisplayMeta } from '../../utils/morrowRouter';
import { ResultCard } from '../cosmos/ResultCard';
import { MorrowCollaborationTrace } from './MorrowCollaborationTrace';

interface MorrowMessageCardProps {
  message: AssistantMessage;
  compact?: boolean;
  copied?: boolean;
  speaking?: boolean;
  savedToQueue?: boolean;
  hasUndoableAction?: boolean;
  onCopy: (msgId: string, text: string) => void;
  onTogglePin?: (msgId: string) => void;
  onRetry?: () => void;
  onSpeak?: (msgId: string, text: string) => void;
  onSaveQuickNote?: (text: string) => void;
  onChoiceClick: (choice: AssistantChoiceChip) => void;
  onResolveDiff: (msgId: string, approved: boolean) => void;
  onTriggerSpotlight: (opts: {
    view: NonNullable<AssistantMessage['spotlightAction']>['view'];
    settingsSection?: NonNullable<AssistantMessage['spotlightAction']>['settingsSection'];
    targetId: string;
    title: string;
    description: string;
  }) => void;
  onTriggerCanvasHandoff?: (handoff: AssistantCanvasHandoff) => void;
  onUndoLastAction?: (msgId?: string) => void;
  onSendPrompt: (prompt: string) => void;
  onSavePromptToQueue?: (msgId: string, prompt: string) => void;
}

function EngineIcon({ engine }: { engine?: AssistantEngineSource }) {
  if (engine === 'gemini_3_8_flash' || engine === 'nemotron_free') {
    return <Sparkles className="h-3.5 w-3.5 shrink-0" />;
  }
  if (engine === 'gemini_3_8_live') {
    return <Radio className="h-3.5 w-3.5 shrink-0" />;
  }
  if (
    engine === 'gemini_3_5_flash' ||
    engine === 'gemini_3_5_flash_lite' ||
    engine === 'openrouter_free'
  ) {
    return <Zap className="h-3.5 w-3.5 shrink-0" />;
  }
  if (engine === 'whisper_large_v3_turbo') {
    return <Volume2 className="h-3.5 w-3.5 shrink-0" />;
  }
  return <Cpu className="h-3.5 w-3.5 shrink-0" />;
}

function renderInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedProse({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 leading-[1.75]">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" aria-hidden="true" />;
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="pt-1 text-xs sm:text-sm font-black tracking-tight"
              style={{ color: 'var(--accent)' }}
            >
              {renderInlineBold(trimmed.slice(4))}
            </h4>
          );
        }
        if (/^(?:•|-|\*)\s+/.test(trimmed)) {
          const content = trimmed.replace(/^(?:•|-|\*)\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pr-1">
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--accent)' }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 tabular-nums">{renderInlineBold(content)}</span>
            </div>
          );
        }
        const numMatch = trimmed.match(/^(\d+)[\.)]\s+(.+)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pr-1">
              <span
                className="shrink-0 font-bold tabular-nums"
                style={{ color: 'var(--accent)' }}
              >
                {numMatch[1]}.
              </span>
              <span className="min-w-0 flex-1 tabular-nums">{renderInlineBold(numMatch[2])}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="tabular-nums">
            {renderInlineBold(line)}
          </p>
        );
      })}
    </div>
  );
}

export const MorrowMessageCard: React.FC<MorrowMessageCardProps> = ({
  message,
  compact = false,
  copied = false,
  speaking = false,
  savedToQueue = false,
  hasUndoableAction = false,
  onCopy,
  onTogglePin,
  onRetry,
  onSpeak,
  onSaveQuickNote,
  onChoiceClick,
  onResolveDiff,
  onTriggerSpotlight,
  onTriggerCanvasHandoff,
  onUndoLastAction,
  onSendPrompt,
  onSavePromptToQueue,
}) => {
  const isUser = message.role === 'user';
  const meta = getEngineDisplayMeta(message.engineUsed, message.modelId);

  if (isUser) {
    return (
      <div className="flex flex-col items-start">
        <div
          className={`rounded-2xl border whitespace-pre-line leading-[1.7] ${
            compact
              ? 'max-w-[88%] px-3.5 py-2.5 text-xs sm:text-[13px]'
              : 'max-w-[85%] px-4 py-3 text-xs sm:text-sm'
          }`}
          style={{
            backgroundColor: 'var(--bg-nav-active)',
            borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border-color))',
            color: 'var(--text-primary)',
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  const isWelcomeMsg = message.id.startsWith('welcome_msg_');
  const showTransforms = !compact && !isWelcomeMsg && message.text.trim().length > 60;

  return (
    <article className="flex flex-col items-stretch">
      <div
        className={`rounded-2xl border transition-colors ${
          compact ? 'px-3.5 py-3 text-xs sm:text-[13px]' : 'px-4 py-3.5 sm:px-5 sm:py-4 text-xs sm:text-sm'
        }`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: message.isPinned
            ? 'color-mix(in srgb, var(--accent) 55%, var(--border-color))'
            : 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Crisp Attribution Header (Single Calm Line) */}
        <header
          className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]"
          style={{ color: 'var(--text-muted)' }}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span
              className="inline-flex items-center gap-1.5 font-extrabold"
              style={{ color: 'var(--accent)' }}
            >
              <EngineIcon engine={message.engineUsed} />
              <span className="truncate">{message.engineLabel || meta.badgeLabel}</span>
            </span>

            {!compact && message.specialtyTitle && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate font-medium">{message.specialtyTitle}</span>
              </>
            )}

            <span dir="ltr" className="hidden sm:inline font-mono text-[10px] opacity-80">
              · {message.modelId || meta.modelId}
            </span>

            {typeof message.latencyMs === 'number' && message.latencyMs > 0 && (
              <span dir="ltr" className="font-mono text-[10px] tabular-nums opacity-80">
                · {(message.latencyMs / 1000).toFixed(1)}s
              </span>
            )}

            {typeof message.confidence === 'number' && !compact && (
              <span className="text-[10px] tabular-nums opacity-80">
                · دقة {Math.round(message.confidence * 100)}%
              </span>
            )}

            {message.fromCache && (
              <span className="text-[10px] font-semibold" style={{ color: 'var(--success)' }}>
                · استرجاع فوري
              </span>
            )}
          </div>

          {message.isPinned && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold"
              style={{ color: 'var(--accent)' }}
            >
              <Pin className="h-3 w-3" />
              <span>مثبت</span>
            </span>
          )}
        </header>

        {/* Readable Structured Message Prose */}
        <FormattedProse text={message.text} />

        {/* Multi-Model / Multi-Stage Collaboration Trace */}
        {message.collaborationTrace && message.collaborationTrace.length > 0 && (
          <MorrowCollaborationTrace trace={message.collaborationTrace} compact={compact} />
        )}

        {/* Rich Analytical Result Card */}
        {message.resultCard && (
          <div className="mt-3">
            <ResultCard
              title={message.resultCard.title}
              summary={message.resultCard.summary}
              scorePercent={message.resultCard.scorePercent}
              scoreLabel={message.resultCard.scoreLabel}
              tone={message.resultCard.tone}
              bars={message.resultCard.bars}
              details={message.resultCard.details}
            />
          </div>
        )}

        {/* Direct Interactive Canvas Handoff */}
        {message.canvasHandoff && onTriggerCanvasHandoff && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => onTriggerCanvasHandoff(message.canvasHandoff!)}
              className="flex w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-right text-xs transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'color-mix(in srgb, var(--accent) 42%, var(--border-color))',
              }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <LayoutPanelLeft className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                <div className="min-w-0">
                  <div className="truncate font-bold" style={{ color: 'var(--text-primary)' }}>
                    {message.canvasHandoff.label}
                  </div>
                  {message.canvasHandoff.description && (
                    <div className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {message.canvasHandoff.description}
                    </div>
                  )}
                </div>
              </div>
              <ArrowUpLeft className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
            </button>
          </div>
        )}

        {/* Inline Undo */}
        {message.canUndo && !message.undoUsed && hasUndoableAction && onUndoLastAction && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => onUndoLastAction(message.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--warning)',
                color: 'var(--warning)',
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>تراجع عن هذه العملية</span>
            </button>
          </div>
        )}

        {message.undoUsed && (
          <div className="mt-1.5 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            تم التراجع عن هذا التعديل.
          </div>
        )}

        {/* Read-Only Sandbox Export Notice */}
        {message.sandboxNotice && (
          <div
            className="mt-2.5 rounded-xl border px-3 py-2 text-[11px] font-semibold"
            style={{
              backgroundColor: 'var(--success-bg)',
              borderColor: 'var(--success)',
              color: 'var(--success)',
            }}
          >
            {message.sandboxNotice}
          </div>
        )}

        {/* Spotlight Navigation Trigger ("وريني") */}
        {message.spotlightAction && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() =>
                onTriggerSpotlight({
                  view: message.spotlightAction!.view,
                  settingsSection: message.spotlightAction!.settingsSection,
                  targetId: message.spotlightAction!.targetId,
                  title: message.spotlightAction!.label,
                  description: 'انتقال ذكي إلى العنصر المحدد',
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-opacity hover:opacity-95"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>{message.spotlightAction.label}</span>
            </button>
          </div>
        )}

        {/* Interactive Action Choices */}
        {message.choices && message.choices.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {message.choices.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => onChoiceClick(ch)}
                className="rounded-xl border px-3 py-1.5 text-right text-[11px] sm:text-xs font-bold transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: ch.tone === 'warning' ? 'var(--warning)' : 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <div>{ch.label}</div>
                {ch.sublabel && (
                  <div className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                    {ch.sublabel}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Diagnostics Audit Details + One-Click Safe Auto-Fix Draft */}
        {message.diagnosticsReport && message.diagnosticsReport.issues.length > 0 && (
          <div
            className="mt-3 divide-y border-t pt-2.5 text-xs"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {message.diagnosticsReport.issues.slice(0, compact ? 4 : 6).map((issue) => (
              <div key={issue.id} className="py-2">
                <div
                  className="font-bold"
                  style={{
                    color: issue.severity === 'high' ? 'var(--danger)' : 'var(--text-primary)',
                  }}
                >
                  {issue.title}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {issue.detail}
                </div>
              </div>
            ))}
            {message.diagnosticsReport.autoFixableCount > 0 && (
              <div className="pt-2.5">
                <button
                  type="button"
                  onClick={() => onSendPrompt('صلح مشاكل الفحص تلقائياً')}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>
                    تجهيز مسودة إصلاح ({message.diagnosticsReport.autoFixableCount})
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Zero-Trust Before -> After Confirmation Diff */}
        {message.confirmationDiff && (
          <div
            className="mt-3 space-y-2.5 border-t pt-3 text-xs"
            style={{
              borderColor: 'color-mix(in srgb, var(--accent) 42%, var(--border-color))',
            }}
          >
            <div>
              <div className="font-extrabold" style={{ color: 'var(--accent)' }}>
                {message.confirmationDiff.title}
              </div>
              {message.confirmationDiff.summary && (
                <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {message.confirmationDiff.summary}
                </div>
              )}
            </div>

            <div
              className="divide-y rounded-xl border"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              {message.confirmationDiff.changes.map((c, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {c.fieldLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 font-bold tabular-nums">
                    <span className="line-through opacity-75">{c.beforeValue}</span>
                    <span style={{ color: 'var(--accent)' }}>←</span>
                    <span style={{ color: 'var(--success)' }}>{c.afterValue}</span>
                  </div>
                </div>
              ))}
            </div>

            {message.confirmationDiff.status === 'pending' ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onResolveDiff(message.id, true)}
                  className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--success)',
                    color: 'var(--success-fg)',
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>موافقة وتنفيذ</span>
                </button>
                <button
                  type="button"
                  onClick={() => onResolveDiff(message.id, false)}
                  className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--danger)',
                    color: 'var(--danger)',
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>إلغاء</span>
                </button>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 text-xs font-bold"
                style={{
                  color:
                    message.confirmationDiff.status === 'approved'
                      ? 'var(--success)'
                      : 'var(--text-muted)',
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {message.confirmationDiff.status === 'approved'
                    ? 'تمت الموافقة والتنفيذ'
                    : 'ملغى'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Offline Queue CTA */}
        {message.queuePrompt && onSavePromptToQueue && (
          <div className="mt-2.5">
            {savedToQueue ? (
              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-bold"
                style={{ color: 'var(--success)' }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>تم حفظ الطلب وسيظهر لك فور عودة الإنترنت</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSavePromptToQueue(message.id, message.queuePrompt!.prompt)}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>احفظ الطلب وأنفذه لما يرجع النت</span>
              </button>
            )}
          </div>
        )}

        {/* Follow-Up Next Step Suggestions (Council / Tool Chains) */}
        {message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
          <div
            className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2.5"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              خطوة مقترحة:
            </span>
            {message.suggestedFollowUps.slice(0, 3).map((fu) => (
              <button
                key={fu.id}
                type="button"
                onClick={() => onSendPrompt(fu.prompt)}
                className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {fu.label}
              </button>
            ))}
          </div>
        )}

        {/* Calm Gemini-Style Bottom Action Toolbar */}
        <footer
          className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[11px]"
          style={{
            borderColor: 'var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onCopy(message.id, message.text)}
              title="نسخ الرد"
              aria-label="نسخ الرد"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--accent)]"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>

            {onSpeak && (
              <button
                type="button"
                onClick={() => onSpeak(message.id, message.text)}
                title={speaking ? 'إيقاف القراءة الصوتية' : 'استماع للرد'}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--accent)]"
                style={{
                  color: speaking ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>{speaking ? 'إيقاف' : 'استماع'}</span>
              </button>
            )}

            {onSaveQuickNote && (
              <button
                type="button"
                onClick={() => onSaveQuickNote(message.text.slice(0, 320))}
                title="حفظ كملاحظة سريعة"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--accent)]"
              >
                <StickyNote className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ملاحظة</span>
              </button>
            )}

            {onTogglePin && (
              <button
                type="button"
                onClick={() => onTogglePin(message.id)}
                title={message.isPinned ? 'إلغاء تثبيت الرسالة' : 'تثبيت الرسالة'}
                aria-label="تثبيت الرسالة"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--accent)]"
                style={{
                  color: message.isPinned ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <Pin className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{message.isPinned ? 'مثبتة' : 'تثبيت'}</span>
              </button>
            )}

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                title="إعادة التوليد"
                aria-label="إعادة توليد الرد"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--accent)]"
              >
                <RefreshCw className="h-3 w-3" />
                <span className="hidden sm:inline">إعادة</span>
              </button>
            )}
          </div>

          {showTransforms && (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  onSendPrompt(`لخص الرد التالي في 3 نقاط مختصرة:\n${message.text.slice(0, 420)}`)
                }
                className="rounded-lg border px-2 py-0.5 text-[10px] font-bold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                لخّص باختصار
              </button>
              <button
                type="button"
                onClick={() =>
                  onSendPrompt(`أعطني تحليلاً أعمق وتوصيات عملية حول:\n${message.text.slice(0, 420)}`)
                }
                className="rounded-lg border px-2 py-0.5 text-[10px] font-bold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                تعمّق بالتحليل
              </button>
            </div>
          )}
        </footer>
      </div>
    </article>
  );
};

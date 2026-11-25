import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Download,
  MessageSquare,
  Pin,
  Search,
  SquarePen,
  Trash2,
} from 'lucide-react';
import type { AssistantChatThread, AssistantMessage } from '../../types/assistant';
import { normalizeArabic } from '../../utils/agencyLogic';
import { MorrowSubPageHeader } from './MorrowSubPageHeader';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import { MotionSurfaceCard } from '../ui/TabrixMotionPrimitives';

interface MorrowHistoryPageProps {
  chatThreads: AssistantChatThread[];
  activeThreadId?: string;
  messages: AssistantMessage[];
  historySearch: string;
  onChangeHistorySearch: (q: string) => void;
  showPinnedOnly: boolean;
  onTogglePinnedOnly: () => void;
  onSwitchThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onNewChat?: () => void;
  onExportChatHistory?: () => void;
  onOpenChat: () => void;
}

export const MorrowHistoryPage: React.FC<MorrowHistoryPageProps> = ({
  chatThreads,
  activeThreadId,
  messages,
  historySearch,
  onChangeHistorySearch,
  showPinnedOnly,
  onTogglePinnedOnly,
  onSwitchThread,
  onDeleteThread,
  onNewChat,
  onExportChatHistory,
  onOpenChat,
}) => {
  const qNorm = normalizeArabic(historySearch.trim());

  const filteredThreads = chatThreads.filter((th) => {
    if (!qNorm) return true;
    return (
      normalizeArabic(th.title).includes(qNorm) ||
      normalizeArabic(th.previewText).includes(qNorm)
    );
  });

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const reducedMotion = useTabrixReducedMotion();
  const sectionVariants = reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS;

  return (
    <main
      aria-label="المحادثات السابقة والجلسات المحفوظة"
      data-testid="morrow-history-page"
      className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
    >
      <MorrowSubPageHeader
        title="المحادثات السابقة والجلسات"
        subtitle="التبديل بين الجلسات المحفوظة، الرسائل المثبتة، أو تصدير السجل"
        onBack={onOpenChat}
        rightSlot={
          <div className="flex items-center gap-2">
            {onExportChatHistory && (
              <button
                type="button"
                onClick={onExportChatHistory}
                className="nexus-pill-btn inline-flex h-9 items-center gap-1.5 border px-3.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Download className="h-3.5 w-3.5" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span>تصدير JSON</span>
              </button>
            )}
            {onNewChat && (
              <button
                type="button"
                onClick={() => {
                  onNewChat();
                  onOpenChat();
                }}
                className="nexus-pill-btn inline-flex h-9 items-center gap-1.5 px-4 text-xs font-extrabold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent-ai, #5B4FE9)',
                  color: '#FFFFFF',
                }}
              >
                <SquarePen className="h-3.5 w-3.5" />
                <span>محادثة جديدة</span>
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        {/* Search & Filter Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="nexus-squircle flex min-w-[220px] flex-1 items-center gap-2 px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              value={historySearch}
              onChange={(e) => onChangeHistorySearch(e.target.value)}
              placeholder="ابحث في عناوين المحادثات أو مقتطفاتها..."
              className="w-full min-w-0 bg-transparent text-xs sm:text-sm outline-none"
            />
          </div>

          <button
            type="button"
            onClick={onTogglePinnedOnly}
            className="nexus-pill-btn inline-flex h-10 items-center gap-1.5 border px-4 text-xs font-bold whitespace-nowrap"
            style={{
              backgroundColor: showPinnedOnly
                ? 'var(--bg-nav-active)'
                : 'var(--bg-surface)',
              borderColor: showPinnedOnly ? 'var(--accent-ai, #5B4FE9)' : 'var(--border-color)',
              color: showPinnedOnly ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)',
            }}
          >
            <Pin className="h-3.5 w-3.5" />
            <span>الرسائل المثبتة ({pinnedMessages.length})</span>
          </button>
        </div>

        {/* Pinned Messages Highlight when toggled */}
        <AnimatePresence>
          {showPinnedOnly && (
            <motion.section
              key="pinned-messages-section"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-2.5"
            >
              <h2 className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
                الرسائل المثبتة في الجلسة الحالية ({pinnedMessages.length})
              </h2>
              {pinnedMessages.length === 0 ? (
                <div
                  className="rounded-2xl border px-4 py-8 text-center text-xs"
                  style={{
                    backgroundColor: 'rgba(13, 15, 22, 0.8)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  لا توجد رسائل مثبتة في المحادثة الحالية بعد. يمكنك تثبيت أي رد من أسفل بطاقته.
                </div>
              ) : (
                pinnedMessages.map((pm) => (
                  <motion.button
                    key={pm.id}
                    type="button"
                    onClick={onOpenChat}
                    whileHover={reducedMotion ? undefined : { y: -2 }}
                    whileTap={reducedMotion ? undefined : { scale: 0.99 }}
                    transition={TABRIX_TACTILE_SPRING}
                    className="block w-full rounded-2xl border p-4 text-right transition-colors hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'rgba(13, 15, 22, 0.85)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--accent)' }}>
                      <span className="font-bold">{pm.engineLabel || 'Morrow'}</span>
                      <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {new Date(pm.createdAt).toLocaleDateString('ar-IQ')}
                      </span>
                    </div>
                    <p className="line-clamp-3 text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      {pm.text}
                    </p>
                  </motion.button>
                ))
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Saved Threads List */}
        <section className="space-y-3">
          <h2 className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
            الجلسات المحفوظة ({filteredThreads.length})
          </h2>

          {filteredThreads.length === 0 ? (
            <div
              className="nexus-squircle px-5 py-12 text-center space-y-2"
              style={{ color: 'var(--text-muted)' }}
            >
              <MessageSquare className="mx-auto h-7 w-7 opacity-60" />
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                لا توجد محادثات مطابقة
              </div>
              <p className="text-xs">
                تُحفظ محادثاتك تلقائياً هنا فور إرسال أول رسالة لتتمكن من الرجوع إليها في أي وقت.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {filteredThreads.map((th) => {
                  const isCurrent = th.id === activeThreadId;
                  return (
                    <motion.div
                      key={th.id}
                      layout={!reducedMotion}
                      variants={sectionVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      <MotionSurfaceCard
                        className="nexus-squircle nexus-squircle-interactive flex items-start justify-between gap-2.5 p-4 h-full"
                        style={{
                          backgroundColor: isCurrent
                            ? 'var(--bg-nav-active)'
                            : 'var(--bg-surface)',
                          borderColor: isCurrent ? 'var(--accent-ai, #5B4FE9)' : 'var(--border-color)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSwitchThread?.(th.id);
                            onOpenChat();
                          }}
                          className="min-w-0 flex-1 text-right space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="truncate text-sm font-extrabold"
                              style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-primary)' }}
                            >
                              {th.title}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            {th.previewText.replace(/#+\s*/g, '').replace(/\*\*/g, '')}
                          </p>
                          <div className="pt-1 text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            {th.messages.length} رسائل ·{' '}
                            {new Date(th.updatedAt).toLocaleDateString('ar-IQ')}
                          </div>
                        </button>

                        {onDeleteThread && (
                          <button
                            type="button"
                            onClick={() => onDeleteThread(th.id)}
                            aria-label={`حذف محادثة ${th.title}`}
                            className="shrink-0 rounded-xl border p-2 opacity-75 transition-opacity hover:opacity-100"
                            style={{
                              backgroundColor: 'rgba(19, 20, 26, 0.9)',
                              borderColor: 'var(--border-color)',
                              color: 'var(--danger)',
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </MotionSurfaceCard>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

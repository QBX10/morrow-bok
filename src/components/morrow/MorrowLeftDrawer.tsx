import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpLeft,
  BarChart3,
  BookmarkCheck,
  Bot,
  Camera,
  ClipboardCheck,
  Cpu,
  FileText,
  History,
  LayoutPanelLeft,
  Mic,
  Radio,
  ShieldCheck,
  Sparkles,
  SquarePen,
  StickyNote,
  Users,
  Volume2,
  Wand2,
} from 'lucide-react';
import type {
  AssistantBrainMode,
  AssistantChatThread,
  MorrowCanvasMode,
} from '../../types/assistant';
import { TABRIX_TACTILE_SPRING, useTabrixReducedMotion } from '../../utils/tabrixMotion';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import { NexusDuotoneIcon } from '../ui/NexusDuotoneIcon';
import {
  SPECIALIZED_ASSISTANTS,
  type MorrowWorkspacePage,
} from './morrowWorkspaceTypes';

interface MorrowLeftDrawerProps {
  open: boolean;
  onClose: () => void;
  activePage: MorrowWorkspacePage;
  activeCanvasMode: MorrowCanvasMode;
  onOpenPage: (page: MorrowWorkspacePage, canvasMode?: MorrowCanvasMode) => void;
  // 1. History & Sessions
  chatThreads: AssistantChatThread[];
  activeThreadId?: string;
  onSwitchThread?: (threadId: string) => void;
  onNewChat?: () => void;
  // 2. Models
  brainMode: AssistantBrainMode;
  activeBrainLabel: string;
  // 3. Specialized Assistants
  activeAssistantId: string;
  onSelectAssistant?: (assistantId: string) => void;
  // Badges / Counts
  pendingDraftsCount: number;
  memoryRulesCount: number;
  quickNotesCount: number;
  // File upload trigger from Tools
  onTriggerFilePicker?: () => void;
}

export const MorrowLeftDrawer: React.FC<MorrowLeftDrawerProps> = ({
  open,
  onClose,
  activePage,
  activeCanvasMode,
  onOpenPage,
  chatThreads,
  activeThreadId,
  onSwitchThread,
  onNewChat,
  activeBrainLabel,
  activeAssistantId,
  onSelectAssistant,
  pendingDraftsCount,
  memoryRulesCount,
  quickNotesCount,
  onTriggerFilePicker,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const openSubPage = (page: MorrowWorkspacePage, canvasMode?: MorrowCanvasMode) => {
    onClose();
    onOpenPage(page, canvasMode);
  };

  const activeAssistant =
    SPECIALIZED_ASSISTANTS.find((a) => a.id === activeAssistantId) ||
    SPECIALIZED_ASSISTANTS[0];

  const rowBtnClass =
    'flex w-full items-center justify-between gap-2.5 rounded-2xl border px-3.5 py-3 text-right text-xs font-bold transition-colors hover:border-[var(--accent-ai)]';

  return (
    <FullScreenPushPage
      open={open}
      onBack={onClose}
      title="مساحة ذكاء Morrow"
      subtitle="المحرك، المساعدون، المحادثات، والأدوات الذكية"
      icon={
        <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
          <Sparkles className="h-4 w-4" />
        </NexusDuotoneIcon>
      }
      maxWidthClass="max-w-3xl"
      zIndexClass="z-[var(--z-sheet)]"
      ariaLabel="قائمة Morrow للذكاء الاصطناعي والنماذج"
      headerActions={
        onNewChat ? (
          <motion.button
            type="button"
            whileHover={reducedMotion ? undefined : { scale: 1.03 }}
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={TABRIX_TACTILE_SPRING}
            onClick={() => {
              onNewChat();
              openSubPage('chat');
            }}
            className="nexus-pill-btn inline-flex h-9 items-center gap-1.5 px-3.5 text-xs font-extrabold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent-ai, #5B4FE9)',
              color: '#FFFFFF',
            }}
          >
            <SquarePen className="h-3.5 w-3.5" />
            <span>محادثة جديدة</span>
          </motion.button>
        ) : undefined
      }
    >
      <div data-testid="morrow-side-drawer" className="space-y-4">
        {/* Category 1: Chat History & Saved Sessions */}
        <section className="nexus-squircle p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-extrabold"
              style={{ color: 'var(--text-muted)' }}
            >
              ١. المحادثات السابقة
            </span>
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              {chatThreads.length} جلسات
            </span>
          </div>

          <button
            type="button"
            data-testid="morrow-nav-history"
            onClick={() => openSubPage('history')}
            className={rowBtnClass}
            style={{
              backgroundColor:
                activePage === 'history'
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
              borderColor:
                activePage === 'history'
                  ? 'var(--accent-ai, #5B4FE9)'
                  : 'var(--border-color)',
            }}
          >
            <span className="flex items-center gap-3 min-w-0">
              <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
                <History className="h-4 w-4" />
              </NexusDuotoneIcon>
              <span className="min-w-0">
                <span className="block truncate">سجل الجلسات والمحادثات</span>
                <span
                  className="block truncate text-[11px] font-normal"
                  style={{ color: 'var(--text-muted)' }}
                >
                  استعراض · بحث · تصدير · الرسائل المثبتة
                </span>
              </span>
            </span>
            <ArrowUpLeft className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          </button>

          {chatThreads.length > 0 && (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 pt-1">
              {chatThreads.slice(0, 3).map((th) => {
                const isCurrent = th.id === activeThreadId && activePage === 'chat';
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      onSwitchThread?.(th.id);
                      openSubPage('chat');
                    }}
                    className="flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-right text-[11px] font-semibold transition-colors hover:border-[var(--accent-ai)]"
                    style={{
                      backgroundColor: isCurrent ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                      borderColor: isCurrent
                        ? 'var(--accent-ai, #5B4FE9)'
                        : 'var(--border-color)',
                      color: isCurrent ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)',
                    }}
                  >
                    <span className="truncate">{th.title}</span>
                    <ArrowUpLeft className="h-3 w-3 shrink-0 opacity-60" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Category 2: AI Models & Fallback Engine */}
        <section className="nexus-squircle p-4 sm:p-5 space-y-2.5">
          <div className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
            ٢. تبديل النماذج الذكية والاحتياط
          </div>
          <button
            type="button"
            data-testid="morrow-nav-models"
            onClick={() => openSubPage('models')}
            className={rowBtnClass}
            style={{
              backgroundColor:
                activePage === 'models' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
              borderColor:
                activePage === 'models'
                  ? 'var(--accent-ai, #5B4FE9)'
                  : 'var(--border-color)',
            }}
          >
            <span className="flex items-center gap-3 min-w-0">
              <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
                <Cpu className="h-4 w-4" />
              </NexusDuotoneIcon>
              <span className="min-w-0">
                <span className="block truncate">محرك النماذج والتبديل التلقائي</span>
                <span
                  className="block truncate text-[11px] font-normal"
                  style={{ color: 'var(--text-muted)' }}
                >
                  النشط: {activeBrainLabel} · سلسلة 6+1 ونمط التعاون
                </span>
              </span>
            </span>
            <ArrowUpLeft className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          </button>
        </section>

        {/* Category 3: Specialized AI Assistants / Agents */}
        <section className="nexus-squircle p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
              ٣. المساعدون المتخصصون
            </span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {SPECIALIZED_ASSISTANTS.length} وكلاء
            </span>
          </div>

          <button
            type="button"
            data-testid="morrow-nav-assistants"
            onClick={() => openSubPage('assistants')}
            className={rowBtnClass}
            style={{
              backgroundColor:
                activePage === 'assistants' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
              borderColor:
                activePage === 'assistants'
                  ? 'var(--accent-ai, #5B4FE9)'
                  : 'var(--border-color)',
            }}
          >
            <span className="flex items-center gap-3 min-w-0">
              <NexusDuotoneIcon tone="ai" sizeClass="h-9 w-9">
                <Users className="h-4 w-4" />
              </NexusDuotoneIcon>
              <span className="min-w-0">
                <span className="block truncate">دليل المساعدين والوكلاء</span>
                <span
                  className="block truncate text-[11px] font-normal"
                  style={{ color: 'var(--text-muted)' }}
                >
                  الحالي: {activeAssistant.name}
                </span>
              </span>
            </span>
            <ArrowUpLeft className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SPECIALIZED_ASSISTANTS.slice(0, 4).map((ag) => {
              const selected = ag.id === activeAssistantId;
              return (
                <motion.button
                  key={ag.id}
                  type="button"
                  whileHover={reducedMotion ? undefined : { y: -1.5, scale: 1.02 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  transition={TABRIX_TACTILE_SPRING}
                  onClick={() => {
                    onSelectAssistant?.(ag.id);
                    openSubPage('chat');
                  }}
                  className="nexus-pill-btn border px-3 py-2 text-center text-[11px] font-bold"
                  style={{
                    backgroundColor: selected ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor: selected
                      ? 'var(--accent-ai, #5B4FE9)'
                      : 'var(--border-color)',
                    color: selected ? 'var(--accent-ai, #5B4FE9)' : 'var(--text-primary)',
                  }}
                >
                  <div className="truncate">{ag.name}</div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Category 4: AI Tools & Smart Actions */}
        <section className="nexus-squircle p-4 sm:p-5 space-y-2.5">
          <div className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
            ٤. الأدوات الذكية والإجراءات
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              data-testid="morrow-open-canvas-btn"
              onClick={() => openSubPage('canvas', 'overview_charts')}
              className={rowBtnClass}
              style={{
                backgroundColor:
                  activePage === 'canvas' && activeCanvasMode === 'overview_charts'
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                borderColor:
                  activePage === 'canvas' && activeCanvasMode === 'overview_charts'
                    ? 'var(--accent-ai, #5B4FE9)'
                    : 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <LayoutPanelLeft className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">اللوحة التفاعلية والرسوم 2.0</span>
              </span>
              <BarChart3 className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </button>

            <button
              type="button"
              onClick={() => openSubPage('canvas', 'executive_report')}
              className={rowBtnClass}
              style={{
                backgroundColor:
                  activePage === 'canvas' && activeCanvasMode === 'executive_report'
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                borderColor:
                  activePage === 'canvas' && activeCanvasMode === 'executive_report'
                    ? 'var(--accent-ai, #5B4FE9)'
                    : 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">مولد التقارير التنفيذية</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => openSubPage('canvas', 'text_analysis')}
              className={rowBtnClass}
              style={{
                backgroundColor:
                  activePage === 'canvas' && activeCanvasMode === 'text_analysis'
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                borderColor:
                  activePage === 'canvas' && activeCanvasMode === 'text_analysis'
                    ? 'var(--accent-ai, #5B4FE9)'
                    : 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Wand2 className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">محلل النصوص ورسائل المندوبين</span>
              </span>
            </button>

            <button
              type="button"
              data-testid="morrow-tab-approvals"
              onClick={() => openSubPage('approvals')}
              className={rowBtnClass}
              style={{
                backgroundColor:
                  activePage === 'approvals' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                borderColor:
                  activePage === 'approvals'
                    ? 'var(--accent-ai, #5B4FE9)'
                    : 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <ClipboardCheck className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">المهام وطابور الموافقة</span>
              </span>
              {pendingDraftsCount > 0 && (
                <span
                  className="text-xs font-black tabular-nums"
                  style={{ color: 'var(--accent-ai, #5B4FE9)' }}
                >
                  {pendingDraftsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="morrow-tab-memory"
              onClick={() => openSubPage('memory')}
              className={rowBtnClass}
              style={{
                backgroundColor:
                  activePage === 'memory' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                borderColor:
                  activePage === 'memory'
                    ? 'var(--accent-ai, #5B4FE9)'
                    : 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <BookmarkCheck className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">الذاكرة والقواعد الدائمة</span>
              </span>
              {memoryRulesCount > 0 && (
                <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {memoryRulesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="morrow-tab-quick_notes"
              onClick={() => openSubPage('quick_notes')}
              className={rowBtnClass}
              style={{
                backgroundColor:
                  activePage === 'quick_notes' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                borderColor:
                  activePage === 'quick_notes'
                    ? 'var(--accent-ai, #5B4FE9)'
                    : 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <StickyNote className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">الملاحظات والتفريغ الصوتي</span>
              </span>
              {quickNotesCount > 0 && (
                <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {quickNotesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onTriggerFilePicker?.();
              }}
              className={rowBtnClass}
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Bot className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">تحليل ملف أو صوت</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => openSubPage('camera')}
              className={rowBtnClass}
              style={{
                backgroundColor:
                  activePage === 'camera' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                borderColor:
                  activePage === 'camera'
                    ? 'var(--accent-ai, #5B4FE9)'
                    : 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Camera className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="truncate">التقاط بالكاميرا</span>
              </span>
            </button>
          </div>

          <button
            type="button"
            data-testid="morrow-nav-diagnostics"
            onClick={() => openSubPage('diagnostics')}
            className={rowBtnClass}
            style={{
              backgroundColor:
                activePage === 'diagnostics' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
              borderColor:
                activePage === 'diagnostics'
                  ? 'var(--accent-ai, #5B4FE9)'
                  : 'var(--border-color)',
            }}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
              <span className="truncate">فحص التكامل والربط بالتطبيق</span>
            </span>
          </button>
        </section>

        {/* Category 5: Voice & Live Call Settings */}
        <section className="nexus-squircle p-4 sm:p-5 space-y-2.5">
          <div className="text-xs font-extrabold" style={{ color: 'var(--text-muted)' }}>
            ٥. إعدادات المحادثة المباشرة والصوت
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              data-testid="morrow-nav-voice-settings"
              onClick={() => openSubPage('voice_settings')}
              className={rowBtnClass}
              style={{
                backgroundColor:
                  activePage === 'voice_settings' ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                borderColor:
                  activePage === 'voice_settings'
                    ? 'var(--accent-ai, #5B4FE9)'
                    : 'var(--border-color)',
              }}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Volume2 className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-ai, #5B4FE9)' }} />
                <span className="min-w-0">
                  <span className="block truncate">تفضيلات الصوت والميكروفون</span>
                  <span
                    className="block truncate text-[10px] font-normal"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    توجيه التسجيل الصوتي وفحص الإذن
                  </span>
                </span>
              </span>
              <Mic className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>

            <motion.button
              type="button"
              whileHover={reducedMotion ? undefined : { y: -1.5, scale: 1.015 }}
              whileTap={reducedMotion ? undefined : { scale: 0.96 }}
              transition={TABRIX_TACTILE_SPRING}
              onClick={() => openSubPage('live')}
              className="nexus-pill-btn flex w-full items-center justify-between gap-2 border px-4 py-3 text-right text-xs font-extrabold"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                color: '#10B981',
              }}
            >
              <span className="flex items-center gap-2">
                <Radio className="h-4 w-4 shrink-0" />
                <span>بدء جلسة صوتية ومرئية لايف</span>
              </span>
              <span className="text-[10px] font-mono">Live</span>
            </motion.button>
          </div>
        </section>
      </div>
    </FullScreenPushPage>
  );
};

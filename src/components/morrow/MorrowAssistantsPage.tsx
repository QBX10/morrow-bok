import React from 'react';
import { Check, Send, Sparkles } from 'lucide-react';
import {
  SPECIALIZED_ASSISTANTS,
  type SpecializedAssistantProfile,
} from './morrowWorkspaceTypes';
import { MorrowSubPageHeader } from './MorrowSubPageHeader';

interface MorrowAssistantsPageProps {
  activeAssistantId: string;
  onActivateAssistant: (profile: SpecializedAssistantProfile, initialPrompt?: string) => void;
  onBackToChat: () => void;
}

export const MorrowAssistantsPage: React.FC<MorrowAssistantsPageProps> = ({
  activeAssistantId,
  onActivateAssistant,
  onBackToChat,
}) => {
  return (
    <main
      aria-label="المساعدون المتخصصون"
      data-testid="morrow-assistants-page"
      className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
    >
      <MorrowSubPageHeader
        title="المساعدون المتخصصون (AI Agents)"
        subtitle="اختر الوكيل المناسب لمهمتك ليتم ضبط النموذج وأسلوب التحليل تلقائياً"
        onBack={onBackToChat}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SPECIALIZED_ASSISTANTS.map((profile) => {
          const isActive = profile.id === activeAssistantId;
          return (
            <article
              key={profile.id}
              className="nexus-squircle flex flex-col justify-between gap-4 p-5 transition-colors"
              style={{
                backgroundColor: isActive
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-surface)',
                borderColor: isActive ? 'var(--accent-ai, #5B4FE9)' : 'var(--border-color)',
              }}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                        color: profile.accentHex,
                      }}
                    >
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm sm:text-base font-extrabold">
                        {profile.name}
                      </h2>
                      <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                        {profile.roleTitle}
                      </div>
                    </div>
                  </div>

                  <span
                    className="shrink-0 text-[11px] font-extrabold whitespace-nowrap"
                    style={{ color: profile.accentHex }}
                  >
                    {profile.badgeText}
                  </span>
                </div>

                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {profile.description}
                </p>

                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    أوامر جاهزة للبدء الفوري:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => onActivateAssistant(profile, prompt)}
                        className="nexus-pill-btn inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Send className="h-3 w-3 shrink-0" style={{ color: profile.accentHex }} />
                        <span>{prompt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => onActivateAssistant(profile)}
                  className="nexus-pill-btn inline-flex h-10 items-center gap-1.5 px-4 text-xs font-extrabold whitespace-nowrap"
                  style={
                    isActive
                      ? {
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--accent-ai, #5B4FE9)',
                          color: 'var(--accent-ai, #5B4FE9)',
                        }
                      : {
                          backgroundColor: 'var(--accent-ai, #5B4FE9)',
                          color: '#FFFFFF',
                        }
                  }
                >
                  {isActive && <Check className="h-3.5 w-3.5" />}
                  <span>{isActive ? 'مُفعّل حالياً — دخول للمحادثة' : 'تفعيل هذا المساعد'}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
};

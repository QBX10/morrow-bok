import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Building2,
  Camera,
  Command,
  Globe2,
  Home,
  ListChecks,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type { AppView, SettingsSectionId } from '../../types/agency';
import { BottomSheet } from './BottomSheet';

interface CosmosBottomNavProps {
  activeView: AppView;
  canAddPerson: boolean;
  canUseQuickExtract: boolean;
  onNavigateView: (view: AppView, settingsSection?: SettingsSectionId) => void;
  onOpenWorldSwitcher: () => void;
  onQuickAddPerson: () => void;
  onOpenAssistant: () => void;
  onOpenCommandPalette?: () => void;
  onQuickAddAgency?: () => void;
  onRunAudit?: () => void;
  assistantConnectivity?: 'online' | 'offline' | 'checking';
  isAssistantThinking?: boolean;
  pendingDraftsCount?: number;
}

export const CosmosBottomNav: React.FC<CosmosBottomNavProps> = ({
  activeView,
  canAddPerson,
  canUseQuickExtract,
  onNavigateView,
  onOpenWorldSwitcher,
  onQuickAddPerson,
  onOpenAssistant,
  onOpenCommandPalette,
  onQuickAddAgency,
  onRunAudit,
  assistantConnectivity = 'online',
  isAssistantThinking = false,
  pendingDraftsCount = 0,
}) => {
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);
  const [dockHidden, setDockHidden] = useState(false);

  const lastScrollYRef = useRef(0);
  const orbLongPressTimerRef = useRef<number | null>(null);
  const orbLongPressedRef = useRef(false);
  const orbTouchStartYRef = useRef<number | null>(null);
  const orbSwipedUpRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      const delta = y - lastScrollYRef.current;
      if (y < 48) {
        setDockHidden(false);
      } else if (delta > 14) {
        setDockHidden(true);
      } else if (delta < -10) {
        setDockHidden(false);
      }
      lastScrollYRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const clearOrbTimers = () => {
    if (orbLongPressTimerRef.current !== null) {
      window.clearTimeout(orbLongPressTimerRef.current);
      orbLongPressTimerRef.current = null;
    }
  };

  const handleOrbPointerDown = (e: React.PointerEvent) => {
    orbLongPressedRef.current = false;
    orbSwipedUpRef.current = false;
    orbTouchStartYRef.current = e.clientY;
    clearOrbTimers();
    orbLongPressTimerRef.current = window.setTimeout(() => {
      orbLongPressedRef.current = true;
      setQuickSheetOpen(true);
    }, 420);
  };

  const handleOrbPointerMove = (e: React.PointerEvent) => {
    if (orbTouchStartYRef.current === null) return;
    const dy = orbTouchStartYRef.current - e.clientY;
    if (dy > 36 && !orbSwipedUpRef.current) {
      orbSwipedUpRef.current = true;
      clearOrbTimers();
      if (onOpenCommandPalette) {
        onOpenCommandPalette();
      } else {
        setQuickSheetOpen(true);
      }
    }
  };

  const handleOrbPointerUp = () => {
    clearOrbTimers();
    const wasLong = orbLongPressedRef.current;
    const wasSwipe = orbSwipedUpRef.current;
    orbTouchStartYRef.current = null;
    if (!wasLong && !wasSwipe) {
      onNavigateView('morrow_center');
    }
  };

  const orbStatusClass = isAssistantThinking || pendingDraftsCount > 0
    ? 'morrow-orb-thinking'
    : assistantConnectivity === 'offline'
      ? 'morrow-orb-offline'
      : 'morrow-orb-online';

  const isHubActive = activeView === 'hub';
  const isSettingsActive = activeView === 'settings';
  const isMorrowActive = activeView === 'morrow_center';

  return (
    <>
      <nav
        aria-label="الشريط العائم السريع"
        className={`no-print fixed inset-x-0 z-[var(--z-bottom-nav)] md:hidden flex justify-center px-4 transition-all duration-200 ${
          dockHidden
            ? 'translate-y-24 opacity-0 pointer-events-none'
            : 'translate-y-0 opacity-100'
        }`}
        style={{
          bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div
          className="flex w-full max-w-[332px] items-center justify-between rounded-[28px] border px-4 py-1.5 shadow-xl backdrop-blur-xl"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
            borderColor: 'color-mix(in srgb, var(--border-color) 82%, transparent)',
          }}
        >
          {/* 1. Hub */}
          <button
            type="button"
            onClick={() => onNavigateView('hub')}
            className="cosmos-touch-target flex min-w-[74px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1 text-[11px] font-extrabold transition-colors"
            style={{
              backgroundColor: isHubActive ? 'var(--bg-nav-active)' : 'transparent',
              color: isHubActive ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <Home className="h-5 w-5" />
            <span>المركز</span>
          </button>

          {/* 2. Center Assistant Orb (Tap = Fullscreen AI, Long Press = Quick Radial Sheet, Swipe Up = ⌘K) */}
          <button
            type="button"
            onPointerDown={handleOrbPointerDown}
            onPointerMove={handleOrbPointerMove}
            onPointerUp={handleOrbPointerUp}
            onPointerCancel={clearOrbTimers}
            onContextMenu={(e) => {
              e.preventDefault();
              setQuickSheetOpen(true);
            }}
            aria-label="المساعد الذكي Morrow — نقر للفتح، ضغط مطوّل للإجراءات، سحب للأعلى للأوامر"
            title="نقر: المساعد · ضغط مطوّل: إجراءات سريعة · سحب للأعلى: بحث ⌘K"
            className={`relative -mt-4 flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 transition-transform active:scale-95 select-none ${orbStatusClass}`}
            style={{
              background: isMorrowActive
                ? 'var(--accent)'
                : 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 68%, #8b5cf6))',
              borderColor: 'var(--bg-surface)',
              color: '#ffffff',
            }}
          >
            <Sparkles className="h-5 w-5" />
            <span className="text-[9px] font-black leading-none mt-0.5">AI</span>
            {pendingDraftsCount > 0 && (
              <span
                className="absolute -top-1 -left-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums shadow"
                style={{ backgroundColor: '#f59e0b', color: '#0f172a' }}
              >
                {pendingDraftsCount}
              </span>
            )}
          </button>

          {/* 3. Settings */}
          <button
            type="button"
            onClick={() => onNavigateView('settings')}
            className="cosmos-touch-target flex min-w-[74px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1 text-[11px] font-extrabold transition-colors"
            style={{
              backgroundColor: isSettingsActive ? 'var(--bg-nav-active)' : 'transparent',
              color: isSettingsActive ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <Settings className="h-5 w-5" />
            <span>الإعدادات</span>
          </button>
        </div>
      </nav>

      {/* Quick Fan / Radial Actions Sheet (Long Press on Orb) */}
      <BottomSheet
        open={quickSheetOpen}
        onClose={() => setQuickSheetOpen(false)}
        title="قائمة الإجراءات السريعة — Morrow"
        subtitle="وصول مباشر بإبهام واحد (ضغط مطوّل على الكرة)"
        icon={<Sparkles className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {onQuickAddAgency && (
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                onQuickAddAgency();
              }}
              className="cosmos-touch-primary flex items-center gap-3 rounded-2xl border p-4 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <Building2 className="h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} />
              <div>
                <div className="text-sm font-extrabold">إضافة وكالة جديدة</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  إنشاء وكالة وتخصيص لونها فوراً
                </div>
              </div>
            </button>
          )}

          {canAddPerson && (
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                onQuickAddPerson();
              }}
              className="cosmos-touch-primary flex items-center gap-3 rounded-2xl border p-4 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <UserPlus className="h-5 w-5 shrink-0" style={{ color: '#10b981' }} />
              <div>
                <div className="text-sm font-extrabold">إضافة مستفيد جديد</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  إدراج مباشر في الوكالة المختارة
                </div>
              </div>
            </button>
          )}

          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                onOpenCommandPalette();
              }}
              className="cosmos-touch-primary flex items-center gap-3 rounded-2xl border p-4 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <Command className="h-5 w-5 shrink-0" style={{ color: '#f59e0b' }} />
              <div>
                <div className="text-sm font-extrabold">البحث الشامل والأوامر ⌘K</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  الانتقال الفوري لأي وكالة أو إعداد
                </div>
              </div>
            </button>
          )}

          {canUseQuickExtract && (
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                onNavigateView('quick_extract');
              }}
              className="cosmos-touch-primary flex items-center gap-3 rounded-2xl border p-4 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <Camera className="h-5 w-5 shrink-0" style={{ color: '#0ea5e9' }} />
              <div>
                <div className="text-sm font-extrabold">السحب الذكي OCR</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  تصوير دفتر أو قراءة ملف PDF
                </div>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onNavigateView('ready_lists');
            }}
            className="cosmos-touch-primary flex items-center gap-3 rounded-2xl border p-4 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <ListChecks className="h-5 w-5 shrink-0" style={{ color: '#14b8a6' }} />
            <div>
              <div className="text-sm font-extrabold">القوائم الجاهزة</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                فتح القوالب والمجموعات المحفوظة
              </div>
            </div>
          </button>

          {onRunAudit && (
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                onRunAudit();
              }}
              className="cosmos-touch-primary flex items-center gap-3 rounded-2xl border p-4 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: '#f97316' }} />
              <div>
                <div className="text-sm font-extrabold">فحص السجلات والمطابقة</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  فحص التكرارات والنواقص فوراً
                </div>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onNavigateView('morrow_center');
            }}
            className="cosmos-touch-primary flex items-center gap-3 rounded-2xl border p-4 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <Bot className="h-5 w-5 shrink-0" style={{ color: '#8b5cf6' }} />
            <div>
              <div className="text-sm font-extrabold">مركز المساعد الكامل Morrow AI</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                فتح صفحة المساعد بملء الشاشة
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onOpenAssistant();
            }}
            className="cosmos-touch-primary flex items-center gap-3 rounded-2xl border p-4 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <Palette className="h-5 w-5 shrink-0" style={{ color: '#6366f1' }} />
            <div>
              <div className="text-sm font-extrabold">النافذة الحوارية السريعة</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                محادثة منبثقة فوق الصفحة الحالية
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onOpenWorldSwitcher();
            }}
            className="cosmos-touch-primary flex items-center gap-3 rounded-2xl border p-4 text-right hover:border-[var(--accent)] sm:col-span-2"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <Globe2 className="h-5 w-5 shrink-0" style={{ color: '#0284c7' }} />
            <div>
              <div className="text-sm font-extrabold">بوابة العوالم والأكوان الـ14</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                القفز المباشر بين جميع عوالم النظام
              </div>
            </div>
          </button>
        </div>
      </BottomSheet>
    </>
  );
};

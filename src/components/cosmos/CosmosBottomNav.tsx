import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Building2,
  Camera,
  Command,
  Compass,
  Globe2,
  Home,
  LayoutGrid,
  ListChecks,
  Settings,
  ShieldCheck,
  Sparkles,
  Table2,
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

/**
 * Modern Spatial Floating Dock (replaces traditional horizontal bottom bar on mobile).
 * Sits lightly in the bottom-right corner (opposite the bottom-left Morrow pill),
 * glides away smoothly when scrolling down, and snaps back immediately on scroll up.
 */
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
  pendingDraftsCount = 0,
}) => {
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);
  const [dockHidden, setDockHidden] = useState(false);

  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = Math.max(0, window.scrollY || 0);
      const delta = y - lastScrollYRef.current;
      if (y <= 36) {
        setDockHidden(false);
      } else if (delta < -4) {
        setDockHidden(false);
      } else if (delta > 8 && y > 72) {
        setDockHidden(true);
      }
      lastScrollYRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isHubActive = activeView === 'hub';

  return (
    <>
      <div
        aria-label="بوابة الوصول السريع العائمة"
        className={`no-print fixed bottom-4 right-4 z-[var(--z-bottom-nav)] md:hidden flex items-center gap-1.5 rounded-full border p-1 shadow-xl backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          dockHidden
            ? 'translate-y-20 opacity-0 pointer-events-none'
            : 'translate-y-0 opacity-100'
        }`}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 90%, transparent)',
          borderColor: 'color-mix(in srgb, var(--accent) 26%, var(--border-color))',
        }}
      >
        <button
          type="button"
          onClick={() => onNavigateView('hub')}
          aria-label="الشاشة الرئيسية"
          title="المركز الرئيسي"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors"
          style={{
            backgroundColor: isHubActive ? 'var(--accent)' : 'var(--bg-main)',
            color: isHubActive ? 'var(--accent-fg)' : 'var(--text-primary)',
          }}
        >
          <Home className="h-4.5 w-4.5" />
        </button>

        <button
          type="button"
          onClick={() => setQuickSheetOpen(true)}
          aria-label="فتح بوابة التنقل السريع والأدوات"
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-extrabold transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-primary)',
          }}
        >
          <Compass className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span>التنقل</span>
          {pendingDraftsCount > 0 && (
            <span
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              {pendingDraftsCount}
            </span>
          )}
        </button>
      </div>

      <BottomSheet
        open={quickSheetOpen}
        onClose={() => setQuickSheetOpen(false)}
        title="بوابة التنقل السريع"
        subtitle="وصول حديث وفوري لجميع أقسام وأدوات التطبيق"
        icon={<LayoutGrid className="h-5 w-5" />}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onNavigateView('hub');
            }}
            className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <Home className="h-4.5 w-4.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <div className="min-w-0">
              <div className="text-xs font-extrabold">المركز الرئيسي</div>
              <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                الوكالات والملخص
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onNavigateView('master_roster');
            }}
            className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <Table2 className="h-4.5 w-4.5 shrink-0" style={{ color: '#0ea5e9' }} />
            <div className="min-w-0">
              <div className="text-xs font-extrabold">الجدول الشامل</div>
              <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                جميع المستفيدين
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onNavigateView('morrow_center');
            }}
            className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <Bot className="h-4.5 w-4.5 shrink-0" style={{ color: '#8b5cf6' }} />
            <div className="min-w-0">
              <div className="text-xs font-extrabold">مساعد Morrow</div>
              <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                صوت، لايف، وملفات
              </div>
            </div>
          </button>

          {canUseQuickExtract && (
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                onNavigateView('quick_extract');
              }}
              className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <Camera className="h-4.5 w-4.5 shrink-0" style={{ color: '#10b981' }} />
              <div className="min-w-0">
                <div className="text-xs font-extrabold">السحب الذكي</div>
                <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  كاميرا وPDF
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
              className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <UserPlus className="h-4.5 w-4.5 shrink-0" style={{ color: '#16a34a' }} />
              <div className="min-w-0">
                <div className="text-xs font-extrabold">إضافة مستفيد</div>
                <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  إدراج مباشر
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
            className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <ListChecks className="h-4.5 w-4.5 shrink-0" style={{ color: '#14b8a6' }} />
            <div className="min-w-0">
              <div className="text-xs font-extrabold">القوائم الجاهزة</div>
              <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                القوالب المحفوظة
              </div>
            </div>
          </button>

          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                onOpenCommandPalette();
              }}
              className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <Command className="h-4.5 w-4.5 shrink-0" style={{ color: '#f59e0b' }} />
              <div className="min-w-0">
                <div className="text-xs font-extrabold">البحث الشامل ⌘K</div>
                <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  وصول فوري
                </div>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onNavigateView('settings');
            }}
            className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <Settings className="h-4.5 w-4.5 shrink-0" style={{ color: 'var(--accent)' }} />
            <div className="min-w-0">
              <div className="text-xs font-extrabold">الإعدادات</div>
              <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                الثيمات والتحكم
              </div>
            </div>
          </button>

          {onQuickAddAgency && (
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                onQuickAddAgency();
              }}
              className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <Building2 className="h-4.5 w-4.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="min-w-0">
                <div className="text-xs font-extrabold">إضافة وكالة</div>
              </div>
            </button>
          )}

          {onRunAudit && (
            <button
              type="button"
              onClick={() => {
                setQuickSheetOpen(false);
                onRunAudit();
              }}
              className="cosmos-touch-primary flex items-center gap-2.5 rounded-2xl border p-3.5 text-right hover:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
            >
              <ShieldCheck className="h-4.5 w-4.5 shrink-0" style={{ color: '#f97316' }} />
              <div className="min-w-0">
                <div className="text-xs font-extrabold">فحص السجلات</div>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onOpenWorldSwitcher();
            }}
            className="cosmos-touch-primary col-span-2 flex items-center justify-center gap-2.5 rounded-2xl border p-3.5 hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <Globe2 className="h-4.5 w-4.5 shrink-0" style={{ color: '#0284c7' }} />
            <span className="text-xs font-extrabold">بوابة العوالم والأكوان الـ14</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickSheetOpen(false);
              onOpenAssistant();
            }}
            className="cosmos-touch-primary col-span-2 flex items-center justify-center gap-2 rounded-2xl border p-3 hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
          >
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-bold">فتح النافذة الحوارية السريعة للمساعد</span>
          </button>
        </div>
      </BottomSheet>
    </>
  );
};

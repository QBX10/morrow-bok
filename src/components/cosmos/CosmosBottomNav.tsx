import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Home,
  Plus,
  ScanLine,
  Search,
  Settings,
  Table2,
} from 'lucide-react';
import type { AppView, SettingsSectionId } from '../../types/agency';

interface CosmosBottomNavProps {
  activeView: AppView;
  canAddPerson: boolean;
  canUseQuickExtract: boolean;
  onNavigateView: (view: AppView, sec?: SettingsSectionId) => void;
  onQuickAddPerson: () => void;
  onOpenAssistant: () => void;
  onOpenCommandPalette: () => void;
  isAssistantThinking?: boolean;
  pendingDraftsCount?: number;
}

/**
 * Mobile One-Thumb Floating Navigation Dock — strictly operational + single Settings gateway.
 */
export const CosmosBottomNav: React.FC<CosmosBottomNavProps> = ({
  activeView,
  canAddPerson,
  canUseQuickExtract,
  onNavigateView,
  onQuickAddPerson,
  onOpenAssistant,
  onOpenCommandPalette,
  isAssistantThinking = false,
  pendingDraftsCount = 0,
}) => {
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const curY = window.scrollY || 0;
      const delta = curY - lastScrollYRef.current;
      if (curY < 60) {
        setHiddenByScroll(false);
      } else if (delta > 16) {
        setHiddenByScroll(true);
      } else if (delta < -10) {
        setHiddenByScroll(false);
      }
      lastScrollYRef.current = curY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const items: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    primary?: boolean;
    onClick: () => void;
    onLongPress?: () => void;
    badge?: number;
  }> = [
    {
      id: 'home',
      label: 'الوكالات',
      icon: <Home className="h-4 w-4" />,
      active: activeView === 'hub',
      onClick: () => onNavigateView('hub'),
    },
    {
      id: 'roster',
      label: 'الجدول',
      icon: <Table2 className="h-4 w-4" />,
      active: activeView === 'master_roster' || activeView === 'agency_roster',
      onClick: () => onNavigateView('master_roster'),
    },
    {
      id: 'center_action',
      label: canAddPerson ? 'إضافة' : 'بحث',
      icon: canAddPerson ? <Plus className="h-5 w-5" /> : <Search className="h-5 w-5" />,
      primary: true,
      onClick: () => (canAddPerson ? onQuickAddPerson() : onOpenCommandPalette()),
      onLongPress: onOpenCommandPalette,
    },
    {
      id: 'morrow',
      label: 'Morrow',
      icon: <Bot className="h-4 w-4" />,
      active: activeView === 'morrow_center',
      badge: pendingDraftsCount > 0 ? pendingDraftsCount : undefined,
      onClick: onOpenAssistant,
      onLongPress: () => onNavigateView('morrow_center'),
    },
    canUseQuickExtract
      ? {
          id: 'extract',
          label: 'السحب',
          icon: <ScanLine className="h-4 w-4" />,
          active: activeView === 'quick_extract',
          onClick: () => onNavigateView('quick_extract'),
          onLongPress: () => onNavigateView('settings'),
        }
      : {
          id: 'settings',
          label: 'الإعدادات',
          icon: <Settings className="h-4 w-4" />,
          active: activeView === 'settings',
          onClick: () => onNavigateView('settings'),
        },
  ];

  return (
    <nav
      aria-label="شريط الوصول السريع للجوال"
      className={`lg:hidden fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav,35)] flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pointer-events-none transition-transform duration-200 ${
        hiddenByScroll ? 'translate-y-24' : 'translate-y-0'
      }`}
    >
      <div
        className="cosmos-glass-panel pointer-events-auto flex w-full max-w-md items-center justify-around gap-1 border px-2 py-1.5 shadow-2xl"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {items.map((item) => {
          let holdTimer: number | null = null;
          const startHold = () => {
            if (!item.onLongPress) return;
            holdTimer = window.setTimeout(() => {
              item.onLongPress?.();
              holdTimer = null;
            }, 460);
          };
          const cancelHold = () => {
            if (holdTimer !== null) {
              clearTimeout(holdTimer);
              holdTimer = null;
            }
          };

          if (item.primary) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                onTouchCancel={cancelHold}
                className="-mt-4 flex h-12 min-w-[56px] flex-col items-center justify-center rounded-2xl px-3 shadow-lg transition-transform active:scale-95"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
                aria-label={item.label}
              >
                {item.icon}
                <span className="text-[10px] font-black leading-none mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              onTouchCancel={cancelHold}
              className="relative flex min-h-[44px] min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-bold transition-colors active:scale-95"
              style={{
                backgroundColor: item.active ? 'var(--bg-nav-active)' : 'transparent',
                color: item.active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              <span className="relative">
                {item.icon}
                {item.id === 'morrow' && isAssistantThinking && (
                  <span
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full"
                    style={{ backgroundColor: 'var(--warning)' }}
                  />
                )}
              </span>
              <span className="whitespace-nowrap leading-none">{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className="absolute top-0.5 left-1 rounded-full px-1 text-[9px] font-black tabular-nums"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
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
  pendingDraftsCount?: number;
}

/**
 * Glassy Floating Dock with Framer Motion layoutId gold pill indicator and Top Glow Cap.
 */
export const CosmosBottomNav: React.FC<CosmosBottomNavProps> = ({
  activeView,
  canAddPerson,
  canUseQuickExtract,
  onNavigateView,
  onQuickAddPerson,
  onOpenAssistant,
  onOpenCommandPalette,
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
      } else if (delta > 24) {
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
      icon: canAddPerson ? <Plus className="h-4 w-4" /> : <Search className="h-4 w-4" />,
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
      aria-label="شريط التنقل العائم"
      className={`fixed inset-x-0 bottom-0 z-[var(--z-bottom-nav,35)] flex justify-center px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pointer-events-none transition-transform duration-300 ${
        hiddenByScroll ? 'translate-y-28' : 'translate-y-0'
      }`}
    >
      <div className="smoked-glass-elevated pointer-events-auto relative flex w-auto max-w-[96vw] items-center justify-center gap-1 sm:gap-1.5 rounded-full px-2.5 py-1.5 border border-[#D4AF37]/25 shadow-[0_20px_48px_rgba(0,0,0,0.8)]">
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
                className="obsidian-gold-cta relative mx-1 flex h-11 min-w-[58px] flex-col items-center justify-center rounded-full px-4 shadow-lg active:scale-95 cursor-pointer"
                aria-label={item.label}
              >
                {item.icon}
                <span className="text-[10px] font-black leading-none mt-0.5 whitespace-nowrap">
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
              aria-current={item.active ? 'page' : undefined}
              className="relative flex min-h-[44px] min-w-[56px] sm:min-w-[66px] flex-col items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-colors active:scale-95 cursor-pointer"
              style={{
                color: item.active ? '#F3E5AB' : '#9898AA',
              }}
            >
              {item.active && (
                <motion.div
                  layoutId="floating-nav-active-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15"
                >
                  <span className="nav-top-glow-cap" />
                </motion.div>
              )}
              <span className="relative z-10">{item.icon}</span>
              <span className="relative z-10 whitespace-nowrap leading-none">
                {item.label}
              </span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="absolute top-0.5 left-1.5 z-20 rounded-full px-1 font-mono-num text-[9px] font-black bg-[#D4AF37] text-[#09090B]">
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

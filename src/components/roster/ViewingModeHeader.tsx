import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lock, Menu, Minimize2, Search, Unlock, X } from 'lucide-react';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface ViewingModeHeaderProps {
  title: string;
  recordCount: number;
  hasActiveFilters: boolean;
  isTableLocked: boolean;
  lockShakeNonce: number;
  canSearch: boolean;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  onToggleLock: () => void;
  onOpenDrawer: () => void;
  onExitViewingMode: () => void;
}

export const ViewingModeHeader: React.FC<ViewingModeHeaderProps> = ({
  title,
  recordCount,
  hasActiveFilters,
  isTableLocked,
  lockShakeNonce,
  canSearch,
  searchQuery,
  onChangeSearchQuery,
  onToggleLock,
  onOpenDrawer,
  onExitViewingMode,
}) => {
  const [searchOpen, setSearchOpen] = useState(Boolean(searchQuery));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reducedMotion = useTabrixReducedMotion();

  useEffect(() => {
    if (searchOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [searchOpen]);

  return (
    <header
      data-testid="viewing-mode-header"
      className="no-print sticky top-0 z-40 border-b px-3 py-2 backdrop-blur-md sm:px-5"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        {/* Right Side (RTL Start): Hamburger Menu + Title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <motion.button
            type="button"
            data-testid="viewing-mode-menu-btn"
            onClick={onOpenDrawer}
            whileHover={reducedMotion ? undefined : { scale: 1.05 }}
            whileTap={reducedMotion ? undefined : { scale: 0.94 }}
            transition={TABRIX_TACTILE_SPRING}
            aria-label="قائمة خيارات الجدول"
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Menu className="h-4 w-4" />
            {hasActiveFilters && (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                style={{ backgroundColor: 'var(--accent)' }}
              />
            )}
          </motion.button>

          <AnimatePresence mode="wait" initial={false}>
            {!searchOpen ? (
              <motion.div
                key="viewing-title"
                variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex min-w-0 items-center gap-2"
              >
                <span className="truncate text-xs font-extrabold sm:text-sm">
                  {title}
                </span>
                <span
                  className="hidden rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums sm:inline-flex"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {recordCount} سجل
                </span>
              </motion.div>
            ) : canSearch ? (
              <motion.div
                key="viewing-search"
                variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                className="relative flex min-w-0 flex-1 max-w-md items-center"
              >
                <Search
                  className="pointer-events-none absolute right-2.5 h-3.5 w-3.5"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  ref={inputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onChangeSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      onChangeSearchQuery('');
                      setSearchOpen(false);
                    }
                  }}
                  placeholder="بحث سريع بالاسم أو البطاقة..."
                  aria-label="بحث في وضع المشاهدة"
                  className="h-9 w-full rounded-xl border pr-8 pl-8 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--accent)',
                  }}
                />
                <button
                  type="button"
                  aria-label="إغلاق البحث"
                  onClick={() => {
                    onChangeSearchQuery('');
                    setSearchOpen(false);
                  }}
                  className="absolute left-2 rounded p-1 hover:opacity-75"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Left Side (RTL End): Search Toggle + One-Tap Lock/Unlock + Exit */}
        <div className="flex shrink-0 items-center gap-1.5">
          {canSearch && !searchOpen && (
            <motion.button
              type="button"
              data-testid="viewing-mode-search-btn"
              onClick={() => setSearchOpen(true)}
              whileHover={reducedMotion ? undefined : { scale: 1.05 }}
              whileTap={reducedMotion ? undefined : { scale: 0.94 }}
              transition={TABRIX_TACTILE_SPRING}
              aria-label="بحث داخل الجدول"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: searchQuery
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
                borderColor: searchQuery
                  ? 'var(--accent)'
                  : 'var(--border-color)',
                color: searchQuery ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              <Search className="h-4 w-4" />
            </motion.button>
          )}

          <motion.button
            key={`lock-${isTableLocked ? '1' : '0'}-${lockShakeNonce}`}
            type="button"
            data-testid="viewing-mode-lock-toggle"
            onClick={onToggleLock}
            aria-pressed={isTableLocked}
            whileHover={reducedMotion ? undefined : { scale: 1.03 }}
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            animate={
              !reducedMotion && lockShakeNonce > 0 && isTableLocked
                ? { x: [0, -4, 4, -2, 0] }
                : undefined
            }
            transition={
              lockShakeNonce > 0 && isTableLocked
                ? { duration: 0.28 }
                : TABRIX_TACTILE_SPRING
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold whitespace-nowrap transition-colors"
            style={{
              backgroundColor: isTableLocked
                ? 'var(--warning-bg)'
                : 'var(--bg-nav-active)',
              borderColor: isTableLocked ? 'var(--warning)' : 'var(--accent)',
              color: isTableLocked ? 'var(--warning)' : 'var(--accent)',
            }}
          >
            {isTableLocked ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>مقفل · فتح القفل</span>
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5" />
                <span>مفتوح · قفل</span>
              </>
            )}
          </motion.button>

          <motion.button
            type="button"
            data-testid="viewing-mode-exit-btn"
            onClick={onExitViewingMode}
            whileHover={reducedMotion ? undefined : { scale: 1.03 }}
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={TABRIX_TACTILE_SPRING}
            aria-label="خروج من وضع المشاهدة"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <Minimize2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span className="hidden sm:inline">خروج</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
};

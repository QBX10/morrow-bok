import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { THEME_LIST, type ThemeId } from '../../theme/tokens';
import { useAgencyStore } from '../../store/useAgencyStore';
import { useSound } from '../../audio/useSound';

export function ThemeSwitcher() {
  const activeTheme = useAgencyStore((s) => s.notificationPrefs.activeTheme);
  const lang = useAgencyStore((s) => s.lang);
  const setTheme = useAgencyStore((s) => s.setTheme);
  const { play } = useSound();
  const isAr = lang === 'ar';

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      role="radiogroup"
      aria-label={isAr ? 'مبدّل الثيمات' : 'Theme Switcher'}
    >
      {THEME_LIST.map((theme) => {
        const selected = activeTheme === theme.id;
        return (
          <motion.button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', ...theme.springConfig }}
            onClick={() => {
              play('button_tap');
              setTheme(theme.id as ThemeId);
            }}
            className="group relative flex flex-col justify-between p-4 text-start transition-transform focus-visible:outline-2"
            style={{
              backgroundColor: theme.bgApp,
              color: theme.textPrimary,
              borderRadius: theme.radiusCard,
              border: selected
                ? `2px solid ${theme.accent}`
                : `1px solid ${theme.surfaceBorder}`,
              boxShadow: selected
                ? `0 0 0 1px ${theme.accent}, 0 16px 32px -18px ${theme.accentGlow}`
                : theme.cardShadow,
              fontFamily: theme.fontBody,
            }}
          >
            {/* Live Miniature Preview Viewport */}
            <div
              className="mb-3 overflow-hidden p-3"
              style={{
                background: theme.bgSurface,
                border: `1px solid ${theme.surfaceBorder}`,
                borderRadius: theme.radiusControl,
                backdropFilter: `blur(${theme.surfaceBlur})`,
              }}
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3"
                    style={{
                      backgroundColor: theme.accent,
                      borderRadius: theme.id === 'terminal_brutalist' ? '0px' : '9999px',
                      boxShadow: `0 0 10px ${theme.accentGlow}`,
                    }}
                  />
                  <span
                    className="text-[11px] font-semibold"
                    style={{ fontFamily: theme.fontMono, color: theme.textPrimary }}
                  >
                    {theme.id === 'terminal_brutalist' ? 'SYS_OK' : 'CORE'}
                  </span>
                </div>
                <span
                  className="text-[11px] tabular-nums"
                  style={{ fontFamily: theme.fontMono, color: theme.accent }}
                >
                  98.4%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div
                  className="col-span-2 h-8 p-1.5"
                  style={{
                    background:
                      theme.id === 'aurora_bento'
                        ? theme.bentoGradients.violet
                        : theme.bgSurfaceElevated,
                    border: `1px solid ${theme.surfaceBorder}`,
                    borderRadius: theme.radiusControl,
                  }}
                >
                  <div
                    className="h-1.5 w-3/4 opacity-80"
                    style={{
                      backgroundColor: theme.textPrimary,
                      borderRadius: theme.id === 'terminal_brutalist' ? '0px' : '4px',
                    }}
                  />
                  <div
                    className="mt-1.5 h-1.5 w-1/2 opacity-45"
                    style={{
                      backgroundColor: theme.textMuted,
                      borderRadius: theme.id === 'terminal_brutalist' ? '0px' : '4px',
                    }}
                  />
                </div>
                <div
                  className="flex h-8 items-center justify-center text-[10px] font-bold"
                  style={{
                    backgroundColor: theme.accent,
                    color: theme.accentFg,
                    borderRadius: theme.radiusControl,
                  }}
                >
                  GO
                </div>
              </div>
            </div>

            {/* Title & Description */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div
                  className="text-base font-bold"
                  style={{ fontFamily: theme.fontDisplay }}
                >
                  {isAr ? theme.nameAr : theme.nameEn}
                </div>
                <p
                  className="mt-1 line-clamp-2 text-xs leading-relaxed"
                  style={{ color: theme.textMuted }}
                >
                  {isAr ? theme.subtitleAr : theme.subtitleEn}
                </p>
              </div>
              {selected && (
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center"
                  style={{
                    backgroundColor: theme.accent,
                    color: theme.accentFg,
                    borderRadius: theme.id === 'terminal_brutalist' ? '0px' : '9999px',
                  }}
                >
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

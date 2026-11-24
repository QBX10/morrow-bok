import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronLeft, Compass, EyeOff, Lock, Orbit } from 'lucide-react';
import type { CosmosNode } from '../../utils/cosmosRegistry';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import {
  TabrixPillIndicator,
  TabrixSubViewTransition,
} from '../ui/TabrixMotionPrimitives';
import { SectionLogo } from '../settings/sectionLogos';

interface OrbitalMapViewProps {
  root: CosmosNode;
  activeWorldId?: string | null;
  hiddenWorldIds?: string[];
  enableOrbitalMode?: boolean;
  onSelectNode: (node: CosmosNode) => void;
}

export const OrbitalMapView: React.FC<OrbitalMapViewProps> = ({
  root,
  activeWorldId,
  hiddenWorldIds = [],
  enableOrbitalMode = true,
  onSelectNode,
}) => {
  const [mode, setMode] = useState<'orbital' | 'sitemap'>(
    enableOrbitalMode ? 'orbital' : 'sitemap'
  );
  const [expandedWorlds, setExpandedWorlds] = useState<Record<string, boolean>>({});
  const reducedMotion = useTabrixReducedMotion();

  const visibleWorlds = root.children.filter(
    (w) => !hiddenWorldIds.includes(w.worldId) || w.worldId === 'world_legacy_archive'
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Orbit className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span className="text-xs sm:text-sm font-extrabold">
            خريطة الأقسام التفاعلية ({visibleWorlds.length} قسم)
          </span>
        </div>

        <div
          className="inline-flex rounded-xl border p-1"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {enableOrbitalMode && (
            <button
              type="button"
              onClick={() => setMode('orbital')}
              className="relative rounded-lg px-3 py-1.5 text-xs font-bold"
              style={{
                color: mode === 'orbital' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {mode === 'orbital' && (
                <TabrixPillIndicator
                  layoutId="orbital-mode-pill"
                  className="rounded-lg"
                />
              )}
              <span className="relative z-10">الخريطة المدارية</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('sitemap')}
            className="relative rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{
              color: mode === 'sitemap' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {mode === 'sitemap' && (
              <TabrixPillIndicator
                layoutId="orbital-mode-pill"
                className="rounded-lg"
              />
            )}
            <span className="relative z-10">الشجرة القابلة للطي</span>
          </button>
        </div>
      </div>

      <TabrixSubViewTransition
        viewKey={mode === 'orbital' && enableOrbitalMode ? 'orbital' : 'sitemap'}
        direction={mode === 'orbital' ? -1 : 1}
      >
      {mode === 'orbital' && enableOrbitalMode ? (
        <div
          className="relative overflow-hidden rounded-[26px] border p-5 sm:p-8"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            backgroundImage:
              'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 11%, transparent) 0%, transparent 68%)',
          }}
        >
          {/* Central Hub Core */}
          <div className="mx-auto mb-6 flex max-w-xs flex-col items-center text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl border shadow-md"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <Compass className="h-7 w-7" />
            </div>
            <h4 className="mt-2 text-sm font-extrabold">المركز الرئيسي — Morrow</h4>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              انقر أي قسم للدخول المباشر فوراً
            </p>
          </div>

          {/* Orbital Ring Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleWorlds.map((world) => {
              const isActive = activeWorldId === world.worldId;
              return (
                <motion.button
                  key={world.id}
                  type="button"
                  whileHover={reducedMotion ? undefined : { y: -4, scale: 1.02 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  transition={TABRIX_TACTILE_SPRING}
                  onClick={() => onSelectNode(world)}
                  className="flex flex-col items-center rounded-2xl border p-3.5 text-center transition-colors hover:border-[var(--accent)] nexus-squircle"
                  style={{
                    backgroundColor: isActive ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                    borderColor: isActive ? world.accentColor : 'var(--border-color)',
                    backgroundImage: world.gradient,
                  }}
                >
                  <SectionLogo icon={world.icon} tone={world.accentTone} size="sm" />
                  <span className="mt-2 text-xs font-extrabold leading-snug line-clamp-1">
                    {world.title}
                  </span>
                  <span
                    className="mt-0.5 text-[10px] tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {world.children.length} أقسام فرعية
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Collapsible Sitemap Tree */
        <div className="space-y-2">
          {root.children.map((world) => {
            const isHidden = hiddenWorldIds.includes(world.worldId);
            const isOpen = Boolean(expandedWorlds[world.id]);
            return (
              <div
                key={world.id}
                className="rounded-2xl border overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelectNode(world)}
                    className="flex items-center gap-3 text-right min-w-0 flex-1"
                  >
                    <SectionLogo icon={world.icon} tone={world.accentTone} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-extrabold truncate">
                          {world.title}
                        </span>
                        {world.protected && (
                          <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--warning)' }} />
                        )}
                        {isHidden && (
                          <EyeOff className="h-3 w-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {world.subtitle}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedWorlds((prev) => ({
                        ...prev,
                        [world.id]: !isOpen,
                      }))
                    }
                    className="cosmos-touch-target inline-flex items-center justify-center rounded-xl border px-2.5 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                    aria-label="توسيع الأقسام الفرعية"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key={`sitemap-world-${world.id}`}
                      variants={
                        reducedMotion
                          ? TABRIX_REDUCED_VARIANTS
                          : TABRIX_POPOVER_VARIANTS
                      }
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="border-t px-4 py-3 space-y-2"
                      style={{
                        borderColor: 'var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                      }}
                    >
                      {world.children.map((gal) => (
                        <div key={gal.id} className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectNode(gal)}
                            className="text-xs font-extrabold hover:underline"
                            style={{ color: world.accentColor }}
                          >
                            🪐 {gal.title}
                          </button>
                          <div className="flex flex-wrap gap-1.5 ps-3">
                            {gal.children.map((cap) => (
                              <button
                                key={cap.id}
                                type="button"
                                onClick={() => onSelectNode(cap)}
                                className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold hover:border-[var(--accent)]"
                                style={{
                                  backgroundColor: 'var(--bg-surface)',
                                  borderColor: 'var(--border-color)',
                                }}
                              >
                                {cap.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
      </TabrixSubViewTransition>
    </div>
  );
};

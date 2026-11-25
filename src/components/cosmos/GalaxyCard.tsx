import React from 'react';
import { ChevronLeft, Lock, Sparkles, Star } from 'lucide-react';
import { SectionLogo } from '../settings/sectionLogos';
import type { CosmosNode } from '../../utils/cosmosRegistry';
import type { HierarchyBadgeContext } from '../../utils/hierarchyRegistry';
import { useSurfaceSheen2D } from '../../utils/tabrixMotion';

interface GalaxyCardProps {
  node: CosmosNode;
  badgeContext?: HierarchyBadgeContext;
  isPinned?: boolean;
  onOpen: (node: CosmosNode) => void;
  onTogglePin?: (nodeId: string) => void;
}

export const GalaxyCard: React.FC<GalaxyCardProps> = ({
  node,
  badgeContext,
  isPinned = false,
  onOpen,
  onTogglePin,
}) => {
  const badge =
    badgeContext && node.getBadge ? node.getBadge(badgeContext) : null;
  const { surfaceRef, surfaceHandlers } = useSurfaceSheen2D<HTMLElement>();

  return (
    <article
      ref={surfaceRef}
      {...surfaceHandlers}
      className="nexus-squircle nexus-squircle-interactive group relative flex flex-col justify-between overflow-hidden p-4 sm:p-5"
      style={{
        backgroundImage: node.gradient,
        borderColor: 'var(--border-color)',
      }}
    >
      <div
        aria-hidden="true"
        className="smart-dashboard-card-sheen pointer-events-none absolute inset-0"
      />
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpen(node)}
          className="flex flex-1 items-start gap-3 text-right min-w-0 cursor-pointer"
        >
          <span className="transition-transform duration-300 group-hover:scale-[1.08] group-hover:-rotate-2">
            <SectionLogo icon={node.icon} tone={node.accentTone} size="md" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm sm:text-base font-extrabold leading-snug transition-colors group-hover:text-[var(--accent)]">
                {node.title}
              </h3>
              {node.isNew && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-emerald-500">
                  <Sparkles className="h-3 w-3" />
                  <span>الجديد</span>
                </span>
              )}
              {(node.protected || node.frozen) && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold"
                  style={{ color: 'var(--warning)' }}
                >
                  <Lock className="h-3 w-3" />
                  <span>{node.frozen ? 'نطاق محمي' : 'محمي'}</span>
                </span>
              )}
            </div>
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: 'var(--text-muted)' }}
            >
              {node.subtitle}
            </p>
          </div>
        </button>

        {node.pinnable && onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(node.id);
            }}
            aria-label={isPinned ? 'إزالة من المفضلة' : 'تثبيت في المفضلة'}
            className="nexus-pill-btn cosmos-touch-target inline-flex items-center justify-center rounded-xl border shrink-0 hover:border-[var(--accent)] cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: isPinned ? '#eab308' : 'var(--text-muted)',
            }}
          >
            <Star className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpen(node)}
        className="relative z-[1] mt-4 flex items-center justify-between border-t pt-2.5 text-xs font-bold cursor-pointer"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <span style={{ color: 'var(--text-muted)' }} className="tabular-nums">
          {badge
            ? badge.text
            : node.children.length > 0
            ? `${node.children.length} أدوات`
            : 'فتح مباشر'}
        </span>
        <span
          className="inline-flex items-center gap-1 group-hover:-translate-x-1 transition-transform"
          style={{ color: node.accentColor || 'var(--accent)' }}
        >
          <span>دخول</span>
          <ChevronLeft className="h-4 w-4" />
        </span>
      </button>
    </article>
  );
};

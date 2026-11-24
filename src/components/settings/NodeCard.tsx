import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import type {
  HierarchyBadge,
  HierarchyNode,
} from '../../utils/hierarchyRegistry';
import { useTabrix3DTilt } from '../../utils/tabrixMotion';
import { SectionLogo } from './sectionLogos';

interface NodeCardProps {
  node: HierarchyNode;
  badge?: HierarchyBadge | null;
  preview?: React.ReactNode;
  actionLabel?: string;
  active?: boolean;
  onOpen: (node: HierarchyNode) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  badge,
  preview,
  actionLabel = 'فتح الأداة',
  active = false,
  onOpen,
}) => {
  const desc = node.description || node.subtitle;
  const { tiltRef, tiltHandlers } = useTabrix3DTilt<HTMLButtonElement>({
    maxTiltX: 4.8,
    maxTiltY: 5.8,
  });

  return (
    <button
      ref={tiltRef}
      {...tiltHandlers}
      type="button"
      data-capsule-node-id={node.id}
      onClick={() => onOpen(node)}
      className="smart-living-card group relative flex min-h-[196px] w-full flex-col justify-between overflow-hidden border p-5 sm:p-6 text-right active:scale-[0.99] cursor-pointer"
      style={{
        borderColor: active
          ? 'var(--accent)'
          : 'color-mix(in srgb, var(--border-color) 85%, transparent)',
      }}
    >
      <div
        aria-hidden="true"
        className="smart-dashboard-card-sheen pointer-events-none absolute inset-0"
      />
      <div className="relative z-[1] w-full space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="transition-transform duration-300 group-hover:scale-[1.08] group-hover:-rotate-2">
              <SectionLogo
                icon={node.logo || node.icon}
                tone={node.accentTone}
                size="md"
              />
            </span>
            {(node.protected || badge) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold tabular-nums">
                {badge && (
                  <span
                    style={{
                      color:
                        badge.tone === 'warning'
                          ? 'var(--warning)'
                          : badge.tone === 'success'
                          ? 'var(--success)'
                          : badge.tone === 'accent'
                          ? 'var(--accent)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {badge.text}
                  </span>
                )}
                {node.protected && badge && (
                  <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                    ·
                  </span>
                )}
                {node.protected && (
                  <span
                    title="فرع محمي بمعاينة آمنة"
                    className="inline-flex items-center gap-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ShieldCheck
                      className="h-3.5 w-3.5"
                      style={{ color: 'var(--accent)' }}
                    />
                    <span>محمي</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-base font-extrabold leading-snug transition-colors group-hover:text-[var(--accent)]">
            {node.title}
          </h3>
          <p
            className="mt-1.5 text-xs leading-relaxed line-clamp-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {desc}
          </p>
        </div>

        {preview && (
          <div
            className="rounded-xl border px-3 py-2 text-[11px]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-main) 82%, transparent)',
              borderColor: 'color-mix(in srgb, var(--border-color) 75%, transparent)',
            }}
          >
            {preview}
          </div>
        )}
      </div>

      <div
        className="relative z-[1] mt-4 flex min-h-[36px] w-full items-center justify-between border-t pt-3 text-xs font-bold"
        style={{
          borderColor: 'color-mix(in srgb, var(--border-color) 75%, transparent)',
          color: 'var(--accent)',
        }}
      >
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span>{actionLabel}</span>
          {node.children.length > 0 && (
            <span
              className="text-[10px] font-semibold tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              · {node.children.length} أدوات
            </span>
          )}
        </span>
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
      </div>
    </button>
  );
};

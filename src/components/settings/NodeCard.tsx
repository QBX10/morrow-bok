import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import type {
  HierarchyBadge,
  HierarchyNode,
} from '../../utils/hierarchyRegistry';
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
  actionLabel = 'فتح الكبسولة',
  active = false,
  onOpen,
}) => {
  const desc = node.description || node.subtitle;

  return (
    <button
      type="button"
      data-capsule-node-id={node.id}
      onClick={() => onOpen(node)}
      className="capsule-glass-card group flex min-h-[200px] w-full flex-col justify-between border p-5 sm:p-6 text-right transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] hover:border-[var(--accent)]"
      style={{
        borderColor: active
          ? 'var(--accent)'
          : 'color-mix(in srgb, var(--border-color) 85%, transparent)',
        boxShadow: active
          ? '0 14px 32px -12px color-mix(in srgb, var(--accent) 26%, transparent)'
          : 'var(--card-shadow)',
      }}
    >
      <div className="w-full space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SectionLogo
              icon={node.logo || node.icon}
              tone={node.accentTone}
              size="md"
            />
            {node.protected && (
              <span
                title="فرع محمي بمعاينة آمنة"
                className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <ShieldCheck
                  className="h-3 w-3"
                  style={{ color: 'var(--accent)' }}
                />
                <span>محمي</span>
              </span>
            )}
          </div>

          {badge && (
            <span
              className="inline-flex shrink-0 items-center rounded-lg border px-2.5 py-1 text-[11px] font-extrabold tabular-nums whitespace-nowrap"
              style={{
                backgroundColor:
                  badge.tone === 'warning'
                    ? 'var(--warning-bg)'
                    : badge.tone === 'success'
                    ? 'var(--success-bg)'
                    : badge.tone === 'accent'
                    ? 'var(--bg-nav-active)'
                    : 'var(--bg-main)',
                borderColor:
                  badge.tone === 'warning'
                    ? 'var(--warning)'
                    : badge.tone === 'success'
                    ? 'var(--success)'
                    : badge.tone === 'accent'
                    ? 'color-mix(in srgb, var(--accent) 32%, var(--border-color))'
                    : 'var(--border-color)',
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
        </div>

        <div>
          <h3 className="text-base font-extrabold leading-snug">{node.title}</h3>
          <p
            className="mt-1.5 text-xs leading-relaxed line-clamp-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {desc}
          </p>
        </div>

        {preview && (
          <div
            className="rounded-2xl border p-2.5 text-[11px]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-main) 88%, transparent)',
              borderColor: 'var(--border-color)',
            }}
          >
            {preview}
          </div>
        )}
      </div>

      <div
        className="mt-4 flex min-h-[36px] w-full items-center justify-between border-t pt-3 text-xs font-bold"
        style={{
          borderColor: 'var(--border-color)',
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
              ({node.children.length} كبسولات)
            </span>
          )}
        </span>
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
      </div>
    </button>
  );
};

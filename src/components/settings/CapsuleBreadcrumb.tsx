import React from 'react';
import { ArrowRight, ChevronLeft, Layers } from 'lucide-react';
import type { HierarchyNode } from '../../utils/hierarchyRegistry';
import { SectionLogo } from './sectionLogos';

interface CapsuleBreadcrumbProps {
  path: HierarchyNode[];
  onNavigateNode: (node: HierarchyNode) => void;
  onBackStep?: () => void;
}

export const CapsuleBreadcrumb: React.FC<CapsuleBreadcrumbProps> = ({
  path,
  onNavigateNode,
  onBackStep,
}) => {
  if (path.length === 0) return null;
  const activeNode = path[path.length - 1];
  const parentNode = path.length > 1 ? path[path.length - 2] : null;

  return (
    <nav
      aria-label="شريط مسار التنقل في الإعدادات"
      className="capsule-glass-card flex flex-wrap items-center justify-between gap-2.5 border px-3.5 py-2.5 text-xs"
      style={{
        borderColor: 'var(--border-color)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {parentNode && (
          <button
            type="button"
            onClick={() =>
              onBackStep ? onBackStep() : onNavigateNode(parentNode)
            }
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--accent)',
            }}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>رجوع: {parentNode.title}</span>
          </button>
        )}

        <ol className="flex flex-wrap items-center gap-1 min-w-0">
          {path.map((node, idx) => {
            const isLast = idx === path.length - 1;
            return (
              <li key={node.id} className="flex items-center gap-1 min-w-0">
                {idx > 0 && (
                  <ChevronLeft
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                    aria-hidden="true"
                  />
                )}
                {isLast ? (
                  <span
                    aria-current="location"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-2.5 py-1 font-extrabold max-w-[230px] sm:max-w-[320px]"
                    style={{
                      backgroundColor: 'var(--bg-nav-active)',
                      color: 'var(--accent)',
                    }}
                  >
                    <SectionLogo
                      icon={node.logo || node.icon}
                      tone={node.accentTone}
                      size="xs"
                    />
                    <span className="truncate">{node.title}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigateNode(node)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-2 py-1 font-semibold max-w-[180px] transition-colors hover:bg-[var(--bg-main)]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <SectionLogo
                      icon={node.logo || node.icon}
                      tone={node.accentTone}
                      size="xs"
                    />
                    <span className="truncate">{node.title}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold tabular-nums whitespace-nowrap"
        style={{
          backgroundColor: 'var(--bg-main)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-muted)',
        }}
      >
        <Layers className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
        <span>عمق {activeNode.level}</span>
      </span>
    </nav>
  );
};

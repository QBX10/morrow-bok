import React, { useMemo } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import type {
  HierarchyBadgeContext,
  HierarchyNode,
  HierarchyTarget,
} from '../utils/hierarchyRegistry';
import {
  getHierarchyPath,
  resolveHierarchyNodeBadge,
} from '../utils/hierarchyRegistry';
import { SectionLogo } from './settings/sectionLogos';

interface HierarchyBreadcrumbBarProps {
  tree: HierarchyNode;
  activeNodeId: string;
  badgeContext: HierarchyBadgeContext;
  onNavigateTarget: (target: HierarchyTarget, nodeId: string) => void;
}

export const HierarchyBreadcrumbBar: React.FC<HierarchyBreadcrumbBarProps> = ({
  tree,
  activeNodeId,
  badgeContext,
  onNavigateTarget,
}) => {
  const path = useMemo(() => {
    const resolved = getHierarchyPath(tree, activeNodeId);
    return resolved.length > 0 ? resolved : [tree];
  }, [tree, activeNodeId]);

  const activeNode = path[path.length - 1] || tree;
  const parentNode = path.length > 1 ? path[path.length - 2] : null;

  const quickDrillNodes = useMemo(() => {
    if (activeNode.children.length > 0) {
      return activeNode.children;
    }
    if (parentNode && parentNode.children.length > 1) {
      return parentNode.children;
    }
    return [];
  }, [activeNode, parentNode]);

  // Hide cleanly at the top-level Hub so there is zero stacked-header clutter
  if (path.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="المسار الهرمي والتنقل السريع"
      data-testid="hierarchy-breadcrumb-bar"
      className="no-print mx-auto w-full max-w-7xl px-3 pt-1.5 sm:px-6"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-xs"
        style={{
          borderColor: 'color-mix(in srgb, var(--border-color) 75%, transparent)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {parentNode && (
            <button
              type="button"
              onClick={() => onNavigateTarget(parentNode.target, parentNode.id)}
              title={`رجوع إلى ${parentNode.title}`}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold whitespace-nowrap transition-colors hover:bg-[var(--bg-surface)]"
              style={{ color: 'var(--accent)' }}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>رجوع</span>
            </button>
          )}

          <ol className="flex flex-wrap items-center gap-0.5 min-w-0">
            {path.map((node, idx) => {
              const isLast = idx === path.length - 1;
              return (
                <li key={node.id} className="flex items-center gap-0.5 min-w-0">
                  {idx > 0 && (
                    <ChevronLeft
                      className="h-3.5 w-3.5 shrink-0 opacity-60"
                      style={{ color: 'var(--text-muted)' }}
                      aria-hidden="true"
                    />
                  )}
                  {isLast ? (
                    <span
                      aria-current="location"
                      className="inline-flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-[280px] rounded-lg px-2 py-0.5 font-extrabold"
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
                      onClick={() => onNavigateTarget(node.target, node.id)}
                      className="inline-flex items-center gap-1.5 truncate max-w-[160px] rounded-lg px-1.5 py-0.5 font-semibold transition-colors hover:bg-[var(--bg-surface)]"
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

        {quickDrillNodes.length > 0 && (
          <div className="flex max-w-full items-center gap-1 overflow-x-auto text-[11px]">
            {quickDrillNodes.slice(0, 6).map((child) => {
              const isCurrent = child.id === activeNode.id;
              const badge = resolveHierarchyNodeBadge(child, badgeContext);
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onNavigateTarget(child.target, child.id)}
                  className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: isCurrent
                      ? 'var(--bg-nav-active)'
                      : 'var(--bg-surface)',
                    borderColor: isCurrent
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                    color: isCurrent ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  <span className="truncate max-w-[120px]">{child.title}</span>
                  {badge && (
                    <span className="text-[10px] font-bold tabular-nums opacity-75">
                      {badge.text}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
};

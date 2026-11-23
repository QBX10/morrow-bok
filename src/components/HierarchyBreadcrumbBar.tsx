import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  Compass,
  FolderTree,
  Layers,
  Search,
  X,
} from 'lucide-react';
import type {
  HierarchyBadgeContext,
  HierarchyNode,
  HierarchyTarget,
} from '../utils/hierarchyRegistry';
import {
  getHierarchyPath,
  searchHierarchyNodes,
} from '../utils/hierarchyRegistry';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [searchOpen]);

  const path = useMemo(() => {
    const resolved = getHierarchyPath(tree, activeNodeId);
    return resolved.length > 0 ? resolved : [tree];
  }, [tree, activeNodeId]);

  const activeNode = path[path.length - 1] || tree;
  const parentNode = path.length > 1 ? path[path.length - 2] : null;

  // Show direct children if any; otherwise show sibling nodes at the same level so user can pivot quickly
  const quickDrillNodes = useMemo(() => {
    if (activeNode.children.length > 0) {
      return { mode: 'children' as const, nodes: activeNode.children };
    }
    if (parentNode && parentNode.children.length > 1) {
      return { mode: 'siblings' as const, nodes: parentNode.children };
    }
    return { mode: 'children' as const, nodes: [] };
  }, [activeNode, parentNode]);

  const searchHits = useMemo(
    () => searchHierarchyNodes(tree, searchQuery),
    [tree, searchQuery]
  );

  return (
    <nav
      aria-label="المسار الهرمي والتنقل المتداخل"
      data-testid="hierarchy-breadcrumb-bar"
      className="no-print mx-auto w-full max-w-7xl px-3 pt-2 sm:px-6"
    >
      <div
        className="rounded-2xl border px-3 py-2.5 sm:px-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Row 1: Ancestor Breadcrumb Trail + Back Button + Recursive Quick Search */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
            {parentNode && (
              <button
                type="button"
                onClick={() =>
                  onNavigateTarget(parentNode.target, parentNode.id)
                }
                title={`رجوع إلى ${parentNode.title}`}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--accent)',
                }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>رجوع</span>
              </button>
            )}

            <span
              className="hidden sm:inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold"
              style={{
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-muted)',
              }}
            >
              <Layers className="h-3 w-3" style={{ color: 'var(--accent)' }} />
              <span className="tabular-nums">مستوى {activeNode.level}</span>
            </span>

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
                        className="truncate max-w-[200px] sm:max-w-[280px] rounded-md px-2 py-1 font-extrabold"
                        style={{
                          backgroundColor: 'var(--bg-nav-active)',
                          color: 'var(--accent)',
                        }}
                      >
                        {node.title}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigateTarget(node.target, node.id)}
                        className="truncate max-w-[160px] rounded-md px-2 py-1 font-semibold transition-colors hover:underline"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {node.title}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Instant Recursive Hierarchy Search */}
          <div
            ref={searchBoxRef}
            className="relative w-full sm:w-64 md:w-72 shrink-0"
          >
            <div
              className="flex min-h-[36px] items-center gap-1.5 rounded-xl border px-2.5"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: searchOpen
                  ? 'var(--accent)'
                  : 'var(--border-color)',
              }}
            >
              <Search
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="انتقال سريع لأي قسم أو أداة..."
                aria-label="البحث الفوري في الأقسام والأدوات الهرمية"
                className="w-full min-w-0 bg-transparent text-xs outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح بحث الهرم"
                  className="rounded p-0.5 hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {searchOpen && searchQuery.trim() && (
              <div
                role="listbox"
                aria-label="نتائج البحث في الهرم"
                className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-72 overflow-y-auto rounded-xl border p-1.5 shadow-xl space-y-1"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                {searchHits.length === 0 ? (
                  <div
                    className="px-3 py-3 text-center text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    لا توجد أداة أو قسم مطابق لـ «{searchQuery}»
                  </div>
                ) : (
                  searchHits.slice(0, 10).map((hit) => {
                    const badge = hit.node.getBadge?.(badgeContext);
                    return (
                      <button
                        key={hit.node.id}
                        type="button"
                        onClick={() => {
                          onNavigateTarget(hit.node.target, hit.node.id);
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-right text-xs transition-colors hover:bg-[var(--bg-main)]"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-bold">{hit.node.title}</div>
                          <div
                            className="truncate text-[10px]"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {hit.path.map((n) => n.title).join(' › ')}
                          </div>
                        </div>
                        {badge && (
                          <span
                            className="shrink-0 text-[10px] font-bold tabular-nums"
                            style={{ color: 'var(--accent)' }}
                          >
                            {badge.text}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Contextual Nested Level / Sibling Quick Chips */}
        {quickDrillNodes.nodes.length > 0 && (
          <div
            className="mt-2 flex items-center gap-1.5 overflow-x-auto border-t pt-2 text-[11px]"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span
              className="inline-flex shrink-0 items-center gap-1 font-bold whitespace-nowrap"
              style={{ color: 'var(--text-muted)' }}
            >
              {quickDrillNodes.mode === 'children' ? (
                <FolderTree className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              ) : (
                <Compass className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              )}
              <span>
                {quickDrillNodes.mode === 'children'
                  ? 'الأقسام الفرعية:'
                  : 'في نفس المستوى:'}
              </span>
            </span>
            {quickDrillNodes.nodes.map((child) => {
              const isCurrent = child.id === activeNode.id;
              const badge = child.getBadge?.(badgeContext);
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onNavigateTarget(child.target, child.id)}
                  className="inline-flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 font-bold whitespace-nowrap transition-colors hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: isCurrent
                      ? 'var(--accent)'
                      : 'var(--bg-main)',
                    borderColor: isCurrent
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                    color: isCurrent ? 'var(--accent-fg)' : 'var(--text-primary)',
                  }}
                >
                  <span>{child.title}</span>
                  {badge && (
                    <span
                      className="text-[10px] font-bold tabular-nums opacity-85"
                      style={{
                        color: isCurrent
                          ? 'var(--accent-fg)'
                          : badge.tone === 'warning'
                          ? 'var(--warning)'
                          : 'var(--text-muted)',
                      }}
                    >
                      ({badge.text})
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

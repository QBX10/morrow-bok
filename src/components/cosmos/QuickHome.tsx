import React from 'react';
import { Zap } from 'lucide-react';
import type { CosmosNode } from '../../utils/cosmosRegistry';
import type { HierarchyBadgeContext } from '../../utils/hierarchyRegistry';
import { GalaxyCard } from './GalaxyCard';

interface QuickHomeProps {
  world: CosmosNode;
  quickNodes: CosmosNode[];
  pinnedNodeIds: string[];
  badgeContext?: HierarchyBadgeContext;
  onOpenNode: (node: CosmosNode) => void;
  onTogglePin: (nodeId: string) => void;
  onShowAllGalaxies: () => void;
}

export const QuickHome: React.FC<QuickHomeProps> = ({
  world,
  quickNodes,
  pinnedNodeIds,
  badgeContext,
  onOpenNode,
  onTogglePin,
  onShowAllGalaxies,
}) => {
  // Enforce <= 6 big controls per screen
  const visibleNodes = quickNodes.slice(0, 6);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" style={{ color: world.accentColor }} />
          <h3 className="text-sm sm:text-base font-extrabold">
            البداية السريعة داخل {world.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onShowAllGalaxies}
          className="text-xs font-bold hover:underline"
          style={{ color: world.accentColor || 'var(--accent)' }}
        >
          عرض جميع المجرات ({world.children.length})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {visibleNodes.map((node) => (
          <GalaxyCard
            key={node.id}
            node={node}
            badgeContext={badgeContext}
            isPinned={pinnedNodeIds.includes(node.id)}
            onOpen={onOpenNode}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    </section>
  );
};

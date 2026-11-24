import React from 'react';
import { Eye, EyeOff, Globe2, Lock } from 'lucide-react';
import type { CosmosNode } from '../../utils/cosmosRegistry';
import { SectionLogo } from '../settings/sectionLogos';
import { BottomSheet } from './BottomSheet';
import { OrbitalMapView } from './OrbitalMapView';

interface SwitcherProps {
  open: boolean;
  onClose: () => void;
  root: CosmosNode;
  activeWorldId?: string | null;
  hiddenWorldIds: string[];
  enableOrbitalMode?: boolean;
  onSelectNode: (node: CosmosNode) => void;
  onToggleHiddenWorld: (worldId: string) => void;
}

export const Switcher: React.FC<SwitcherProps> = ({
  open,
  onClose,
  root,
  activeWorldId,
  hiddenWorldIds,
  enableOrbitalMode = true,
  onSelectNode,
  onToggleHiddenWorld,
}) => {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="مبدّل الأقسام السريع — Morrow"
      subtitle="تنقّل بين أقسام النظام بنقرة، أو أخفِ الأقسام قليلة الاستخدام دون حذفها"
      icon={<Globe2 className="h-5 w-5" />}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Quick World Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {root.children.map((world) => {
            const isActive = activeWorldId === world.worldId;
            const isHidden = hiddenWorldIds.includes(world.worldId);
            const canHide = world.worldId !== 'world_legacy_archive' && world.worldId !== 'world_agencies_tables';

            return (
              <div
                key={world.id}
                className="flex items-center justify-between gap-2 rounded-2xl border p-3 transition-all"
                style={{
                  backgroundColor: isActive ? 'var(--bg-nav-active)' : 'var(--bg-main)',
                  borderColor: isActive ? world.accentColor : 'var(--border-color)',
                  opacity: isHidden ? 0.65 : 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectNode(world);
                    onClose();
                  }}
                  className="flex flex-1 items-center gap-2.5 text-right min-w-0"
                >
                  <SectionLogo icon={world.icon} tone={world.accentTone} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-extrabold truncate">{world.title}</span>
                      {world.protected && (
                        <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--warning)' }} />
                      )}
                    </div>
                    <span
                      className="block text-[10px] truncate"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {isHidden ? 'مخفي من الواجهة الرئيسية' : `${world.children.length} أقسام فرعية`}
                    </span>
                  </div>
                </button>

                {canHide && (
                  <button
                    type="button"
                    onClick={() => onToggleHiddenWorld(world.worldId)}
                    title={isHidden ? 'إظهار هذا القسم في المركز' : 'إخفاء من المركز (يبقى حياً في البحث)'}
                    aria-label={isHidden ? 'إظهار القسم' : 'إخفاء القسم'}
                    className="cosmos-touch-target inline-flex items-center justify-center rounded-xl border px-2 text-xs hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-color)',
                      color: isHidden ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Orbital & Tree Map */}
        <OrbitalMapView
          root={root}
          activeWorldId={activeWorldId}
          hiddenWorldIds={hiddenWorldIds}
          enableOrbitalMode={enableOrbitalMode}
          onSelectNode={(n) => {
            onSelectNode(n);
            onClose();
          }}
        />
      </div>
    </BottomSheet>
  );
};

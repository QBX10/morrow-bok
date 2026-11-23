import React from 'react';
import { Filter, Layers, Lock } from 'lucide-react';
import type { CosmosNode } from '../../utils/cosmosRegistry';
import { SectionLogo } from '../settings/sectionLogos';

interface CapsuleViewProps {
  capsule: CosmosNode;
  onlyModified?: boolean;
  onToggleOnlyModified?: () => void;
  hasModificationFilter?: boolean;
  children: React.ReactNode;
}

export const CapsuleView: React.FC<CapsuleViewProps> = ({
  capsule,
  onlyModified = false,
  onToggleOnlyModified,
  hasModificationFilter = false,
  children,
}) => {
  return (
    <section className="cosmos-world-enter space-y-4">
      <div
        className="cosmos-glass-panel border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <SectionLogo icon={capsule.icon} tone={capsule.accentTone} size="md" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold">{capsule.title}</h3>
              {(capsule.protected || capsule.frozen) && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold"
                  style={{ color: 'var(--warning)' }}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{capsule.frozen ? 'جدول محمي' : 'إعداد حساس'}</span>
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {capsule.description || capsule.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasModificationFilter && onToggleOnlyModified && (
            <button
              type="button"
              onClick={onToggleOnlyModified}
              className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-bold"
              style={
                onlyModified
                  ? {
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                      borderColor: 'var(--accent)',
                    }
                  : {
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }
              }
            >
              <Filter className="h-3.5 w-3.5" />
              <span>المعدَّل فقط</span>
            </button>
          )}
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: 'var(--text-muted)' }}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>مستوى {capsule.depth}</span>
          </span>
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </section>
  );
};

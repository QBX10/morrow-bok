import React from 'react';
import {
  Archive,
  Bell,
  Bot,
  Calculator,
  CalendarDays,
  Camera,
  Cloud,
  Coins,
  Columns3,
  Eye,
  FileJson,
  FlaskConical,
  HeartHandshake,
  Home,
  Layers,
  ListChecks,
  Lock,
  Palette,
  Percent,
  Scale,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  Store,
  Table2,
  Trash2,
  Type,
  Wallet,
} from 'lucide-react';
import type {
  HierarchyAccentTone,
  HierarchyIconKey,
} from '../../utils/hierarchyRegistry';

export function getHierarchyLucideIcon(
  key?: HierarchyIconKey
): React.FC<{ className?: string }> {
  switch (key) {
    case 'home':
      return Home;
    case 'agencies':
      return Store;
    case 'table':
      return Table2;
    case 'columns':
      return Columns3;
    case 'camera':
      return Camera;
    case 'list':
      return ListChecks;
    case 'heart':
      return HeartHandshake;
    case 'wallet':
      return Wallet;
    case 'archive':
      return Archive;
    case 'bot':
      return Bot;
    case 'calendar':
      return CalendarDays;
    case 'palette':
      return Palette;
    case 'sparkles':
      return Sparkles;
    case 'layers':
      return Layers;
    case 'sliders':
      return Sliders;
    case 'type':
      return Type;
    case 'calculator':
      return Calculator;
    case 'scale':
      return Scale;
    case 'coins':
      return Coins;
    case 'percent':
      return Percent;
    case 'flask':
      return FlaskConical;
    case 'bell':
      return Bell;
    case 'shield':
      return Shield;
    case 'cloud':
      return Cloud;
    case 'file_json':
      return FileJson;
    case 'lock':
      return Lock;
    case 'trash':
      return Trash2;
    case 'eye':
      return Eye;
    case 'settings':
    default:
      return Settings;
  }
}

const TONE_GRADIENTS: Record<
  HierarchyAccentTone,
  { from: string; to: string; fg: string; ring: string }
> = {
  indigo: {
    from: 'color-mix(in srgb, #3b82f6 20%, var(--bg-surface))',
    to: 'color-mix(in srgb, #6366f1 10%, var(--bg-main))',
    fg: '#4f46e5',
    ring: 'color-mix(in srgb, #6366f1 34%, var(--border-color))',
  },
  cyan: {
    from: 'color-mix(in srgb, #06b6d4 20%, var(--bg-surface))',
    to: 'color-mix(in srgb, #0ea5e9 10%, var(--bg-main))',
    fg: '#0891b2',
    ring: 'color-mix(in srgb, #06b6d4 34%, var(--border-color))',
  },
  violet: {
    from: 'color-mix(in srgb, #8b5cf6 20%, var(--bg-surface))',
    to: 'color-mix(in srgb, #a855f7 10%, var(--bg-main))',
    fg: '#7c3aed',
    ring: 'color-mix(in srgb, #8b5cf6 34%, var(--border-color))',
  },
  emerald: {
    from: 'color-mix(in srgb, #10b981 20%, var(--bg-surface))',
    to: 'color-mix(in srgb, #14b8a6 10%, var(--bg-main))',
    fg: '#059669',
    ring: 'color-mix(in srgb, #10b981 34%, var(--border-color))',
  },
  amber: {
    from: 'color-mix(in srgb, #f59e0b 20%, var(--bg-surface))',
    to: 'color-mix(in srgb, #eab308 10%, var(--bg-main))',
    fg: '#d97706',
    ring: 'color-mix(in srgb, #f59e0b 34%, var(--border-color))',
  },
  rose: {
    from: 'color-mix(in srgb, #f43f5e 18%, var(--bg-surface))',
    to: 'color-mix(in srgb, #ec4899 10%, var(--bg-main))',
    fg: '#e11d48',
    ring: 'color-mix(in srgb, #f43f5e 34%, var(--border-color))',
  },
  slate: {
    from: 'color-mix(in srgb, var(--accent) 18%, var(--bg-surface))',
    to: 'color-mix(in srgb, var(--text-muted) 10%, var(--bg-main))',
    fg: 'var(--accent)',
    ring: 'color-mix(in srgb, var(--accent) 30%, var(--border-color))',
  },
};

export interface SectionLogoProps {
  icon?: HierarchyIconKey;
  tone?: HierarchyAccentTone;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const SectionLogo: React.FC<SectionLogoProps> = ({
  icon = 'settings',
  tone = 'indigo',
  size = 'md',
  className = '',
}) => {
  const Icon = getHierarchyLucideIcon(icon);
  const palette = TONE_GRADIENTS[tone] || TONE_GRADIENTS.indigo;

  const sizeClass =
    size === 'xs'
      ? 'h-6 w-6 rounded-lg'
      : size === 'sm'
      ? 'h-8 w-8 rounded-xl'
      : size === 'lg'
      ? 'h-13 w-13 rounded-2xl'
      : 'h-11 w-11 rounded-2xl';

  const iconSize =
    size === 'xs'
      ? 'h-3.5 w-3.5'
      : size === 'sm'
      ? 'h-4 w-4'
      : size === 'lg'
      ? 'h-6 w-6'
      : 'h-5 w-5';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center border shadow-sm ${sizeClass} ${className}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
        borderColor: palette.ring,
        color: palette.fg,
      }}
      aria-hidden="true"
    >
      <Icon className={iconSize} />
    </span>
  );
};

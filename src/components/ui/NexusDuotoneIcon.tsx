import React from 'react';

interface NexusDuotoneIconProps {
  children?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'gold' | 'ai' | 'emerald' | 'crimson';
  size?: 'sm' | 'md' | 'lg';
  sizeClass?: string;
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
};

const ICON_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-4 w-4',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

/**
 * Duotone icon badge pairing Slate Gray secondary surface depth with
 * warm Amber Gold (#F5B041) or Electric Indigo AI (#5B4FE9) foreground strokes.
 */
export const NexusDuotoneIcon: React.FC<NexusDuotoneIconProps> = ({
  children,
  icon: IconComponent,
  tone = 'gold',
  size = 'lg',
  sizeClass,
  className = '',
}) => {
  const accentColor =
    tone === 'ai'
      ? 'var(--accent-ai, #5B4FE9)'
      : tone === 'emerald'
      ? 'var(--success)'
      : tone === 'crimson'
      ? 'var(--danger)'
      : 'var(--accent)';

  const resolvedSizeClass = sizeClass || SIZE_CLASSES[size];
  const resolvedIconClass = ICON_SIZE_CLASSES[size];

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex ${resolvedSizeClass} shrink-0 items-center justify-center rounded-2xl border ${className}`}
      style={{
        background: `linear-gradient(145deg, color-mix(in srgb, ${accentColor} 16%, var(--bg-surface)), color-mix(in srgb, #8A8A9E 14%, var(--bg-main)))`,
        borderColor: `color-mix(in srgb, ${accentColor} 28%, rgba(138, 138, 158, 0.25))`,
        color: accentColor,
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 12px -4px rgba(0, 0, 0, 0.3)',
      }}
    >
      <span
        className="pointer-events-none absolute inset-1.5 rounded-xl opacity-35"
        style={{
          backgroundColor: 'rgba(138, 138, 158, 0.18)',
        }}
      />
      <span className="relative z-[1] flex items-center justify-center">
        {IconComponent ? <IconComponent className={resolvedIconClass} /> : children}
      </span>
    </span>
  );
};

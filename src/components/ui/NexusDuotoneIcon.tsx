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
        background: `linear-gradient(145deg, color-mix(in srgb, ${accentColor} 26%, var(--bg-table-header, var(--bg-surface))), color-mix(in srgb, var(--bg-main) 88%, ${accentColor} 12%))`,
        borderColor: `color-mix(in srgb, ${accentColor} 42%, var(--border-color))`,
        color: accentColor,
        transformStyle: 'preserve-3d',
        boxShadow: `inset 0 1.5px 0 rgba(255, 255, 255, 0.28), inset 0 -2.5px 0 rgba(2, 10, 22, 0.62), 0 3px 0 rgba(2, 8, 18, 0.45), 0 10px 22px -6px color-mix(in srgb, ${accentColor} 38%, rgba(2, 10, 22, 0.72))`,
      }}
    >
      <span
        className="pointer-events-none absolute inset-1.5 rounded-xl opacity-55"
        style={{
          background: `radial-gradient(circle at 28% 22%, color-mix(in srgb, ${accentColor} 34%, transparent), transparent 72%)`,
        }}
      />
      <span
        className="pointer-events-none absolute inset-x-2.5 top-[1px] h-[1px] rounded-full opacity-70"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)`,
        }}
      />
      <span className="relative z-[1] flex items-center justify-center drop-shadow-[0_2px_5px_rgba(2,10,22,0.65)]">
        {IconComponent ? <IconComponent className={resolvedIconClass} /> : children}
      </span>
    </span>
  );
};

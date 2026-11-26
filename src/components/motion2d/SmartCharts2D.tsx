import React, { useId, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  buildAreaUnderSplinePath,
  computeDonutSlices,
  computeNiceTicks,
  computeSmoothSplinePath,
  type Chart2DDonutSegmentInput,
  type Chart2DPoint,
} from '../../utils/chart2dMath';
import { TABRIX_EASE, useTabrixReducedMotion } from '../../utils/tabrixMotion';

export interface Smart2DBarDatum {
  id: string;
  label: string;
  icon?: string;
  primaryValue: number;
  secondaryValue?: number;
  primaryFormatted?: string;
  secondaryFormatted?: string;
  hint?: string;
}

interface Smart2DBarComparisonChartProps {
  title: string;
  subtitle?: string;
  data: Smart2DBarDatum[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  height?: number;
  onSelectDatum?: (id: string) => void;
  formatTick?: (val: number) => string;
  emptyText?: string;
}

function defaultCompactTick(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(val / 1_000)}k`;
  return String(Math.round(val));
}

export const Smart2DBarComparisonChart: React.FC<Smart2DBarComparisonChartProps> = ({
  title,
  subtitle,
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = 'var(--accent)',
  secondaryColor = 'var(--spatial-secondary, var(--success))',
  height = 248,
  onSelectDatum,
  formatTick = defaultCompactTick,
  emptyText = 'لا توجد بيانات كافية لعرض الرسم البياني.',
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const uid = useId().replace(/:/g, '_');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const visibleData = useMemo(() => data.slice(0, 10), [data]);
  const hasSecondary = Boolean(secondaryLabel) && visibleData.some((d) => d.secondaryValue !== undefined);

  const svgWidth = 640;
  const svgHeight = height;
  const pad = { top: 20, right: 20, bottom: 42, left: 54 };
  const plotW = svgWidth - pad.left - pad.right;
  const plotH = svgHeight - pad.top - pad.bottom;

  const maxVal = useMemo(() => {
    let m = 0;
    for (const d of visibleData) {
      m = Math.max(m, Math.max(0, d.primaryValue));
      if (hasSecondary && typeof d.secondaryValue === 'number') {
        m = Math.max(m, Math.max(0, d.secondaryValue));
      }
    }
    return m > 0 ? m : 10;
  }, [visibleData, hasSecondary]);

  const ticks = useMemo(() => computeNiceTicks(maxVal, 4), [maxVal]);
  const ceiling = Math.max(1, ticks[ticks.length - 1] || maxVal);

  const hoveredItem = hoveredIdx !== null ? visibleData[hoveredIdx] ?? null : null;

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs sm:text-sm font-black" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: primaryColor }} />
            <span>{primaryLabel}</span>
          </span>
          {hasSecondary && secondaryLabel && (
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </span>
          )}
        </div>
      </div>

      {visibleData.length === 0 ? (
        <div
          className="rounded-xl border border-dashed px-4 py-8 text-center text-xs font-semibold"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          {emptyText}
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible select-none"
            role="img"
            aria-label={title}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id={`barGradA_${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryColor} stopOpacity="0.98" />
                <stop offset="100%" stopColor={primaryColor} stopOpacity="0.48" />
              </linearGradient>
              <linearGradient id={`barGradB_${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.92" />
                <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.4" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines & Axis Labels */}
            {ticks.map((tick) => {
              const y = pad.top + plotH - (tick / ceiling) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={svgWidth - pad.right}
                    y2={y}
                    stroke="var(--grid-color, var(--border-color))"
                    strokeDasharray={tick === 0 ? undefined : '3 4'}
                    strokeWidth={1}
                  />
                  <text
                    x={pad.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="10"
                    className="tabular-nums"
                  >
                    {formatTick(tick)}
                  </text>
                </g>
              );
            })}

            {/* Columns */}
            {visibleData.map((d, idx) => {
              const slotW = plotW / Math.max(1, visibleData.length);
              const centerX = pad.left + slotW * idx + slotW / 2;
              const groupW = Math.min(46, slotW * 0.68);
              const barW = hasSecondary ? Math.max(8, (groupW - 4) / 2) : Math.max(12, groupW * 0.72);
              const valA = Math.max(0, d.primaryValue);
              const hA = valA === 0 ? 2 : Math.max(4, (valA / ceiling) * plotH);
              const yA = pad.top + plotH - hA;

              const valB = hasSecondary ? Math.max(0, d.secondaryValue || 0) : 0;
              const hB = hasSecondary ? (valB === 0 ? 2 : Math.max(4, (valB / ceiling) * plotH)) : 0;
              const yB = pad.top + plotH - hB;

              const xA = hasSecondary ? centerX - barW - 2 : centerX - barW / 2;
              const xB = centerX + 2;
              const isHovered = hoveredIdx === idx;
              const shortLabel =
                d.label.length > 11 ? `${d.label.slice(0, 10)}…` : d.label;

              return (
                <g
                  key={d.id}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onClick={() => onSelectDatum?.(d.id)}
                  style={{ cursor: onSelectDatum ? 'pointer' : 'default' }}
                >
                  {isHovered && (
                    <rect
                      x={pad.left + slotW * idx + 3}
                      y={pad.top}
                      width={Math.max(8, slotW - 6)}
                      height={plotH}
                      rx={8}
                      fill="var(--bg-nav-active)"
                      opacity={0.75}
                    />
                  )}

                  <motion.rect
                    x={xA}
                    width={barW}
                    rx={5}
                    initial={reducedMotion ? { y: yA, height: hA } : { y: pad.top + plotH, height: 0 }}
                    animate={{ y: yA, height: hA }}
                    transition={{ duration: reducedMotion ? 0.05 : 0.42, ease: TABRIX_EASE, delay: idx * 0.025 }}
                    fill={`url(#barGradA_${uid})`}
                    stroke={isHovered ? 'var(--text-primary)' : 'none'}
                    strokeWidth={isHovered ? 1 : 0}
                  />

                  {hasSecondary && (
                    <motion.rect
                      x={xB}
                      width={barW}
                      rx={5}
                      initial={reducedMotion ? { y: yB, height: hB } : { y: pad.top + plotH, height: 0 }}
                      animate={{ y: yB, height: hB }}
                      transition={{ duration: reducedMotion ? 0.05 : 0.46, ease: TABRIX_EASE, delay: idx * 0.025 }}
                      fill={`url(#barGradB_${uid})`}
                      stroke={isHovered ? 'var(--text-primary)' : 'none'}
                      strokeWidth={isHovered ? 1 : 0}
                    />
                  )}

                  <text
                    x={centerX}
                    y={pad.top + plotH + 18}
                    textAnchor="middle"
                    fill={isHovered ? 'var(--accent-bright, var(--accent))' : 'var(--text-muted)'}
                    fontSize="10"
                    fontWeight={isHovered ? 800 : 600}
                  >
                    {shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Readout Bar */}
          <div
            className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] tabular-nums"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: hoveredItem ? 'var(--accent)' : 'var(--border-color)',
            }}
          >
            {hoveredItem ? (
              <>
                <span className="font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {hoveredItem.icon ? `${hoveredItem.icon} ` : ''}
                  {hoveredItem.label}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold" style={{ color: primaryColor }}>
                    {primaryLabel}: {hoveredItem.primaryFormatted ?? formatTick(hoveredItem.primaryValue)}
                  </span>
                  {hasSecondary && hoveredItem.secondaryValue !== undefined && (
                    <span className="font-bold" style={{ color: secondaryColor }}>
                      {secondaryLabel}: {hoveredItem.secondaryFormatted ?? formatTick(hoveredItem.secondaryValue)}
                    </span>
                  )}
                  {hoveredItem.hint && (
                    <span style={{ color: 'var(--text-muted)' }}>{hoveredItem.hint}</span>
                  )}
                </div>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                مرّر المؤشر فوق أي عمود لعرض التفاصيل الدقيقة{onSelectDatum ? ' أو اضغط لفتح السجل' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface Smart2DSplinePoint {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number;
  formattedValue?: string;
  secondaryFormattedValue?: string;
}

interface Smart2DTrendSplineChartProps {
  title: string;
  subtitle?: string;
  points: Smart2DSplinePoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  height?: number;
  formatTick?: (val: number) => string;
  emptyText?: string;
}

export const Smart2DTrendSplineChart: React.FC<Smart2DTrendSplineChartProps> = ({
  title,
  subtitle,
  points,
  primaryLabel,
  secondaryLabel,
  primaryColor = 'var(--accent)',
  secondaryColor = 'var(--spatial-secondary, var(--success))',
  height = 228,
  formatTick = defaultCompactTick,
  emptyText = 'لا توجد نقاط كافية لرسم المنحنى.',
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const uid = useId().replace(/:/g, '_');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const hasSecondary = Boolean(secondaryLabel) && points.some((p) => p.secondaryValue !== undefined);
  const svgWidth = 640;
  const svgHeight = height;
  const pad = { top: 20, right: 24, bottom: 38, left: 54 };
  const plotW = svgWidth - pad.left - pad.right;
  const plotH = svgHeight - pad.top - pad.bottom;

  const maxVal = useMemo(() => {
    let m = 0;
    for (const pt of points) {
      m = Math.max(m, Math.max(0, pt.value));
      if (hasSecondary && typeof pt.secondaryValue === 'number') {
        m = Math.max(m, Math.max(0, pt.secondaryValue));
      }
    }
    return m > 0 ? m : 10;
  }, [points, hasSecondary]);

  const ticks = useMemo(() => computeNiceTicks(maxVal, 4), [maxVal]);
  const ceiling = Math.max(1, ticks[ticks.length - 1] || maxVal);

  const coordsA = useMemo<Chart2DPoint[]>(() => {
    if (points.length === 0) return [];
    return points.map((p, i) => ({
      x:
        points.length === 1
          ? pad.left + plotW / 2
          : pad.left + (i / (points.length - 1)) * plotW,
      y: pad.top + plotH - (Math.max(0, p.value) / ceiling) * plotH,
    }));
  }, [points, pad.left, pad.top, plotW, plotH, ceiling]);

  const coordsB = useMemo<Chart2DPoint[]>(() => {
    if (!hasSecondary || points.length === 0) return [];
    return points.map((p, i) => ({
      x:
        points.length === 1
          ? pad.left + plotW / 2
          : pad.left + (i / (points.length - 1)) * plotW,
      y: pad.top + plotH - (Math.max(0, p.secondaryValue ?? 0) / ceiling) * plotH,
    }));
  }, [points, hasSecondary, pad.left, pad.top, plotW, plotH, ceiling]);

  const lineA = useMemo(() => computeSmoothSplinePath(coordsA), [coordsA]);
  const areaA = useMemo(
    () => buildAreaUnderSplinePath(coordsA, pad.top + plotH),
    [coordsA, pad.top, plotH]
  );
  const lineB = useMemo(() => computeSmoothSplinePath(coordsB), [coordsB]);

  const activePoint = activeIdx !== null ? points[activeIdx] ?? null : null;

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs sm:text-sm font-black" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <span className="h-2 w-4 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span>{primaryLabel}</span>
          </span>
          {hasSecondary && secondaryLabel && (
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span className="h-2 w-4 rounded-full" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </span>
          )}
        </div>
      </div>

      {points.length === 0 ? (
        <div
          className="rounded-xl border border-dashed px-4 py-8 text-center text-xs font-semibold"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          {emptyText}
        </div>
      ) : (
        <div>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible select-none"
            role="img"
            aria-label={title}
            onMouseLeave={() => setActiveIdx(null)}
          >
            <defs>
              <linearGradient id={`areaGrad_${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryColor} stopOpacity="0.34" />
                <stop offset="100%" stopColor={primaryColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {ticks.map((tick) => {
              const y = pad.top + plotH - (tick / ceiling) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={svgWidth - pad.right}
                    y2={y}
                    stroke="var(--grid-color, var(--border-color))"
                    strokeDasharray={tick === 0 ? undefined : '3 4'}
                    strokeWidth={1}
                  />
                  <text
                    x={pad.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="10"
                    className="tabular-nums"
                  >
                    {formatTick(tick)}
                  </text>
                </g>
              );
            })}

            {areaA && <path d={areaA} fill={`url(#areaGrad_${uid})`} />}

            {lineB && (
              <motion.path
                d={lineB}
                fill="none"
                stroke={secondaryColor}
                strokeWidth={2.2}
                strokeDasharray="5 4"
                strokeLinecap="round"
                initial={reducedMotion ? false : { pathLength: 0, opacity: 0.4 }}
                animate={{ pathLength: 1, opacity: 0.92 }}
                transition={{ duration: reducedMotion ? 0.05 : 0.65, ease: TABRIX_EASE }}
              />
            )}

            {lineA && (
              <motion.path
                d={lineA}
                fill="none"
                stroke={primaryColor}
                strokeWidth={2.8}
                strokeLinecap="round"
                initial={reducedMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reducedMotion ? 0.05 : 0.58, ease: TABRIX_EASE }}
              />
            )}

            {activeIdx !== null && coordsA[activeIdx] && (
              <line
                x1={coordsA[activeIdx].x}
                y1={pad.top}
                x2={coordsA[activeIdx].x}
                y2={pad.top + plotH}
                stroke="var(--accent)"
                strokeDasharray="3 3"
                strokeWidth={1.2}
                opacity={0.7}
              />
            )}

            {points.map((pt, idx) => {
              const cA = coordsA[idx];
              const cB = coordsB[idx];
              const isAct = activeIdx === idx;
              const shortLabel =
                pt.label.length > 11 ? `${pt.label.slice(0, 10)}…` : pt.label;
              return (
                <g
                  key={pt.id}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className="cursor-pointer"
                >
                  <rect
                    x={cA.x - Math.max(16, plotW / Math.max(2, points.length * 2))}
                    y={pad.top}
                    width={Math.max(32, plotW / Math.max(1, points.length))}
                    height={plotH}
                    fill="transparent"
                  />
                  {cB && (
                    <circle
                      cx={cB.x}
                      cy={cB.y}
                      r={isAct ? 5 : 3.2}
                      fill="var(--bg-main)"
                      stroke={secondaryColor}
                      strokeWidth={2}
                    />
                  )}
                  <circle
                    cx={cA.x}
                    cy={cA.y}
                    r={isAct ? 5.5 : 3.8}
                    fill="var(--bg-surface)"
                    stroke={primaryColor}
                    strokeWidth={2.4}
                  />
                  <text
                    x={cA.x}
                    y={pad.top + plotH + 18}
                    textAnchor="middle"
                    fill={isAct ? 'var(--accent-bright, var(--accent))' : 'var(--text-muted)'}
                    fontSize="10"
                    fontWeight={isAct ? 800 : 600}
                  >
                    {shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>

          <div
            className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] tabular-nums"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: activePoint ? 'var(--accent)' : 'var(--border-color)',
            }}
          >
            {activePoint ? (
              <>
                <span className="font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  {activePoint.label}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold" style={{ color: primaryColor }}>
                    {primaryLabel}: {activePoint.formattedValue ?? formatTick(activePoint.value)}
                  </span>
                  {hasSecondary && activePoint.secondaryValue !== undefined && (
                    <span className="font-bold" style={{ color: secondaryColor }}>
                      {secondaryLabel}:{' '}
                      {activePoint.secondaryFormattedValue ?? formatTick(activePoint.secondaryValue)}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                حرّك المؤشر على نقاط المنحنى لاستعراض القيم التفصيلية
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface Smart2DDonutBreakdownChartProps {
  title: string;
  subtitle?: string;
  segments: Chart2DDonutSegmentInput[];
  centerPrimaryLabel: string;
  centerSecondaryLabel: string;
}

export const Smart2DDonutBreakdownChart: React.FC<Smart2DDonutBreakdownChartProps> = ({
  title,
  subtitle,
  segments,
  centerPrimaryLabel,
  centerSecondaryLabel,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const radius = 48;

  const geometry = useMemo(() => computeDonutSlices(segments, radius), [segments]);
  const activeSlice =
    geometry.slices.find((s) => s.id === hoveredId) ?? null;

  return (
    <div
      className="rounded-2xl border p-4 flex flex-col justify-between gap-3"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div>
        <h3 className="text-xs sm:text-sm font-black" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <svg viewBox="0 0 132 132" className="h-36 w-36 shrink-0" role="img" aria-label={title}>
          <circle
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth="14"
            opacity={0.45}
          />
          {geometry.slices.map((slice) => {
            if (slice.dashLength <= 0) return null;
            const isHovered = hoveredId === slice.id;
            return (
              <motion.circle
                key={slice.id}
                cx="66"
                cy="66"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? 17 : 14}
                strokeDasharray={`${slice.dashLength} ${geometry.circumference}`}
                strokeDashoffset={slice.dashOffset}
                transform="rotate(-90 66 66)"
                onMouseEnter={() => setHoveredId(slice.id)}
                onMouseLeave={() => setHoveredId(null)}
                animate={{ strokeWidth: isHovered ? 17 : 14, opacity: hoveredId && !isHovered ? 0.5 : 1 }}
                transition={{ duration: reducedMotion ? 0.05 : 0.2 }}
                className="cursor-pointer"
              />
            );
          })}
          <text
            x="66"
            y="63"
            textAnchor="middle"
            fill="var(--text-primary)"
            fontSize="16"
            fontWeight="900"
            className="tabular-nums"
          >
            {activeSlice ? `${activeSlice.percent}%` : centerPrimaryLabel}
          </text>
          <text
            x="66"
            y="80"
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="9.5"
            fontWeight="600"
          >
            {activeSlice
              ? activeSlice.label.slice(0, 14)
              : centerSecondaryLabel}
          </text>
        </svg>

        <div className="w-full min-w-0 flex-1 space-y-2 text-[11px] tabular-nums">
          {geometry.slices.map((slice) => {
            const isHovered = hoveredId === slice.id;
            return (
              <div
                key={slice.id}
                onMouseEnter={() => setHoveredId(slice.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 transition-colors cursor-default"
                style={{
                  backgroundColor: isHovered ? 'var(--bg-nav-active)' : 'var(--bg-surface)',
                  borderColor: isHovered ? slice.color : 'var(--border-color)',
                }}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate font-bold" style={{ color: 'var(--text-primary)' }}>
                    {slice.label}
                  </span>
                </span>
                <span className="shrink-0 font-extrabold" style={{ color: 'var(--text-muted)' }}>
                  {slice.formattedValue ?? slice.value} ({slice.percent}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

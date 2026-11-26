export interface Chart2DPoint {
  x: number;
  y: number;
}

export interface Chart2DPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Chart2DDonutSegmentInput {
  id: string;
  label: string;
  value: number;
  color: string;
  formattedValue?: string;
}

export interface Chart2DDonutSliceGeometry extends Chart2DDonutSegmentInput {
  percent: number;
  dashLength: number;
  dashOffset: number;
}

/**
 * Generates clean evenly-spaced tick steps for any positive ceiling value.
 */
export function computeNiceTicks(maxValue: number, tickCount = 4): number[] {
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 100;
  const steps = Math.max(2, Math.min(8, tickCount));
  const rawStep = safeMax / (steps - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceNorm =
    norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = niceNorm * mag;
  const ticks: number[] = [];
  for (let i = 0; i < steps; i++) {
    ticks.push(Math.round(i * step * 1000) / 1000);
  }
  return ticks;
}

/**
 * Computes a smooth Catmull-Rom cubic Bezier SVG path string through (x, y) coordinates.
 * Guarantees crisp tension and zero NaN points for 0, 1, or N points.
 */
export function computeSmoothSplinePath(
  points: readonly Chart2DPoint[],
  tension = 0.22
): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Wraps a spline path down to baselineY so gradient area fills close cleanly.
 */
export function buildAreaUnderSplinePath(
  points: readonly Chart2DPoint[],
  baselineY: number,
  tension = 0.22
): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(2)} ${baselineY.toFixed(2)} L ${p.x.toFixed(2)} ${p.y.toFixed(2)} L ${p.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
  }
  const linePath = computeSmoothSplinePath(points, tension);
  const last = points[points.length - 1];
  const first = points[0];
  return `${linePath} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

/**
 * Computes responsive SVG stroke-dasharray / stroke-dashoffset geometry for 2D donut segments.
 */
export function computeDonutSlices(
  segments: readonly Chart2DDonutSegmentInput[],
  radius: number
): {
  total: number;
  circumference: number;
  slices: Chart2DDonutSliceGeometry[];
} {
  const clean = segments.map((s) => ({
    ...s,
    value: Number.isFinite(s.value) && s.value > 0 ? s.value : 0,
  }));
  const total = clean.reduce((sum, s) => sum + s.value, 0);
  const circumference = 2 * Math.PI * Math.max(1, radius);

  if (total <= 0) {
    return {
      total: 0,
      circumference,
      slices: clean.map((s) => ({
        ...s,
        percent: 0,
        dashLength: 0,
        dashOffset: 0,
      })),
    };
  }

  let cumulativeLength = 0;
  const slices: Chart2DDonutSliceGeometry[] = clean.map((seg) => {
    const fraction = seg.value / total;
    const dashLength = fraction * circumference;
    const slice: Chart2DDonutSliceGeometry = {
      ...seg,
      percent: Math.round(fraction * 1000) / 10,
      dashLength,
      dashOffset: -cumulativeLength,
    };
    cumulativeLength += dashLength;
    return slice;
  });

  return {
    total,
    circumference,
    slices,
  };
}

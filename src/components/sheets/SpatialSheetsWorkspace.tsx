import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, Plus, Sparkles, Table2 } from 'lucide-react';
import { useAgencyStore, type SpatialSheet } from '../../store/useAgencyStore';
import { useSound } from '../../audio/useSound';

const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-F])(\d+)$/.exec(ref.toUpperCase());
  if (!m) return null;
  const col = COL_LABELS.indexOf(m[1]);
  const row = Number(m[2]) - 1;
  if (col < 0 || row < 0) return null;
  return { col, row };
}

function extractFormulaDeps(raw: string): string[] {
  if (!raw.startsWith('=')) return [];
  const deps = new Set<string>();
  const rangeRe = /([A-F]\d+):([A-F]\d+)/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rangeRe.exec(raw)) !== null) {
    const start = parseCellRef(rm[1]);
    const end = parseCellRef(rm[2]);
    if (start && end) {
      for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
        for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
          deps.add(`${COL_LABELS[c]}${r + 1}`);
        }
      }
    }
  }
  const singleRe = /\b([A-F]\d+)\b/gi;
  let sm: RegExpExecArray | null;
  while ((sm = singleRe.exec(raw)) !== null) {
    deps.add(sm[1].toUpperCase());
  }
  return Array.from(deps);
}

function evaluateCellValue(
  sheet: SpatialSheet,
  key: string,
  visited = new Set<string>()
): string | number {
  const cell = sheet.cells[key];
  if (!cell) return '';
  const raw = cell.raw.trim();
  if (!raw.startsWith('=')) {
    const n = Number(raw);
    return raw !== '' && Number.isFinite(n) ? n : raw;
  }
  if (visited.has(key)) return '#REF!';
  visited.add(key);

  const expr = raw.slice(1).toUpperCase();
  const sumMatch = /^SUM\(([A-F]\d+):([A-F]\d+)\)$/.exec(expr);
  if (sumMatch) {
    const deps = extractFormulaDeps(raw);
    const total = deps.reduce((acc, d) => {
      const val = Number(evaluateCellValue(sheet, d, new Set(visited)));
      return acc + (Number.isFinite(val) ? val : 0);
    }, 0);
    return Math.round(total * 100) / 100;
  }

  // Evaluate simple arithmetic expressions like B2-C2 or C2/B2*100
  const substituted = expr.replace(/\b([A-F]\d+)\b/g, (_, ref: string) => {
    const v = Number(evaluateCellValue(sheet, ref, new Set(visited)));
    return Number.isFinite(v) ? String(v) : '0';
  });

  if (/^[0-9+\-*/().\s]+$/.test(substituted)) {
    try {
      const fn = new Function(`return (${substituted});`) as () => number;
      const res = fn();
      if (Number.isFinite(res)) return Math.round(res * 100) / 100;
    } catch {
      return '#ERR';
    }
  }
  return raw;
}

export function SheetsListView() {
  const lang = useAgencyStore((s) => s.lang);
  const sheets = useAgencyStore((s) => s.sheets);
  const setActiveSheetId = useAgencyStore((s) => s.setActiveSheetId);
  const createBlankSheet = useAgencyStore((s) => s.createBlankSheet);
  const navigate = useAgencyStore((s) => s.navigate);
  const { play } = useSound();
  const isAr = lang === 'ar';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="theme-display-heading text-2xl font-bold">
            {isAr ? 'جداول العمل المكانية' : 'Spatial Sheets'}
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {isAr
              ? 'صيغ حية مع خطوط ربط بصرية وشريط ذكاء اصطناعي لبناء الرسوم.'
              : 'Live formulas, animated dependency lines & AI table builder.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => createBlankSheet('جدول ميزانية جديد', 'New Budget Sheet')}
          className="theme-control inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          <Plus className="h-4 w-4" />
          <span>{isAr ? 'جدول جديد' : 'New Sheet'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sheets.map((sheet) => (
          <motion.button
            key={sheet.id}
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => {
              play('open_panel');
              setActiveSheetId(sheet.id);
              navigate('sheet_editor');
            }}
            className="theme-surface flex flex-col justify-between p-5 text-start"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center border"
                  style={{
                    borderRadius: 'var(--radius-control)',
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                  }}
                >
                  <Table2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold">
                    {isAr ? sheet.titleAr : sheet.titleEn}
                  </h2>
                  <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {sheet.rows} × {sheet.cols} · {sheet.updatedAt}
                  </div>
                </div>
              </div>
              {sheet.chart && <BarChart3 className="h-4 w-4" style={{ color: 'var(--accent)' }} />}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function SpatialSheetEditorView() {
  const lang = useAgencyStore((s) => s.lang);
  const sheets = useAgencyStore((s) => s.sheets);
  const activeSheetId = useAgencyStore((s) => s.activeSheetId);
  const updateSheetCell = useAgencyStore((s) => s.updateSheetCell);
  const runSheetAiCommand = useAgencyStore((s) => s.runSheetAiCommand);
  const navigate = useAgencyStore((s) => s.navigate);
  const { play } = useSound();
  const isAr = lang === 'ar';

  const sheet = sheets.find((s) => s.id === activeSheetId) ?? sheets[0];
  const [selectedCell, setSelectedCell] = useState<string>('B5');
  const [aiPrompt, setAiPrompt] = useState('');
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  const activeRaw = sheet?.cells[selectedCell]?.raw ?? '';
  const activeDeps = useMemo(() => extractFormulaDeps(activeRaw), [activeRaw]);

  const dependencyLines = useMemo(() => {
    const target = parseCellRef(selectedCell);
    if (!target || activeDeps.length === 0) return [];
    const cellW = 128;
    const cellH = 44;
    const headerW = 48;
    const headerH = 40;
    const tx = headerW + target.col * cellW + cellW / 2;
    const ty = headerH + target.row * cellH + cellH / 2;
    return activeDeps
      .map((dep) => {
        const src = parseCellRef(dep);
        if (!src) return null;
        const sx = headerW + src.col * cellW + cellW / 2;
        const sy = headerH + src.row * cellH + cellH / 2;
        return { dep, sx, sy, tx, ty };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [activeDeps, selectedCell]);

  if (!sheet) return null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="theme-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              play('back');
              navigate('sheets');
            }}
            className="theme-control inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: 'var(--surface-border)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{isAr ? 'كل الجداول' : 'Sheets'}</span>
          </button>
          <div>
            <h1 className="text-base font-bold">{isAr ? sheet.titleAr : sheet.titleEn}</h1>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {activeDeps.length > 0
                ? `${selectedCell} ⇐ ${activeDeps.join(', ')}`
                : isAr
                ? `الخلية المحددة: ${selectedCell}`
                : `Selected: ${selectedCell}`}
            </div>
          </div>
        </div>

        {/* Formula Bar */}
        <div className="flex min-w-[240px] flex-1 items-center gap-2 sm:max-w-md">
          <span
            className="theme-control flex h-[44px] items-center border px-3 text-xs font-bold tabular-nums"
            style={{
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {selectedCell}
          </span>
          <input
            type="text"
            dir="ltr"
            value={activeRaw}
            onChange={(e) => updateSheetCell(sheet.id, selectedCell, e.target.value)}
            placeholder="=SUM(B2:B4)"
            className="theme-control w-full border px-3 py-2 text-sm tabular-nums"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--surface-border)',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>
      </div>

      {/* Spatial Grid with Sticky Headers + Animated SVG Dependency Lines */}
      <div
        ref={gridContainerRef}
        dir="ltr"
        className="theme-surface relative overflow-auto"
        style={{ maxHeight: 380 }}
      >
        <div className="relative inline-block min-w-full">
          {/* Animated SVG Dependency Overlay */}
          {dependencyLines.length > 0 && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 h-full w-full"
            >
              {dependencyLines.map((line) => (
                <motion.path
                  key={line.dep}
                  d={`M ${line.sx} ${line.sy} Q ${(line.sx + line.tx) / 2} ${Math.min(line.sy, line.ty) - 22} ${line.tx} ${line.ty}`}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  initial={{ pathLength: 0, opacity: 0.2 }}
                  animate={{ pathLength: 1, opacity: 0.9 }}
                  transition={{ duration: 0.45 }}
                />
              ))}
            </svg>
          )}

          <table className="border-collapse text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            <thead className="sticky top-0 z-20" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
              <tr>
                <th
                  className="sticky left-0 z-30 h-[40px] w-[48px] border text-center"
                  style={{ borderColor: 'var(--surface-border)', backgroundColor: 'var(--bg-surface-elevated)' }}
                >
                  #
                </th>
                {Array.from({ length: sheet.cols }, (_, ci) => (
                  <th
                    key={ci}
                    className="h-[40px] min-w-[128px] border px-2 text-center font-bold"
                    style={{ borderColor: 'var(--surface-border)', color: 'var(--text-muted)' }}
                  >
                    {COL_LABELS[ci]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: sheet.rows }, (_, ri) => (
                <tr key={ri}>
                  <th
                    className="sticky left-0 z-10 h-[44px] w-[48px] border text-center tabular-nums"
                    style={{
                      borderColor: 'var(--surface-border)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {ri + 1}
                  </th>
                  {Array.from({ length: sheet.cols }, (_, ci) => {
                    const key = `${COL_LABELS[ci]}${ri + 1}`;
                    const isSelected = selectedCell === key;
                    const isDep = activeDeps.includes(key);
                    const evaluated = evaluateCellValue(sheet, key);
                    return (
                      <td
                        key={key}
                        onClick={() => {
                          setSelectedCell(key);
                          play('button_tap');
                        }}
                        className="h-[44px] min-w-[128px] cursor-pointer border px-2.5 text-sm tabular-nums transition-shadow"
                        style={{
                          borderColor: isSelected
                            ? 'var(--accent)'
                            : isDep
                            ? 'var(--warning)'
                            : 'var(--surface-border)',
                          boxShadow: isSelected
                            ? 'inset 0 0 0 1px var(--accent), 0 0 14px var(--accent-glow)'
                            : isDep
                            ? 'inset 0 0 0 1px var(--warning)'
                            : 'none',
                          backgroundColor: isSelected
                            ? 'rgba(255,255,255,0.06)'
                            : 'transparent',
                        }}
                      >
                        {String(evaluated)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Inline SVG Chart (when generated by AI or present on sheet) */}
      {sheet.chart && (
        <div className="theme-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">{isAr ? sheet.chart.titleAr : sheet.chart.titleEn}</h2>
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              SVG LIVE
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {sheet.chart.values.map((val, idx) => {
              const maxVal = Math.max(...sheet.chart!.values, 1);
              const pct = Math.max(12, Math.round((val / maxVal) * 100));
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex h-24 items-end border p-2" style={{ borderColor: 'var(--surface-border)', borderRadius: 'var(--radius-control)' }}>
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      style={{
                        height: `${pct}%`,
                        width: '100%',
                        transformOrigin: 'bottom',
                        backgroundColor: 'var(--accent)',
                        borderRadius: 'calc(var(--radius-control) * 0.4)',
                      }}
                    />
                  </div>
                  <div className="text-xs font-semibold">{sheet.chart!.labels[idx]}</div>
                  <div className="text-xs tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {val.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating AI Command Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSheetAiCommand(sheet.id, aiPrompt);
          setAiPrompt('');
        }}
        className="theme-surface-elevated flex items-center gap-2 p-3"
      >
        <Sparkles className="h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} />
        <input
          type="text"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder={
            isAr
              ? 'أمر ذكي: «أضف صف احتياطي» أو «أنشئ مخطط بياني»...'
              : 'AI command: "Add reserve row" or "Generate chart"...'
          }
          className="min-h-[44px] flex-1 bg-transparent px-2 text-sm outline-none"
        />
        <button
          type="submit"
          className="theme-control px-4 py-2 text-xs font-bold whitespace-nowrap"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {isAr ? 'تنفيذ' : 'Apply AI'}
        </button>
      </form>
    </div>
  );
}

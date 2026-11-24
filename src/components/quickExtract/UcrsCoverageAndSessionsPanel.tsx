import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Brain,
  CheckCircle2,
  Copy,
  Crop,
  FilePlus2,
  FolderClock,
  HelpCircle,
  Layers,
  Merge,
  Play,
  Plus,
  Trash2,
  Volume2,
} from 'lucide-react';
import type {
  NormalizedBox,
  UcrsDiagnosticEntry,
  UcrsLearningRule,
  UcrsSession,
} from '../../types/agency';
import { buildDiagnosticsForSession } from '../../utils/ucrsEngine';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';

interface UcrsCoverageAndSessionsPanelProps {
  activeSession: UcrsSession | null;
  allSessions: UcrsSession[];
  learningRules: UcrsLearningRule[];
  sourceImageUrl?: string;
  loading: boolean;
  onAppendSupplementaryFiles: (files: FileList) => void;
  onAnalyzeCroppedRegion: (croppedDataUrl: string, box: NormalizedBox) => void;
  onLoadSession: (session: UcrsSession) => void;
  onDuplicateSession: (session: UcrsSession) => void;
  onMergeWithSession: (otherSession: UcrsSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onAddLearningRule: (wrongToken: string, correctedToken: string) => void;
  onToggleLearningRule: (ruleId: string) => void;
  onDeleteLearningRule: (ruleId: string) => void;
  onJumpToRow: (rowId: string) => void;
  onSpeakText: (text: string) => void;
  onOpenReportsModal: () => void;
}

const STATE_COLOR: Record<
  'confident' | 'doubtful' | 'unreadable' | 'skipped',
  string
> = {
  confident: '#16a34a',
  doubtful: '#d97706',
  unreadable: '#dc2626',
  skipped: '#64748b',
};

const STATE_LABEL: Record<
  'confident' | 'doubtful' | 'unreadable' | 'skipped',
  string
> = {
  confident: 'مقروء بثقة',
  doubtful: 'مشكوك فيه',
  unreadable: 'غير مقروء',
  skipped: 'متجاهل',
};

const STATUS_LABEL: Record<UcrsSession['status'], string> = {
  scanning: 'قيد الفحص',
  in_progress: 'قيد العمل',
  needs_completion: 'يحتاج إكمال',
  ready: 'جاهز للترحيل',
  committed: 'تم الترحيل',
  rejected: 'مرفوض',
};

export const UcrsCoverageAndSessionsPanel: React.FC<
  UcrsCoverageAndSessionsPanelProps
> = ({
  activeSession,
  allSessions,
  learningRules,
  sourceImageUrl,
  loading,
  onAppendSupplementaryFiles,
  onAnalyzeCroppedRegion,
  onLoadSession,
  onDuplicateSession,
  onMergeWithSession,
  onDeleteSession,
  onAddLearningRule,
  onToggleLearningRule,
  onDeleteLearningRule,
  onJumpToRow,
  onSpeakText,
  onOpenReportsModal,
}) => {
  const [selectedDiagId, setSelectedDiagId] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragCurr, setDragCurr] = useState<{ x: number; y: number } | null>(
    null
  );
  const [wrongTokenInput, setWrongTokenInput] = useState('');
  const [correctedTokenInput, setCorrectedTokenInput] = useState('');
  const cropContainerRef = useRef<HTMLDivElement | null>(null);

  const diagnostics = useMemo<UcrsDiagnosticEntry[]>(() => {
    if (!activeSession) return [];
    if (activeSession.diagnostics.length > 0) return activeSession.diagnostics;
    return buildDiagnosticsForSession({
      rows: activeSession.rows,
      identity: activeSession.identity,
      coverage: activeSession.coverage,
    });
  }, [activeSession]);

  const activeDiagnostic =
    diagnostics.find((d) => d.id === selectedDiagId) || diagnostics[0] || null;

  const getCropPoint = (clientX: number, clientY: number) => {
    const el = cropContainerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(
        0,
        Math.min(1000, Math.round(((clientX - rect.left) / rect.width) * 1000))
      ),
      y: Math.max(
        0,
        Math.min(1000, Math.round(((clientY - rect.top) / rect.height) * 1000))
      ),
    };
  };

  const cropBox: NormalizedBox | null =
    dragStart && dragCurr
      ? {
          xmin: Math.min(dragStart.x, dragCurr.x),
          xmax: Math.max(dragStart.x, dragCurr.x),
          ymin: Math.min(dragStart.y, dragCurr.y),
          ymax: Math.max(dragStart.y, dragCurr.y),
        }
      : null;

  const handleConfirmCrop = () => {
    if (!sourceImageUrl || !cropBox) return;
    if (cropBox.xmax - cropBox.xmin < 20 || cropBox.ymax - cropBox.ymin < 15) {
      return;
    }
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const sx = Math.max(0, Math.round((cropBox.xmin / 1000) * w));
      const sy = Math.max(0, Math.round((cropBox.ymin / 1000) * h));
      const sw = Math.max(
        40,
        Math.round(((cropBox.xmax - cropBox.xmin) / 1000) * w)
      );
      const sh = Math.max(
        30,
        Math.round(((cropBox.ymax - cropBox.ymin) / 1000) * h)
      );

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.94);
      setCropModalOpen(false);
      setDragStart(null);
      setDragCurr(null);
      onAnalyzeCroppedRegion(croppedDataUrl, cropBox);
    };
    img.src = sourceImageUrl;
  };

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wrongTokenInput.trim() || !correctedTokenInput.trim()) return;
    onAddLearningRule(wrongTokenInput.trim(), correctedTokenInput.trim());
    setWrongTokenInput('');
    setCorrectedTokenInput('');
  };

  return (
    <div className="space-y-4">
      {activeSession && (
        <section
          aria-label="محرك التغطية الذكي والدمج التدريجي"
          className="space-y-4 rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          {/* Honest Progressive Status Banner */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--accent)' }}
                />
                <h2 className="text-sm font-bold">
                  الحالة التدريجية والتغطية الذكية — {activeSession.title}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold tabular-nums">
                <span style={{ color: 'var(--success)' }}>
                  قرأت {activeSession.coverage.confidentCount} من{' '}
                  {activeSession.coverage.totalEstimatedItems} بثقة عالية
                </span>
                <span aria-hidden="true">·</span>
                <span style={{ color: 'var(--warning)' }}>
                  مشكوك فيها: {activeSession.coverage.doubtfulCount}
                </span>
                <span aria-hidden="true">·</span>
                <span style={{ color: 'var(--danger)' }}>
                  غير مقروءة: {activeSession.coverage.unreadableCount}
                </span>
                <span aria-hidden="true">·</span>
                <span style={{ color: 'var(--accent)' }}>
                  التغطية الكلية: {activeSession.coverage.overallPercent}%
                </span>
              </div>
              {activeSession.coverage.missingHint && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {activeSession.coverage.missingHint}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                <span>إضافة صورة / PDF مكمّل للدمج</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv,.docx,.txt"
                  disabled={loading}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onAppendSupplementaryFiles(e.target.files);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>

              {sourceImageUrl && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setCropModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap disabled:opacity-40"
                  style={{
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                  }}
                >
                  <Crop className="h-3.5 w-3.5" />
                  <span>قص الجزء غير المقروء</span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  onSpeakText(
                    `ملخص الجلسة ${activeSession.title}. تمت قراءة ${activeSession.coverage.confidentCount} عنصر بثقة عالية من أصل ${activeSession.coverage.totalEstimatedItems}. نسبة التغطية ${activeSession.coverage.overallPercent} بالمئة. ${activeSession.coverage.missingHint}`
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>قراءة صوتية</span>
              </button>

              <button
                type="button"
                onClick={onOpenReportsModal}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>التقارير والإحصاءات</span>
              </button>
            </div>
          </div>

          {/* Last Fusion Diff Banner */}
          {activeSession.lastFusionDiff && (
            <div
              className="flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--success-bg)',
                borderColor: 'var(--success)',
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{activeSession.lastFusionDiff.summaryMessage}</span>
            </div>
          )}

          {/* 4-Layer Coverage Bars + Field Breakdown */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div
              className="space-y-2.5 rounded-lg border p-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="font-bold">نسب التغطية الرباعية</div>
              {(
                [
                  {
                    label: 'التغطية الكلية المعتمدة',
                    value: activeSession.coverage.overallPercent,
                    color: 'var(--accent)',
                  },
                  {
                    label: 'تغطية الصفحات والمحتوى',
                    value: activeSession.coverage.contentCoveragePercent,
                    color: 'var(--success)',
                  },
                  {
                    label: 'تغطية العناصر المرصودة',
                    value: activeSession.coverage.itemsCoveragePercent,
                    color: 'var(--warning)',
                  },
                  {
                    label: 'جودة القراءة (خالية من الشك)',
                    value: activeSession.coverage.qualityCoveragePercent,
                    color: 'var(--success)',
                  },
                ] as const
              ).map((bar) => (
                <div key={bar.label} className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>{bar.label}</span>
                    <span className="tabular-nums">{bar.value}%</span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--bg-surface)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, bar.value))}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              className="space-y-2.5 rounded-lg border p-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="font-bold">تغطية الحقول التفصيلية</div>
              {(
                [
                  {
                    label: 'الأسماء',
                    value: activeSession.coverage.fieldsCoverage.namePercent,
                  },
                  {
                    label: 'عدد الأفراد',
                    value:
                      activeSession.coverage.fieldsCoverage.individualsPercent,
                  },
                  {
                    label: 'النزول / النقصان',
                    value:
                      activeSession.coverage.fieldsCoverage.decreasePercent,
                  },
                  {
                    label: 'الإضافة / الحذف',
                    value:
                      activeSession.coverage.fieldsCoverage.addOrDeletePercent,
                  },
                  {
                    label: 'الملاحظات المرافقة',
                    value: activeSession.coverage.fieldsCoverage.notesPercent,
                  },
                ] as const
              ).map((f) => (
                <div key={f.label} className="space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>{f.label}</span>
                    <span className="tabular-nums">{f.value}%</span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--bg-surface)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, f.value))}%`,
                        backgroundColor: 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Visual Coverage Map + "لماذا؟" Diagnostics Inspector */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Visual Coverage Map */}
            <div
              className="space-y-2.5 rounded-lg border p-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <Layers className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span>خريطة التغطية التفاعلية</span>
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span style={{ color: STATE_COLOR.confident }}>■ مقروء</span>
                  <span style={{ color: STATE_COLOR.doubtful }}>■ مشكوك</span>
                  <span style={{ color: STATE_COLOR.unreadable }}>
                    ■ غير مقروء
                  </span>
                </div>
              </div>

              {sourceImageUrl && activeSession.coverageRegions.length > 0 ? (
                <div
                  className="relative mx-auto max-h-72 w-fit overflow-hidden rounded-lg border"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <img
                    src={sourceImageUrl}
                    alt="خريطة تغطية المستند"
                    className="block max-h-72 w-auto object-contain"
                  />
                  {activeSession.coverageRegions.map((reg) => {
                    const c = STATE_COLOR[reg.state];
                    return (
                      <button
                        key={reg.id}
                        type="button"
                        title={`${reg.label} — ${reg.reason || STATE_LABEL[reg.state]}`}
                        onClick={() => {
                          const targetRowId = reg.id.replace(/^cov_/, '');
                          const matchDiag = diagnostics.find(
                            (d) => d.targetId === targetRowId
                          );
                          if (matchDiag) setSelectedDiagId(matchDiag.id);
                          if (reg.state !== 'unreadable') {
                            onJumpToRow(targetRowId);
                          } else {
                            setCropModalOpen(true);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          left: `${reg.box.xmin / 10}%`,
                          top: `${reg.box.ymin / 10}%`,
                          width: `${Math.max(4, (reg.box.xmax - reg.box.xmin) / 10)}%`,
                          height: `${Math.max(4, (reg.box.ymax - reg.box.ymin) / 10)}%`,
                          border: `2px solid ${c}`,
                          backgroundColor: `${c}26`,
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="max-h-60 space-y-1.5 overflow-y-auto">
                  {activeSession.rows.length === 0 ? (
                    <div
                      className="py-6 text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      لا توجد صفوف جدولية بعد — يمكنك تصفح الكيانات النصية أو البحث الدلالي.
                    </div>
                  ) : (
                    activeSession.rows.slice(0, 40).map((r) => {
                      const isConfident =
                        (!r.hasDoubt || r.doubtConfirmed) &&
                        (r.mathIssues.length === 0 || r.mathConfirmed) &&
                        r.isComplete;
                      const state = isConfident
                        ? 'confident'
                        : r.resolvedName.trim()
                        ? 'doubtful'
                        : 'unreadable';
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            const matchDiag = diagnostics.find(
                              (d) => d.targetId === r.id
                            );
                            if (matchDiag) setSelectedDiagId(matchDiag.id);
                            onJumpToRow(r.id);
                          }}
                          className="flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-right hover:opacity-85"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: STATE_COLOR[state],
                          }}
                        >
                          <span className="truncate font-semibold">
                            #{r.rowIndex} · {r.resolvedName || '[غير مقروء]'}
                          </span>
                          <span
                            className="shrink-0 text-[11px] font-bold"
                            style={{ color: STATE_COLOR[state] }}
                          >
                            {STATE_LABEL[state]}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* "لماذا؟" Diagnostic & Hypothesis Engine */}
            <div
              className="space-y-2.5 rounded-lg border p-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <HelpCircle
                    className="h-4 w-4"
                    style={{ color: 'var(--warning)' }}
                  />
                  <span>التشخيص الذاتي والفرضيات («لماذا؟»)</span>
                </div>
                <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {diagnostics.length} ملاحظة
                </span>
              </div>

              {diagnostics.length === 0 ? (
                <div
                  className="rounded-lg border p-4 text-center font-semibold"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--success)',
                    color: 'var(--success)',
                  }}
                >
                  لا توجد أي أعطال أو فجوات أو التباسات غير محلولة في هذه الجلسة.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {diagnostics.slice(0, 8).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDiagId(d.id)}
                        className="rounded-md border px-2 py-1 text-[11px] font-semibold"
                        style={{
                          backgroundColor:
                            activeDiagnostic?.id === d.id
                              ? 'var(--accent)'
                              : 'var(--bg-surface)',
                          borderColor:
                            activeDiagnostic?.id === d.id
                              ? 'var(--accent)'
                              : 'var(--border-color)',
                          color:
                            activeDiagnostic?.id === d.id
                              ? 'var(--accent-fg)'
                              : 'var(--text-primary)',
                        }}
                      >
                        {d.targetLabel}
                      </button>
                    ))}
                  </div>

                  {activeDiagnostic && (
                    <div
                      className="space-y-2 rounded-lg border p-3"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div
                        className="font-bold"
                        style={{
                          color:
                            activeDiagnostic.severity === 'critical'
                              ? 'var(--danger)'
                              : 'var(--warning)',
                        }}
                      >
                        السبب: {activeDiagnostic.whyMessage}
                      </div>

                      <div>
                        <div
                          className="mb-1 text-[11px] font-bold"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          سلسلة الاستدلال:
                        </div>
                        <ul className="list-disc space-y-0.5 pr-4 text-[11px]">
                          {activeDiagnostic.reasoningChain.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div
                          className="mb-1 text-[11px] font-bold"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          الفرضيات المرتبة بالاحتمال:
                        </div>
                        <div className="space-y-1.5">
                          {activeDiagnostic.hypotheses.map((h, i) => (
                            <div
                              key={i}
                              className="rounded-md border px-2.5 py-1.5 text-[11px]"
                              style={{
                                backgroundColor: 'var(--bg-main)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              <div className="flex justify-between font-bold">
                                <span>{h.label}</span>
                                <span
                                  className="tabular-nums"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  {h.probability}%
                                </span>
                              </div>
                              <div style={{ color: 'var(--text-muted)' }}>
                                الحل المقترح: {h.suggestedFix}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Sessions Continuity ("جلساتي") & Self-Learning Rules */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Saved Sessions */}
        <div
          aria-label="جلساتي المحفوظة"
          className="space-y-3 rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderClock
                className="h-4 w-4"
                style={{ color: 'var(--accent)' }}
              />
              <h2 className="text-sm font-bold">
                جلساتي واستمرارية العمل ({allSessions.length})
              </h2>
            </div>
          </div>

          {allSessions.length === 0 ? (
            <div
              className="rounded-lg border p-4 text-center text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              تُحفظ كل جلسة قراءة تلقائيًا هنا لتتمكن من إيقافها واستئنافها أو دمجها في أي وقت.
            </div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto text-xs">
              {allSessions.map((sess) => {
                const isActive = activeSession?.id === sess.id;
                return (
                  <div
                    key={sess.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5"
                    style={{
                      backgroundColor: isActive
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-main)',
                      borderColor: isActive
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    }}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="truncate font-bold">{sess.title}</div>
                      <div
                        className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span>{STATUS_LABEL[sess.status]}</span>
                        <span aria-hidden="true">·</span>
                        <span>تغطية {sess.coverage.overallPercent}%</span>
                        <span aria-hidden="true">·</span>
                        <span>{sess.rows.length} صف</span>
                        <span aria-hidden="true">·</span>
                        <span>{sess.sources.length} مصدر</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {!isActive && (
                        <button
                          type="button"
                          title="استئناف الجلسة"
                          onClick={() => onLoadSession(sess)}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold"
                          style={{
                            borderColor: 'var(--accent)',
                            color: 'var(--accent)',
                          }}
                        >
                          <Play className="h-3 w-3" />
                          <span>فتح</span>
                        </button>
                      )}
                      {activeSession && !isActive && (
                        <button
                          type="button"
                          title="دمج مع الجلسة الحالية"
                          onClick={() => onMergeWithSession(sess)}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <Merge className="h-3 w-3" />
                          <span>دمج</span>
                        </button>
                      )}
                      <button
                        type="button"
                        title="تكرار الجلسة"
                        onClick={() => onDuplicateSession(sess)}
                        className="rounded-md border p-1.5"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="حذف الجلسة"
                        onClick={() => onDeleteSession(sess.id)}
                        className="rounded-md border p-1.5"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--danger)',
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Self-Learning Rules */}
        <div
          aria-label="قواعد التعلم الذاتي"
          className="space-y-3 rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <div>
              <h2 className="text-sm font-bold">
                التعلم الذاتي من تصحيحاتك ({learningRules.length})
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                كل تصحيح تكتبه يُحفظ كقاعدة تُطبّق تلقائيًا على القراءات القادمة.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddRuleSubmit} className="flex flex-wrap gap-1.5 text-xs">
            <input
              type="text"
              value={wrongTokenInput}
              onChange={(e) => setWrongTokenInput(e.target.value)}
              placeholder="الكلمة الملتبسة (مثلاً: عبذ)"
              className="min-w-[120px] flex-1 rounded-lg border px-2.5 py-1.5"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
            <input
              type="text"
              value={correctedTokenInput}
              onChange={(e) => setCorrectedTokenInput(e.target.value)}
              placeholder="التصحيح المعتمد (مثلاً: عبد)"
              className="min-w-[120px] flex-1 rounded-lg border px-2.5 py-1.5"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>إضافة</span>
            </button>
          </form>

          {learningRules.length === 0 ? (
            <div
              className="rounded-lg border p-3 text-center text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              لم تُسجل قواعد تصحيح بعد — ستُسجل تلقائيًا عند تعديلك لأي اسم مشكوك فيه.
            </div>
          ) : (
            <div className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
              {learningRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                    opacity: rule.enabled ? 1 : 0.55,
                  }}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => onToggleLearningRule(rule.id)}
                    />
                    <span className="truncate font-bold">
                      {rule.wrongToken} ← {rule.correctedToken}
                    </span>
                    <span
                      className="text-[11px] tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ({rule.usageCount})
                    </span>
                  </label>
                  <button
                    type="button"
                    aria-label={`حذف قاعدة ${rule.wrongToken}`}
                    onClick={() => onDeleteLearningRule(rule.id)}
                    className="p-1 hover:opacity-75"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Interactive Manual Crop Full-Screen Push Page for Unreadable Regions */}
      {sourceImageUrl && (
        <FullScreenPushPage
          open={cropModalOpen}
          onBack={() => setCropModalOpen(false)}
          title="اسحب لتحديد الجزء غير المقروء أو الباهت"
          subtitle="حدد المنطقة المطلوب التركيز عليها ثم اضغط تحليل ودمج هذا الجزء"
          ariaLabel="قص الجزء غير المقروء لإعادة التحليل"
          icon={<Crop className="h-4 w-4" />}
          maxWidthClass="max-w-3xl"
          footer={
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                className="nexus-pill-btn border px-4 py-2 font-semibold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={
                  !cropBox ||
                  cropBox.xmax - cropBox.xmin < 20 ||
                  cropBox.ymax - cropBox.ymin < 15
                }
                onClick={handleConfirmCrop}
                className="nexus-pill-btn px-5 py-2 font-bold disabled:opacity-40"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                تحليل ودمج هذا الجزء
              </button>
            </div>
          }
        >
          <div className="nexus-squircle space-y-3 p-4 sm:p-5 text-xs">
            <p style={{ color: 'var(--text-muted)' }}>
              حدد المنطقة المطلوب التركيز عليها بالمؤشر ثم اضغط «تحليل ودمج هذا الجزء» لقراءته ودمجه مع الجلسة دون تكرار البقية.
            </p>

            <div
              ref={cropContainerRef}
              onPointerDown={(e) => {
                const pt = getCropPoint(e.clientX, e.clientY);
                if (!pt) return;
                setDragStart(pt);
                setDragCurr(pt);
              }}
              onPointerMove={(e) => {
                if (!dragStart) return;
                const pt = getCropPoint(e.clientX, e.clientY);
                if (pt) setDragCurr(pt);
              }}
              onPointerUp={() => {
                // Keep dragCurr set so user can inspect and click confirm
              }}
              className="relative mx-auto max-h-[64vh] w-fit cursor-crosshair select-none overflow-hidden rounded-2xl border"
              style={{
                borderColor: 'var(--accent)',
                touchAction: 'none',
              }}
            >
              <img
                src={sourceImageUrl}
                alt="صورة المصدر للقص اليدوي"
                draggable={false}
                className="block max-h-[63vh] w-auto object-contain"
              />
              {cropBox && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${cropBox.xmin / 10}%`,
                    top: `${cropBox.ymin / 10}%`,
                    width: `${(cropBox.xmax - cropBox.xmin) / 10}%`,
                    height: `${(cropBox.ymax - cropBox.ymin) / 10}%`,
                    border: '2px dashed var(--accent)',
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          </div>
        </FullScreenPushPage>
      )}
    </div>
  );
};

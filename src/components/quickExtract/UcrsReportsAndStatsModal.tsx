import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  GitCompare,
  HelpCircle,
  Printer,
  Volume2,
} from 'lucide-react';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import type { Agency, Person, UcrsSession } from '../../types/agency';
import {
  buildDiagnosticsForSession,
  compareSessionWithRoster,
  computeSessionStatistics,
} from '../../utils/ucrsEngine';
import {
  TabrixPillIndicator,
  TabrixSubViewTransition,
} from '../ui/TabrixMotionPrimitives';
import {
  TABRIX_TACTILE_SPRING,
  useTabrixOrderedDirection,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';

interface UcrsReportsAndStatsModalProps {
  open: boolean;
  session: UcrsSession | null;
  agencies: Agency[];
  persons: Person[];
  onClose: () => void;
  onSpeakText: (text: string) => void;
}

type ReportTab = 'overview' | 'diagnostics' | 'statistics' | 'compare';

export const UcrsReportsAndStatsModal: React.FC<
  UcrsReportsAndStatsModalProps
> = ({ open, session, agencies, persons, onClose, onSpeakText }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [compareTargetAgencyId, setCompareTargetAgencyId] = useState<
    number | 'all'
  >('all');
  const reducedMotion = useTabrixReducedMotion();
  const tabDirection = useTabrixOrderedDirection(activeTab, [
    'overview',
    'diagnostics',
    'statistics',
    'compare',
  ]);

  const stats = useMemo(
    () => (session ? computeSessionStatistics(session) : null),
    [session]
  );

  const diagnostics = useMemo(
    () =>
      session
        ? session.diagnostics.length > 0
          ? session.diagnostics
          : buildDiagnosticsForSession({
              rows: session.rows,
              identity: session.identity,
              coverage: session.coverage,
            })
        : [],
    [session]
  );

  const comparison = useMemo(() => {
    if (!session) return null;
    const pool =
      compareTargetAgencyId === 'all'
        ? persons
        : persons.filter((p) => p.agencyId === compareTargetAgencyId);
    return compareSessionWithRoster(session, pool);
  }, [session, persons, compareTargetAgencyId]);

  if (!session || !stats) return null;

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rowData = session.rows.map((r) => ({
      التسلسل: r.rowIndex,
      الاسم: r.resolvedName,
      الأفراد: r.resolvedIndividuals ?? '',
      النزول: r.resolvedDecreaseCount ?? 0,
      'إضافة/حذف': r.resolvedAddOrDeleteAction,
      'العدد المضاف/المحذوف': r.resolvedAddOrDeleteCount ?? 0,
      الملاحظات: r.notes || '',
      ثقة_الاسم: `${Math.round(r.nameConfidence * 100)}%`,
    }));
    const wsRows = XLSX.utils.json_to_sheet(rowData);
    XLSX.utils.book_append_sheet(wb, wsRows, 'البيانات المستخرجة');

    const statsRows = [
      { المؤشر: 'عنوان الجلسة', القيمة: session.title },
      { المؤشر: 'التغطية الكلية', القيمة: `${session.coverage.overallPercent}%` },
      { المؤشر: 'إجمالي الصفوف', القيمة: stats.totalRows },
      { المؤشر: 'الأسماء الفريدة', القيمة: stats.uniqueNamesCount },
      { المؤشر: 'متوسط الأفراد', القيمة: stats.avgIndividuals },
      { المؤشر: 'مجموع الإضافات', القيمة: stats.totalAdditions },
      { المؤشر: 'مجموع النزول', القيمة: stats.totalDecreases },
      { المؤشر: 'مجموع الحذف', القيمة: stats.totalDeletions },
    ];
    const wsStats = XLSX.utils.json_to_sheet(statsRows);
    XLSX.utils.book_append_sheet(wb, wsStats, 'التقرير والإحصاء');

    XLSX.writeFile(
      wb,
      `tabrix-ucrs-report-${session.createdAt.slice(0, 10)}.xlsx`
    );
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      session,
      statistics: stats,
      diagnostics,
      comparison,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabrix-ucrs-${session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <FullScreenPushPage
      open={open}
      onClose={onClose}
      title={`التقارير، التشخيص، الإحصاء والمقارنة — ${session.title}`}
      subtitle="تقارير التغطية والتشخيص والمقارنة مع سجلات التطبيق"
      icon={<BarChart3 className="h-4 w-4" />}
      maxWidthClass="max-w-5xl"
      headerActions={
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              onSpeakText(
                `التقرير الإحصائي للجلسة: إجمالي ${stats.totalRows} صف، ${stats.uniqueNamesCount} اسم فريد، متوسط الأفراد ${stats.avgIndividuals}، إجمالي الإضافات ${stats.totalAdditions} والنزول ${stats.totalDecreases}. نسبة التغطية ${session.coverage.overallPercent} بالمئة.`
              )
            }
            className="nexus-pill-btn inline-flex items-center gap-1 border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>قراءة</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="nexus-pill-btn inline-flex items-center gap-1 border px-3 py-1 text-xs font-bold"
            style={{
              borderColor: 'var(--success)',
              color: 'var(--success)',
            }}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="nexus-pill-btn inline-flex items-center gap-1 border px-3 py-1 text-xs font-bold"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <Printer className="h-3.5 w-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="nexus-pill-btn inline-flex items-center gap-1 border px-3 py-1 text-xs font-bold"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>
        </div>
      }
    >
      <div className="nexus-squircle overflow-hidden">
        {/* Report Section Tabs */}
        <div
          className="flex flex-wrap gap-1 border-b px-5 py-2.5 text-xs"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {(
            [
              { id: 'overview', label: 'التقرير العام والتغطية' },
              {
                id: 'diagnostics',
                label: `تقرير التشخيص (${diagnostics.length})`,
              },
              { id: 'statistics', label: 'التحليل الإحصائي' },
              { id: 'compare', label: 'المقارنة مع السجلات' },
            ] as const
          ).map((t) => {
            const isActive = activeTab === t.id;
            return (
              <motion.button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                transition={TABRIX_TACTILE_SPRING}
                className="relative overflow-hidden rounded-lg px-3 py-1.5 font-bold whitespace-nowrap"
                style={{
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--accent-fg)' : 'var(--text-primary)',
                }}
              >
                {isActive && (
                  <TabrixPillIndicator
                    layoutId="ucrs-report-tab-pill"
                    className="rounded-lg"
                    style={{ backgroundColor: 'var(--accent)' }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </motion.button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-xs">
          <TabrixSubViewTransition
            viewKey={activeTab}
            direction={tabDirection}
            className="space-y-4"
          >
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>التغطية الكلية</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {session.coverage.overallPercent}%
                  </div>
                </div>
                <div
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>مقروء بثقة</div>
                  <div
                    className="mt-1 text-lg font-bold tabular-nums"
                    style={{ color: 'var(--success)' }}
                  >
                    {session.coverage.confidentCount}
                  </div>
                </div>
                <div
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>مشكوك فيه</div>
                  <div
                    className="mt-1 text-lg font-bold tabular-nums"
                    style={{ color: 'var(--warning)' }}
                  >
                    {session.coverage.doubtfulCount}
                  </div>
                </div>
                <div
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>مصادر الجلسة</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {session.sources.length}
                  </div>
                </div>
              </div>

              {session.documentSummary && (
                <div
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="mb-1 font-bold">الملخص العام:</div>
                  <p>{session.documentSummary}</p>
                </div>
              )}

              <div>
                <div className="mb-2 font-bold">سجل المصادر المدمجة في الجلسة:</div>
                <div className="space-y-1.5">
                  {session.sources.map((src) => (
                    <div
                      key={src.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <span className="font-semibold">{src.label}</span>
                      <span
                        className="tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {src.kind} · وضوح {src.clarityScore}% · {src.pageCount} صفحة
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-2.5">
              {diagnostics.length === 0 ? (
                <div
                  className="rounded-lg border p-6 text-center font-semibold"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--success)',
                    color: 'var(--success)',
                  }}
                >
                  لا توجد أي أخطاء أو التباسات أو فجوات تغطية مسجلة.
                </div>
              ) : (
                diagnostics.map((d) => (
                  <div
                    key={d.id}
                    className="space-y-1.5 rounded-lg border p-3"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <HelpCircle
                        className="h-4 w-4"
                        style={{
                          color:
                            d.severity === 'critical'
                              ? 'var(--danger)'
                              : 'var(--warning)',
                        }}
                      />
                      <span>
                        {d.targetLabel} — {d.whyMessage}
                      </span>
                    </div>
                    <ul className="list-disc space-y-0.5 pr-5">
                      {d.hypotheses.map((h, i) => (
                        <li key={i}>
                          <strong>{h.label}</strong> ({h.probability}%) —{' '}
                          {h.suggestedFix}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'إجمالي الصفوف', val: stats.totalRows },
                { label: 'الأسماء الفريدة', val: stats.uniqueNamesCount },
                { label: 'متوسط الأفراد لكل عائلة', val: stats.avgIndividuals },
                { label: 'أعلى عدد أفراد', val: stats.maxIndividuals },
                { label: 'أدنى عدد أفراد', val: stats.minIndividuals },
                { label: 'مجموع الإضافات', val: stats.totalAdditions },
                { label: 'مجموع النزول/النقصان', val: stats.totalDecreases },
                { label: 'مجموع الحذف', val: stats.totalDeletions },
                { label: 'الملاحظات المرصودة', val: stats.notesCount },
                { label: 'التواريخ المرصودة', val: stats.datesCount },
                { label: 'الأماكن والمناطق', val: stats.locationsCount },
                { label: 'الكيانات النصية', val: stats.totalEntities },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                  <div className="mt-1 text-base font-bold tabular-nums">
                    {item.val}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'compare' && comparison && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <GitCompare
                    className="h-4 w-4"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span>مقارنة الجلسة الحالية مع سجلات التطبيق</span>
                </div>
                <select
                  aria-label="اختيار الوكالة للمقارنة"
                  value={compareTargetAgencyId}
                  onChange={(e) =>
                    setCompareTargetAgencyId(
                      e.target.value === 'all' ? 'all' : Number(e.target.value)
                    )
                  }
                  className="rounded-lg border px-2.5 py-1.5"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <option value="all">جميع الوكالات ({persons.length})</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>نسبة التطابق</div>
                  <div
                    className="mt-1 text-lg font-bold tabular-nums"
                    style={{ color: 'var(--accent)' }}
                  >
                    {comparison.similarityPercent}%
                  </div>
                </div>
                <div
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>مطابق بالسجل</div>
                  <div
                    className="mt-1 text-lg font-bold tabular-nums"
                    style={{ color: 'var(--success)' }}
                  >
                    {comparison.matchedInTargetCount}
                  </div>
                </div>
                <div
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>أسماء جديدة</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">
                    {comparison.newOnlyCount}
                  </div>
                </div>
                <div
                  className="rounded-lg border p-3"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)' }}>تغيّر بالأفراد</div>
                  <div
                    className="mt-1 text-lg font-bold tabular-nums"
                    style={{ color: 'var(--warning)' }}
                  >
                    {comparison.changedIndividualsCount}
                  </div>
                </div>
              </div>

              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                {comparison.differences.length === 0 ? (
                  <div
                    className="rounded-lg border p-4 text-center"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    تطابق تام — لا توجد أسماء جديدة أو اختلافات في الأفراد.
                  </div>
                ) : (
                  comparison.differences.map((diff, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <span className="font-bold">{diff.name}</span>
                      <span className="tabular-nums">
                        {diff.kind === 'new'
                          ? `جديد (${diff.sessionValue ?? '—'} أفراد)`
                          : `تغيّر الأفراد: ${diff.targetValue ?? '—'} ← ${diff.sessionValue ?? '—'}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          </TabrixSubViewTransition>
        </div>
      </div>
    </FullScreenPushPage>
  );
};

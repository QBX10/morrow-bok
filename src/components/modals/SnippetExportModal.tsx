import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Download,
  Printer,
  Scissors,
  Share2,
} from 'lucide-react';
import type {
  CalculationSettings,
  FreeformHeaderConfig,
  PeriodQuotaMeta,
} from '../../types/agency';
import {
  formatIqd,
  formatTotalQuota,
  getEffectiveAllocationForPerson,
} from '../../utils/agencyLogic';
import {
  buildSnippetCardDetails,
  formatPeriodDateYMD,
  resolvePeriodMeta,
  type SnippetRecordInput,
} from '../../utils/archiveLogic';
import {
  downloadBlobFile,
  generateSmartSnippetBlob,
  printSmartSnippetPdf,
} from '../../utils/snippetExport';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import {
  runWithSignatureLoader,
  useDelayedLoading,
} from '../../utils/delayedLoader';

interface SnippetExportModalProps {
  open: boolean;
  tableTitle: string;
  tableSubtitle?: string;
  periodMeta?: PeriodQuotaMeta;
  freeformHeader?: FreeformHeaderConfig;
  records: SnippetRecordInput[];
  settings: CalculationSettings;
  onClose: () => void;
}

export const SnippetExportModal: React.FC<SnippetExportModalProps> = ({
  open,
  tableTitle,
  tableSubtitle,
  periodMeta,
  freeformHeader,
  records,
  settings,
  onClose,
}) => {
  const [busy, setBusy] = useState(false);
  useDelayedLoading(busy, 'جاري تجهيز وتصدير القصاصة...', {
    immediate: true,
    subtitle: 'يتم رسم القصاصة بدقة عالية وتجهيزها للمشاركة أو الحفظ...',
  });
  const [notice, setNotice] = useState('');
  const [cachedRecords, setCachedRecords] = useState<SnippetRecordInput[]>(records);
  const reducedMotion = useTabrixReducedMotion();

  useEffect(() => {
    if (records.length > 0) {
      setCachedRecords(records);
    }
  }, [records]);

  const activeRecords = records.length > 0 ? records : cachedRecords;
  const isOpen = open && records.length > 0;

  const resolvedPeriod = useMemo(
    () => resolvePeriodMeta(periodMeta, activeRecords[0]?.updatedAt),
    [periodMeta, activeRecords]
  );

  const totals = useMemo(() => {
    let individuals = 0;
    let totalKg = 0;
    let totalIqd = 0;
    for (const r of activeRecords) {
      const eff = getEffectiveAllocationForPerson(r, settings);
      const elig = eff.eligibleIndividuals ?? 0;
      individuals += elig;
      totalKg += elig * settings.kgPerIndividual;
      totalIqd += eff.priceIqd ?? 0;
    }
    return { individuals, totalKg, totalIqd };
  }, [activeRecords, settings]);

  const topTitle = freeformHeader?.topCustomTitle?.trim();
  const freeSubtitles = (freeformHeader?.freeSubtitles || []).filter((s) =>
    s.trim()
  );

  const handleDownloadPng = async () => {
    try {
      setBusy(true);
      setNotice('');
      const { blob, filename } = await generateSmartSnippetBlob({
        tableTitle,
        tableSubtitle,
        periodMeta: resolvedPeriod,
        freeformHeader,
        records: activeRecords,
        settings,
      });
      downloadBlobFile(blob, filename);
      setNotice('تم حفظ القصاصة كصورة عالية الجودة (PNG) بنجاح.');
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'تعذر حفظ القصاصة كصورة.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    if (activeRecords.length === 0) return;
    try {
      setBusy(true);
      setNotice('');
      const { blob, filename } = await generateSmartSnippetBlob({
        tableTitle,
        tableSubtitle,
        periodMeta: resolvedPeriod,
        freeformHeader,
        records: activeRecords,
        settings,
      });

      const file = new File([blob], filename, { type: 'image/png' });
      const summaryLines = activeRecords.map((rec, idx) => {
        const d = buildSnippetCardDetails({
          record: rec,
          fallbackTitle: tableTitle,
          periodMeta: resolvedPeriod,
          settings,
        });
        return `${idx + 1}. ${d.name} | الأفراد: ${d.individualsLabel} | النزول: ${d.decreaseLabel} | ${d.addOrDeleteLabel} | الحصة: ${d.quotaLabel} | ${d.priceLabel} | ${d.notesLabel}`;
      });
      const textPayload = [
        topTitle || tableTitle,
        `التاريخ: ${formatPeriodDateYMD(resolvedPeriod.fullDate)} · ${resolvedPeriod.monthName} (شهر ${resolvedPeriod.monthNumber}) · ${resolvedPeriod.quotaName} (${resolvedPeriod.quotaNumber})`,
        ...summaryLines,
      ].join('\n');

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: `قصاصة — ${activeRecords[0]?.name || tableTitle}`,
          text: textPayload,
          files: [file],
        });
        setNotice('تمت مشاركة القصاصة المصورة بنجاح.');
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: `قصاصة — ${tableTitle}`,
          text: textPayload,
        });
        setNotice('تمت مشاركة بيانات القصاصة بنجاح.');
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textPayload);
        setNotice('تم نسخ نص القصاصة للحافظة لمشاركته فوراً.');
      } else {
        downloadBlobFile(blob, filename);
        setNotice('تم تنزيل القصاصة كصورة للمشاركة.');
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'تعذرت المشاركة المباشرة.'
      );
    } finally {
      setBusy(false);
    }
  };

  const singleDetails =
    activeRecords.length === 1
      ? buildSnippetCardDetails({
          record: activeRecords[0],
          fallbackTitle: tableTitle,
          periodMeta: resolvedPeriod,
          settings,
        })
      : null;

  return (
    <FullScreenPushPage
      open={isOpen}
      onBack={onClose}
      title={`معاينة وتصدير حقل / قصاصة (${activeRecords.length === 1 ? activeRecords[0].name : `${activeRecords.length} صفوف`})`}
      subtitle={tableTitle}
      icon={<Scissors className="h-4 w-4" />}
      ariaLabel="تصدير حقل / قصاصة رسمية"
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <motion.button
            type="button"
            whileHover={reducedMotion ? undefined : { scale: 1.02 }}
            whileTap={reducedMotion ? undefined : { scale: 0.96 }}
            transition={TABRIX_TACTILE_SPRING}
            onClick={onClose}
            className="nexus-pill-btn border px-4 py-2 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            إغلاق
          </motion.button>

          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              type="button"
              whileHover={reducedMotion ? undefined : { y: -1.5, scale: 1.02 }}
              whileTap={reducedMotion ? undefined : { scale: 0.96 }}
              transition={TABRIX_TACTILE_SPRING}
              onClick={() =>
                void runWithSignatureLoader(
                  {
                    label: 'جاري تجهيز القصاصة للطباعة (PDF)...',
                    subtitle: 'يتم تنسيق البطاقة الرسمية للطباعة أو الحفظ بصيغة PDF...',
                  },
                  () =>
                    printSmartSnippetPdf({
                      tableTitle,
                      tableSubtitle,
                      periodMeta: resolvedPeriod,
                      freeformHeader,
                      records: activeRecords,
                      settings,
                    })
                )
              }
              className="nexus-pill-btn inline-flex items-center gap-1.5 border px-4 py-2 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>طباعة / PDF</span>
            </motion.button>

            <motion.button
              type="button"
              disabled={busy}
              whileHover={reducedMotion || busy ? undefined : { y: -1.5, scale: 1.02 }}
              whileTap={reducedMotion || busy ? undefined : { scale: 0.96 }}
              transition={TABRIX_TACTILE_SPRING}
              onClick={handleShare}
              className="nexus-pill-btn inline-flex items-center gap-1.5 border px-4 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-50"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>مشاركة فورية</span>
            </motion.button>

            <motion.button
              type="button"
              disabled={busy}
              whileHover={reducedMotion || busy ? undefined : { y: -1.5, scale: 1.02 }}
              whileTap={reducedMotion || busy ? undefined : { scale: 0.96 }}
              transition={TABRIX_TACTILE_SPRING}
              onClick={handleDownloadPng}
              className="nexus-pill-btn inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Download className="h-3.5 w-3.5" />
              <span>{busy ? 'جارٍ التجهيز...' : 'حفظ كصورة عالية الدقة (PNG)'}</span>
            </motion.button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
          <AnimatePresence initial={false}>
            {notice && (
              <motion.div
                key="snippet-notice"
                variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                role="status"
                className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--success-bg)',
                  borderColor: 'var(--success)',
                  color: 'var(--success)',
                }}
              >
                <Check className="h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="overflow-hidden rounded-xl border-2 bg-white text-slate-900 shadow-lg"
            style={{ borderColor: freeformHeader?.borderColor || '#0f172a' }}
          >
            {/* Masthead */}
            <div className="bg-slate-900 px-5 py-4 text-white">
              {topTitle && (
                <div
                  className="mb-1 text-xs font-bold"
                  style={{ color: freeformHeader?.customColor || '#38bdf8' }}
                >
                  {topTitle}
                </div>
              )}
              <div className="text-lg font-bold sm:text-xl">{tableTitle}</div>
              {tableSubtitle && (
                <div className="mt-0.5 text-xs text-slate-300">
                  {tableSubtitle}
                </div>
              )}
              {freeSubtitles.length > 0 && (
                <div className="mt-1 text-xs text-slate-400">
                  {freeSubtitles.join(' · ')}
                </div>
              )}
            </div>

            {/* Period & Quota Strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-300 bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-800 tabular-nums">
              <span>التاريخ: {formatPeriodDateYMD(resolvedPeriod.fullDate)}</span>
              <span>·</span>
              <span>
                الشهر: {resolvedPeriod.monthName} (شهر {resolvedPeriod.monthNumber})
              </span>
              <span>·</span>
              <span>
                الحصة: {resolvedPeriod.quotaName} (رقم {resolvedPeriod.quotaNumber})
              </span>
              <span>·</span>
              <span>
                تاريخ الحصة: {formatPeriodDateYMD(resolvedPeriod.quotaDate)}
              </span>
            </div>

            {/* Cropped Table Slice */}
            <div className="overflow-x-auto p-4">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-200 text-slate-900">
                    <th className="border border-slate-300 px-2.5 py-2">#</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">
                      الاسم
                    </th>
                    <th className="border border-slate-300 px-2.5 py-2">الأفراد</th>
                    <th className="border border-slate-300 px-2.5 py-2">
                      النزول / النقصان
                    </th>
                    <th className="border border-slate-300 px-2.5 py-2">
                      الإضافة / الحذف
                    </th>
                    <th className="border border-slate-300 px-2.5 py-2">الحصة</th>
                    <th className="border border-slate-300 px-2.5 py-2">المبلغ</th>
                    <th className="border border-slate-300 px-2.5 py-2">الحالة</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">
                      الملاحظات
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeRecords.map((rec, idx) => {
                    const d = buildSnippetCardDetails({
                      record: rec,
                      fallbackTitle: tableTitle,
                      periodMeta: resolvedPeriod,
                      settings,
                    });
                    return (
                      <tr
                        key={`${rec.name}_${idx}`}
                        className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
                      >
                        <td className="border border-slate-300 px-2.5 py-2 text-center tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 font-bold">
                          {d.name}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-2 text-center font-bold tabular-nums">
                          {d.individualsLabel}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-2 text-center tabular-nums">
                          {d.decreaseLabel}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-2 text-center font-semibold">
                          {d.addOrDeleteLabel}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-2 text-center tabular-nums">
                          {d.quotaLabel}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-2 text-center font-bold tabular-nums">
                          {d.priceLabel}
                        </td>
                        <td className="border border-slate-300 px-2.5 py-2 text-center font-semibold">
                          {d.statusLabel}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-700">
                          {d.notesLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Single-Record Structured Detail Card */}
              {singleDetails && (
                <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">الوكالة / القائمة: </span>
                    <span className="font-bold">{singleDetails.agencyName}</span>
                  </div>
                  <div className="tabular-nums">
                    <span className="text-slate-500">رقم البطاقة: </span>
                    <span className="font-bold">{singleDetails.nationalId}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">الفترة والحصة: </span>
                    <span className="font-bold tabular-nums">
                      {singleDetails.periodLine}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Totals */}
            <div className="border-t border-slate-300 bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-800 tabular-nums">
              قصاصة تدقيق رسمية — Morrow · السجلات: {activeRecords.length} · الأفراد:{' '}
              {totals.individuals} · {formatTotalQuota(totals.totalKg, settings)} ·{' '}
              {formatIqd(totals.totalIqd)}
            </div>
          </div>
      </div>
    </FullScreenPushPage>
  );
};

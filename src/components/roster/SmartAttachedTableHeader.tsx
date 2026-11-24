import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Building2,
  Calendar,
  Check,
  Eye,
  EyeOff,
  Hash,
  Layers,
  Palette,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  TABRIX_POPOVER_VARIANTS,
  TABRIX_REDUCED_VARIANTS,
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import { FullScreenPushPage } from '../ui/FullScreenPushPage';
import { TabrixPillIndicator } from '../ui/TabrixMotionPrimitives';
import type {
  AttachedHeaderFieldKey,
  CustomHeaderSubSection,
  FreeformHeaderAlign,
  FreeformHeaderConfig,
  FreeformHeaderSize,
  FreeformHeaderStylePreset,
  PeriodQuotaMeta,
  SectionTableHeaderMeta,
} from '../../types/agency';
import {
  ARABIC_MONTH_NAMES,
  DEFAULT_FREEFORM_HEADER,
  formatPeriodDateYMD,
  getArabicMonthName,
  resolvePeriodMeta,
} from '../../utils/archiveLogic';

const DEFAULT_FIELD_ORDER: AttachedHeaderFieldKey[] = [
  'title',
  'agency',
  'agencyNumber',
  'quotaNumber',
  'date',
];

const FIELD_LABELS: Record<AttachedHeaderFieldKey, string> = {
  title: 'اسم الجدول / العنوان الرئيسي',
  agency: 'الوكالة الأم',
  agencyNumber: 'رقم الوكالة',
  quotaNumber: 'رقم الحصة والدورة',
  date: 'التاريخ والشهر',
};

const SIZE_CLASSES: Record<FreeformHeaderSize, string> = {
  sm: 'text-xs sm:text-sm',
  md: 'text-sm sm:text-base',
  lg: 'text-base sm:text-lg',
  xl: 'text-lg sm:text-xl',
};

const PRESET_LABELS: Array<{ id: FreeformHeaderStylePreset; label: string }> = [
  { id: 'classic_official', label: 'كلاسيكي رسمي' },
  { id: 'accent_frame', label: 'إطار بارز' },
  { id: 'minimal_divider', label: 'بسيط بخط سفلي' },
  { id: 'dark_ledger', label: 'داكن متباين' },
];

interface SmartAttachedTableHeaderProps {
  headerMeta: SectionTableHeaderMeta;
  periodMeta?: PeriodQuotaMeta;
  fallbackPeriod?: PeriodQuotaMeta;
  agencyId: number | null;
  agencyName: string;
  recordCount: number;
  locked?: boolean;
  customizerOpen?: boolean;
  onCustomizerOpenChange?: (open: boolean) => void;
  onSaveHeader: (patch: Partial<SectionTableHeaderMeta>) => void;
}

export const SmartAttachedTableHeader: React.FC<SmartAttachedTableHeaderProps> = ({
  headerMeta,
  periodMeta,
  fallbackPeriod,
  agencyId,
  agencyName,
  recordCount,
  locked = false,
  customizerOpen,
  onCustomizerOpenChange,
  onSaveHeader,
}) => {
  const reducedMotion = useTabrixReducedMotion();
  const [localOpen, setLocalOpen] = useState(false);
  const modalOpen = customizerOpen !== undefined ? customizerOpen : localOpen;
  const setModalOpen = (next: boolean) => {
    setLocalOpen(next);
    onCustomizerOpenChange?.(next);
  };

  const resolvedPeriod = useMemo(
    () => resolvePeriodMeta(periodMeta || fallbackPeriod),
    [periodMeta, fallbackPeriod]
  );

  const ff: FreeformHeaderConfig = useMemo(
    () => ({
      ...DEFAULT_FREEFORM_HEADER,
      ...(headerMeta.freeformHeader || {}),
    }),
    [headerMeta.freeformHeader]
  );

  const fieldOrder: AttachedHeaderFieldKey[] = useMemo(() => {
    const base = ff.attachedFieldOrder?.length
      ? ff.attachedFieldOrder
      : DEFAULT_FIELD_ORDER;
    const valid = base.filter((k): k is AttachedHeaderFieldKey =>
      DEFAULT_FIELD_ORDER.includes(k)
    );
    for (const k of DEFAULT_FIELD_ORDER) {
      if (!valid.includes(k)) valid.push(k);
    }
    return valid;
  }, [ff.attachedFieldOrder]);

  const visibleFieldSet = useMemo(() => {
    if (ff.visibleAttachedFields && ff.visibleAttachedFields.length > 0) {
      return new Set(ff.visibleAttachedFields);
    }
    return new Set(DEFAULT_FIELD_ORDER);
  }, [ff.visibleAttachedFields]);

  const customSubSections: CustomHeaderSubSection[] = useMemo(() => {
    if (ff.customSubSections && ff.customSubSections.length > 0) {
      return ff.customSubSections;
    }
    if (ff.freeSubtitles && ff.freeSubtitles.length > 0) {
      return ff.freeSubtitles
        .filter((s) => s.trim().length > 0)
        .map((val, idx) => ({
          id: `legacy_${idx}`,
          label: '',
          value: val,
          visible: true,
        }));
    }
    return [];
  }, [ff.customSubSections, ff.freeSubtitles]);

  // Modal draft state
  const [draftTitle, setDraftTitle] = useState(headerMeta.title);
  const [draftSubtitle, setDraftSubtitle] = useState(headerMeta.subtitle);
  const [draftPeriod, setDraftPeriod] = useState<PeriodQuotaMeta>(resolvedPeriod);
  const [draftFf, setDraftFf] = useState<FreeformHeaderConfig>(ff);
  const [draftOrder, setDraftOrder] =
    useState<AttachedHeaderFieldKey[]>(fieldOrder);
  const [draftVisible, setDraftVisible] =
    useState<AttachedHeaderFieldKey[]>(Array.from(visibleFieldSet));
  const [draftSubSections, setDraftSubSections] =
    useState<CustomHeaderSubSection[]>(customSubSections);

  useEffect(() => {
    if (!modalOpen) return;
    setDraftTitle(headerMeta.title);
    setDraftSubtitle(headerMeta.subtitle);
    setDraftPeriod(resolvedPeriod);
    setDraftFf(ff);
    setDraftOrder(fieldOrder);
    setDraftVisible(Array.from(visibleFieldSet));
    setDraftSubSections(customSubSections);
  }, [
    modalOpen,
    headerMeta.title,
    headerMeta.subtitle,
    resolvedPeriod,
    ff,
    fieldOrder,
    visibleFieldSet,
    customSubSections,
  ]);

  const align = ff.align || 'right';
  const size = ff.size || 'md';
  const preset = ff.stylePreset || 'classic_official';

  const alignJustifyClass =
    align === 'center'
      ? 'justify-center text-center'
      : align === 'left'
      ? 'justify-end text-left'
      : 'justify-start text-right';

  const alignContainerItems =
    align === 'center'
      ? 'items-center text-center'
      : align === 'left'
      ? 'items-end text-left'
      : 'items-start text-right';

  const isDarkLedger = preset === 'dark_ledger';
  const headerContainerStyle: React.CSSProperties =
    preset === 'dark_ledger'
      ? {
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          borderColor: ff.borderColor || '#334155',
        }
      : preset === 'accent_frame'
      ? {
          backgroundColor: 'color-mix(in srgb, var(--bg-nav-active) 55%, var(--bg-surface))',
          color: ff.customColor || 'var(--text-primary)',
          borderColor: ff.borderColor || 'var(--accent)',
        }
      : preset === 'minimal_divider'
      ? {
          backgroundColor: 'var(--bg-surface)',
          color: ff.customColor || 'var(--text-primary)',
          borderColor: ff.borderColor || 'var(--border-color)',
        }
      : {
          backgroundColor: 'color-mix(in srgb, var(--bg-table-header) 62%, var(--bg-surface))',
          color: ff.customColor || 'var(--text-primary)',
          borderColor: ff.borderColor || 'var(--border-color)',
        };

  const resolvedAgencyNumber =
    (ff.agencyNumber || '').trim() ||
    (agencyId !== null ? String(agencyId) : '00');

  const resolvedDisplayTitle =
    (ff.topCustomTitle || '').trim() || headerMeta.title;

  const visibleSubSections = customSubSections.filter(
    (s) => s.visible !== false && (s.value.trim() || s.label.trim())
  );

  // Order metadata chips cleanly according to user's configured order
  const metaOrderWithoutTitle = fieldOrder.filter(
    (k) => k !== 'title' && visibleFieldSet.has(k)
  );
  const showTitle = visibleFieldSet.has('title');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSubSections = draftSubSections
      .map((s) => ({
        ...s,
        label: s.label.trim(),
        value: s.value.trim(),
      }))
      .filter((s) => s.label || s.value);

    const nextPeriod: PeriodQuotaMeta = {
      ...draftPeriod,
      monthName: getArabicMonthName(draftPeriod.monthNumber),
      quotaDate: draftPeriod.quotaDate || draftPeriod.fullDate,
    };

    const nextFreeform: FreeformHeaderConfig = {
      ...draftFf,
      agencyNumber: (draftFf.agencyNumber || '').trim(),
      attachedFieldOrder: draftOrder,
      visibleAttachedFields:
        draftVisible.length > 0 ? draftVisible : ['title'],
      customSubSections: cleanSubSections,
      freeSubtitles: cleanSubSections
        .filter((s) => s.visible !== false)
        .map((s) => (s.label ? `${s.label}: ${s.value}` : s.value)),
    };

    onSaveHeader({
      title: draftTitle.trim() || headerMeta.title,
      subtitle: draftSubtitle.trim(),
      date: nextPeriod.fullDate,
      periodMeta: nextPeriod,
      freeformHeader: nextFreeform,
    });
    setModalOpen(false);
  };

  const moveDraftField = (key: AttachedHeaderFieldKey, dir: -1 | 1) => {
    const idx = draftOrder.indexOf(key);
    if (idx === -1) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= draftOrder.length) return;
    const copy = [...draftOrder];
    const [removed] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, removed);
    setDraftOrder(copy);
  };

  const toggleDraftFieldVisible = (key: AttachedHeaderFieldKey) => {
    setDraftVisible((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const addDraftSubSection = () => {
    setDraftSubSections((prev) => [
      ...prev,
      {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: '',
        value: '',
        visible: true,
      },
    ]);
  };

  const moveDraftSubSection = (id: string, dir: -1 | 1) => {
    setDraftSubSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  const draftPreviewPeriod = useMemo(
    () => resolvePeriodMeta(draftPeriod),
    [draftPeriod]
  );
  const draftVisibleSubSections = useMemo(
    () =>
      draftSubSections.filter(
        (s) => s.visible !== false && (s.value.trim() || s.label.trim())
      ),
    [draftSubSections]
  );
  const draftMetaOrder = useMemo(
    () =>
      draftOrder.filter(
        (k) => k !== 'title' && draftVisible.includes(k)
      ),
    [draftOrder, draftVisible]
  );

  const hasBottomMetadata =
    metaOrderWithoutTitle.length > 0 || visibleSubSections.length > 0;

  return (
    <>
      <div
        data-testid="smart-attached-table-header"
        className="smart-attached-header border-b transition-colors"
        style={headerContainerStyle}
      >
        {/* Tier 1: Title + Live Record Counter (Right/Start) + Tactile Customizer Button (Left/End) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 sm:px-4">
          <div
            className={`flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5 ${alignJustifyClass}`}
          >
            {showTitle && (
              <h2
                className={`font-black tracking-tight ${SIZE_CLASSES[size]}`}
                style={{
                  color:
                    ff.customColor ||
                    (isDarkLedger ? '#f8fafc' : 'var(--text-primary)'),
                }}
              >
                {resolvedDisplayTitle}
              </h2>
            )}
            {headerMeta.subtitle && (
              <span
                className="text-xs font-medium"
                style={{
                  color: isDarkLedger ? '#cbd5e1' : 'var(--text-muted)',
                }}
              >
                {headerMeta.subtitle}
              </span>
            )}
            <span
              className="inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-extrabold tabular-nums whitespace-nowrap"
              style={{
                backgroundColor: isDarkLedger
                  ? 'rgba(56,189,248,0.14)'
                  : 'var(--bg-nav-active)',
                borderColor: isDarkLedger
                  ? 'rgba(56,189,248,0.3)'
                  : 'color-mix(in srgb, var(--accent) 28%, var(--border-color))',
                color: isDarkLedger ? '#38bdf8' : 'var(--accent)',
              }}
            >
              {recordCount} سجل
            </span>
          </div>

          {!locked && (
            <div className="no-print flex shrink-0 items-center">
              <motion.button
                type="button"
                data-testid="customize-attached-header-btn"
                onClick={() => setModalOpen(true)}
                whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                transition={TABRIX_TACTILE_SPRING}
                className="nexus-pill-btn inline-flex min-h-[34px] items-center gap-1.5 border px-3.5 py-1 text-[11px] font-extrabold whitespace-nowrap"
                style={{
                  backgroundColor: isDarkLedger
                    ? 'rgba(255,255,255,0.08)'
                    : 'var(--bg-surface)',
                  borderColor: isDarkLedger
                    ? 'rgba(148,163,184,0.35)'
                    : 'var(--border-color)',
                  color: isDarkLedger ? '#f8fafc' : 'var(--text-primary)',
                }}
              >
                <SlidersHorizontal
                  className="h-3.5 w-3.5"
                  style={{ color: isDarkLedger ? '#38bdf8' : 'var(--accent)' }}
                />
                <span>تخصيص الترويسة</span>
              </motion.button>
            </div>
          )}
        </div>

        {/* Tier 2: Unified Horizontal Metadata Strip with Hairline Dividers */}
        {hasBottomMetadata && (
          <div
            className="border-t px-3.5 py-2 sm:px-4"
            style={{
              borderColor: isDarkLedger
                ? 'rgba(148,163,184,0.22)'
                : 'color-mix(in srgb, var(--border-color) 80%, transparent)',
              backgroundColor: isDarkLedger
                ? 'rgba(2,6,23,0.26)'
                : 'color-mix(in srgb, var(--bg-main) 55%, transparent)',
            }}
          >
            <div
              className={
                ff.subtitlesLayout === 'stacked' && visibleSubSections.length > 0
                  ? `flex flex-col gap-1 text-[11px] ${alignContainerItems}`
                  : `flex flex-wrap items-center gap-y-1 text-[11px] w-full ${alignJustifyClass}`
              }
              style={{
                color: isDarkLedger ? '#cbd5e1' : 'var(--text-muted)',
              }}
            >
              {metaOrderWithoutTitle.map((key, idx) => {
                const divider = idx > 0 && (
                  <span
                    aria-hidden="true"
                    className="mx-2.5 inline-block h-3 w-px align-middle"
                    style={{
                      backgroundColor: isDarkLedger
                        ? 'rgba(148,163,184,0.32)'
                        : 'var(--border-color)',
                    }}
                  />
                );

                if (key === 'agency') {
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      {divider}
                      <Building2
                        className="h-3 w-3 shrink-0"
                        style={{
                          color: isDarkLedger ? '#38bdf8' : 'var(--accent)',
                        }}
                      />
                      <span className="font-semibold">الوكالة:</span>
                      <strong
                        className="font-extrabold"
                        style={{
                          color: isDarkLedger ? '#ffffff' : 'var(--text-primary)',
                        }}
                      >
                        {agencyName}
                      </strong>
                    </span>
                  );
                }
                if (key === 'agencyNumber') {
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 tabular-nums whitespace-nowrap"
                    >
                      {divider}
                      <Hash
                        className="h-3 w-3 shrink-0"
                        style={{
                          color: isDarkLedger ? '#38bdf8' : 'var(--accent)',
                        }}
                      />
                      <span className="font-semibold">رقم الوكالة:</span>
                      <strong
                        className="font-extrabold"
                        style={{
                          color: isDarkLedger ? '#ffffff' : 'var(--text-primary)',
                        }}
                      >
                        {resolvedAgencyNumber}
                      </strong>
                    </span>
                  );
                }
                if (key === 'quotaNumber') {
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 tabular-nums whitespace-nowrap"
                    >
                      {divider}
                      <Layers
                        className="h-3 w-3 shrink-0"
                        style={{
                          color: isDarkLedger ? '#38bdf8' : 'var(--accent)',
                        }}
                      />
                      <span className="font-semibold">الحصة:</span>
                      <strong
                        className="font-extrabold"
                        style={{
                          color: isDarkLedger ? '#ffffff' : 'var(--text-primary)',
                        }}
                      >
                        {resolvedPeriod.quotaName} ({resolvedPeriod.quotaNumber})
                      </strong>
                    </span>
                  );
                }
                if (key === 'date') {
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 tabular-nums whitespace-nowrap"
                    >
                      {divider}
                      <Calendar
                        className="h-3 w-3 shrink-0"
                        style={{
                          color: isDarkLedger ? '#38bdf8' : 'var(--accent)',
                        }}
                      />
                      <span className="font-semibold">التاريخ:</span>
                      <strong
                        className="font-extrabold"
                        style={{
                          color: isDarkLedger ? '#ffffff' : 'var(--text-primary)',
                        }}
                      >
                        {formatPeriodDateYMD(resolvedPeriod.fullDate)}
                      </strong>
                      <span>· {resolvedPeriod.monthName}</span>
                    </span>
                  );
                }
                return null;
              })}

              {visibleSubSections.map((sub, sIdx) => (
                <span
                  key={sub.id}
                  className="inline-flex items-center gap-1 whitespace-nowrap"
                >
                  {(metaOrderWithoutTitle.length > 0 || sIdx > 0) &&
                    ff.subtitlesLayout !== 'stacked' && (
                      <span
                        aria-hidden="true"
                        className="mx-2.5 inline-block h-3 w-px align-middle"
                        style={{
                          backgroundColor: isDarkLedger
                            ? 'rgba(148,163,184,0.32)'
                            : 'var(--border-color)',
                        }}
                      />
                    )}
                  {sub.label && (
                    <span className="font-semibold">{sub.label}:</span>
                  )}
                  <strong
                    className="font-extrabold"
                    style={{
                      color: isDarkLedger ? '#f8fafc' : 'var(--text-primary)',
                    }}
                  >
                    {sub.value}
                  </strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deep Smart Header & Period Customizer Full-Screen Push Page */}
      <FullScreenPushPage
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="تخصيص الترويسة المتصلة للجدول"
        subtitle="تحكم كامل بالحقول الظاهرة، ترتيبها، أرقام الوكالة والحصة، والمواضيع الفرعية مع معاينة حية"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        maxWidthClass="max-w-3xl"
      >
        <form
          onSubmit={handleSave}
          className="nexus-squircle p-5 space-y-5 text-xs"
        >

            {/* Live Header Preview */}
            <div
              className="overflow-hidden rounded-xl border"
              style={{
                borderColor:
                  draftFf.stylePreset === 'accent_frame'
                    ? 'var(--accent)'
                    : draftFf.stylePreset === 'dark_ledger'
                      ? '#334155'
                      : 'var(--border-color)',
                backgroundColor:
                  draftFf.stylePreset === 'dark_ledger'
                    ? '#0f172a'
                    : draftFf.stylePreset === 'accent_frame'
                      ? 'color-mix(in srgb, var(--bg-nav-active) 55%, var(--bg-surface))'
                      : 'var(--bg-main)',
                color:
                  draftFf.stylePreset === 'dark_ledger'
                    ? '#f8fafc'
                    : 'var(--text-primary)',
              }}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  {draftVisible.includes('title') && (
                    <span className="text-sm font-black">
                      {(draftFf.topCustomTitle || '').trim() ||
                        draftTitle ||
                        headerMeta.title}
                    </span>
                  )}
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{
                      backgroundColor:
                        draftFf.stylePreset === 'dark_ledger'
                          ? 'rgba(56,189,248,0.16)'
                          : 'var(--bg-nav-active)',
                      color:
                        draftFf.stylePreset === 'dark_ledger'
                          ? '#38bdf8'
                          : 'var(--accent)',
                    }}
                  >
                    {recordCount} سجل
                  </span>
                </div>
                <span className="text-[10px] opacity-70">معاينة حية</span>
              </div>
              {(draftMetaOrder.length > 0 || draftVisibleSubSections.length > 0) && (
                <div
                  className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t px-3 py-1.5 text-[10px]"
                  style={{
                    borderColor:
                      draftFf.stylePreset === 'dark_ledger'
                        ? 'rgba(148,163,184,0.25)'
                        : 'var(--border-color)',
                    opacity: 0.9,
                  }}
                >
                  {draftMetaOrder.map((k) => {
                    if (k === 'agency') return <span key={k}>الوكالة: <strong>{agencyName}</strong></span>;
                    if (k === 'agencyNumber')
                      return (
                        <span key={k} className="tabular-nums">
                          رقم: <strong>{(draftFf.agencyNumber || '').trim() || (agencyId !== null ? String(agencyId) : '00')}</strong>
                        </span>
                      );
                    if (k === 'quotaNumber')
                      return (
                        <span key={k} className="tabular-nums">
                          الحصة: <strong>{draftPreviewPeriod.quotaName} ({draftPreviewPeriod.quotaNumber})</strong>
                        </span>
                      );
                    if (k === 'date')
                      return (
                        <span key={k} className="tabular-nums">
                          التاريخ: <strong>{formatPeriodDateYMD(draftPreviewPeriod.fullDate)}</strong>
                        </span>
                      );
                    return null;
                  })}
                  {draftVisibleSubSections.map((s) => (
                    <span key={s.id}>
                      {s.label ? `${s.label}: ` : ''}
                      <strong>{s.value}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 1. Primary Fields Values */}
            <div className="space-y-3">
              <div className="font-bold" style={{ color: 'var(--accent)' }}>
                1. بيانات الرأس والوكالة والفترة
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold">
                    العنوان الرئيسي للجدول
                  </label>
                  <input
                    type="text"
                    value={draftFf.topCustomTitle || ''}
                    onChange={(e) =>
                      setDraftFf((prev) => ({
                        ...prev,
                        topCustomTitle: e.target.value,
                      }))
                    }
                    placeholder={draftTitle || 'اتركه فارغًا لاستخدام اسم القسم'}
                    className="w-full rounded-lg border px-3 py-2 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">
                    اسم القسم / الكشف الأساسي
                  </label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">
                    وصف موجز بجانب العنوان
                  </label>
                  <input
                    type="text"
                    value={draftSubtitle}
                    onChange={(e) => setDraftSubtitle(e.target.value)}
                    placeholder="مثال: كشف التوزيع المعتمد..."
                    className="w-full rounded-lg border px-3 py-2 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">
                    رقم الوكالة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={draftFf.agencyNumber || ''}
                    onChange={(e) =>
                      setDraftFf((prev) => ({
                        ...prev,
                        agencyNumber: e.target.value,
                      }))
                    }
                    placeholder={agencyId !== null ? String(agencyId) : '00'}
                    className="w-full rounded-lg border px-3 py-2 text-xs tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block font-semibold">اسم الحصة</label>
                  <input
                    type="text"
                    value={draftPeriod.quotaName}
                    onChange={(e) =>
                      setDraftPeriod((p) => ({
                        ...p,
                        quotaName: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border px-2.5 py-2 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">رقم الحصة</label>
                  <input
                    type="text"
                    value={draftPeriod.quotaNumber}
                    onChange={(e) =>
                      setDraftPeriod((p) => ({
                        ...p,
                        quotaNumber: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border px-2.5 py-2 text-xs tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">الشهر</label>
                  <select
                    value={draftPeriod.monthNumber}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      setDraftPeriod((p) => ({
                        ...p,
                        monthNumber: m,
                        monthName: getArabicMonthName(m),
                      }));
                    }}
                    className="w-full rounded-lg border px-2.5 py-2 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    {Object.entries(ARABIC_MONTH_NAMES).map(([mNum, mName]) => (
                      <option key={mNum} value={Number(mNum)}>
                        {mNum} - {mName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold">التاريخ</label>
                  <input
                    type="date"
                    dir="ltr"
                    value={draftPeriod.fullDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = new Date(val);
                      const valid = !Number.isNaN(parsed.getTime());
                      const monthNum = valid
                        ? parsed.getMonth() + 1
                        : draftPeriod.monthNumber;
                      setDraftPeriod((p) => ({
                        ...p,
                        fullDate: val,
                        quotaDate: val,
                        year: valid ? parsed.getFullYear() : p.year,
                        monthNumber: monthNum,
                        monthName: getArabicMonthName(monthNum),
                      }));
                    }}
                    className="w-full rounded-lg border px-2.5 py-2 text-xs tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Field Visibility & Order */}
            <div
              className="space-y-2.5 border-t pt-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="font-bold" style={{ color: 'var(--accent)' }}>
                2. الحقول الظاهرة وترتيبها في الرأس
              </div>
              <div className="space-y-1.5">
                {draftOrder.map((key, idx) => {
                  const isVis = draftVisible.includes(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: isVis
                          ? 'var(--border-color)'
                          : 'transparent',
                        opacity: isVis ? 1 : 0.65,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleDraftFieldVisible(key)}
                        className="inline-flex items-center gap-2 font-bold"
                      >
                        {isVis ? (
                          <Eye
                            className="h-3.5 w-3.5"
                            style={{ color: 'var(--accent)' }}
                          />
                        ) : (
                          <EyeOff
                            className="h-3.5 w-3.5"
                            style={{ color: 'var(--text-muted)' }}
                          />
                        )}
                        <span>{FIELD_LABELS[key]}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveDraftField(key, -1)}
                          aria-label={`نقل ${FIELD_LABELS[key]} للأعلى`}
                          className="rounded border p-1 disabled:opacity-30"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draftOrder.length - 1}
                          onClick={() => moveDraftField(key, 1)}
                          aria-label={`نقل ${FIELD_LABELS[key]} للأسفل`}
                          className="rounded border p-1 disabled:opacity-30"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Addable & Customizable Sub-Sections */}
            <div
              className="space-y-2.5 border-t pt-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold" style={{ color: 'var(--accent)' }}>
                  3. عناوين فرعية وحقول مخصصة قابلة للإضافة
                </div>
                <button
                  type="button"
                  onClick={addDraftSubSection}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    backgroundColor: 'var(--bg-nav-active)',
                    color: 'var(--accent)',
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة عنوان فرعي</span>
                </button>
              </div>

              {draftSubSections.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed px-3 py-3 text-center text-[11px]"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  لا توجد عناوين فرعية مضافة بعد (مثل: القضاء، الدورة، الموزع، أو ملاحظة ثابتة).
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {draftSubSections.map((sub, idx) => (
                      <motion.div
                        key={sub.id}
                        layout={!reducedMotion}
                        variants={reducedMotion ? TABRIX_REDUCED_VARIANTS : TABRIX_POPOVER_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="flex flex-wrap items-center gap-2 rounded-xl border p-2"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setDraftSubSections((prev) =>
                              prev.map((item) =>
                                item.id === sub.id
                                  ? { ...item, visible: item.visible === false }
                                  : item
                              )
                            )
                          }
                          title={sub.visible === false ? 'إظهار' : 'إخفاء'}
                          className="rounded border p-1.5"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          {sub.visible === false ? (
                            <EyeOff className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                          ) : (
                            <Eye className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                          )}
                        </button>

                        <input
                          type="text"
                          value={sub.label}
                          onChange={(e) =>
                            setDraftSubSections((prev) =>
                              prev.map((item) =>
                                item.id === sub.id
                                  ? { ...item, label: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="التسمية (مثال: القضاء)"
                          className="w-32 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-color)',
                          }}
                        />
                        <input
                          type="text"
                          value={sub.value}
                          onChange={(e) =>
                            setDraftSubSections((prev) =>
                              prev.map((item) =>
                                item.id === sub.id
                                  ? { ...item, value: e.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder="القيمة أو النص الفرعي..."
                          className="min-w-[140px] flex-1 rounded-lg border px-2.5 py-1.5 text-xs"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-color)',
                          }}
                        />

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveDraftSubSection(sub.id, -1)}
                            className="rounded border p-1 disabled:opacity-30"
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === draftSubSections.length - 1}
                            onClick={() => moveDraftSubSection(sub.id, 1)}
                            className="rounded border p-1 disabled:opacity-30"
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftSubSections((prev) =>
                                prev.filter((item) => item.id !== sub.id)
                              )
                            }
                            aria-label="حذف العنوان الفرعي"
                            className="rounded border p-1.5"
                            style={{
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* 4. Visual Style, Alignment & Colors */}
            <div
              className="space-y-3 border-t pt-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--accent)' }}>
                <Palette className="h-3.5 w-3.5" />
                <span>4. المظهر والمحاذاة والحجم</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-semibold">المحاذاة</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'right', label: 'يمين', icon: AlignRight },
                        { id: 'center', label: 'وسط', icon: AlignCenter },
                        { id: 'left', label: 'يسار', icon: AlignLeft },
                      ] as const
                    ).map((opt) => {
                      const Icon = opt.icon;
                      const active = (draftFf.align || 'right') === opt.id;
                      return (
                        <motion.button
                          key={opt.id}
                          type="button"
                          whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                          transition={TABRIX_TACTILE_SPRING}
                          onClick={() =>
                            setDraftFf((p) => ({
                              ...p,
                              align: opt.id as FreeformHeaderAlign,
                            }))
                          }
                          className="relative overflow-hidden inline-flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-bold"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: active
                              ? 'var(--accent)'
                              : 'var(--border-color)',
                            color: active
                              ? 'var(--accent)'
                              : 'var(--text-primary)',
                          }}
                        >
                          {active && (
                            <TabrixPillIndicator
                              layoutId="attached-hdr-align-pill"
                              className="rounded-lg"
                            />
                          )}
                          <Icon className="relative z-10 h-3.5 w-3.5" />
                          <span className="relative z-10">{opt.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-semibold">حجم العنوان</label>
                  <select
                    value={draftFf.size || 'md'}
                    onChange={(e) =>
                      setDraftFf((p) => ({
                        ...p,
                        size: e.target.value as FreeformHeaderSize,
                      }))
                    }
                    className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <option value="sm">مدمج (صغير)</option>
                    <option value="md">متوازن (افتراضي)</option>
                    <option value="lg">كبير</option>
                    <option value="xl">بارز جدًا</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold">تخطيط الفرعيات</label>
                  <select
                    value={draftFf.subtitlesLayout || 'inline'}
                    onChange={(e) =>
                      setDraftFf((p) => ({
                        ...p,
                        subtitlesLayout: e.target.value as 'stacked' | 'inline',
                      }))
                    }
                    className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <option value="inline">سطر متصل مدمج</option>
                    <option value="stacked">أسطر منفصلة عمودية</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESET_LABELS.map((p) => {
                  const active = (draftFf.stylePreset || 'classic_official') === p.id;
                  return (
                    <motion.button
                      key={p.id}
                      type="button"
                      whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                      whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                      transition={TABRIX_TACTILE_SPRING}
                      onClick={() =>
                        setDraftFf((prev) => ({
                          ...prev,
                          stylePreset: p.id,
                        }))
                      }
                      className="relative overflow-hidden rounded-xl border px-2.5 py-2 text-[11px] font-bold"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: active
                          ? 'var(--accent)'
                          : 'var(--border-color)',
                        color: active ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                    >
                      {active && (
                        <TabrixPillIndicator
                          layoutId="attached-hdr-preset-pill"
                          className="rounded-xl"
                        />
                      )}
                      <span className="relative z-10">{p.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Footer Actions */}
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-t pt-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                transition={TABRIX_TACTILE_SPRING}
                onClick={() => {
                  setDraftOrder(DEFAULT_FIELD_ORDER);
                  setDraftVisible(DEFAULT_FIELD_ORDER);
                  setDraftFf({
                    ...DEFAULT_FREEFORM_HEADER,
                    align: 'right',
                    size: 'md',
                    stylePreset: 'classic_official',
                  });
                }}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 font-semibold"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-muted)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>إعادة الافتراضي</span>
              </motion.button>

              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  transition={TABRIX_TACTILE_SPRING}
                  onClick={() => setModalOpen(false)}
                  className="nexus-pill-btn border px-4 py-2 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  إلغاء
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={reducedMotion ? undefined : { y: -1.5, scale: 1.02 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  transition={TABRIX_TACTILE_SPRING}
                  className="nexus-pill-btn inline-flex items-center gap-1.5 px-5 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>حفظ وتطبيق الرأس</span>
                </motion.button>
              </div>
            </div>
        </form>
      </FullScreenPushPage>
    </>
  );
};

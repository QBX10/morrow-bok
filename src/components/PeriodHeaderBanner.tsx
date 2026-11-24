import React, { useEffect, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Calendar,
  Check,
  Palette,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import type {
  FreeformHeaderAlign,
  FreeformHeaderConfig,
  FreeformHeaderSize,
  FreeformHeaderStylePreset,
  PeriodQuotaMeta,
} from '../types/agency';
import {
  ARABIC_MONTH_NAMES,
  DEFAULT_FREEFORM_HEADER,
  formatPeriodDateYMD,
  getArabicMonthName,
  resolvePeriodMeta,
} from '../utils/archiveLogic';

interface PeriodHeaderBannerProps {
  periodMeta?: PeriodQuotaMeta;
  fallbackPeriod?: PeriodQuotaMeta;
  freeformHeader?: FreeformHeaderConfig;
  readOnly?: boolean;
  onSavePeriodAndHeader?: (next: {
    periodMeta: PeriodQuotaMeta;
    freeformHeader: FreeformHeaderConfig;
  }) => void;
}

const SIZE_CLASSES: Record<FreeformHeaderSize, string> = {
  sm: 'text-sm sm:text-base',
  md: 'text-base sm:text-lg',
  lg: 'text-lg sm:text-xl',
  xl: 'text-xl sm:text-2xl',
};

const ALIGN_CLASSES: Record<FreeformHeaderAlign, string> = {
  right: 'text-right items-start',
  center: 'text-center items-center',
  left: 'text-left items-end',
};

export const PeriodHeaderBanner: React.FC<PeriodHeaderBannerProps> = ({
  periodMeta,
  fallbackPeriod,
  freeformHeader,
  readOnly = false,
  onSavePeriodAndHeader,
}) => {
  const resolvedPeriod = resolvePeriodMeta(
    periodMeta || fallbackPeriod,
    fallbackPeriod?.fullDate
  );
  const resolvedHeader: FreeformHeaderConfig = {
    ...DEFAULT_FREEFORM_HEADER,
    ...(freeformHeader || {}),
    freeSubtitles: Array.isArray(freeformHeader?.freeSubtitles)
      ? freeformHeader.freeSubtitles
      : [],
  };

  const [modalOpen, setModalOpen] = useState(false);

  // Modal draft state
  const [fullDate, setFullDate] = useState(resolvedPeriod.fullDate);
  const [year, setYear] = useState(String(resolvedPeriod.year));
  const [monthNumber, setMonthNumber] = useState(resolvedPeriod.monthNumber);
  const [monthName, setMonthName] = useState(resolvedPeriod.monthName);
  const [quotaName, setQuotaName] = useState(resolvedPeriod.quotaName);
  const [quotaNumber, setQuotaNumber] = useState(resolvedPeriod.quotaNumber);
  const [quotaDate, setQuotaDate] = useState(resolvedPeriod.quotaDate);

  const [topCustomTitle, setTopCustomTitle] = useState(
    resolvedHeader.topCustomTitle || ''
  );
  const [freeSubtitles, setFreeSubtitles] = useState<string[]>(
    resolvedHeader.freeSubtitles || []
  );
  const [newSubtitleDraft, setNewSubtitleDraft] = useState('');
  const [subtitlesLayout, setSubtitlesLayout] = useState<'stacked' | 'inline'>(
    resolvedHeader.subtitlesLayout || 'stacked'
  );
  const [align, setAlign] = useState<FreeformHeaderAlign>(
    resolvedHeader.align || 'right'
  );
  const [size, setSize] = useState<FreeformHeaderSize>(
    resolvedHeader.size || 'lg'
  );
  const [stylePreset, setStylePreset] = useState<FreeformHeaderStylePreset>(
    resolvedHeader.stylePreset || 'classic_official'
  );
  const [customColor, setCustomColor] = useState(
    resolvedHeader.customColor || ''
  );
  const [borderColor, setBorderColor] = useState(
    resolvedHeader.borderColor || ''
  );
  const [showPeriodCard, setShowPeriodCard] = useState(
    resolvedHeader.showPeriodCard !== false
  );

  useEffect(() => {
    setFullDate(resolvedPeriod.fullDate);
    setYear(String(resolvedPeriod.year));
    setMonthNumber(resolvedPeriod.monthNumber);
    setMonthName(resolvedPeriod.monthName);
    setQuotaName(resolvedPeriod.quotaName);
    setQuotaNumber(resolvedPeriod.quotaNumber);
    setQuotaDate(resolvedPeriod.quotaDate);
  }, [
    resolvedPeriod.fullDate,
    resolvedPeriod.year,
    resolvedPeriod.monthNumber,
    resolvedPeriod.monthName,
    resolvedPeriod.quotaName,
    resolvedPeriod.quotaNumber,
    resolvedPeriod.quotaDate,
  ]);

  useEffect(() => {
    setTopCustomTitle(resolvedHeader.topCustomTitle || '');
    setFreeSubtitles(resolvedHeader.freeSubtitles || []);
    setSubtitlesLayout(resolvedHeader.subtitlesLayout || 'stacked');
    setAlign(resolvedHeader.align || 'right');
    setSize(resolvedHeader.size || 'lg');
    setStylePreset(resolvedHeader.stylePreset || 'classic_official');
    setCustomColor(resolvedHeader.customColor || '');
    setBorderColor(resolvedHeader.borderColor || '');
    setShowPeriodCard(resolvedHeader.showPeriodCard !== false);
  }, [
    resolvedHeader.topCustomTitle,
    resolvedHeader.subtitlesLayout,
    resolvedHeader.align,
    resolvedHeader.size,
    resolvedHeader.stylePreset,
    resolvedHeader.customColor,
    resolvedHeader.borderColor,
    resolvedHeader.showPeriodCard,
    freeformHeader?.freeSubtitles,
  ]);

  const cleanSubtitles = (resolvedHeader.freeSubtitles || []).filter((s) =>
    s.trim()
  );
  const hasFreeform =
    Boolean(resolvedHeader.topCustomTitle?.trim()) || cleanSubtitles.length > 0;

  const presetStyles = (): React.CSSProperties => {
    if (stylePreset === 'dark_ledger') {
      return {
        backgroundColor: '#0f172a',
        borderColor: borderColor || '#334155',
        color: customColor || '#f8fafc',
      };
    }
    if (stylePreset === 'accent_frame') {
      return {
        backgroundColor: 'var(--bg-nav-active)',
        borderColor: borderColor || 'var(--accent)',
        color: customColor || 'var(--text-primary)',
      };
    }
    if (stylePreset === 'minimal_divider') {
      return {
        backgroundColor: 'transparent',
        borderColor: borderColor || 'var(--border-color)',
        color: customColor || 'var(--text-primary)',
      };
    }
    return {
      backgroundColor: 'var(--bg-surface)',
      borderColor: borderColor || 'var(--border-color)',
      color: customColor || 'var(--text-primary)',
    };
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSavePeriodAndHeader) return;
    const cleanedSubs = [...freeSubtitles, newSubtitleDraft]
      .map((s) => s.trim())
      .filter(Boolean);
    onSavePeriodAndHeader({
      periodMeta: {
        fullDate: fullDate.trim() || resolvedPeriod.fullDate,
        year: Math.max(1990, Number(year) || resolvedPeriod.year),
        monthNumber,
        monthName: monthName.trim() || getArabicMonthName(monthNumber),
        quotaName: quotaName.trim() || 'الحصة التموينية المعتمدة',
        quotaNumber: quotaNumber.trim() || '1',
        quotaDate: quotaDate.trim() || fullDate.trim() || resolvedPeriod.fullDate,
      },
      freeformHeader: {
        topCustomTitle: topCustomTitle.trim(),
        freeSubtitles: cleanedSubs,
        subtitlesLayout,
        align,
        size,
        stylePreset,
        customColor: customColor.trim() || undefined,
        borderColor: borderColor.trim() || undefined,
        showPeriodCard,
      },
    });
    setNewSubtitleDraft('');
    setModalOpen(false);
  };

  return (
    <section
      aria-label="بطاقة تعريف الفترة والحصة والترويسة الحرة"
      className="space-y-2.5"
    >
      {/* 1. Designed Freeform Masthead (when configured) */}
      {hasFreeform && (
        <div
          className={`flex flex-col rounded-xl border px-4 py-3 ${
            ALIGN_CLASSES[resolvedHeader.align || 'right']
          }`}
          style={presetStyles()}
        >
          {resolvedHeader.topCustomTitle?.trim() && (
            <div
              className={`font-bold leading-snug ${
                SIZE_CLASSES[resolvedHeader.size || 'lg']
              }`}
              style={{
                color:
                  customColor ||
                  (stylePreset === 'dark_ledger' ? '#ffffff' : 'var(--text-primary)'),
              }}
            >
              {resolvedHeader.topCustomTitle}
            </div>
          )}

          {cleanSubtitles.length > 0 && (
            <div
              className={
                resolvedHeader.subtitlesLayout === 'inline'
                  ? 'mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium'
                  : 'mt-1 flex flex-col gap-0.5 text-xs font-medium'
              }
              style={{
                color:
                  stylePreset === 'dark_ledger' ? '#cbd5e1' : 'var(--text-muted)',
              }}
            >
              {cleanSubtitles.map((sub, i) => (
                <span key={i}>
                  {resolvedHeader.subtitlesLayout === 'inline' && i > 0 ? '· ' : ''}
                  {sub}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Period & Quota Identification Card */}
      {resolvedHeader.showPeriodCard !== false && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 font-bold tabular-nums">
              <Calendar
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>التاريخ:</span>
              <span>{formatPeriodDateYMD(resolvedPeriod.fullDate)}</span>
            </span>

            <span aria-hidden="true" style={{ color: 'var(--border-color)' }}>
              |
            </span>

            <span className="font-semibold tabular-nums">
              <span style={{ color: 'var(--text-muted)' }}>الشهر: </span>
              <span className="font-bold">{resolvedPeriod.monthName}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {' '}
                (شهر {resolvedPeriod.monthNumber})
              </span>
            </span>

            <span aria-hidden="true" style={{ color: 'var(--border-color)' }}>
              |
            </span>

            <span className="font-semibold tabular-nums">
              <span style={{ color: 'var(--text-muted)' }}>الحصة: </span>
              <span className="font-bold">{resolvedPeriod.quotaName}</span>
              <span style={{ color: 'var(--accent)' }}>
                {' '}
                · رقم {resolvedPeriod.quotaNumber}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {' '}
                · {formatPeriodDateYMD(resolvedPeriod.quotaDate)}
              </span>
            </span>
          </div>

          {!readOnly && onSavePeriodAndHeader && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="nexus-pill-btn inline-flex shrink-0 items-center gap-1.5 border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--accent)',
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>تخصيص الفترة والترويسة الحرة</span>
            </button>
          )}
        </div>
      )}

      {resolvedHeader.showPeriodCard === false && !readOnly && onSavePeriodAndHeader && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="nexus-pill-btn inline-flex items-center gap-1.5 border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>إظهار / تخصيص الفترة والترويسة الحرة</span>
          </button>
        </div>
      )}

      {/* Full-Screen Push Page: Edit Period & Designed Freeform Headers */}
      <FullScreenPushPage
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="تخصيص الفترة والحصة والترويسة الحرة"
        subtitle="ضبط التاريخ والشهر ورقم الحصة والترويسة التصميمية أعلى الجدول"
        icon={<Sparkles className="h-4 w-4" />}
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSave} className="nexus-squircle p-5 space-y-5 text-xs">
              {/* Section 1: Period & Quota */}
              <div className="space-y-3">
                <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                  1. بيانات التاريخ والشهر والحصة
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block font-semibold">التاريخ الكامل</label>
                    <input
                      type="date"
                      value={fullDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFullDate(val);
                        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                          const y = val.slice(0, 4);
                          const m = Number(val.slice(5, 7));
                          setYear(y);
                          setMonthNumber(m);
                          setMonthName(getArabicMonthName(m));
                        }
                      }}
                      className="w-full rounded-lg border px-3 py-2 tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold">الشهر (رقم واسم)</label>
                    <select
                      value={monthNumber}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        setMonthNumber(m);
                        setMonthName(getArabicMonthName(m));
                      }}
                      className="w-full rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {Object.entries(ARABIC_MONTH_NAMES).map(([num, label]) => (
                        <option key={num} value={num}>
                          شهر {num} — {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold">السنة</label>
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block font-semibold">اسم الحصة</label>
                    <input
                      type="text"
                      value={quotaName}
                      onChange={(e) => setQuotaName(e.target.value)}
                      placeholder="مثال: الحصة التموينية الثانية"
                      className="w-full rounded-lg border px-3 py-2"
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
                      value={quotaNumber}
                      onChange={(e) => setQuotaNumber(e.target.value)}
                      placeholder="مثال: 2"
                      className="w-full rounded-lg border px-3 py-2 tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold">تاريخ الحصة</label>
                    <input
                      type="date"
                      value={quotaDate}
                      onChange={(e) => setQuotaDate(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Freeform Designed Header */}
              <div
                className="space-y-3 border-t pt-4"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                  2. العنونة الحرة والتصميمية أعلى الجدول
                </div>

                <div>
                  <label className="mb-1 block font-semibold">
                    عنوان رئيسي مخصص فوق عنوان الجدول
                  </label>
                  <input
                    type="text"
                    value={topCustomTitle}
                    onChange={(e) => setTopCustomTitle(e.target.value)}
                    placeholder="مثال: كشف التوزيع الميداني المعتمد — شعبة الكرادة"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-semibold">
                    عناوين فرعية حرة (تحتها أو بجانبها)
                  </label>

                  {freeSubtitles.map((sub, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={sub}
                        onChange={(e) => {
                          const next = [...freeSubtitles];
                          next[idx] = e.target.value;
                          setFreeSubtitles(next);
                        }}
                        className="flex-1 rounded-lg border px-3 py-1.5"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFreeSubtitles(freeSubtitles.filter((_, i) => i !== idx))
                        }
                        aria-label="حذف العنوان الفرعي"
                        className="rounded-lg border p-2 hover:opacity-80"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--danger)',
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSubtitleDraft}
                      onChange={(e) => setNewSubtitleDraft(e.target.value)}
                      placeholder="أضف عنواناً فرعياً حراً جديداً (مثال: المندوب المسؤول: علي حسن)..."
                      className="flex-1 rounded-lg border px-3 py-1.5"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newSubtitleDraft.trim()) return;
                        setFreeSubtitles([...freeSubtitles, newSubtitleDraft.trim()]);
                        setNewSubtitleDraft('');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-bold whitespace-nowrap"
                      style={{
                        backgroundColor: 'var(--bg-nav-active)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>إضافة سطر</span>
                    </button>
                  </div>
                </div>

                {/* Formatting Options: Size, Alignment, Subtitle Layout, Preset, Colors */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-semibold">حجم الترويسة</label>
                    <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--border-color)' }}>
                      {(
                        [
                          { id: 'sm', label: 'صغير' },
                          { id: 'md', label: 'متوسط' },
                          { id: 'lg', label: 'كبير' },
                          { id: 'xl', label: 'بارز' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSize(opt.id)}
                          className="flex-1 rounded-md py-1.5 font-bold"
                          style={{
                            backgroundColor:
                              size === opt.id ? 'var(--accent)' : 'transparent',
                            color:
                              size === opt.id
                                ? 'var(--accent-fg)'
                                : 'var(--text-primary)',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold">المحاذاة</label>
                    <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--border-color)' }}>
                      {(
                        [
                          { id: 'right', label: 'يمين', icon: AlignRight },
                          { id: 'center', label: 'وسط', icon: AlignCenter },
                          { id: 'left', label: 'يسار', icon: AlignLeft },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAlign(opt.id)}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 font-bold"
                            style={{
                              backgroundColor:
                                align === opt.id ? 'var(--accent)' : 'transparent',
                              color:
                                align === opt.id
                                  ? 'var(--accent-fg)'
                                  : 'var(--text-primary)',
                            }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold">
                      موقع العناوين الفرعية
                    </label>
                    <select
                      value={subtitlesLayout}
                      onChange={(e) =>
                        setSubtitlesLayout(
                          e.target.value === 'inline' ? 'inline' : 'stacked'
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <option value="stacked">تحت الترويسة (أسطر متتابعة)</option>
                      <option value="inline">بجانب بعضها (شريط أفقي منسق)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold">نمط التصميم والإطار</label>
                    <select
                      value={stylePreset}
                      onChange={(e) =>
                        setStylePreset(e.target.value as FreeformHeaderStylePreset)
                      }
                      className="w-full rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <option value="classic_official">ترويسة رسمية هادئة</option>
                      <option value="accent_frame">إطار مميز بلون التطبيق</option>
                      <option value="dark_ledger">شريط داكن عالي التباين</option>
                      <option value="minimal_divider">خط خفيف بدون خلفية</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold">
                      لون نص مخصص (اختياري)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColor || '#0f172a'}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border p-0.5"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setCustomColor('')}
                        className="rounded-lg border px-2.5 py-1.5 text-[11px]"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        افتراضي
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold">
                      لون الإطار المخصص (اختياري)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={borderColor || '#2563eb'}
                        onChange={(e) => setBorderColor(e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border p-0.5"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setBorderColor('')}
                        className="rounded-lg border px-2.5 py-1.5 text-[11px]"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        افتراضي
                      </button>
                    </div>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 pt-1 font-semibold">
                  <input
                    type="checkbox"
                    checked={showPeriodCard}
                    onChange={(e) => setShowPeriodCard(e.target.checked)}
                  />
                  <span>إظهار بطاقة تعريف التاريخ والشهر والحصة أعلى الجدول</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="nexus-pill-btn border px-4 py-2 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="nexus-pill-btn inline-flex items-center gap-1.5 px-5 py-2 font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>حفظ الفترة والترويسة</span>
                </button>
              </div>
            </form>
      </FullScreenPushPage>
    </section>
  );
};

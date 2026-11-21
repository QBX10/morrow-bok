import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Edit3, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { compressImageFileToDataUrl } from '../lib/imageUpload';
import type {
  Agency,
  AgencyExpense,
  CalculationSettings,
  Person,
} from '../types/agency';
import {
  computeAgencyMetrics,
  formatNumberCompact,
} from '../utils/agencyLogic';
import type { ModeCapabilities } from '../utils/modePermissions';

interface AgenciesHubViewProps {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  calculationSettings: CalculationSettings;
  capabilities: ModeCapabilities;
  onOpenMasterRoster: () => void;
  onOpenAgencyRoster: (agencyId: number) => void;
  onAddAgency: (name: string, icon: string) => void;
  onUpdateAgencyDetails?: (
    agencyId: number,
    patch: Partial<Pick<Agency, 'name' | 'icon' | 'logoDataUrl' | 'isLocked'>>
  ) => void;
}

export const AgenciesHubView: React.FC<AgenciesHubViewProps> = ({
  agencies,
  persons,
  expenses,
  calculationSettings,
  capabilities,
  onOpenMasterRoster,
  onOpenAgencyRoster,
  onAddAgency,
  onUpdateAgencyDetails,
}) => {
  const [newAgencyName, setNewAgencyName] = useState('');
  const [showAddAgency, setShowAddAgency] = useState(false);
  const [editingAgencyId, setEditingAgencyId] = useState<number | null>(null);
  const [editAgencyName, setEditAgencyName] = useState('');
  const [editAgencyIcon, setEditAgencyIcon] = useState('');
  const [editAgencyLogo, setEditAgencyLogo] = useState<string | undefined>(
    undefined
  );
  const [logoError, setLogoError] = useState('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const allMetrics = useMemo(
    () => computeAgencyMetrics(persons, expenses, calculationSettings),
    [persons, expenses, calculationSettings]
  );

  // Strict 4-card startup layout: Card 1 = All Agencies, Cards 2-4 = First 3 agencies
  const primaryThreeAgencies = useMemo(() => agencies.slice(0, 3), [agencies]);
  const extraAgencies = useMemo(() => agencies.slice(3), [agencies]);

  const handleAgencyLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setLogoError('');
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxDim: 200,
        maxChars: 140000,
        quality: 0.8,
      });
      setEditAgencyLogo(dataUrl);
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : 'تعذر معالجة شعار الوكالة.'
      );
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">
            تابريكس — الوكالات الرئيسية
          </h1>
          <p
            className="mt-1 text-xs sm:text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            اختر «جميع الوكالات» أو إحدى الوكالات لعرض جدولها التفصيلي
            {capabilities.isReadOnlyPdfView
              ? ' · وضع المبتدئ (عرض وقراءة فقط)'
              : ` · ${capabilities.label}`}
          </p>
        </div>

        {capabilities.canManageAgencies && (
          <button
            type="button"
            onClick={() => setShowAddAgency((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>إضافة وكالة جديدة</span>
          </button>
        )}
      </div>

      {showAddAgency && capabilities.canManageAgencies && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newAgencyName.trim()) return;
            onAddAgency(newAgencyName, '🏢');
            setNewAgencyName('');
            setShowAddAgency(false);
          }}
          className="tabrix-card flex flex-wrap items-center gap-2 border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-color)',
          }}
        >
          <input
            type="text"
            required
            value={newAgencyName}
            onChange={(e) => setNewAgencyName(e.target.value)}
            placeholder="اسم الوكالة الجديدة..."
            className="min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          />
          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-xs font-bold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            حفظ الوكالة
          </button>
        </form>
      )}

      {editingAgencyId !== null &&
        capabilities.canManageAgencies &&
        onUpdateAgencyDetails && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editAgencyName.trim()) return;
              onUpdateAgencyDetails(editingAgencyId, {
                name: editAgencyName.trim(),
                icon: editAgencyIcon.trim() || '🏢',
                logoDataUrl: editAgencyLogo || '',
              });
              setEditingAgencyId(null);
              setLogoError('');
            }}
            className="tabrix-card space-y-2 border p-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent)',
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {editAgencyLogo ? (
                <img
                  src={editAgencyLogo}
                  alt="شعار الوكالة"
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-lg border object-cover"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              ) : null}

              <input
                type="text"
                value={editAgencyIcon}
                onChange={(e) => setEditAgencyIcon(e.target.value)}
                aria-label="أيقونة الوكالة"
                className="w-14 rounded-lg border px-2 py-2 text-center text-sm"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <input
                type="text"
                required
                value={editAgencyName}
                onChange={(e) => setEditAgencyName(e.target.value)}
                aria-label="تعديل اسم الوكالة"
                className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              />

              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <ImagePlus className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>رفع شعار</span>
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleAgencyLogoUpload}
                className="hidden"
              />

              {editAgencyLogo && (
                <button
                  type="button"
                  onClick={() => setEditAgencyLogo(undefined)}
                  aria-label="حذف شعار الوكالة"
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold"
                  style={{
                    borderColor: 'var(--danger)',
                    color: 'var(--danger)',
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Check className="h-3.5 w-3.5" />
                <span>حفظ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingAgencyId(null);
                  setLogoError('');
                }}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <X className="h-3.5 w-3.5" />
                <span>إلغاء</span>
              </button>
            </div>
            {logoError && (
              <div className="text-xs font-bold" style={{ color: 'var(--danger)' }}>
                {logoError}
              </div>
            )}
          </form>
        )}

      {/* Strictly 4 Primary Cards at Entry */}
      <section
        aria-label="البطاقات الأربع للوكالات"
        data-testid="hub-four-cards"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* Card 1: All Agencies */}
        <button
          type="button"
          onClick={onOpenMasterRoster}
          className="tabrix-card flex flex-col justify-between border p-5 text-right transition-colors hover:border-blue-500"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent)',
          }}
        >
          <div>
            <div
              className="flex items-center justify-between text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>البطاقة الأولى</span>
              <span>السجل الشامل</span>
            </div>
            <h2 className="mt-2 text-lg font-bold">جميع الوكالات</h2>
            <div
              className="mt-3 space-y-1 text-xs tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              <div>
                العائلات: {allMetrics.activeHouseholds} · الأفراد:{' '}
                {allMetrics.activeIndividuals}
              </div>
              <div>
                الأكياس: {allMetrics.fullBags} كيس
                {allMetrics.remainderKg > 0
                  ? ` + ${formatNumberCompact(allMetrics.remainderKg)} كغم`
                  : ''}
              </div>
            </div>
          </div>

          <div
            className="mt-5 flex items-center justify-between border-t pt-3 text-xs font-bold"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--accent)',
            }}
          >
            <span>فتح الجدول الشامل</span>
            <ArrowLeft className="h-4 w-4" />
          </div>
        </button>

        {/* Cards 2, 3, 4: Second, Third, Fourth Cards */}
        {primaryThreeAgencies.map((agency, idx) => {
          const m = computeAgencyMetrics(
            persons.filter((p) => p.agencyId === agency.id),
            expenses.filter((e) => e.agencyId === agency.id),
            calculationSettings
          );
          const cardOrderLabels = [
            'الوكالة الثانية',
            'الوكالة الثالثة',
            'الوكالة الرابعة',
          ];
          return (
            <div
              key={agency.id}
              className="tabrix-card flex flex-col justify-between border p-5 text-right transition-colors hover:border-blue-500"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div>
                <div
                  className="flex items-center justify-between text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span>{cardOrderLabels[idx] || `وكالة ${idx + 2}`}</span>
                  <div className="flex items-center gap-1.5">
                    {capabilities.canManageAgencies && onUpdateAgencyDetails && (
                      <button
                        type="button"
                        aria-label={`تعديل ${agency.name}`}
                        onClick={() => {
                          setEditingAgencyId(agency.id);
                          setEditAgencyName(agency.name);
                          setEditAgencyIcon(agency.icon);
                          setEditAgencyLogo(agency.logoDataUrl || undefined);
                          setLogoError('');
                        }}
                        className="rounded border p-1 hover:opacity-80"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    )}
                    {agency.logoDataUrl ? (
                      <img
                        src={agency.logoDataUrl}
                        alt={agency.name}
                        referrerPolicy="no-referrer"
                        className="h-6 w-6 rounded-md border object-cover"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <span aria-hidden="true">{agency.icon}</span>
                    )}
                  </div>
                </div>
                <h2 className="mt-2 truncate text-lg font-bold">
                  {agency.name}
                </h2>
                <div
                  className="mt-3 space-y-1 text-xs tabular-nums"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <div>
                    العائلات: {m.activeHouseholds} · الأفراد:{' '}
                    {m.activeIndividuals}
                  </div>
                  <div>
                    الأكياس: {m.fullBags} كيس
                    {m.remainderKg > 0
                      ? ` + ${formatNumberCompact(m.remainderKg)} كغم`
                      : ''}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenAgencyRoster(agency.id)}
                className="mt-5 flex w-full items-center justify-between border-t pt-3 text-xs font-bold"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--accent)',
                }}
              >
                <span>عرض الجدول البياني</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </section>

      {/* Extra agencies only shown if user added more in Expert mode */}
      {extraAgencies.length > 0 && !capabilities.isReadOnlyPdfView && (
        <section className="space-y-3 pt-2">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
            وكالات إضافية ({extraAgencies.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {extraAgencies.map((agency) => {
              const m = computeAgencyMetrics(
                persons.filter((p) => p.agencyId === agency.id),
                expenses.filter((e) => e.agencyId === agency.id),
                calculationSettings
              );
              return (
                <button
                  key={agency.id}
                  type="button"
                  onClick={() => onOpenAgencyRoster(agency.id)}
                  className="tabrix-card flex items-center justify-between border p-4 text-right hover:border-blue-500"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    {agency.logoDataUrl ? (
                      <img
                        src={agency.logoDataUrl}
                        alt={agency.name}
                        referrerPolicy="no-referrer"
                        className="h-8 w-8 rounded-lg border object-cover"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <span className="text-base" aria-hidden="true">
                        {agency.icon}
                      </span>
                    )}
                    <div>
                      <div className="font-bold">{agency.name}</div>
                      <div
                        className="mt-1 text-xs tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        الأفراد: {m.activeIndividuals} · الأكياس: {m.fullBags}
                      </div>
                    </div>
                  </div>
                  <ArrowLeft className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
};

import React from 'react';
import {
  GitFork,
  Layers,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  Agency,
  QuickExtractDestinationSpec,
  QuickExtractMergeStrategy,
  QuickExtractRoutingConfig,
  QuickExtractRoutingRule,
  QuickExtractRuleCondition,
  ReadyList,
} from '../../types/agency';

const CONDITION_LABELS: Array<{ id: QuickExtractRuleCondition; label: string }> = [
  { id: 'has_addition', label: 'يحتوي على «إضافة» (إضافة > 0)' },
  { id: 'has_decrease', label: 'يحتوي على «نزول / نقصان» (> 0)' },
  { id: 'has_deletion', label: 'يحتوي على «حذف» (حذف > 0)' },
  { id: 'name_contains', label: 'الاسم يحتوي على نص محدد' },
  { id: 'individuals_gte', label: 'صافي الأفراد أكبر أو يساوي (≥)' },
  { id: 'individuals_lte', label: 'صافي الأفراد أصغر أو يساوي (≤)' },
  { id: 'matched_existing', label: 'مطابق لسجل موجود في النظام' },
  { id: 'unmatched_new', label: 'سجل جديد غير موجود في النظام' },
];

interface DestinationSlotEditorProps {
  label: string;
  spec: QuickExtractDestinationSpec;
  agencies: Agency[];
  readyLists: ReadyList[];
  allowPerSlotStrategy?: boolean;
  defaultStrategy?: QuickExtractMergeStrategy;
  onChange: (next: QuickExtractDestinationSpec) => void;
}

const DestinationSlotEditor: React.FC<DestinationSlotEditorProps> = ({
  label,
  spec,
  agencies,
  readyLists,
  allowPerSlotStrategy = false,
  defaultStrategy = 'update_matched',
  onChange,
}) => {
  const effectiveStrategy = spec.mergeStrategy || defaultStrategy;

  return (
    <div
      className="space-y-2.5 rounded-xl border p-3.5 text-xs"
      style={{
        backgroundColor: 'var(--bg-main)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="font-bold" style={{ color: 'var(--accent)' }}>
        {label}
      </div>

      <div
        className={`grid grid-cols-1 gap-2 ${
          allowPerSlotStrategy ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
        }`}
      >
        <div>
          <label className="mb-1 block font-semibold">نوع الوجهة</label>
          <select
            aria-label={`${label} - نوع الوجهة`}
            value={spec.kind}
            onChange={(e) => {
              const nextKind = e.target
                .value as QuickExtractDestinationSpec['kind'];
              onChange({
                ...spec,
                kind: nextKind,
                existingReadyListId:
                  nextKind === 'existing_ready_list'
                    ? spec.existingReadyListId || readyLists[0]?.id
                    : spec.existingReadyListId,
              });
            }}
            className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <option value="agency">وكالة محددة</option>
            <option value="existing_ready_list">قائمة جاهزة محددة (موجودة)</option>
            <option value="ready_list">إنشاء قائمة جاهزة جديدة</option>
            <option value="master_roster">السجل الشامل (جميع الوكالات)</option>
          </select>
        </div>

        {spec.kind === 'existing_ready_list' && (
          <div>
            <label className="mb-1 block font-semibold">
              اختر القائمة الجاهزة
            </label>
            {readyLists.length === 0 ? (
              <div
                className="rounded-lg border px-2.5 py-1.5 text-[11px]"
                style={{
                  backgroundColor: 'var(--warning-bg)',
                  borderColor: 'var(--warning)',
                  color: 'var(--warning)',
                }}
              >
                لا توجد قوائم بعد — اختر «إنشاء قائمة جديدة».
              </div>
            ) : (
              <select
                aria-label={`${label} - القائمة المختارة`}
                value={spec.existingReadyListId || readyLists[0]?.id || ''}
                onChange={(e) =>
                  onChange({
                    ...spec,
                    existingReadyListId: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {readyLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({list.listDate})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {(spec.kind === 'agency' || spec.kind === 'ready_list') && (
          <div>
            <label className="mb-1 block font-semibold">
              {spec.kind === 'agency'
                ? 'الوكالة المستهدفة'
                : 'الوكالة المرتبطة بالقائمة'}
            </label>
            <select
              aria-label={`${label} - الوكالة`}
              value={spec.agencyId}
              onChange={(e) =>
                onChange({ ...spec, agencyId: Number(e.target.value) })
              }
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.icon} {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {allowPerSlotStrategy && (
          <div>
            <label className="mb-1 block font-semibold">خيار التنفيذ</label>
            <select
              aria-label={`${label} - خيار التنفيذ`}
              value={effectiveStrategy}
              onChange={(e) =>
                onChange({
                  ...spec,
                  mergeStrategy: e.target.value as QuickExtractMergeStrategy,
                })
              }
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-bold"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <option value="update_matched">تحديث المطابق + إضافة الجديد</option>
              <option value="add_new">إضافة كسجلات جديدة</option>
              <option value="replace">استبدال سجلات الوجهة</option>
            </select>
          </div>
        )}
      </div>

      {spec.kind === 'ready_list' && (
        <div
          className="grid grid-cols-1 gap-2 border-t pt-2.5 sm:grid-cols-2"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div>
            <label className="mb-1 block font-semibold">عنوان القائمة الجديدة</label>
            <input
              type="text"
              value={spec.readyListMeta.name}
              onChange={(e) =>
                onChange({
                  ...spec,
                  readyListMeta: { ...spec.readyListMeta, name: e.target.value },
                })
              }
              placeholder="مثال: كشف الإضافات — خط التوصيل 1"
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold">التاريخ</label>
            <input
              type="date"
              value={spec.readyListMeta.listDate}
              onChange={(e) =>
                onChange({
                  ...spec,
                  readyListMeta: {
                    ...spec.readyListMeta,
                    listDate: e.target.value,
                  },
                })
              }
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold">العنوان الفرعي الأول</label>
            <input
              type="text"
              value={spec.readyListMeta.subtitle1}
              onChange={(e) =>
                onChange({
                  ...spec,
                  readyListMeta: {
                    ...spec.readyListMeta,
                    subtitle1: e.target.value,
                  },
                })
              }
              placeholder="مثال: الوكالة / المنطقة"
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold">العنوان الفرعي الثاني</label>
            <input
              type="text"
              value={spec.readyListMeta.subtitle2}
              onChange={(e) =>
                onChange({
                  ...spec,
                  readyListMeta: {
                    ...spec.readyListMeta,
                    subtitle2: e.target.value,
                  },
                })
              }
              placeholder="مثال: اسم الموزع / ملاحظة الدفتر"
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface RoutingPanelProps {
  routing: QuickExtractRoutingConfig;
  agencies: Agency[];
  readyLists: ReadyList[];
  planCounts: { add: number; update: number; replace: number; skip: number };
  onChange: (next: QuickExtractRoutingConfig) => void;
}

export const RoutingPanel: React.FC<RoutingPanelProps> = ({
  routing,
  agencies,
  readyLists,
  planCounts,
  onChange,
}) => {
  const customRules = routing.customRules || [];
  const defaultAgencyId = agencies[0]?.id || 1;
  const secondAgencyId = agencies[1]?.id || defaultAgencyId;
  const today = new Date().toISOString().slice(0, 10);

  const createBlankRule = (
    condition: QuickExtractRuleCondition = 'has_addition'
  ): QuickExtractRoutingRule => ({
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    enabled: true,
    label:
      condition === 'has_addition'
        ? 'إرسال سجلات الإضافة إلى قائمة محددة'
        : 'قاعدة توزيع مخصصة',
    condition,
    textValue: '',
    numberValue: 5,
    mergeStrategy: 'add_new',
    destination: {
      kind: readyLists.length > 0 ? 'existing_ready_list' : 'ready_list',
      agencyId: defaultAgencyId,
      existingReadyListId: readyLists[0]?.id,
      readyListMeta: {
        name: `كشف الإضافات المستخرجة — ${today}`,
        listDate: today,
        subtitle1: 'توجيه تلقائي للسجلات المضافة',
        subtitle2: 'مراجعة السحب السريع',
        autoUpdateDate: false,
      },
    },
  });

  const handleAddRule = () => {
    onChange({
      ...routing,
      mode: 'custom_rules',
      customRules: [...customRules, createBlankRule('has_addition')],
    });
  };

  const handleApplySplitPreset = () => {
    const presetRule = createBlankRule('has_addition');
    onChange({
      ...routing,
      mode: 'custom_rules',
      customRules: [presetRule],
      primaryDestination: {
        ...routing.primaryDestination,
        kind: 'agency',
        agencyId: secondAgencyId,
        mergeStrategy: 'update_matched',
      },
    });
  };

  const updateRule = (
    ruleId: string,
    patch: Partial<QuickExtractRoutingRule>
  ) => {
    onChange({
      ...routing,
      customRules: customRules.map((r) =>
        r.id === ruleId ? { ...r, ...patch } : r
      ),
    });
  };

  const removeRule = (ruleId: string) => {
    onChange({
      ...routing,
      customRules: customRules.filter((r) => r.id !== ruleId),
    });
  };

  const overrideCount = Object.keys(routing.rowOverrides || {}).length;

  return (
    <div
      className="space-y-3 rounded-xl border p-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitFork className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <div>
            <h3 className="text-sm font-bold">
              لوحة التوجيه والترحيل النهائي الديناميكية
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              وزّع الصفوف ديناميكيًا على قوائم أو وكالات محددة مع اختيار (تحديث، إضافة، أو استبدال) قبل التنفيذ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div
            className="flex flex-wrap items-center gap-1 rounded-lg border p-1"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => onChange({ ...routing, mode: 'single' })}
              className="rounded-md px-3 py-1 font-bold whitespace-nowrap"
              style={{
                backgroundColor:
                  routing.mode === 'single' ? 'var(--accent)' : 'transparent',
                color:
                  routing.mode === 'single'
                    ? 'var(--accent-fg)'
                    : 'var(--text-primary)',
              }}
            >
              وجهة واحدة للجميع
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...routing, mode: 'split_by_change' })}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1 font-bold whitespace-nowrap"
              style={{
                backgroundColor:
                  routing.mode === 'split_by_change'
                    ? 'var(--accent)'
                    : 'transparent',
                color:
                  routing.mode === 'split_by_change'
                    ? 'var(--accent-fg)'
                    : 'var(--text-primary)',
              }}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>تقسيم وتوجيه تلقائي حسب الحالة</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...routing,
                  mode: 'custom_rules',
                  customRules:
                    customRules.length > 0
                      ? customRules
                      : [createBlankRule('has_addition')],
                })
              }
              className="inline-flex items-center gap-1 rounded-md px-3 py-1 font-bold whitespace-nowrap"
              style={{
                backgroundColor:
                  routing.mode === 'custom_rules'
                    ? 'var(--accent)'
                    : 'transparent',
                color:
                  routing.mode === 'custom_rules'
                    ? 'var(--accent-fg)'
                    : 'var(--text-primary)',
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>قواعد توزيع ديناميكية</span>
            </button>
          </div>

          <select
            aria-label="استراتيجية الدمج الافتراضية"
            value={routing.mergeStrategy}
            onChange={(e) =>
              onChange({
                ...routing,
                mergeStrategy: e.target.value as QuickExtractMergeStrategy,
              })
            }
            className="rounded-lg border px-3 py-1.5 font-bold"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <option value="update_matched">
              الافتراضي: تحديث المطابق + إضافة الجديد
            </option>
            <option value="add_new">الافتراضي: إضافة الجميع كسجلات جديدة</option>
            <option value="replace">الافتراضي: استبدال سجلات الوجهة</option>
          </select>
        </div>
      </div>

      {routing.mode === 'single' && (
        <DestinationSlotEditor
          label="الوجهة الموحدة لجميع الصفوف المحددة"
          spec={routing.primaryDestination}
          agencies={agencies}
          readyLists={readyLists}
          onChange={(primaryDestination) =>
            onChange({ ...routing, primaryDestination })
          }
        />
      )}

      {routing.mode === 'split_by_change' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <DestinationSlotEditor
            label="1. صفوف الإضافات الجديدة (إضافة > 0)"
            spec={routing.additionsDestination}
            agencies={agencies}
            readyLists={readyLists}
            allowPerSlotStrategy
            defaultStrategy={routing.mergeStrategy}
            onChange={(additionsDestination) =>
              onChange({ ...routing, additionsDestination })
            }
          />
          <DestinationSlotEditor
            label="2. صفوف النزول / النقصان / الحذف"
            spec={routing.decreasesDestination}
            agencies={agencies}
            readyLists={readyLists}
            allowPerSlotStrategy
            defaultStrategy={routing.mergeStrategy}
            onChange={(decreasesDestination) =>
              onChange({ ...routing, decreasesDestination })
            }
          />
          <DestinationSlotEditor
            label="3. بقية الصفوف المستقرة"
            spec={routing.primaryDestination}
            agencies={agencies}
            readyLists={readyLists}
            allowPerSlotStrategy
            defaultStrategy={routing.mergeStrategy}
            onChange={(primaryDestination) =>
              onChange({ ...routing, primaryDestination })
            }
          />
        </div>
      )}

      {routing.mode === 'custom_rules' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddRule}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة قاعدة توزيع جديدة</span>
              </button>

              <button
                type="button"
                onClick={handleApplySplitPreset}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>قالب سريع: «إضافة» ← قائمة محددة والبقية ← وكالة أخرى</span>
              </button>
            </div>

            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              تُطبّق القواعد بالترتيب من الأعلى للأسفل
            </span>
          </div>

          <div className="space-y-2.5">
            {customRules.map((rule, idx) => (
              <div
                key={rule.id}
                className="space-y-2.5 rounded-xl border p-3.5 text-xs"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: rule.enabled
                    ? 'var(--accent)'
                    : 'var(--border-color)',
                  opacity: rule.enabled ? 1 : 0.65,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`تفعيل القاعدة ${idx + 1}`}
                      checked={rule.enabled}
                      onChange={(e) =>
                        updateRule(rule.id, { enabled: e.target.checked })
                      }
                    />
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>
                      قاعدة #{idx + 1}:
                    </span>
                    <input
                      type="text"
                      value={rule.label}
                      onChange={(e) =>
                        updateRule(rule.id, { label: e.target.value })
                      }
                      placeholder="وصف مختصر للقاعدة..."
                      className="w-56 rounded-md border px-2 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRule(rule.id)}
                    aria-label={`حذف القاعدة ${idx + 1}`}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold"
                    style={{
                      borderColor: 'var(--danger)',
                      color: 'var(--danger)',
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>حذف</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block font-semibold">شرط السجل</label>
                    <select
                      aria-label={`شرط القاعدة ${idx + 1}`}
                      value={rule.condition}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          condition: e.target.value as QuickExtractRuleCondition,
                        })
                      }
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {CONDITION_LABELS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {rule.condition === 'name_contains' && (
                    <div>
                      <label className="mb-1 block font-semibold">
                        النص المطلوب في الاسم
                      </label>
                      <input
                        type="text"
                        value={rule.textValue || ''}
                        onChange={(e) =>
                          updateRule(rule.id, { textValue: e.target.value })
                        }
                        placeholder="مثال: الساعدي"
                        className="w-full rounded-lg border px-2.5 py-1.5 text-xs"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                  )}

                  {(rule.condition === 'individuals_gte' ||
                    rule.condition === 'individuals_lte') && (
                    <div>
                      <label className="mb-1 block font-semibold">
                        العدد المرجعي (الأفراد)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={rule.numberValue ?? 0}
                        onChange={(e) =>
                          updateRule(rule.id, {
                            numberValue: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-full rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block font-semibold">
                      إجراء الدمج لهذه القاعدة
                    </label>
                    <select
                      aria-label={`إجراء القاعدة ${idx + 1}`}
                      value={rule.mergeStrategy}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          mergeStrategy: e.target
                            .value as QuickExtractMergeStrategy,
                        })
                      }
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                      style={{
                        backgroundColor: 'var(--bg-nav-active)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                      }}
                    >
                      <option value="add_new">إضافة كسجلات جديدة</option>
                      <option value="update_matched">
                        تحديث المطابق + إضافة الجديد
                      </option>
                      <option value="replace">استبدال سجلات الوجهة</option>
                    </select>
                  </div>
                </div>

                <DestinationSlotEditor
                  label={`وجهة القاعدة #${idx + 1}`}
                  spec={rule.destination}
                  agencies={agencies}
                  readyLists={readyLists}
                  onChange={(destination) =>
                    updateRule(rule.id, { destination })
                  }
                />
              </div>
            ))}
          </div>

          <DestinationSlotEditor
            label="بقية السجلات (التي لا تطابق أي قاعدة أعلاه)"
            spec={routing.primaryDestination}
            agencies={agencies}
            readyLists={readyLists}
            allowPerSlotStrategy
            defaultStrategy={routing.mergeStrategy}
            onChange={(primaryDestination) =>
              onChange({ ...routing, primaryDestination })
            }
          />
        </div>
      )}

      <div
        className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold tabular-nums"
        style={{ color: 'var(--text-muted)' }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span>ملخص خطة الترحيل الحالية:</span>
          <span style={{ color: 'var(--success)' }}>
            إضافة جديدة: {planCounts.add}
          </span>
          <span style={{ color: 'var(--warning)' }}>
            تحديث موجود: {planCounts.update}
          </span>
          {planCounts.replace > 0 && (
            <span style={{ color: 'var(--danger)' }}>
              استبدال: {planCounts.replace}
            </span>
          )}
          {planCounts.skip > 0 && (
            <span style={{ color: 'var(--text-muted)' }}>
              مستبعد: {planCounts.skip}
            </span>
          )}
        </div>

        {overrideCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...routing, rowOverrides: {} })}
            className="rounded-md border px-2.5 py-1 text-[11px] font-bold"
            style={{ borderColor: 'var(--border-color)' }}
          >
            إعادة تعيين التخصيصات الفردية ({overrideCount})
          </button>
        )}
      </div>
    </div>
  );
};

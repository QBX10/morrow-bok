import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Flag,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import type { FeatureFlagsMap } from '../../types/agency';
import {
  flattenCosmosNodes,
  LEGACY_KEY_MAP,
  validateRegistryGovernance,
  verifyLegacyCoverage,
  type CosmosNode,
} from '../../utils/cosmosRegistry';

interface RegistryInspectorProps {
  root: CosmosNode;
  featureFlags: FeatureFlagsMap;
  onUpdateFeatureFlags: (patch: Partial<FeatureFlagsMap>) => void;
  onOpenNode?: (node: CosmosNode) => void;
}

const FLAG_META: Array<{
  key: keyof FeatureFlagsMap;
  title: string;
  desc: string;
}> = [
  {
    key: 'orbitalMapView',
    title: 'الخريطة التفاعلية للأقسام',
    desc: 'إتاحة عرض الأقسام كخريطة تفاعلية بجانب القائمة الشجرية.',
  },
  {
    key: 'smartUsageSuggestions',
    title: 'الاقتراحات الذكية للاستخدام المحلي',
    desc: 'تحليل محلي فقط (بدون رفع سحابي) لاقتراح تثبيت العناصر المتكررة.',
  },
  {
    key: 'longPressPeek',
    title: 'معاينة الضغط المطوّل (Peek)',
    desc: 'إظهار قائمة اختصارات سريعة عند الضغط المطوّل على الإعدادات.',
  },
  {
    key: 'safeTrialTenSeconds',
    title: 'التجربة الآمنة لمدة 10 ثوانٍ',
    desc: 'تجربة التعديلات الحساسة مع رجوع تلقائي إذا لم تُثبّت.',
  },
  {
    key: 'voiceCommandsIq',
    title: 'الأوامر الصوتية (اللهجة العراقية)',
    desc: 'دعم الميكروفون المباشر باللهجة العراقية داخل Morrow AI.',
  },
  {
    key: 'tactileAudioCues',
    title: 'التغذية اللمسية والصوتية الاختيارية',
    desc: 'تفعيل الاهتزاز اللطيف والنغمة الخفيفة عند التفاعل.',
  },
];

export const RegistryInspector: React.FC<RegistryInspectorProps> = ({
  root,
  featureFlags,
  onUpdateFeatureFlags,
  onOpenNode,
}) => {
  const governance = useMemo(() => validateRegistryGovernance(root), [root]);
  const legacy = useMemo(() => verifyLegacyCoverage(root), [root]);
  const allNodes = useMemo(() => flattenCosmosNodes(root), [root]);

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div
        className="cosmos-glass-panel border p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-3"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            الأقسام الرئيسية والفرعية
          </p>
          <p className="text-lg font-extrabold tabular-nums">
            {governance.worldCount} قسم · {governance.galaxyCount} فرعي
          </p>
        </div>
        <div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            إجمالي الأدوات
          </p>
          <p className="text-lg font-extrabold tabular-nums">
            {governance.capsuleCount} أداة
          </p>
        </div>
        <div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            تغطية المفاتيح القديمة
          </p>
          <p
            className="text-lg font-extrabold tabular-nums flex items-center gap-1"
            style={{ color: legacy.passed ? 'var(--success)' : 'var(--danger)' }}
          >
            {legacy.passed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <span>{legacy.totalLegacyKeys} / {LEGACY_KEY_MAP.length}</span>
          </p>
        </div>
        <div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            الحوكمة ومنع الازدحام
          </p>
          <p
            className="text-lg font-extrabold flex items-center gap-1"
            style={{ color: governance.passed ? 'var(--success)' : 'var(--warning)' }}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{governance.passed ? 'سليم 100%' : `${governance.violations.length} تنبيه`}</span>
          </p>
        </div>
      </div>

      {/* Feature Flags */}
      <div
        className="rounded-[20px] border p-4 space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <h4 className="text-sm font-extrabold">أعلام الميزات التجريبية (Feature Flags)</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {FLAG_META.map((f) => {
            const active = Boolean(featureFlags[f.key]);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onUpdateFeatureFlags({ [f.key]: !active })}
                className="flex items-start justify-between gap-3 rounded-xl border p-3 text-right hover:border-[var(--accent)]"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                }}
              >
                <div className="min-w-0">
                  <div className="text-xs font-extrabold">{f.title}</div>
                  <div
                    className="text-[11px] mt-0.5 leading-relaxed"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {f.desc}
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold"
                  style={
                    active
                      ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
                      : { backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }
                  }
                >
                  {active ? 'مفعّل' : 'معطّل'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legacy Guard & Frozen Zone Status */}
      <div
        className="rounded-[20px] border p-4 space-y-2.5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h4 className="text-sm font-extrabold">
              حارس عدم الحذف والمناطق المحمية ({legacy.protectedZonesCount} نطاق محمي)
            </h4>
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {allNodes.length} عقدة مسجلة
          </span>
        </div>

        {governance.violations.length > 0 && (
          <div
            className="rounded-xl border p-3 text-xs space-y-1"
            style={{ backgroundColor: 'var(--warning-bg)', borderColor: 'var(--warning)' }}
          >
            {governance.violations.map((v, i) => (
              <div key={i}>• {v.message}</div>
            ))}
          </div>
        )}

        <div className="max-h-56 overflow-y-auto divide-y text-xs" style={{ borderColor: 'var(--border-color)' }}>
          {LEGACY_KEY_MAP.slice(0, 20).map((entry) => (
            <div
              key={entry.legacyKey}
              className="flex items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0">
                <span className="font-bold">{entry.label}</span>
                <span
                  dir="ltr"
                  className="mx-2 text-[10px] font-data"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {entry.legacyKey}
                </span>
              </div>
              {onOpenNode && (
                <button
                  type="button"
                  onClick={() => {
                    const hit = allNodes.find((n) => n.id === entry.nodeId);
                    if (hit) onOpenNode(hit);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold shrink-0"
                  style={{ color: 'var(--accent)' }}
                >
                  <Layers className="h-3 w-3" />
                  <span>فتح</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

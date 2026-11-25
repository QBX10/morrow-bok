import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  Archive,
  CheckCircle2,
  Compass,
  FlaskConical,
  Hand,
  Layers,
  Lock,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  Zap,
} from 'lucide-react';
import type {
  AccessibilityAndExperiencePrefs,
  Agency,
  AgencyExpense,
  AppDatabaseState,
  CalculationSettings,
  CardShadowLevel,
  CustomThemePreset,
  FeatureFlagsMap,
  MigrationSnapshotRecord,
  Person,
  ThemeColorMode,
  ThemePreferences,
  WorkspaceCosmosState,
} from '../../types/agency';
import {
  auditAgencyPersons,
  calculateAllocation,
  computeAgencyMetrics,
  formatIqd,
} from '../../utils/agencyLogic';
import {
  LEGACY_KEY_MAP,
  type CosmosNode,
} from '../../utils/cosmosRegistry';
import {
  formatCosmosDate,
  formatCosmosNumerals,
  getAppThemeById,
  MARINE_THEMES,
} from '../../utils/themes';
import {
  playTactileFeedback,
  resetAppSoundPrefs,
  setGlobalAppSoundEnabled,
} from '../../utils/tactileFeedback';
import {
  getBackgroundMusicSnapshot,
  setBackgroundMusicPaused,
  setBackgroundMusicSmartMode,
  setBackgroundMusicVolume,
  subscribeBackgroundMusic,
} from '../../utils/backgroundMusicEngine';
import { updateServerSoundSetting } from '../../utils/intelligentAmbience';
import {
  TABRIX_TACTILE_SPRING,
  useTabrixReducedMotion,
} from '../../utils/tabrixMotion';
import {
  MotionSurfaceCard,
  TabrixSubViewTransition,
} from '../ui/TabrixMotionPrimitives';
import { LiveStage } from '../cosmos/LiveStage';
import { RegistryInspector } from '../cosmos/RegistryInspector';
import { ResultCard } from '../cosmos/ResultCard';
import { SettingRow } from '../cosmos/SettingRow';
import { SoundCustomizationPanel } from '../settings/SoundCustomizationPanel';

/* ─── 1. Calm 2D Identity Themes Panel ─── */
interface CustomThemeStudioPanelProps {
  themePrefs: ThemePreferences;
  accessibility: AccessibilityAndExperiencePrefs;
  onUpdateThemePrefs: (patch: Partial<ThemePreferences>) => void;
  onSaveCustomTheme: (preset: Omit<CustomThemePreset, 'id' | 'createdAt'>) => void;
  onDeleteCustomTheme: (id: string) => void;
  onNotify: (msg: string) => void;
}

export const CustomThemeStudioPanel: React.FC<CustomThemeStudioPanelProps> = ({
  themePrefs,
  accessibility,
  onUpdateThemePrefs,
  onNotify,
}) => {
  const activeTheme = getAppThemeById(themePrefs.appTheme);
  const reducedMotion = useTabrixReducedMotion();
  return (
    <div className="space-y-4">
      <LiveStage
        title={`الثيمات البحرية المطلقة — ${activeTheme.name}`}
        subtitle={activeTheme.description}
        accentColor={activeTheme.vars['--accent']}
      >
        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{
            backgroundColor: activeTheme.vars['--bg-main'],
            color: activeTheme.vars['--text-primary'],
            borderColor: activeTheme.vars['--border-color'],
            borderRadius: `${themePrefs.borderRadiusPx ?? 22}px`,
          }}
        >
          <div className="text-sm font-extrabold" style={{ color: activeTheme.vars['--accent-bright'] }}>
            Morrow 2D Edition · {activeTheme.englishName}
          </div>
          <div className="text-xs" style={{ color: activeTheme.vars['--text-muted'] }}>
            رسم الفرد: {formatCosmosNumerals('250', accessibility.numeralSystem)} د.ع · شفافية زجاجية {themePrefs.glassOpacityPct ?? 70}%
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {MARINE_THEMES.map((theme) => {
              const selected = theme.id === activeTheme.id;
              return (
                <motion.button
                  key={theme.id}
                  type="button"
                  whileHover={reducedMotion ? undefined : { y: -3, scale: 1.02 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  transition={TABRIX_TACTILE_SPRING}
                  onClick={() => {
                    onUpdateThemePrefs({ appTheme: theme.id });
                    onNotify(`تم تفعيل الثيم البحري "${theme.name}".`);
                  }}
                  className="rounded-xl border px-2.5 py-2 text-right transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.vars['--bg-surface'],
                    borderColor: selected ? theme.vars['--accent'] : theme.vars['--border-color'],
                    color: theme.vars['--text-primary'],
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold truncate">{theme.name}</span>
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: theme.vars['--accent'] }}
                    />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </LiveStage>
    </div>
  );
};

/* ─── 2. Accessibility, Numerals, Calendar & One-Handed Panel ─── */
interface AccessibilityCosmosPanelProps {
  accessibility: AccessibilityAndExperiencePrefs;
  onUpdateAccessibility: (patch: Partial<AccessibilityAndExperiencePrefs>) => void;
  onNotify: (msg: string) => void;
}

export const AccessibilityCosmosPanel: React.FC<AccessibilityCosmosPanelProps> = ({
  accessibility,
  onUpdateAccessibility,
  onNotify,
}) => {
  const musicSnap = useSyncExternalStore(
    subscribeBackgroundMusic,
    getBackgroundMusicSnapshot,
    getBackgroundMusicSnapshot
  );

  const sampleDate = formatCosmosDate(
    new Date(),
    accessibility.calendarSystem,
    accessibility.numeralSystem
  );
  const sampleMoney = formatCosmosNumerals('1,250 د.ع', accessibility.numeralSystem);

  return (
    <div className="space-y-3">
      <LiveStage
        title="معاينة الترقيم والتقويم والحركة"
        subtitle="تحديث مباشر للغة الأرقام والتقويم الهجري/الميلادي"
        accentColor="#ec4899"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-extrabold">
          <span>تاريخ اليوم: {sampleDate}</span>
          <span style={{ color: 'var(--accent)' }}>نموذج مبلغ: {sampleMoney}</span>
          <span>
            وضع التصفح: {accessibility.oneHandedMode ? 'يد واحدة (منخفض)' : 'كامل الشاشة'}
          </span>
        </div>
      </LiveStage>

      <SettingRow
        id="acc_numeral_system"
        title="نظام الأرقام (عربية / هندية)"
        description="التبديل بين الأرقام الغربية (123) والأرقام الهندية الشرقية (١٢٣)"
        icon="type"
        currentValueLabel={accessibility.numeralSystem === 'hindi' ? 'هندية ١٢٣' : 'غربية 123'}
        isModified={accessibility.numeralSystem !== 'western'}
        onResetSingle={() => onUpdateAccessibility({ numeralSystem: 'western' })}
      >
        <div className="inline-flex rounded-xl border p-1 text-xs" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
          <button
            type="button"
            onClick={() => onUpdateAccessibility({ numeralSystem: 'western' })}
            className="rounded-lg px-2.5 py-1.5 font-bold"
            style={
              accessibility.numeralSystem === 'western'
                ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
                : { color: 'var(--text-muted)' }
            }
          >
            123
          </button>
          <button
            type="button"
            onClick={() => onUpdateAccessibility({ numeralSystem: 'hindi' })}
            className="rounded-lg px-2.5 py-1.5 font-bold"
            style={
              accessibility.numeralSystem === 'hindi'
                ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
                : { color: 'var(--text-muted)' }
            }
          >
            ١٢٣
          </button>
        </div>
      </SettingRow>

      <SettingRow
        id="acc_calendar_system"
        title="التقويم المعتمد في الواجهات"
        description="عرض التواريخ والدورات بالتقويم الميلادي أو الهجري (أم القرى)"
        icon="calendar"
        currentValueLabel={accessibility.calendarSystem === 'hijri' ? 'هجري' : 'ميلادي'}
        isModified={accessibility.calendarSystem !== 'gregorian'}
        onResetSingle={() => onUpdateAccessibility({ calendarSystem: 'gregorian' })}
      >
        <div className="inline-flex rounded-xl border p-1 text-xs" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
          <button
            type="button"
            onClick={() => onUpdateAccessibility({ calendarSystem: 'gregorian' })}
            className="rounded-lg px-2.5 py-1.5 font-bold"
            style={
              accessibility.calendarSystem === 'gregorian'
                ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
                : { color: 'var(--text-muted)' }
            }
          >
            ميلادي
          </button>
          <button
            type="button"
            onClick={() => onUpdateAccessibility({ calendarSystem: 'hijri' })}
            className="rounded-lg px-2.5 py-1.5 font-bold"
            style={
              accessibility.calendarSystem === 'hijri'
                ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
                : { color: 'var(--text-muted)' }
            }
          >
            هجري
          </button>
        </div>
      </SettingRow>

      <SettingRow
        id="acc_reduce_motion"
        title="تقليل الحركة والتأثيرات الانتقالية"
        description="يعطّل الحركات السريعة لراحة العين والحفاظ على البطارية"
        icon="eye"
        isModified={accessibility.reduceMotion}
        onResetSingle={() => onUpdateAccessibility({ reduceMotion: false })}
      >
        <button
          type="button"
          onClick={() =>
            onUpdateAccessibility({ reduceMotion: !accessibility.reduceMotion })
          }
          className="cosmos-touch-target w-full rounded-xl px-3.5 text-xs font-extrabold"
          style={
            accessibility.reduceMotion
              ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
              : { backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }
          }
        >
          {accessibility.reduceMotion ? 'مفعّل' : 'متوقف'}
        </button>
      </SettingRow>

      <SettingRow
        id="acc_one_handed"
        title="وضع اليد الواحدة (الجوال)"
        description="ينزل المحتوى التفاعلي في الأقسام إلى نطاق وصول الإبهام"
        icon="sliders"
        isModified={accessibility.oneHandedMode}
        onResetSingle={() => onUpdateAccessibility({ oneHandedMode: false })}
      >
        <button
          type="button"
          onClick={() =>
            onUpdateAccessibility({ oneHandedMode: !accessibility.oneHandedMode })
          }
          className="cosmos-touch-target inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-extrabold"
          style={
            accessibility.oneHandedMode
              ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
              : { backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }
          }
        >
          <Hand className="h-3.5 w-3.5" />
          <span>{accessibility.oneHandedMode ? 'مفعّل' : 'عادي'}</span>
        </button>
      </SettingRow>

      <SettingRow
        id="acc_tactile"
        title="منظومة الصوت والوضع الذكي · صوت التطبيق الخلفي"
        description="صوت نظام مدمج بالخلفية (وليس مشغل موسيقى) مع منظومة أصوات تفاعلية متكاملة تتوقف تلقائياً عند الخروج أو الكاميرا أو الاتصال أو التسجيل وتعود فور الانتهاء"
        icon="bell"
        isModified={!accessibility.soundFeedback || musicSnap.userPaused || !musicSnap.smartModeEnabled}
        onResetSingle={() => {
          onUpdateAccessibility({ hapticFeedback: true, soundFeedback: true });
          setGlobalAppSoundEnabled(true);
          setBackgroundMusicSmartMode(true);
          setBackgroundMusicPaused(false);
          setBackgroundMusicVolume(0.27);
          resetAppSoundPrefs();
          void updateServerSoundSetting(true, 0.27);
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextSmart = !musicSnap.smartModeEnabled;
              setBackgroundMusicSmartMode(nextSmart);
              onNotify(
                nextSmart
                  ? 'تم تفعيل الوضع الذكي لصوت التطبيق (يتوقف تلقائياً عند الخروج والكاميرا والاتصال والتسجيل).'
                  : 'تم إيقاف الوضع الذكي المؤقت لصوت التطبيق.'
              );
            }}
            className="cosmos-touch-target rounded-xl border px-2.5 text-[11px] font-bold"
            style={
              musicSnap.smartModeEnabled
                ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' }
                : { backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }
            }
          >
            {musicSnap.smartModeEnabled ? 'الوضع الذكي مفعّل' : 'الوضع الذكي متوقف'}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateAccessibility({ hapticFeedback: !accessibility.hapticFeedback })
            }
            className="cosmos-touch-target rounded-xl border px-2.5 text-[11px] font-bold"
            style={
              accessibility.hapticFeedback
                ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' }
                : { backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }
            }
          >
            اهتزاز
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !accessibility.soundFeedback;
              onUpdateAccessibility({ soundFeedback: next });
              setGlobalAppSoundEnabled(next);
              setBackgroundMusicPaused(!next);
              void updateServerSoundSetting(next, musicSnap.volume);
              if (next) {
                playTactileFeedback('save_complete', { sound: true, haptic: false });
              }
              onNotify(
                next
                  ? 'تم تفعيل صوت التطبيق الخلفي ومنظومة الأصوات التفاعلية.'
                  : 'تم كتم أصوات التطبيق بنجاح.'
              );
            }}
            className="cosmos-touch-target inline-flex items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold"
            style={
              accessibility.soundFeedback
                ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' }
                : { backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }
            }
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>{accessibility.soundFeedback ? 'الصوت مفعّل' : 'مكتوم'}</span>
          </button>
          <div className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(musicSnap.volume * 100)}
              onChange={(e) => {
                const nextVol = Number(e.target.value) / 100;
                setBackgroundMusicVolume(nextVol);
                void updateServerSoundSetting(accessibility.soundFeedback, nextVol);
              }}
              aria-label="مستوى صوت التطبيق الخلفي"
              className="h-1.5 w-20 cursor-pointer accent-[var(--accent)]"
            />
            <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {Math.round(musicSnap.volume * 100)}%
            </span>
          </div>
        </div>
      </SettingRow>

      <SoundCustomizationPanel onNotify={onNotify} />

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            onUpdateAccessibility({ onboardingCompleted: false });
            onNotify('سيظهر الدليل التعريفي السريع في المركز الرئيسي عند العودة.');
          }}
          className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-extrabold"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
        >
          <Compass className="h-4 w-4" />
          <span>إعادة عرض الجولة التعريفية السريعة</span>
        </button>
      </div>
    </div>
  );
};

/* ─── 3. Executive KPI, Data Health & Governance Panel ─── */
interface HealthAndKpiPanelProps {
  tab: 'kpi' | 'health' | 'inspector';
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  calculationSettings: CalculationSettings;
  rootCosmos: CosmosNode;
  featureFlags: FeatureFlagsMap;
  onUpdateFeatureFlags: (patch: Partial<FeatureFlagsMap>) => void;
  onRunAutoFix: () => { fixedCount: number; summaryLines: string[] };
  onOpenNode: (node: CosmosNode) => void;
  onNotify: (msg: string) => void;
}

export const HealthAndKpiPanel: React.FC<HealthAndKpiPanelProps> = ({
  tab,
  agencies,
  persons,
  expenses,
  calculationSettings,
  rootCosmos,
  featureFlags,
  onUpdateFeatureFlags,
  onRunAutoFix,
  onOpenNode,
  onNotify,
}) => {
  const metrics = useMemo(
    () => computeAgencyMetrics(persons, expenses, calculationSettings),
    [persons, expenses, calculationSettings]
  );

  const issues = useMemo(() => auditAgencyPersons(persons), [persons]);

  const agencyBars = useMemo(() => {
    const maxInd = Math.max(
      1,
      ...agencies.map((ag) =>
        persons
          .filter((p) => p.agencyId === ag.id)
          .reduce((acc, p) => acc + (p.individuals ?? 0), 0)
      )
    );
    return agencies.map((ag) => {
      const m = computeAgencyMetrics(
        persons.filter((p) => p.agencyId === ag.id),
        expenses.filter((e) => e.agencyId === ag.id),
        calculationSettings
      );
      return {
        label: `${ag.icon} ${ag.name}`,
        value: m.activeIndividuals,
        max: maxInd,
        displayValue: `${m.activeIndividuals} فرد · ${formatIqd(m.revenue)}`,
      };
    });
  }, [agencies, persons, expenses, calculationSettings]);

  const healthScore = Math.max(25, Math.min(100, 100 - issues.length * 8));

  if (tab === 'inspector') {
    return (
      <RegistryInspector
        root={rootCosmos}
        featureFlags={featureFlags}
        onUpdateFeatureFlags={onUpdateFeatureFlags}
        onOpenNode={onOpenNode}
      />
    );
  }

  if (tab === 'health') {
    return (
      <div className="space-y-4">
        <ResultCard
          title="نتيجة فحص صحة وسلامة البيانات"
          summary={
            issues.length === 0
              ? 'جميع سجلات المستفيدين والحجب والأرقام مطابقة وسليمة 100%.'
              : `تم رصد ${issues.length} ملاحظات في التدقيق التلقائي يمكن إصلاح بعضها فوراً.`
          }
          scorePercent={healthScore}
          scoreLabel="سلامة السجل"
          tone={issues.length === 0 ? 'success' : 'warning'}
          details={
            issues.length > 0
              ? issues.slice(0, 6).map((iss) => `${iss.personName}: ${iss.message}`)
              : ['لا توجد أسماء مكررة متطابقة أو أعداد محجوبين تتجاوز حجم العائلة.']
          }
          actions={
            issues.length > 0
              ? [
                  {
                    id: 'fix_now',
                    label: 'تطبيق الإصلاح التلقائي الآمن',
                    primary: true,
                    onClick: () => {
                      const res = onRunAutoFix();
                      onNotify(
                        res.fixedCount > 0
                          ? `تم إصلاح ${res.fixedCount} حالة تلقائياً بنجاح.`
                          : 'الملاحظات المتبقية تتطلب مراجعة يدوية سريعة في الجدول.'
                      );
                    },
                  },
                ]
              : undefined
          }
        />
      </div>
    );
  }

  // KPI Dashboard
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'العوائل المستفيدة', val: `${metrics.activeHouseholds} / ${metrics.registeredHouseholds}` },
          { label: 'الأفراد النشطين', val: `${metrics.activeIndividuals} فرد` },
          {
            label: 'الحصة الإجمالية',
            val: `${metrics.fullBags} كيس${metrics.remainderKg > 0 ? ` + ${metrics.remainderKg} كغم` : ''} (${metrics.totalKg} كغم)`,
          },
          { label: 'صافي الإيراد التقديري', val: formatIqd(metrics.profit) },
        ].map((k) => (
          <MotionSurfaceCard
            key={k.label}
            className="rounded-[20px] border p-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
          >
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {k.label}
            </div>
            <div className="mt-1 text-base sm:text-lg font-extrabold tabular-nums">
              {k.val}
            </div>
          </MotionSurfaceCard>
        ))}
      </div>

      <ResultCard
        title="مؤشرات توزيع الوكالات والإيرادات"
        summary={`الإيراد الكلي ${formatIqd(metrics.revenue)} مقابل مصروفات ${formatIqd(metrics.totalExpenses)}`}
        scorePercent={healthScore}
        scoreLabel="صحة النظام"
        tone="accent"
        bars={agencyBars}
      />
    </div>
  );
};

/* ─── 4. Complete Legacy Archive & Pre-Migration Snapshot Panel ─── */
interface LegacyArchivePanelProps {
  rootCosmos: CosmosNode;
  workspaceCosmos: WorkspaceCosmosState;
  migrationSnapshot?: MigrationSnapshotRecord;
  onToggleHiddenWorld: (worldId: string) => void;
  onRestoreMigrationSnapshot: () => boolean;
  onNavigateToLegacyEntry: (nodeId: string) => void;
  onNotify: (msg: string) => void;
}

export const LegacyArchivePanel: React.FC<LegacyArchivePanelProps> = ({
  rootCosmos,
  workspaceCosmos,
  migrationSnapshot,
  onToggleHiddenWorld,
  onRestoreMigrationSnapshot,
  onNavigateToLegacyEntry,
  onNotify,
}) => {
  const [filterCat, setFilterCat] = useState<string>('all');

  const filtered = useMemo(
    () =>
      filterCat === 'all'
        ? LEGACY_KEY_MAP
        : LEGACY_KEY_MAP.filter((m) => m.category === filterCat),
    [filterCat]
  );

  const hiddenWorlds = rootCosmos.children.filter((w) =>
    workspaceCosmos.hiddenWorldIds.includes(w.worldId)
  );

  return (
    <div className="space-y-4">
      {/* Pre-migration Snapshot Box */}
      {migrationSnapshot && (
        <div
          className="rounded-[20px] border p-4 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent)',
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <ShieldCheck className="h-4 w-4" style={{ color: 'var(--success)' }} />
              <span>لقطة احتياطية قبل الترحيل (إصدار {migrationSnapshot.version})</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {migrationSnapshot.reason} · حُفظت في {migrationSnapshot.createdAt.slice(0, 10)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const ok = onRestoreMigrationSnapshot();
              onNotify(
                ok
                  ? 'تم استرجاع إعدادات الحاسبة والمظهر من لقطة ما قبل الترحيل.'
                  : 'لا توجد لقطة ترحيل سابقة.'
              );
            }}
            className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <RotateCcw className="h-4 w-4" />
            <span>استرجاع اللقطة الاحتياطية</span>
          </button>
        </div>
      )}

      {/* Hidden Worlds Recovery */}
      {hiddenWorlds.length > 0 && (
        <div
          className="rounded-[20px] border p-4 space-y-2.5"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
        >
          <h4 className="text-xs font-extrabold">أقسام مخفية من الواجهة الرئيسية ({hiddenWorlds.length})</h4>
          <div className="flex flex-wrap gap-2">
            {hiddenWorlds.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onToggleHiddenWorld(w.worldId)}
                className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-bold"
                style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
              >
                <span>إظهار: {w.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Complete Zero-Deletion Key Directory */}
      <div
        className="rounded-[20px] border p-4 space-y-3"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h4 className="text-sm font-extrabold">
              سجل الأرشيف الكامل للمفاتيح القديمة ({filtered.length})
            </h4>
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            aria-label="تصفية فئة المفاتيح القديمة"
            className="cosmos-touch-target rounded-xl border px-3 text-xs font-bold"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <option value="all">كل الفئات ({LEGACY_KEY_MAP.length})</option>
            <option value="settings_section">الأقسام الثمانية</option>
            <option value="classic_theme">الهوية البصرية البحرية (5 ثيمات)</option>
            <option value="table_theme">محركات الجداول (8)</option>
            <option value="arabic_font">الخطوط العربية (6)</option>
            <option value="calc_field">حقول الحاسبة</option>
            <option value="view_route">صفحات التطبيق</option>
          </select>
        </div>

        <TabrixSubViewTransition viewKey={filterCat}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filtered.map((item) => (
              <button
                key={item.legacyKey}
                type="button"
                onClick={() => onNavigateToLegacyEntry(item.nodeId)}
                className="flex items-center justify-between gap-2 rounded-xl border p-3 text-right hover:border-[var(--accent)]"
                style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold truncate">{item.label}</span>
                    {item.protected && (
                      <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--warning)' }} />
                    )}
                  </div>
                  <span
                    dir="ltr"
                    className="block text-[10px] font-data truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {item.legacyKey}
                  </span>
                </div>
                <span className="text-[11px] font-bold shrink-0" style={{ color: 'var(--accent)' }}>
                  انتقال
                </span>
              </button>
            ))}
          </div>
        </TabrixSubViewTransition>
      </div>
    </div>
  );
};

/* ─── 5. Calculator Presets & Before/After Compare Strip ─── */
interface CalculatorPresetsStripProps {
  currentCalc: CalculationSettings;
  savedCalc: CalculationSettings;
  agenciesCount: number;
  activePeriodLabel: string;
  onApplyPreset: (patch: Partial<CalculationSettings>, presetLabel: string) => void;
  onApplyToAllCurrent: () => void;
}

export const CalculatorPresetsStrip: React.FC<CalculatorPresetsStripProps> = ({
  currentCalc,
  savedCalc,
  agenciesCount,
  activePeriodLabel,
  onApplyPreset,
  onApplyToAllCurrent,
}) => {
  const before5 = calculateAllocation(5, savedCalc);
  const after5 = calculateAllocation(5, currentCalc);
  const changed =
    (before5?.priceIqd ?? 0) !== (after5?.priceIqd ?? 0) ||
    (before5?.totalKg ?? 0) !== (after5?.totalKg ?? 0) ||
    savedCalc.feePerIndividualIqd !== currentCalc.feePerIndividualIqd;

  return (
    <div className="space-y-3">
      {/* Presets Row */}
      <div
        className="rounded-[20px] border p-4 space-y-2.5"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <Zap className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span>قوالب الحاسبة الجاهزة بنقرة واحدة</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() =>
              onApplyPreset(
                {
                  kgPerIndividual: 9,
                  kgPerBag: 50,
                  feePerIndividualIqd: 250,
                  fixedCardFeeIqd: 250,
                  roundingStepIqd: 0,
                  discountPercent: 0,
                },
                'القياسي العراقي (رسم فرد 250)'
              )
            }
            className="cosmos-touch-target rounded-xl border p-3 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <div className="text-xs font-extrabold">القياسي التمويني (250)</div>
            <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              9 كغم · فرد 250 · بطاقة 250
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onApplyPreset(
                {
                  kgPerIndividual: 9,
                  kgPerBag: 50,
                  feePerIndividualIqd: 250,
                  fixedCardFeeIqd: 0,
                  roundingStepIqd: 0,
                },
                'رسم فرد فقط بدون رسم بطاقة'
              )
            }
            className="cosmos-touch-target rounded-xl border p-3 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <div className="text-xs font-extrabold">بدون رسم بطاقة ثابت</div>
            <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              9 كغم · فرد 250 · بطاقة 0
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onApplyPreset(
                {
                  kgPerIndividual: 9,
                  kgPerBag: 50,
                  feePerIndividualIqd: 500,
                  fixedCardFeeIqd: 250,
                  roundingStepIqd: 250,
                },
                'التقريب لأقرب 250 (فئة 500)'
              )
            }
            className="cosmos-touch-target rounded-xl border p-3 text-right hover:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)' }}
          >
            <div className="text-xs font-extrabold">رسم مزدوج مع تقريب 250</div>
            <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              فرد 500 · بطاقة 250 · تقريب 250
            </div>
          </button>
        </div>
      </div>

      {/* Before / After Comparison & Apply to Current */}
      <div
        className="rounded-[20px] border p-4 flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: changed ? 'var(--warning-bg)' : 'var(--bg-surface)',
          borderColor: changed ? 'var(--warning)' : 'var(--border-color)',
        }}
      >
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 font-extrabold">
            <FlaskConical className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <span>مقارنة قبل / بعد (نموذج 5 أفراد · {activePeriodLabel})</span>
          </div>
          <div className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
            قبل: <strong>{formatIqd(before5?.priceIqd ?? 0)}</strong> ({before5?.totalKg ?? 0} كغم)
            {'  ←  '}
            بعد: <strong style={{ color: 'var(--accent)' }}>{formatIqd(after5?.priceIqd ?? 0)}</strong> ({after5?.totalKg ?? 0} كغم)
          </div>
        </div>

        <button
          type="button"
          onClick={onApplyToAllCurrent}
          className="cosmos-touch-target inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>تطبيق على الوكالات الحالية ({agenciesCount})؟</span>
        </button>
      </div>
    </div>
  );
};

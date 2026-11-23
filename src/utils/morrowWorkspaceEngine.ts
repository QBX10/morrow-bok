import type {
  Agency,
  AgencyExpense,
  AppDatabaseState,
  CalculationSettings,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
  Person,
} from '../types/agency.ts';
import type {
  AssistantToolCall,
  MorrowAgencyForecast,
  MorrowChartSeriesItem,
  MorrowExecutiveReport,
  MorrowForecastReport,
  MorrowMacroDefinition,
  MorrowMacroExecutionResult,
  MorrowMacroStepAction,
  MorrowMacroStepTrace,
  MorrowProactiveInsight,
  MorrowSummonNavigateDecision,
  MorrowTextAnalysisResult,
  MorrowTextExtractedEntry,
} from '../types/assistant.ts';
import {
  computeAgencyMetrics,
  formatIqd,
  formatTotalQuota,
  normalizeArabic,
  type AgencyFinancialMetrics,
} from './agencyLogic.ts';
import { runAppDiagnostics } from './assistantDiagnostics.ts';
import { findKnowledgeEntry } from './assistantKnowledgeBase.ts';
import { fuzzyMatchPersons, matchAgencyInText } from './assistantOfflineBrain.ts';
import { convertArabicIndicDigits, normalizeIraqiDialect } from './assistantPrivacy.ts';

const MACROS_STORAGE_KEY = 'morrow_custom_macros_v1';

export interface IndexedWorkspaceAnalytics {
  byAgencyId: Map<
    number,
    {
      agency: Agency;
      persons: Person[];
      expenses: AgencyExpense[];
      metrics: AgencyFinancialMetrics;
    }
  >;
  totals: AgencyFinancialMetrics;
  chartSeries: MorrowChartSeriesItem[];
  blockBreakdown: {
    activeHouseholds: number;
    partialBlockedHouseholds: number;
    fullBlockedHouseholds: number;
    archivedHouseholds: number;
  };
}

/**
 * Single-pass O(N + M) indexed aggregation across all agencies, eliminating repeated
 * per-agency array `.filter()` scans in hubs, reports, and Morrow Canvas charts.
 */
export function buildIndexedWorkspaceAnalytics(
  agencies: Agency[],
  persons: Person[],
  expenses: AgencyExpense[],
  settings: CalculationSettings
): IndexedWorkspaceAnalytics {
  const personsByAgency = new Map<number, Person[]>();
  const expensesByAgency = new Map<number, AgencyExpense[]>();

  for (const ag of agencies) {
    personsByAgency.set(ag.id, []);
    expensesByAgency.set(ag.id, []);
  }

  let partialBlockedHouseholds = 0;
  let fullBlockedHouseholds = 0;
  let archivedHouseholds = 0;

  for (const p of persons) {
    const bucket = personsByAgency.get(p.agencyId);
    if (bucket) {
      bucket.push(p);
    }
    if (p.status === 'مؤرشف' || p.blockType === 'archived') {
      archivedHouseholds += 1;
    } else if (p.status === 'محجوب' || p.blockType === 'full') {
      fullBlockedHouseholds += 1;
    } else if (p.blockType === 'partial' && (p.blockedIndividuals ?? 0) > 0) {
      partialBlockedHouseholds += 1;
    }
  }

  for (const e of expenses) {
    const bucket = expensesByAgency.get(e.agencyId);
    if (bucket) {
      bucket.push(e);
    }
  }

  const byAgencyId = new Map<
    number,
    {
      agency: Agency;
      persons: Person[];
      expenses: AgencyExpense[];
      metrics: AgencyFinancialMetrics;
    }
  >();

  let totalActiveIndividuals = 0;
  let totalRegisteredHouseholds = 0;
  let totalActiveHouseholds = 0;
  let totalBlockedCount = 0;
  let totalBlockedInd = 0;
  let totalKg = 0;
  let totalRevenue = 0;
  let totalWorkerWages = 0;
  let totalGeneralExpenses = 0;

  const rawRows: Array<{ agency: Agency; metrics: AgencyFinancialMetrics }> = [];

  for (const ag of agencies) {
    const agPersons = personsByAgency.get(ag.id) || [];
    const agExpenses = expensesByAgency.get(ag.id) || [];
    const metrics = computeAgencyMetrics(agPersons, agExpenses, settings);

    byAgencyId.set(ag.id, {
      agency: ag,
      persons: agPersons,
      expenses: agExpenses,
      metrics,
    });
    rawRows.push({ agency: ag, metrics });

    totalRegisteredHouseholds += metrics.registeredHouseholds;
    totalActiveHouseholds += metrics.activeHouseholds;
    totalActiveIndividuals += metrics.activeIndividuals;
    totalBlockedCount += metrics.blockedCount;
    totalBlockedInd += metrics.blockedIndividualsTotal;
    totalKg += metrics.totalKg;
    totalRevenue += metrics.revenue;
    totalWorkerWages += metrics.workerWages;
    totalGeneralExpenses += metrics.generalExpenses;
  }

  const denomIndividuals = Math.max(1, totalActiveIndividuals);
  const chartSeries: MorrowChartSeriesItem[] = rawRows.map(({ agency, metrics }) => ({
    id: `ag_${agency.id}`,
    agencyId: agency.id,
    label: agency.name,
    icon: agency.icon || '🏢',
    activeHouseholds: metrics.activeHouseholds,
    blockedCount: metrics.blockedCount,
    activeIndividuals: metrics.activeIndividuals,
    fullBags: metrics.fullBags,
    remainderKg: metrics.remainderKg,
    revenue: metrics.revenue,
    totalExpenses: metrics.totalExpenses,
    profit: metrics.profit,
    sharePercent: Math.round((metrics.activeIndividuals / denomIndividuals) * 100),
  }));

  const fullBags = Math.floor(totalKg / Math.max(1, settings.kgPerBag));
  const remainderKg = totalKg % Math.max(1, settings.kgPerBag);
  const totalExpenses = totalWorkerWages + totalGeneralExpenses;

  return {
    byAgencyId,
    totals: {
      registeredHouseholds: totalRegisteredHouseholds,
      activeHouseholds: totalActiveHouseholds,
      activeIndividuals: totalActiveIndividuals,
      blockedCount: totalBlockedCount,
      blockedIndividualsTotal: totalBlockedInd,
      totalKg,
      fullBags,
      remainderKg,
      revenue: totalRevenue,
      workerWages: totalWorkerWages,
      generalExpenses: totalGeneralExpenses,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
    },
    chartSeries,
    blockBreakdown: {
      activeHouseholds: totalActiveHouseholds,
      partialBlockedHouseholds,
      fullBlockedHouseholds,
      archivedHouseholds,
    },
  };
}

/**
 * Smarter Summon vs. Navigate Router:
 * Determines whether a prompt should build/summon a live widget inside Morrow's
 * Dynamic Canvas OR navigate straight to a target screen and highlight its control.
 */
export function decideSummonOrNavigate(
  rawPrompt: string,
  agencies: Agency[],
  customMacros: MorrowMacroDefinition[] = DEFAULT_MORROW_MACROS
): MorrowSummonNavigateDecision {
  const norm = normalizeIraqiDialect(rawPrompt);
  const matchedAg = matchAgencyInText(rawPrompt, agencies);

  // 1. Check Custom or Built-in Macros first
  const matchedMacro = findMatchingMacroByPrompt(rawPrompt, customMacros);
  if (matchedMacro) {
    return {
      mode: 'summon_canvas',
      canvasMode: 'macro_studio',
      targetAgencyId: matchedAg?.id ?? null,
      title: `تشغيل ماكرو: ${matchedMacro.name}`,
      reason: 'تم استدعاء استوديو الماكرو في اللوحة التفاعلية لتنفيذ الخطوات المبرمجة.',
    };
  }

  // 2. Explicit Navigate + Highlight commands ("وريني", "افتح", "وديني", "خذني", "اريد زر")
  const explicitNavigateVerbs =
    /(?:^|\s)(وريني|افتح|وديني|خذني|روح لـ|انتقل|دليني|اشير|اضاءه|الزر|وين زر)/.test(
      norm
    );
  const kb = findKnowledgeEntry(rawPrompt);
  if (explicitNavigateVerbs && kb) {
    return {
      mode: 'navigate_spotlight',
      targetView: kb.targetView,
      settingsSection: kb.settingsSection,
      targetDomId: kb.domTargetId,
      targetAgencyId: matchedAg?.id ?? null,
      title: `الانتقال إلى ${kb.title} وإبراز العنصر`,
      reason: 'طلب صريح للذهاب إلى شاشة أو أداة معينة في التطبيق.',
    };
  }

  // 3. Summon inside Dynamic Canvas (Charts, Editable Table, Report, Forecast, Text Analyzer)
  if (
    /(توقع|تنبؤ|متوقع|الشهر القادم|التغييرات المتوقعه|انحراف|تنبؤات)/.test(norm)
  ) {
    return {
      mode: 'summon_canvas',
      canvasMode: 'forecast',
      targetAgencyId: matchedAg?.id ?? null,
      title: 'استدعاء نموذج توقع التغييرات في اللوحة',
      reason: 'تم جلب التوقعات ومؤشرات النمو والمخاطر مباشرة داخل مساحة العمل.',
    };
  }

  if (/(حلل النص|تحليل نص|واتساب|رساله نصيه|استخرج من النص|اقرا النص)/.test(norm)) {
    return {
      mode: 'summon_canvas',
      canvasMode: 'text_analysis',
      targetAgencyId: matchedAg?.id ?? null,
      title: 'استدعاء محلل النصوص الذكي في اللوحة',
      reason: 'فتح أداة استخلاص الأسماء والأفراد من النصوص وتحويلها لمسودة موافقة.',
    };
  }

  if (
    /(عدل مباشر|تعديل مباشر|جدول تفاعلي|جدول هنا|حرر الجدول|اعرض الجدول هنا|جلب الجدول)/.test(
      norm
    )
  ) {
    return {
      mode: 'summon_canvas',
      canvasMode: 'editable_table',
      targetAgencyId: matchedAg?.id ?? null,
      title: 'استدعاء جدول التعديل المباشر الآمن (Zero-Trust)',
      reason: 'تعديل الصفوف مباشرة في اللوحة ثم إرسالها لطابور الموافقات قبل الحفظ النهائي.',
    };
  }

  if (/(تقرير تنفيذي|مولد التقارير|جهز تقرير|تقرير شامل|ملخص تنفيذي)/.test(norm)) {
    return {
      mode: 'summon_canvas',
      canvasMode: 'executive_report',
      targetAgencyId: matchedAg?.id ?? null,
      title: 'بناء التقرير التنفيذي التلقائي في اللوحة',
      reason: 'توليد تقرير تفصيلي للأفراد والحصص والأرباح في مساحة العمل.',
    };
  }

  if (
    /(رسم بياني|مخطط|شارت|قارن الوكالات|مقارنه|احصائيات|كم كيس|صافي الربح|توزيع الحصص)/.test(
      norm
    )
  ) {
    return {
      mode: 'summon_canvas',
      canvasMode: 'overview_charts',
      targetAgencyId: matchedAg?.id ?? null,
      title: 'استدعاء الرسوم البيانية ومؤشرات الأداء',
      reason: 'عرض مقارنة بصرية فورية للحصص والأفراد والأرباح في اللوحة التفاعلية.',
    };
  }

  if (explicitNavigateVerbs && matchedAg) {
    return {
      mode: 'navigate_spotlight',
      targetView: 'agency_roster',
      targetAgencyId: matchedAg.id,
      targetDomId: 'hub-agencies-grid',
      title: `الانتقال إلى ${matchedAg.name}`,
      reason: 'الانتقال المباشر إلى جدول الوكالة المطلوبة.',
    };
  }

  return {
    mode: 'chat_standard',
    title: 'معالجة في سجل المحادثة',
    reason: 'طلب حواري أو تعديلي قياسي يتم التعامل معه عبر المحادثة وبطاقات الموافقة.',
  };
}

export function generateExecutiveReport(params: {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  settings: CalculationSettings;
  periodLabel?: string;
  scopeAgencyId?: number | null;
}): MorrowExecutiveReport {
  const targetAgencies =
    params.scopeAgencyId && params.scopeAgencyId > 0
      ? params.agencies.filter((a) => a.id === params.scopeAgencyId)
      : params.agencies;

  const indexed = buildIndexedWorkspaceAnalytics(
    targetAgencies,
    params.persons,
    params.expenses,
    params.settings
  );

  const scopeLabel =
    targetAgencies.length === 1 ? targetAgencies[0].name : `جميع الوكالات (${targetAgencies.length})`;
  const topAgency = [...indexed.chartSeries].sort(
    (a, b) => b.activeIndividuals - a.activeIndividuals
  )[0];
  const highestProfitAgency = [...indexed.chartSeries].sort(
    (a, b) => b.profit - a.profit
  )[0];

  const summaryPoints: string[] = [
    `النطاق المشمول: ${scopeLabel} بإجمالي ${indexed.totals.activeHouseholds} عائلة نشطة و${indexed.totals.activeIndividuals} فرد مستحق.`,
    `الكمية الكلية المطلوبة: ${formatTotalQuota(indexed.totals.totalKg, params.settings)} (${indexed.totals.fullBags} كيس كامل).`,
    `الإيرادات التقديرية ${formatIqd(indexed.totals.revenue)} مقابل مصاريف ${formatIqd(
      indexed.totals.totalExpenses
    )}، بصافي ربح ${formatIqd(indexed.totals.profit)}.`,
  ];

  if (topAgency && targetAgencies.length > 1) {
    summaryPoints.push(
      `أعلى وكالة من حيث الأفراد: «${topAgency.label}» بنسبة ${topAgency.sharePercent}% (${topAgency.activeIndividuals} فرد).`
    );
  }
  if (highestProfitAgency && highestProfitAgency.profit > 0 && targetAgencies.length > 1) {
    summaryPoints.push(
      `أعلى مساهمة ربحية: «${highestProfitAgency.label}» بصافي ${formatIqd(highestProfitAgency.profit)}.`
    );
  }
  if (indexed.totals.blockedCount > 0) {
    summaryPoints.push(
      `ملاحظة تدقيقية: يوجد ${indexed.totals.blockedCount} عائلة محجوبة جزئياً أو كلياً بإجمالي ${indexed.totals.blockedIndividualsTotal} فرد مستبعد.`
    );
  }

  return {
    id: `exec_rep_${Date.now()}`,
    title: `التقرير التنفيذي — ${scopeLabel}`,
    generatedAt: new Date().toISOString(),
    periodLabel: params.periodLabel || 'الحصة الحالية',
    scopeLabel,
    summaryPoints,
    agencyRows: indexed.chartSeries,
    totals: {
      registeredHouseholds: indexed.totals.registeredHouseholds,
      activeHouseholds: indexed.totals.activeHouseholds,
      blockedCount: indexed.totals.blockedCount,
      activeIndividuals: indexed.totals.activeIndividuals,
      fullBags: indexed.totals.fullBags,
      remainderKg: indexed.totals.remainderKg,
      revenue: indexed.totals.revenue,
      totalExpenses: indexed.totals.totalExpenses,
      profit: indexed.totals.profit,
    },
  };
}

/**
 * Proactive Intelligence & Change Forecaster:
 * Compares live indexed state against historical Monthly Archives & structural integrity rules
 * to surface actionable insights before the user even asks.
 */
export function computeProactiveInsightsAndForecasts(params: {
  state: AppDatabaseState;
  monthlyArchives?: MonthlyArchiveRecord[];
  activePeriod?: PeriodQuotaMeta;
  lastBackupAt?: string | null;
  nowMs?: number;
}): {
  insights: MorrowProactiveInsight[];
  forecast: MorrowForecastReport;
  analytics: IndexedWorkspaceAnalytics;
} {
  const { state, monthlyArchives = [], activePeriod, lastBackupAt, nowMs = Date.now() } = params;
  const analytics = buildIndexedWorkspaceAnalytics(
    state.agencies,
    state.persons,
    state.expenses,
    state.calculationSettings
  );
  const diagnostics = runAppDiagnostics(state, lastBackupAt, nowMs);
  const insights: MorrowProactiveInsight[] = [];

  // 1. Archive Baseline Comparison for Change Forecasting
  const latestArchive = monthlyArchives[0];
  const prevByAgencyName = new Map<string, number>();
  if (latestArchive) {
    const prevAgg = buildIndexedWorkspaceAnalytics(
      latestArchive.agencies || [],
      latestArchive.persons || [],
      latestArchive.expenses || [],
      latestArchive.calculationSettings || state.calculationSettings
    );
    for (const row of prevAgg.chartSeries) {
      prevByAgencyName.set(normalizeArabic(row.label), row.activeIndividuals);
    }
  }

  const agencyForecasts: MorrowAgencyForecast[] = [];
  let totalProjectedIndividuals = 0;

  for (const row of analytics.chartSeries) {
    const prevInd = prevByAgencyName.get(normalizeArabic(row.label));
    const entry = analytics.byAgencyId.get(row.agencyId);
    const partialBlocked = (entry?.persons || []).filter(
      (p) => p.blockType === 'partial' && p.status !== 'مؤرشف'
    ).length;

    let projected = row.activeIndividuals;
    let changePct = 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let note = 'استقرار متوقع في الحصة القادمة';

    if (prevInd && prevInd > 0) {
      const observedDeltaPct = ((row.activeIndividuals - prevInd) / prevInd) * 100;
      // Damped trend continuation (50% momentum + block adjustments)
      const dampedPct = Math.max(-18, Math.min(22, observedDeltaPct * 0.5));
      projected = Math.max(0, Math.round(row.activeIndividuals * (1 + dampedPct / 100)));
      changePct =
        row.activeIndividuals > 0
          ? Number((((projected - row.activeIndividuals) / row.activeIndividuals) * 100).toFixed(1))
          : 0;

      if (Math.abs(observedDeltaPct) >= 12) {
        riskLevel = 'high';
        note =
          observedDeltaPct > 0
            ? `نمو ملحوظ (+${Math.round(observedDeltaPct)}%) مقارنة بـ ${latestArchive.periodMeta.quotaName}`
            : `تراجع ملحوظ (${Math.round(observedDeltaPct)}%) مقارنة بـ ${latestArchive.periodMeta.quotaName}`;
      } else if (partialBlocked >= 3) {
        riskLevel = 'medium';
        note = `${partialBlocked} سجلات بحظر جزئي قد ترفع الحصة عند رفع الحظر`;
      }
    } else {
      // No archive baseline yet: model sensitivity from blocked/missing records
      const blockPressurePct =
        row.activeHouseholds > 0 ? (row.blockedCount / (row.activeHouseholds + row.blockedCount)) * 100 : 0;
      const estimatedDriftPct = blockPressurePct > 15 ? -2.5 : 1.8;
      projected = Math.max(0, Math.round(row.activeIndividuals * (1 + estimatedDriftPct / 100)));
      changePct = Number(estimatedDriftPct.toFixed(1));
      if (blockPressurePct > 18) {
        riskLevel = 'high';
        note = `نسبة المحجوبين مرتفعة (${Math.round(blockPressurePct)}%) وتؤثر على صافي التوزيع`;
      } else if (row.profit < 0) {
        riskLevel = 'medium';
        note = 'المصاريف المسجلة تفوق الإيراد التقديري لهذه الوكالة';
      }
    }

    totalProjectedIndividuals += projected;
    const projectedKg = projected * state.calculationSettings.kgPerIndividual;
    const projectedBags = Math.ceil(projectedKg / Math.max(1, state.calculationSettings.kgPerBag));

    agencyForecasts.push({
      agencyId: row.agencyId,
      agencyName: row.label,
      currentIndividuals: row.activeIndividuals,
      projectedIndividuals: projected,
      currentBags: row.fullBags,
      projectedBags,
      changePercent: changePct,
      riskLevel,
      note,
    });
  }

  const deltaInd = totalProjectedIndividuals - analytics.totals.activeIndividuals;
  const deltaPct =
    analytics.totals.activeIndividuals > 0
      ? Number(((deltaInd / analytics.totals.activeIndividuals) * 100).toFixed(1))
      : 0;
  const projectedTotalKg =
    totalProjectedIndividuals * state.calculationSettings.kgPerIndividual;
  const projectedBags = Math.ceil(
    projectedTotalKg / Math.max(1, state.calculationSettings.kgPerBag)
  );
  const avgFeePerInd =
    analytics.totals.activeIndividuals > 0
      ? analytics.totals.revenue / analytics.totals.activeIndividuals
      : state.calculationSettings.feePerIndividualIqd;
  const projectedRevenue = Math.round(totalProjectedIndividuals * avgFeePerInd);
  const projectedProfit = projectedRevenue - analytics.totals.totalExpenses;

  const recommendations: string[] = [];
  if (diagnostics.highCount > 0) {
    recommendations.push(
      `معالجة ${diagnostics.highCount} ملاحظة حرجة (تكرارات أو أفراد ناقصين) قبل اعتماد حصة الشهر القادم.`
    );
  }
  const highRiskAgencies = agencyForecasts.filter((f) => f.riskLevel === 'high');
  if (highRiskAgencies.length > 0) {
    recommendations.push(
      `مراجعة كشوفات: ${highRiskAgencies.map((a) => a.agencyName).join('، ')} لوجود تغير حاد أو نسبة حجب مرتفعة.`
    );
  }
  if (monthlyArchives.length === 0) {
    recommendations.push(
      'أرشفة الحصة الحالية عند إغلاق الشهر لرفع دقة تنبؤات الأشهر القادمة تلقائياً.'
    );
  } else {
    recommendations.push(
      `التقدير اللوجستي المطلوب للحصة القادمة: نحو ${projectedBags} كيس طحين لتغطية ${totalProjectedIndividuals} فرد.`
    );
  }

  // 2. Build Proactive Insights Cards (sorted by priority)
  if (diagnostics.highCount > 0 || diagnostics.autoFixableCount > 0) {
    insights.push({
      id: 'insight_diagnostics_priority',
      severity: diagnostics.highCount > 0 ? 'high' : 'medium',
      category: 'audit',
      title:
        diagnostics.highCount > 0
          ? `رصد استباقي: ${diagnostics.highCount} ملاحظة حرجة في السجلات`
          : `تحسين متاح: ${diagnostics.autoFixableCount} سجل قابل للإصلاح الآمن`,
      detail:
        diagnostics.issues[0]?.title ||
        'توجد ملاحظات في الأسماء المكررة أو تطابق حالات الحجب.',
      metricLabel: `درجة السلامة ${diagnostics.healthScore}%`,
      resolutionMode: 'summon_canvas',
      targetCanvasMode: 'editable_table',
      promptToRun: 'افحص التطبيق',
    });
  }

  const backupIssue = diagnostics.issues.find((i) => i.id === 'backup_stale');
  if (backupIssue) {
    insights.push({
      id: 'insight_backup_stale',
      severity: 'medium',
      category: 'backup',
      title: 'تنبيه استباقي للنسخ الاحتياطي',
      detail: backupIssue.detail,
      metricLabel: 'حماية البيانات',
      resolutionMode: 'navigate_spotlight',
      targetView: 'settings',
      targetId: 'sec_ai_assistant_cap',
    });
  }

  if (highRiskAgencies.length > 0) {
    const firstRisk = highRiskAgencies[0];
    insights.push({
      id: `insight_forecast_${firstRisk.agencyId}`,
      severity: 'medium',
      category: 'forecast',
      title: `تنبيه تغيّر في ${firstRisk.agencyName}`,
      detail: firstRisk.note,
      metricLabel: `${firstRisk.projectedBags} كيس متوقع`,
      resolutionMode: 'summon_canvas',
      targetCanvasMode: 'forecast',
      targetAgencyId: firstRisk.agencyId,
    });
  }

  insights.push({
    id: 'insight_exec_report_ready',
    severity: 'info',
    category: 'opportunity',
    title: `تقرير ${activePeriod?.quotaName || 'الحصة الحالية'} جاهز للعرض`,
    detail: `${analytics.totals.activeIndividuals} فرد نشط · ${analytics.totals.fullBags} كيس · صافي ${formatIqd(
      analytics.totals.profit
    )}`,
    metricLabel: `${analytics.chartSeries.length} وكالات`,
    resolutionMode: 'summon_canvas',
    targetCanvasMode: 'executive_report',
  });

  return {
    insights,
    analytics,
    forecast: {
      id: `fc_${Date.now()}`,
      horizonLabel: 'توقعات الحصة القادمة',
      baselineLabel: latestArchive
        ? `مقارنة بأرشيف ${latestArchive.periodMeta.quotaName}`
        : 'تحليل هيكلي للبيانات الحالية',
      projectedIndividuals: totalProjectedIndividuals,
      deltaIndividuals: deltaInd,
      deltaPercent: deltaPct,
      projectedBags,
      projectedRevenue,
      projectedProfit,
      trendDirection: deltaInd > 2 ? 'up' : deltaInd < -2 ? 'down' : 'stable',
      agencyForecasts,
      recommendations,
    },
  };
}

/**
 * Smart Text Analyzer:
 * Parses raw WhatsApp / ledger notes pasted by the user into structured
 * person-level actions ready to review & stage as Zero-Trust Approval Drafts.
 */
export function analyzeRawArabicText(params: {
  rawText: string;
  persons: Person[];
  agencies: Agency[];
}): MorrowTextAnalysisResult {
  const { rawText, persons, agencies } = params;
  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));
  const lines = String(rawText || '')
    .split(/\r?\n|؛/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3)
    .slice(0, 40);

  const entries: MorrowTextExtractedEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const normalized = normalizeArabic(
      normalizeIraqiDialect(convertArabicIndicDigits(rawLine))
    );
    const numMatch = convertArabicIndicDigits(rawLine).match(/\b(\d{1,2})\b/);
    const extractedNum = numMatch ? Number(numMatch[1]) : null;
    const isBlock = /(حجب|محجوب|ايقاف|تجميد|وقف)/.test(normalized);
    const isAdd = /^(?:اضافه|اضافة|اضف|ضيف|جديد|عايله جديده)/.test(normalized);

    const cleanedCandidate = rawLine
      .replace(/^[-•*\d.)\s]+/, '')
      .replace(/(?:احجب|حجب|تعديل|تغيير|إضافة|اضافة|اضف|ضيف|إلى|الى|أفراد|افراد|فرد|نفر|أنفار|انفار|عائلة)/g, ' ')
      .replace(/\b\d+\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const matches =
      !isAdd && cleanedCandidate.length >= 2
        ? fuzzyMatchPersons(cleanedCandidate, persons)
        : [];
    const best = matches[0];
    const matchedAgency = matchAgencyInText(rawLine, agencies);

    let actionHint: MorrowTextExtractedEntry['actionHint'] = 'note';
    if (isBlock) actionHint = 'block_full';
    else if (isAdd) actionHint = 'add_person';
    else if (best && extractedNum !== null) actionHint = 'update_individuals';
    else if (!best && extractedNum !== null && cleanedCandidate.length >= 3) {
      actionHint = 'add_person';
    }

    const confidence = best
      ? Math.min(0.98, Number((best.score / 100).toFixed(2)))
      : extractedNum !== null
      ? 0.72
      : 0.45;

    entries.push({
      id: `txt_${i}_${Date.now()}`,
      rawLine,
      candidateName: cleanedCandidate || rawLine.slice(0, 32),
      extractedIndividuals: extractedNum,
      matchedPersonId: best ? best.person.id : null,
      matchedPersonName: best ? best.person.name : null,
      matchedAgencyId: best ? best.person.agencyId : matchedAgency?.id ?? agencies[0]?.id ?? null,
      matchedAgencyName: best
        ? agencyMap.get(best.person.agencyId) || null
        : matchedAgency?.name || agencies[0]?.name || null,
      actionHint,
      confidence,
    });
  }

  const matchedCount = entries.filter((e) => e.matchedPersonId !== null).length;
  const actionableCount = entries.filter((e) => e.actionHint !== 'note').length;

  return {
    id: `ta_${Date.now()}`,
    rawText,
    analyzedAt: new Date().toISOString(),
    usedCloudAi: false,
    summary:
      entries.length === 0
        ? 'لم يتم العثور على سطور قابلة للتحليل في النص المدخل.'
        : `تم تحليل ${entries.length} سطر: رُبط ${matchedCount} منها بأسماء مسجلة، وهناك ${actionableCount} إجراء جاهز للإرسال كمسودة موافقة.`,
    entries,
  };
}

/**
 * Custom Macro Engine ("إغلاق الشهر" + User-Programmable Macros)
 */
export const MACRO_STEP_LABELS: Record<MorrowMacroStepAction, string> = {
  run_diagnostics: 'فحص سلامة الجداول والتكرارات',
  compute_forecast: 'حساب توقعات التغييرات والحصص',
  generate_report: 'توليد التقرير التنفيذي النهائي',
  stage_auto_fixes: 'تجهيز مسودة إصلاح الأخطاء تلقائياً',
  prepare_backup: 'أخذ نسخة احتياطية JSON آمنة',
  prepare_archive_month: 'أرشفة وإغلاق حصة الشهر في الأرشيف',
};

export const DEFAULT_MORROW_MACROS: MorrowMacroDefinition[] = [
  {
    id: 'macro_close_month',
    name: 'إغلاق الشهر الشامل',
    triggerPhrase: 'إغلاق الشهر',
    description:
      'يفحص الجداول، يحسب توقعات الشهر القادم، يولّد التقرير التنفيذي النهائي في اللوحة، ويجهّز النسخة الاحتياطية والأرشفة الآمنة.',
    builtIn: true,
    steps: [
      'run_diagnostics',
      'compute_forecast',
      'generate_report',
      'stage_auto_fixes',
      'prepare_backup',
      'prepare_archive_month',
    ],
  },
  {
    id: 'macro_morning_audit',
    name: 'جرد وتدقيق الصباح',
    triggerPhrase: 'جرد الصباح',
    description:
      'فحص يومي سريع للتكرارات، حالات الحظر الجزئي، وتحديث توقعات أكياس الطحين.',
    builtIn: true,
    steps: ['run_diagnostics', 'compute_forecast', 'stage_auto_fixes'],
  },
  {
    id: 'macro_distribution_pack',
    name: 'تجهيز كشف التوزيع',
    triggerPhrase: 'تجهيز كشف التوزيع',
    description:
      'تجميع حصص الوكالات النشطة وتوليد التقرير التنفيذي مع نسخة احتياطية فورية قبل الطباعة.',
    builtIn: true,
    steps: ['generate_report', 'prepare_backup'],
  },
];

export function loadUserMacros(): MorrowMacroDefinition[] {
  try {
    const raw = localStorage.getItem(MACROS_STORAGE_KEY);
    if (!raw) return DEFAULT_MORROW_MACROS;
    const parsed = JSON.parse(raw) as MorrowMacroDefinition[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_MORROW_MACROS;
    // Always preserve built-ins merged with any user custom macros
    const customOnly = parsed.filter((m) => !m.builtIn);
    return [...DEFAULT_MORROW_MACROS, ...customOnly];
  } catch {
    return DEFAULT_MORROW_MACROS;
  }
}

export function saveUserMacros(macros: MorrowMacroDefinition[]): void {
  try {
    const customOnly = macros.filter((m) => !m.builtIn);
    localStorage.setItem(MACROS_STORAGE_KEY, JSON.stringify(customOnly));
  } catch {
    // ignore storage limits
  }
}

export function findMatchingMacroByPrompt(
  prompt: string,
  macros: MorrowMacroDefinition[]
): MorrowMacroDefinition | null {
  const norm = normalizeArabic(normalizeIraqiDialect(prompt));
  if (!norm) return null;
  for (const m of macros) {
    const triggerNorm = normalizeArabic(m.triggerPhrase);
    const nameNorm = normalizeArabic(m.name);
    if (
      (triggerNorm && norm.includes(triggerNorm)) ||
      (nameNorm && norm.includes(nameNorm))
    ) {
      return m;
    }
  }
  if (/^(?:ماكرو|شغل ماكرو|نفذ ماكرو)/.test(norm)) {
    return macros[0] || null;
  }
  return null;
}

export function executeMorrowMacro(params: {
  macro: MorrowMacroDefinition;
  state: AppDatabaseState;
  monthlyArchives?: MonthlyArchiveRecord[];
  activePeriod?: PeriodQuotaMeta;
  lastBackupAt?: string | null;
}): MorrowMacroExecutionResult {
  const { macro, state, monthlyArchives = [], activePeriod, lastBackupAt } = params;
  const traces: MorrowMacroStepTrace[] = [];
  const stagedDraftTools: AssistantToolCall[] = [];

  let diagnosticsSummary = undefined as MorrowMacroExecutionResult['diagnosticsSummary'];
  let report = undefined as MorrowExecutiveReport | undefined;
  let forecast = undefined as MorrowForecastReport | undefined;

  for (const step of macro.steps) {
    if (step === 'run_diagnostics') {
      diagnosticsSummary = runAppDiagnostics(state, lastBackupAt);
      traces.push({
        action: step,
        label: MACRO_STEP_LABELS[step],
        status: diagnosticsSummary.highCount > 0 ? 'warning' : 'done',
        detail: `درجة السلامة ${diagnosticsSummary.healthScore}% · ${diagnosticsSummary.totalIssues} ملاحظة (${diagnosticsSummary.autoFixableCount} قابلة للإصلاح الآمن).`,
      });
    } else if (step === 'compute_forecast') {
      const proactive = computeProactiveInsightsAndForecasts({
        state,
        monthlyArchives,
        activePeriod,
        lastBackupAt,
      });
      forecast = proactive.forecast;
      traces.push({
        action: step,
        label: MACRO_STEP_LABELS[step],
        status: 'done',
        detail: `الحصة القادمة المتوقعة: ${forecast.projectedIndividuals} فرد (${forecast.projectedBags} كيس) بتغير ${forecast.deltaPercent >= 0 ? '+' : ''}${forecast.deltaPercent}%.`,
      });
    } else if (step === 'generate_report') {
      report = generateExecutiveReport({
        agencies: state.agencies,
        persons: state.persons,
        expenses: state.expenses,
        settings: state.calculationSettings,
        periodLabel: activePeriod?.quotaName,
      });
      traces.push({
        action: step,
        label: MACRO_STEP_LABELS[step],
        status: 'done',
        detail: `تم بناء تقرير «${report.scopeLabel}»: ${report.totals.activeIndividuals} فرد · صافي ${formatIqd(
          report.totals.profit
        )}.`,
      });
    } else if (step === 'stage_auto_fixes') {
      const diag = diagnosticsSummary || runAppDiagnostics(state, lastBackupAt);
      diagnosticsSummary = diag;
      if (diag.autoFixableCount > 0) {
        stagedDraftTools.push({
          name: 'run_diagnostics',
          args: { autoFix: true },
        });
        traces.push({
          action: step,
          label: MACRO_STEP_LABELS[step],
          status: 'staged_draft',
          detail: `تم تجهيز مسودة موافقة لإصلاح ${diag.autoFixableCount} سجل تلقائياً دون مساس بالجدول حتى موافقتك.`,
        });
      } else {
        traces.push({
          action: step,
          label: MACRO_STEP_LABELS[step],
          status: 'done',
          detail: 'لا توجد أخطاء تحتاج إصلاحاً تلقائياً.',
        });
      }
    } else if (step === 'prepare_backup') {
      stagedDraftTools.push({
        name: 'backup_restore',
        args: { action: 'backup_json' },
      });
      traces.push({
        action: step,
        label: MACRO_STEP_LABELS[step],
        status: 'done',
        detail: 'النسخة الاحتياطية (JSON) جاهزة للتنزيل الفوري.',
      });
    } else if (step === 'prepare_archive_month') {
      stagedDraftTools.push({
        name: 'backup_restore',
        args: { action: 'archive_period' },
      });
      traces.push({
        action: step,
        label: MACRO_STEP_LABELS[step],
        status: 'staged_draft',
        detail: `تم تجهيز إجراء أرشفة «${activePeriod?.quotaName || 'الحصة الحالية'}» بانتظار نقرك على زر التنفيذ الآمن.`,
      });
    }
  }

  return {
    macroId: macro.id,
    macroName: macro.name,
    executedAt: new Date().toISOString(),
    steps: traces,
    report,
    forecast,
    diagnosticsSummary,
    stagedDraftTools,
  };
}

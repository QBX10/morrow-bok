import type { AppDatabaseState } from '../types/agency.ts';
import {
  DEFAULT_CALCULATION_SETTINGS,
  computeAgencyMetrics,
} from './agencyLogic.ts';
import { runAppDiagnostics } from './assistantDiagnostics.ts';

export type SmartModelId =
  | 'audit_inspector'
  | 'forecast_scheduler'
  | 'fast_processor'
  | 'generator_architect';

export type SmartModelTaskChipId =
  | 'diff_analysis'
  | 'error_detection'
  | 'summarize_records'
  | 'generate_plan';

export type SmartPrecisionLevel = 'standard' | 'deep' | 'forensic';
export type SmartSpeedMode = 'turbo' | 'balanced' | 'thorough';
export type SmartOutputFormat = 'executive_grid' | 'audit_matrix' | 'action_blueprint';

export interface SmartModelDefinition {
  id: SmartModelId;
  nameAr: string;
  shortTitleAr: string;
  roleAr: string;
  precisionBadgeAr: string;
  latencyBaseMs: number;
  accentHex: string;
  secondaryHex: string;
  statusLabelAr: string;
  recommendedChip: SmartModelTaskChipId;
}

export interface SmartModelExecutionParams {
  precisionLevel: SmartPrecisionLevel;
  speedMode: SmartSpeedMode;
  outputFormat: SmartOutputFormat;
}

export interface SmartModelKpiCard {
  label: string;
  value: string;
  tone: 'accent' | 'emerald' | 'amber' | 'rose' | 'cyan';
  hint?: string;
}

export interface SmartModelComparisonRow {
  agencyId: number;
  agencyName: string;
  households: number;
  eligibleIndividuals: number;
  totalKg: number;
  fullBags: number;
  remainderKg: number;
  netProfitIqd: number;
  issuesCount: number;
  healthScore: number;
}

export interface SmartModelFinding {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  agencyId?: number;
  personId?: number;
  autoFixable: boolean;
}

export interface SmartModelExecutionResult {
  executionId: string;
  model: SmartModelDefinition;
  taskChipId: SmartModelTaskChipId;
  promptUsed: string;
  generatedAt: string;
  latencyMs: number;
  confidencePct: number;
  headlineAr: string;
  executiveSummaryAr: string;
  reasoningSteps: string[];
  kpis: SmartModelKpiCard[];
  comparisonRows: SmartModelComparisonRow[];
  findings: SmartModelFinding[];
  actionPlanSteps: string[];
  exportMarkdown: string;
  exportCsv: string;
}

export const SMART_MODELS_CATALOG: SmartModelDefinition[] = [
  {
    id: 'audit_inspector',
    nameAr: 'نموذج التدقيق والفحص الذكي للسجلات',
    shortTitleAr: 'المدقق الذكي',
    roleAr: 'فحص التكرارات، الحصص، الأوزان وصافي الربحية بدقة عالية',
    precisionBadgeAr: 'تدقيق شامل',
    latencyBaseMs: 142,
    accentHex: '#10B981',
    secondaryHex: '#22D3EE',
    statusLabelAr: 'متصل بالسجلات',
    recommendedChip: 'error_detection',
  },
  {
    id: 'forecast_scheduler',
    nameAr: 'نموذج التنبؤ وجدولة الوجبات',
    shortTitleAr: 'محرك التنبؤ والكميات',
    roleAr: 'تقدير احتياج الأكياس والأوزان وجدولة توزيع الوجبات القادمة',
    precisionBadgeAr: 'تنبؤ كمّي',
    latencyBaseMs: 168,
    accentHex: '#22D3EE',
    secondaryHex: '#8B5CF6',
    statusLabelAr: 'تحليل الوجبات',
    recommendedChip: 'diff_analysis',
  },
  {
    id: 'fast_processor',
    nameAr: 'نموذج الملخص التنفيذي السريع',
    shortTitleAr: 'الملخص التنفيذي',
    roleAr: 'تلخيص فوري لكامل الوكالات، الصرفيات والأرصدة المالية',
    precisionBadgeAr: 'استجابة فورية',
    latencyBaseMs: 84,
    accentHex: '#F59E0B',
    secondaryHex: '#10B981',
    statusLabelAr: 'ملخص شامل',
    recommendedChip: 'summarize_records',
  },
  {
    id: 'generator_architect',
    nameAr: 'نموذج التخطيط والهيكلة التشغيلية',
    shortTitleAr: 'مهندس الخطط',
    roleAr: 'صياغة خطط عمل ميدانية وإصلاحات مباشرة لرفع جودة السجلات',
    precisionBadgeAr: 'تخطيط منظم',
    latencyBaseMs: 196,
    accentHex: '#8B5CF6',
    secondaryHex: '#22D3EE',
    statusLabelAr: 'بناء المخططات',
    recommendedChip: 'generate_plan',
  },
];

export const SMART_TASK_CHIPS: {
  id: SmartModelTaskChipId;
  labelAr: string;
  defaultPromptAr: string;
}[] = [
  {
    id: 'diff_analysis',
    labelAr: 'تحليل الفروقات',
    defaultPromptAr: 'قارن بين الوكالات في عدد الأفراد، الوزن، الأكياس وصافي الربح وكشف الفجوات.',
  },
  {
    id: 'error_detection',
    labelAr: 'كشف الأخطاء',
    defaultPromptAr: 'افحص السجل الشامل واكشف التكرارات، نقص الهويات، وقيم الأفراد غير المنضبطة.',
  },
  {
    id: 'summarize_records',
    labelAr: 'تلخيص السجلات',
    defaultPromptAr: 'أنشئ ملخصاً تنفيذياً مركزاً لأداء المحفظة، الإيرادات، المصاريف والوجبة الحالية.',
  },
  {
    id: 'generate_plan',
    labelAr: 'توليد خطة عمل',
    defaultPromptAr: 'ولّد خطة عمل ميدانية ومحاسبية منظمة للوجبة القادمة وإغلاق الملاحظات.',
  },
];

function formatInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function getSmartModelById(id: SmartModelId): SmartModelDefinition {
  return SMART_MODELS_CATALOG.find((m) => m.id === id) || SMART_MODELS_CATALOG[0];
}

export function executeSmartModelTask(input: {
  modelId: SmartModelId;
  taskChipId: SmartModelTaskChipId;
  prompt?: string;
  params: SmartModelExecutionParams;
  state: AppDatabaseState;
}): SmartModelExecutionResult {
  const model = getSmartModelById(input.modelId);
  const settings = input.state.calculationSettings || DEFAULT_CALCULATION_SETTINGS;
  const chip =
    SMART_TASK_CHIPS.find((c) => c.id === input.taskChipId) || SMART_TASK_CHIPS[0];
  const promptUsed = input.prompt?.trim() || chip.defaultPromptAr;

  const diagnostics = runAppDiagnostics(
    input.state,
    input.state.securityPrefs?.smartSync?.lastSavedAt || null
  );

  const agencies = input.state.agencies || [];
  const persons = input.state.persons || [];
  const expenses = input.state.expenses || [];

  const comparisonRows: SmartModelComparisonRow[] = agencies.map((agency) => {
    const agencyPersons = persons.filter((p) => p.agencyId === agency.id);
    const agencyExpenses = expenses.filter((e) => e.agencyId === agency.id);
    const metrics = computeAgencyMetrics(agencyPersons, agencyExpenses, settings);
    const agencyIssues = diagnostics.issues.filter((i) => i.agencyId === agency.id);
    const penalty = agencyIssues.reduce(
      (sum, item) => sum + (item.severity === 'high' ? 8 : item.severity === 'medium' ? 4 : 1),
      0
    );
    const healthScore = Math.max(40, Math.min(100, 100 - penalty));

    return {
      agencyId: agency.id,
      agencyName: agency.name,
      households: metrics.registeredHouseholds,
      eligibleIndividuals: metrics.activeIndividuals,
      totalKg: metrics.totalKg,
      fullBags: metrics.fullBags,
      remainderKg: metrics.remainderKg,
      netProfitIqd: metrics.profit,
      issuesCount: agencyIssues.length,
      healthScore,
    };
  });

  const totalHouseholds = comparisonRows.reduce((s, r) => s + r.households, 0);
  const totalIndividuals = comparisonRows.reduce((s, r) => s + r.eligibleIndividuals, 0);
  const totalKg = comparisonRows.reduce((s, r) => s + r.totalKg, 0);
  const totalBags = Math.floor(totalKg / Math.max(1, settings.kgPerBag || 50));
  const remainderKg = totalKg % Math.max(1, settings.kgPerBag || 50);
  const totalNetProfit = comparisonRows.reduce((s, r) => s + r.netProfitIqd, 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amountIqd || 0), 0);
  const autoFixableCount = diagnostics.issues.filter((i) => i.autoFixable).length;

  const sortedByIndividuals = [...comparisonRows].sort(
    (a, b) => b.eligibleIndividuals - a.eligibleIndividuals
  );
  const topAgency = sortedByIndividuals[0];
  const lowAgency = sortedByIndividuals[sortedByIndividuals.length - 1];

  const findings: SmartModelFinding[] = diagnostics.issues.slice(0, 8).map((issue) => ({
    id: issue.id,
    severity: issue.severity === 'info' ? 'low' : issue.severity,
    title: issue.title,
    detail: issue.detail,
    agencyId: issue.agencyId,
    personId: issue.personId,
    autoFixable: Boolean(issue.autoFixable),
  }));

  if (findings.length === 0) {
    findings.push({
      id: 'all_clear_integrity',
      severity: 'low',
      title: 'السجل سليم بالكامل وفق معايير التدقيق',
      detail: 'لم يتم العثور على تكرارات أو أرقام أفراد غير صالحة أو تعارضات بين الوكالات.',
      autoFixable: false,
    });
  }

  const speedFactor =
    input.params.speedMode === 'turbo'
      ? 0.72
      : input.params.speedMode === 'thorough'
      ? 1.35
      : 1;
  const precisionBonus =
    input.params.precisionLevel === 'forensic'
      ? 1.6
      : input.params.precisionLevel === 'deep'
      ? 0.9
      : 0;
  const latencyMs = Math.max(48, Math.round(model.latencyBaseMs * speedFactor));
  const confidencePct = Math.min(
    99.8,
    Number(
      (
        (model.id === 'audit_inspector' ? 98.1 : model.id === 'forecast_scheduler' ? 96.8 : 96.4) +
        precisionBonus
      ).toFixed(1)
    )
  );

  const quotaTitle = input.state.activePeriod?.quotaName || 'الوجبة الحالية';
  const headlineByChip: Record<SmartModelTaskChipId, string> = {
    diff_analysis: `مقارنة الأداء والحصص بين ${agencies.length} وكالات (${quotaTitle})`,
    error_detection: `تقرير الفحص والتدقيق: ${diagnostics.issues.length} ملاحظة (${autoFixableCount} قابلة للإصلاح الآلي)`,
    summarize_records: `الملخص التنفيذي لمحفظة Morrow (${formatInt(totalIndividuals)} فرد مستحق)`,
    generate_plan: `خطة التشغيل والتوزيع للوجبة القادمة (${formatInt(totalBags)} كيس + ${formatInt(remainderKg)} كغم)`,
  };

  const executiveSummaryByChip: Record<SmartModelTaskChipId, string> = {
    diff_analysis: topAgency
      ? `تتصدر «${topAgency.agencyName}» المحفظة بـ ${formatInt(topAgency.eligibleIndividuals)} فرد مستحق وصافي ربح ${formatInt(topAgency.netProfitIqd)} د.ع${lowAgency && lowAgency.agencyId !== topAgency.agencyId ? ` مقارنةً بـ «${lowAgency.agencyName}» (${formatInt(lowAgency.eligibleIndividuals)} فرد)` : ''}.`
      : 'لا توجد وكالات مسجلة للمقارنة بعد.',
    error_detection:
      diagnostics.issues.length > 0
        ? `تم فحص ${formatInt(persons.length)} سجل مستفيد؛ تم رصد ${diagnostics.highCount} حالة عالية الأولوية و${diagnostics.mediumCount} متوسطة، مع إمكانية تطبيق ${autoFixableCount} إصلاح تلقائي مباشرة على السجل.`
        : `تم فحص ${formatInt(persons.length)} سجل مستفيد بنجاح وبدرجة سلامة بيانات ${diagnostics.healthScore}%.`,
    summarize_records: `إجمالي العوائل المسجلة ${formatInt(totalHouseholds)} بإجمالي حصة ${formatInt(totalKg)} كغم (${formatInt(totalBags)} كيس كامل) وصافي ربح قدره ${formatInt(totalNetProfit)} د.ع بعد خصم مصروفات ${formatInt(totalExpenses)} د.ع.`,
    generate_plan: `خطة توزيع مقترحة لـ ${formatInt(totalHouseholds)} عائلة: تجهيز ${formatInt(totalBags)} كيس (وزن ${settings.kgPerBag} كغم) وفك رصيد متبقي ${formatInt(remainderKg)} كغم مع تصفية ${diagnostics.issues.length} ملاحظة تدقيق قبل الإغلاق.`,
  };

  const precisionLabelAr =
    input.params.precisionLevel === 'forensic'
      ? 'التدقيق الشامل'
      : input.params.precisionLevel === 'deep'
      ? 'التدقيق العميق'
      : 'التدقيق القياسي';

  const outputLabelAr =
    input.params.outputFormat === 'audit_matrix'
      ? 'مصفوفة التدقيق'
      : input.params.outputFormat === 'action_blueprint'
      ? 'مخطط العمل'
      : 'البطاقات التنفيذية';

  const reasoningSteps: string[] = [
    `1. قراءة بيانات ${agencies.length} وكالة و${persons.length} سجل مستفيد وفق (${settings.kgPerIndividual} كغم/فرد · ${settings.feePerIndividualIqd} د.ع/فرد).`,
    `2. احتساب الأفراد المستحقين لكل وكالة بعد استبعاد المحجوبين والمؤرشفين: ${formatInt(totalIndividuals)} فرد مستحق.`,
    `3. تطبيق مستوى ${precisionLabelAr} ورصد ${diagnostics.issues.length} ملاحظة بدرجة سلامة ${diagnostics.healthScore}%.`,
    `4. إعداد التقرير بصيغة ${outputLabelAr} مع جدول المقارنة وخطة التنفيذ المباشرة.`,
  ];

  const forecastNextIndividuals = Math.round(totalIndividuals * 1.03);
  const forecastBags = Math.ceil((forecastNextIndividuals * settings.kgPerIndividual) / Math.max(1, settings.kgPerBag));

  const actionPlanSteps: string[] = [
    autoFixableCount > 0
      ? `تشغيل «تطبيق على السجل» لمعالجة ${autoFixableCount} ملاحظة آلية (تنسيق الأسماء والحرف الأول وتنظيف المسافات) فوراً.`
      : 'تأكيد سلامة الأسماء والأحرف الأولى لجميع الوكالات قبل طباعة القوائم.',
    `تجهيز ${formatInt(totalBags)} كيس طحين كامل + ${formatInt(remainderKg)} كغم فرط للوجبة الحالية (${quotaTitle}).`,
    `تخصيص هامش احتياط للوجبة القادمة بمقدار ~${formatInt(forecastBags)} كيس تحسباً لزيادة 3% في الأفراد.`,
    topAgency
      ? `مراجعة خطوط التوزيع في «${topAgency.agencyName}» لضمان انسيابية التسليم ومطابقة الصرفيات (${formatInt(totalExpenses)} د.ع).`
      : 'مراجعة خطوط التوزيع ومطابقة الصرفيات.',
  ];

  const kpis: SmartModelKpiCard[] = [
    {
      label: 'الأفراد المستحقون',
      value: formatInt(totalIndividuals),
      tone: 'emerald',
      hint: `من أصل ${formatInt(totalHouseholds)} عائلة`,
    },
    {
      label: 'الكمية الإجمالية',
      value: `${formatInt(totalKg)} كغم`,
      tone: 'cyan',
      hint: `${formatInt(totalBags)} كيس + ${formatInt(remainderKg)} كغم`,
    },
    {
      label: 'صافي الربحية',
      value: `${formatInt(totalNetProfit)} د.ع`,
      tone: 'amber',
      hint: `مصاريف: ${formatInt(totalExpenses)} د.ع`,
    },
    {
      label: 'سلامة السجلات',
      value: `${diagnostics.healthScore}%`,
      tone: diagnostics.issues.length > 0 ? 'rose' : 'emerald',
      hint: `${diagnostics.issues.length} ملاحظة (${autoFixableCount} آلي)`,
    },
  ];

  const mdLines = [
    `# ${headlineByChip[input.taskChipId]}`,
    `- النموذج: ${model.nameAr} (${model.shortTitleAr})`,
    `- سلامة السجلات: ${diagnostics.healthScore}%`,
    ``,
    `## الملخص التنفيذي`,
    executiveSummaryByChip[input.taskChipId],
    ``,
    `## جدول مقارنة الوكالات`,
    `| الوكالة | العوائل | الأفراد المستحقون | الكتلة (كغم) | الأكياس | صافي الربح (د.ع) | السلامة |`,
    `|---|---:|---:|---:|---:|---:|---:|`,
    ...comparisonRows.map(
      (r) =>
        `| ${r.agencyName} | ${r.households} | ${r.eligibleIndividuals} | ${r.totalKg} | ${r.fullBags} | ${r.netProfitIqd} | ${r.healthScore}% |`
    ),
    ``,
    `## خطوات العمل المقترحة`,
    ...actionPlanSteps.map((step, i) => `${i + 1}. ${step}`),
  ];

  const csvRows = [
    'الوكالة,العوائل,الأفراد_المستحقون,الوزن_كغم,الأكياس,المتبقي_كغم,صافي_الربح_دع,الملاحظات,درجة_السلامة',
    ...comparisonRows.map(
      (r) =>
        `"${r.agencyName.replace(/"/g, '""')}",${r.households},${r.eligibleIndividuals},${r.totalKg},${r.fullBags},${r.remainderKg},${r.netProfitIqd},${r.issuesCount},${r.healthScore}`
    ),
  ];

  return {
    executionId: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    model,
    taskChipId: input.taskChipId,
    promptUsed,
    generatedAt: new Date().toISOString(),
    latencyMs,
    confidencePct,
    headlineAr: headlineByChip[input.taskChipId],
    executiveSummaryAr: executiveSummaryByChip[input.taskChipId],
    reasoningSteps,
    kpis,
    comparisonRows,
    findings,
    actionPlanSteps,
    exportMarkdown: mdLines.join('\n'),
    exportCsv: csvRows.join('\n'),
  };
}

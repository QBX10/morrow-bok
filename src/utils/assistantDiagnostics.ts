import type {
  AppDatabaseState,
  Person,
} from '../types/agency.ts';
import type {
  DiagnosticIssueItem,
  DiagnosticSummary,
} from '../types/assistant.ts';
import { initialLetter, normalizeArabic } from './agencyLogic.ts';

function daysBetweenIso(isoDate: string, nowMs: number): number {
  const t = Date.parse(isoDate);
  if (!Number.isFinite(t)) return 999;
  return Math.floor((nowMs - t) / (1000 * 60 * 60 * 24));
}

export function runAppDiagnostics(
  state: AppDatabaseState,
  lastBackupAt?: string | null,
  nowMs: number = Date.now()
): DiagnosticSummary {
  const issues: DiagnosticIssueItem[] = [];
  const agencyMap = new Map(state.agencies.map((a) => [a.id, a.name]));
  const listIds = new Set(state.readyLists.map((l) => l.id));
  const agencyIds = new Set(state.agencies.map((a) => a.id));

  // 1. Duplicate names inside each agency + across agencies
  const seenInAgency = new Map<string, Person>();
  const seenGlobal = new Map<string, Person>();

  for (const p of state.persons) {
    if (p.status === 'مؤرشف' || p.blockType === 'archived') continue;
    const norm = normalizeArabic(p.name);
    if (!norm) {
      issues.push({
        id: `empty_name_${p.id}`,
        category: 'missing_letter_or_name',
        severity: 'high',
        title: `سجل #${p.id} بدون اسم صالح`,
        detail: `السجل رقم #${p.id} في ${agencyMap.get(p.agencyId) || 'وكالة غير محددة'} لا يحتوي على اسم واضح.`,
        agencyId: p.agencyId,
        personId: p.id,
        autoFixable: false,
      });
      continue;
    }

    // Check extra whitespace / unclean initial letter
    const trimmed = p.name.trim().replace(/\s+/g, ' ');
    if (trimmed !== p.name || initialLetter(trimmed) === '—') {
      issues.push({
        id: `clean_name_${p.id}`,
        category: 'missing_letter_or_name',
        severity: 'medium',
        title: `تنسيق اسم أو حرف أول غير منضبط: ${p.name}`,
        detail: 'يوجد فراغات زائدة أو حرف أول غير مضبوط يؤثر على الترتيب والبحث.',
        agencyId: p.agencyId,
        personId: p.id,
        autoFixable: true,
        fixDescription: `تنظيف الفراغات وتوحيد الاسم إلى «${trimmed}»`,
      });
    }

    const agencyKey = `${p.agencyId}:${norm}`;
    const existingSameAgency = seenInAgency.get(agencyKey);
    if (existingSameAgency) {
      issues.push({
        id: `dup_agency_${p.id}_${existingSameAgency.id}`,
        category: 'duplicate_name',
        severity: 'high',
        title: `اسم مكرر داخل ${agencyMap.get(p.agencyId) || 'الوكالة'}: ${p.name}`,
        detail: `مكرر مع السجل #${existingSameAgency.id} (${existingSameAgency.individuals ?? 0} أفراد مقابل ${p.individuals ?? 0} أفراد).`,
        agencyId: p.agencyId,
        personId: p.id,
        autoFixable: false,
      });
    } else {
      seenInAgency.set(agencyKey, p);
    }

    const existingOther = seenGlobal.get(norm);
    if (existingOther && existingOther.agencyId !== p.agencyId) {
      issues.push({
        id: `dup_cross_${p.id}_${existingOther.id}`,
        category: 'duplicate_name',
        severity: 'medium',
        title: `تكرار اسم بين وكالتين: ${p.name}`,
        detail: `موجود في ${agencyMap.get(existingOther.agencyId) || 'وكالة'} و${agencyMap.get(p.agencyId) || 'وكالة'}.`,
        agencyId: p.agencyId,
        personId: p.id,
        autoFixable: false,
      });
    } else if (!existingOther) {
      seenGlobal.set(norm, p);
    }

    // 2. Invalid / zero individuals
    if (p.individuals === null || p.individuals === undefined || p.individuals <= 0 || !Number.isFinite(p.individuals)) {
      if (p.blockType !== 'full') {
        issues.push({
          id: `invalid_ind_${p.id}`,
          category: 'invalid_individuals',
          severity: 'high',
          title: `عدد الأفراد غير مكتمل أو صفر: ${p.name}`,
          detail: `القيمة الحالية (${String(p.individuals)}) تحتاج مراجعة أو تحويل السجل للحظر/الأرشفة.`,
          agencyId: p.agencyId,
          personId: p.id,
          autoFixable: false,
        });
      }
    }

    // 3. Status vs BlockType sync mismatch (auto-fixable!)
    const expectedStatus: Person['status'] =
      p.blockType === 'full' ? 'محجوب' : p.blockType === 'archived' ? 'مؤرشف' : '';
    if (p.status !== expectedStatus) {
      issues.push({
        id: `status_sync_${p.id}`,
        category: 'calculation_mismatch',
        severity: 'medium',
        title: `عدم تطابق حالة الحظر للسجل: ${p.name}`,
        detail: `نوع الحظر (${p.blockType}) لا يطابق نص الحالة (${p.status || 'نشط'}) مما قد يربك الحسابات.`,
        agencyId: p.agencyId,
        personId: p.id,
        autoFixable: true,
        fixDescription: `مزامنة الحالة إلى «${expectedStatus || 'نشط'}»`,
      });
    }

    // 4. Partial block bounds check (auto-fixable!)
    if (
      p.blockType === 'partial' &&
      p.individuals !== null &&
      p.blockedIndividuals >= p.individuals
    ) {
      issues.push({
        id: `partial_bound_${p.id}`,
        category: 'calculation_mismatch',
        severity: 'medium',
        title: `حظر جزئي يساوي/يفوق عدد الأفراد: ${p.name}`,
        detail: `المحظور (${p.blockedIndividuals}) >= الإجمالي (${p.individuals}). يُفضّل تحويله لحظر كامل.`,
        agencyId: p.agencyId,
        personId: p.id,
        autoFixable: true,
        fixDescription: 'تحويل الحظر إلى «حظر كامل» وضبط الحالة إلى «محجوب»',
      });
    }

    // 5. Missing updatedAt or dangling agencyId
    if (!agencyIds.has(p.agencyId)) {
      issues.push({
        id: `dangling_agency_${p.id}`,
        category: 'data_integrity',
        severity: 'high',
        title: `وكالة مفقودة للسجل: ${p.name}`,
        detail: `السجل مرتبط بوكالة رقم #${p.agencyId} غير موجودة.`,
        personId: p.id,
        autoFixable: state.agencies.length > 0,
        fixDescription: state.agencies[0]
          ? `ربطه بأول وكالة متاحة (${state.agencies[0].name})`
          : undefined,
      });
    }
    if (!p.updatedAt) {
      issues.push({
        id: `missing_date_${p.id}`,
        category: 'data_integrity',
        severity: 'info',
        title: `تاريخ تحديث مفقود: ${p.name}`,
        detail: 'السجل لا يحمل تاريخ تحديث.',
        agencyId: p.agencyId,
        personId: p.id,
        autoFixable: true,
        fixDescription: 'تعيين تاريخ اليوم كآخر تحديث',
      });
    }
  }

  // 6. Calculation settings sanity check
  const calc = state.calculationSettings;
  if (
    !calc ||
    calc.kgPerIndividual <= 0 ||
    calc.kgPerBag <= 0 ||
    calc.feePerIndividualIqd < 0 ||
    calc.fixedCardFeeIqd < 0
  ) {
    issues.push({
      id: 'calc_settings_invalid',
      category: 'calculation_mismatch',
      severity: 'high',
      title: 'خلل في قيم حاسبة الجدول',
      detail: 'أحد معاملات الحصص أو الوزن أو الرسوم مضبوط بقيمة غير صالحة (صفر أو سالب).',
      autoFixable: true,
      fixDescription: 'ضبط المعاملات غير الصالحة لأقرب قيمة آمنة',
    });
  }

  // 7. Dangling ready list items
  const orphanedItems = state.readyListItems.filter((it) => !listIds.has(it.listId));
  if (orphanedItems.length > 0) {
    issues.push({
      id: 'orphaned_ready_items',
      category: 'data_integrity',
      severity: 'medium',
      title: `عناصر قوائم جاهزة غير مرتبطة (${orphanedItems.length})`,
      detail: 'توجد صفوف قوائم جاهزة تشير إلى قوائم محذوفة.',
      autoFixable: true,
      fixDescription: 'تنظيف الصفوف اليتيمة دون المساس بجدول الوكالات',
    });
  }

  // 8. Backup staleness check
  const hasRecentArchive = (state.monthlyArchives || []).some(
    (a) => daysBetweenIso(a.createdAt, nowMs) <= 7
  );
  const backupAge = lastBackupAt ? daysBetweenIso(lastBackupAt, nowMs) : 999;
  if (!hasRecentArchive && backupAge > 7) {
    issues.push({
      id: 'backup_stale',
      category: 'backup_staleness',
      severity: 'medium',
      title: 'لم يتم أخذ نسخة احتياطية حديثة',
      detail: lastBackupAt
        ? `مرّ أكثر من ${backupAge} يوماً على آخر نسخة احتياطية.`
        : 'لا توجد نسخة احتياطية مسجلة خلال هذا الأسبوع.',
      autoFixable: false,
      fixDescription: 'انقر «نسخة احتياطية JSON» لحفظ بياناتك الآن',
    });
  }

  const highCount = issues.filter((i) => i.severity === 'high').length;
  const mediumCount = issues.filter((i) => i.severity === 'medium').length;
  const autoFixableCount = issues.filter((i) => i.autoFixable).length;
  const healthScore = Math.max(
    15,
    100 - highCount * 14 - mediumCount * 5 - (issues.length - highCount - mediumCount) * 2
  );

  return {
    checkedAt: new Date(nowMs).toISOString(),
    totalIssues: issues.length,
    highCount,
    mediumCount,
    autoFixableCount,
    healthScore,
    issues,
  };
}

export function applyDiagnosticAutoFixes(
  state: AppDatabaseState,
  selectedIssueIds?: string[]
): {
  nextState: AppDatabaseState;
  fixedCount: number;
  summaryLines: string[];
} {
  const report = runAppDiagnostics(state);
  const targetSet =
    selectedIssueIds && selectedIssueIds.length > 0
      ? new Set(selectedIssueIds)
      : null;

  const fixableIssues = report.issues.filter(
    (i) => i.autoFixable && (!targetSet || targetSet.has(i.id))
  );
  if (fixableIssues.length === 0) {
    return { nextState: state, fixedCount: 0, summaryLines: [] };
  }

  const today = new Date().toISOString().slice(0, 10);
  const fixIds = new Set(fixableIssues.map((i) => i.id));
  const summaryLines: string[] = [];
  let nextPersons = state.persons.map((p) => ({ ...p }));
  let nextReadyListItems = state.readyListItems;
  let nextCalc = { ...state.calculationSettings };
  let fixedCount = 0;

  for (let idx = 0; idx < nextPersons.length; idx++) {
    const p = nextPersons[idx];
    let changed = false;

    if (fixIds.has(`clean_name_${p.id}`)) {
      const cleaned = p.name.trim().replace(/\s+/g, ' ');
      if (cleaned !== p.name) {
        p.name = cleaned;
        changed = true;
        fixedCount += 1;
        summaryLines.push(`تنظيف اسم: ${cleaned}`);
      }
    }

    if (fixIds.has(`partial_bound_${p.id}`)) {
      p.blockType = 'full';
      p.status = 'محجوب';
      p.blockedIndividuals = p.individuals ?? 0;
      changed = true;
      fixedCount += 1;
      summaryLines.push(`تصحيح حظر كامل لـ ${p.name}`);
    } else if (fixIds.has(`status_sync_${p.id}`)) {
      p.status =
        p.blockType === 'full'
          ? 'محجوب'
          : p.blockType === 'archived'
          ? 'مؤرشف'
          : '';
      changed = true;
      fixedCount += 1;
      summaryLines.push(`مزامنة حالة ${p.name}`);
    }

    if (fixIds.has(`dangling_agency_${p.id}`) && state.agencies[0]) {
      p.agencyId = state.agencies[0].id;
      changed = true;
      fixedCount += 1;
      summaryLines.push(`ربط ${p.name} بوكالة ${state.agencies[0].name}`);
    }

    if (fixIds.has(`missing_date_${p.id}`) && !p.updatedAt) {
      p.updatedAt = today;
      changed = true;
      fixedCount += 1;
    }

    if (changed) {
      p.updatedAt = today;
    }
  }

  if (fixIds.has('calc_settings_invalid')) {
    nextCalc = {
      ...nextCalc,
      kgPerIndividual: Math.max(1, nextCalc.kgPerIndividual || 9),
      kgPerBag: Math.max(1, nextCalc.kgPerBag || 50),
      feePerIndividualIqd: Math.max(0, nextCalc.feePerIndividualIqd || 0),
      fixedCardFeeIqd: Math.max(0, nextCalc.fixedCardFeeIqd || 0),
    };
    fixedCount += 1;
    summaryLines.push('تصحيح معاملات الحاسبة');
  }

  if (fixIds.has('orphaned_ready_items')) {
    const validListIds = new Set(state.readyLists.map((l) => l.id));
    nextReadyListItems = state.readyListItems.filter((it) =>
      validListIds.has(it.listId)
    );
    fixedCount += 1;
    summaryLines.push('تنظيف صفوف القوائم الجاهزة غير المرتبطة');
  }

  return {
    nextState: {
      ...state,
      persons: nextPersons,
      readyListItems: nextReadyListItems,
      calculationSettings: nextCalc,
    },
    fixedCount,
    summaryLines,
  };
}

export function getProactiveHealthNotice(
  state: AppDatabaseState,
  lastBackupAt?: string | null
): string | null {
  const report = runAppDiagnostics(state, lastBackupAt);
  if (report.totalIssues === 0) return null;
  if (report.highCount > 0) {
    const firstHigh = report.issues.find((i) => i.severity === 'high');
    return `تنبيه ذكي: يوجد ${report.highCount} ملاحظة مهمة (${firstHigh?.title || 'فحص السجلات'}). قل «افحص التطبيق» للمراجعة.`;
  }
  const hasBackupIssue = report.issues.some((i) => i.id === 'backup_stale');
  if (hasBackupIssue && report.totalIssues === 1) {
    return 'تنبيه لطيف: مرّ وقت بدون نسخة احتياطية جديدة — تقدر تاخذ نسخة JSON بضغطة وحدة.';
  }
  return `ملاحظة سريعة: التطبيق شغال تمام، ولقيت ${report.totalIssues} تحسين مقترح عند الفحص.`;
}

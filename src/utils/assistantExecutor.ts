import * as XLSX from 'xlsx';
import type {
  Agency,
  AppDatabaseState,
  AppModeTier,
  AppThemeId,
  AppView,
  CalculationSettings,
  Person,
  SettingsSectionId,
} from '../types/agency.ts';
import type {
  AssistantChoiceChip,
  AssistantExternalTableCommand,
  AssistantMessage,
  AssistantMutationHandlers,
  AssistantSlotSession,
  AssistantToolCall,
  AssistantUiContext,
  DiagnosticSummary,
} from '../types/assistant.ts';
import {
  computeAgencyMetrics,
  formatIqd,
  formatTotalQuota,
  getEffectiveAllocationForPerson,
  initialLetter,
} from './agencyLogic.ts';
import { runAppDiagnostics } from './assistantDiagnostics.ts';
import {
  findKnowledgeEntry,
  formatKnowledgeAnswer,
} from './assistantKnowledgeBase.ts';
import { fuzzyMatchPersons } from './assistantOfflineBrain.ts';
import {
  buildBeforeAfterDiff,
  cloneReadOnlySandbox,
  findAgencyByIdOrFallback,
  resolvePersonTarget,
} from './assistantTools.ts';
import {
  exportFinancialReportToExcel,
  exportReadyListToExcel,
  exportReadyListToImage,
  exportReadyListToTextFile,
  printViaIframe,
} from './excelExport.ts';

export interface AssistantActionRuntime {
  state: AppDatabaseState;
  uiContext: AssistantUiContext;
  mutations: AssistantMutationHandlers;
  navigate: (view: AppView, settingsSection?: SettingsSectionId) => void;
  selectAgency: (agencyId: number) => void;
  focusPerson: (personId: number | null) => void;
  issueTableCommand: (cmd: Omit<AssistantExternalTableCommand, 'nonce'>) => void;
  triggerSpotlight: (opts: {
    view: AppView;
    settingsSection?: SettingsSectionId;
    targetId: string;
    title: string;
    description: string;
  }) => void;
  setModeTier: (tier: AppModeTier) => void;
  setAppTheme: (themeId: AppThemeId) => void;
  setAllowCloudNames: (allowed: boolean) => void;
  saveUserPref: (key: string, label: string, value: string | boolean | number) => void;
  deleteUserPref: (prefId: string) => void;
  applyAutoFixes: (issueIds?: string[]) => { fixedCount: number; summaryLines: string[] };
  exportBackupJson: (silentAuto?: boolean) => void;
  archiveCurrentPeriod: () => void;
}

export interface ToolExecutionResolution {
  replyText: string;
  gracefulLevel: 'A' | 'B' | 'C';
  choices?: AssistantChoiceChip[];
  confirmationDiff?: ReturnType<typeof buildBeforeAfterDiff>;
  nextSlotSession?: AssistantSlotSession | null;
  spotlightAction?: AssistantMessage['spotlightAction'];
  sandboxNotice?: string;
  diagnosticsReport?: DiagnosticSummary;
  switchedToOffline?: boolean;
}

export function exportSandboxRosterToExcel(params: {
  filename: string;
  persons: ReadonlyArray<Person>;
  agencies: ReadonlyArray<Agency>;
  settings: Readonly<CalculationSettings>;
  hideStatusColumn?: boolean;
}) {
  const { filename, persons, agencies, settings, hideStatusColumn } = params;
  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));

  const rows = persons.map((person, idx) => {
    const eff = getEffectiveAllocationForPerson(person, settings);
    const base: Record<string, string | number> = {
      '#': idx + 1,
      الحرف: initialLetter(person.name),
      الاسم: person.name,
      الوكالة: agencyMap.get(person.agencyId) || '',
      'الأفراد المستحقون':
        eff.summary.scope === 'partial'
          ? `${eff.eligibleIndividuals} من ${person.individuals ?? 0}`
          : eff.summary.scope === 'full'
          ? 0
          : person.individuals ?? '',
      الحصة: eff.quotaText,
      'المبلغ (د.ع)': eff.priceIqd ?? 0,
    };
    if (!hideStatusColumn) {
      base['الحالة'] = eff.summary.shortLabel;
    }
    base['الملاحظات'] = person.notes || '';
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, 'نسخة معزولة');
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function printSandboxRosterPdf(params: {
  title: string;
  persons: ReadonlyArray<Person>;
  agencies: ReadonlyArray<Agency>;
  settings: Readonly<CalculationSettings>;
  hideStatusColumn?: boolean;
}) {
  const { title, persons, agencies, settings, hideStatusColumn } = params;
  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));
  const rowsHtml = persons
    .map((p, idx) => {
      const eff = getEffectiveAllocationForPerson(p, settings);
      return `<tr>
        <td>${idx + 1}</td>
        <td>${initialLetter(p.name)}</td>
        <td style="text-align:right">${p.name}</td>
        <td>${agencyMap.get(p.agencyId) || ''}</td>
        <td>${eff.eligibleIndividuals ?? 0}</td>
        <td>${eff.quotaText}</td>
        <td>${eff.priceText}</td>
        ${hideStatusColumn ? '' : `<td>${eff.summary.shortLabel}</td>`}
        <td>${p.notes || ''}</td>
      </tr>`;
    })
    .join('');

  printViaIframe(`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>${title}</title>
<style>
  body { font-family: Cairo, Tahoma, Arial, sans-serif; padding: 18px; color: #0f172a; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .note { font-size: 11px; color: #475569; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #94a3b8; padding: 6px; text-align: center; }
  th { background: #e2e8f0; }
</style></head>
<body>
  <h1>${title}</h1>
  <div class="note">نسخة تقرير معزولة للقراءة فقط (Sandbox)</div>
  <table>
    <thead><tr><th>#</th><th>الحرف</th><th>الاسم</th><th>الوكالة</th><th>الأفراد</th><th>الحصة</th><th>المبلغ</th>${
      hideStatusColumn ? '' : '<th>الحالة</th>'
    }<th>الملاحظات</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`);
}

/**
 * Resolves a validated ToolCall. Read-only operations execute immediately;
 * state-mutating operations verify slots and emit a Before/After confirmation card.
 */
export function resolveToolExecution(
  toolCall: AssistantToolCall,
  runtime: AssistantActionRuntime,
  cloudText?: string
): ToolExecutionResolution {
  const { state, uiContext } = runtime;
  const agencyMap = new Map(state.agencies.map((a) => [a.id, a.name]));

  switch (toolCall.name) {
    case 'search_person': {
      const query = String(toolCall.args.query || '').trim();
      const agencyId = toolCall.args.agencyId ? Number(toolCall.args.agencyId) : null;
      const matches = fuzzyMatchPersons(query, state.persons, agencyId);
      if (matches.length === 0) {
        return {
          gracefulLevel: 'B',
          replyText: `ما لقيت أي سجل مطابق لـ «${query}». جرّب جزء آخر من الاسم.`,
        };
      }
      if (matches.length === 1) {
        const p = matches[0].person;
        runtime.selectAgency(p.agencyId);
        runtime.navigate('agency_roster');
        runtime.focusPerson(p.id);
        runtime.issueTableCommand({
          agencyId: p.agencyId,
          searchQuery: '',
          focusPersonId: p.id,
        });
        return {
          gracefulLevel: 'A',
          replyText:
            cloudText ||
            `لقيت «${p.name}» في ${agencyMap.get(p.agencyId) || 'الوكالة'} (${
              p.individuals ?? 0
            } أفراد · ${p.status || 'نشط'}). فتحت الجدول وحددت سطره.`,
        };
      }
      return {
        gracefulLevel: 'A',
        replyText: `لقيت ${matches.length} أسماء مطابقة، اختر الاسم المطلوب للانتقال إلى سطره:`,
        choices: matches.slice(0, 6).map(({ person }) => ({
          id: `sr_${person.id}`,
          label: person.name,
          sublabel: `${agencyMap.get(person.agencyId) || ''} · ${person.individuals ?? 0} أفراد`,
          actionType: 'select_person',
          payload: { personId: person.id, followUpAction: 'focus_person' },
        })),
      };
    }

    case 'add_person': {
      const name = String(toolCall.args.name || '').trim();
      const agency = findAgencyByIdOrFallback(state, toolCall.args.agencyId);
      const hasIndividuals =
        toolCall.args.individuals !== undefined &&
        toolCall.args.individuals !== null &&
        Number.isFinite(Number(toolCall.args.individuals));

      if (!name) {
        return {
          gracefulLevel: 'B',
          replyText: 'اكتب اسم المستفيد الكامل حتى أجهز الإضافة.',
        };
      }
      if (!agency) {
        return {
          gracefulLevel: 'B',
          replyText: `لإضافة «${name}»، اختر الوكالة أولاً:`,
          nextSlotSession: {
            intent: 'add_person',
            collectedArgs: {
              name,
              ...(hasIndividuals ? { individuals: Number(toolCall.args.individuals) } : {}),
            },
            missingSlot: 'agencyId',
            originalPrompt: name,
          },
          choices: state.agencies.map((ag) => ({
            id: `slot_ag_${ag.id}`,
            label: `${ag.icon} ${ag.name}`,
            actionType: 'slot_answer',
            payload: { agencyId: ag.id },
          })),
        };
      }
      if (!hasIndividuals) {
        return {
          gracefulLevel: 'B',
          replyText: `كم عدد الأفراد لعائلة «${name}» في ${agency.name}؟`,
          nextSlotSession: {
            intent: 'add_person',
            collectedArgs: { name, agencyId: agency.id },
            missingSlot: 'individuals',
            originalPrompt: name,
          },
          choices: [2, 3, 4, 5, 6, 7, 8].map((n) => ({
            id: `slot_ind_${n}`,
            label: `${n} أفراد`,
            actionType: 'slot_answer',
            payload: { individuals: n },
          })),
        };
      }

      const diff = buildBeforeAfterDiff(state, toolCall, uiContext.focusedPersonId);
      return {
        gracefulLevel: 'A',
        replyText:
          cloudText || 'جهّزت بطاقة «قبل ← بعد» لتأكيد إضافة العائلة:',
        confirmationDiff: diff,
      };
    }

    case 'update_person':
    case 'archive_person': {
      const { exact, candidates } = resolvePersonTarget(
        state,
        toolCall.args,
        uiContext.focusedPersonId
      );
      if (!exact) {
        if (candidates.length > 1) {
          return {
            gracefulLevel: 'B',
            replyText: 'أكثر من اسم يطابق طلبك، اختر الشخص المقصود:',
            choices: candidates.slice(0, 5).map((p) => ({
              id: `amb_${p.id}`,
              label: p.name,
              sublabel: `${agencyMap.get(p.agencyId) || ''} · ${p.individuals ?? 0} أفراد`,
              actionType: 'select_person',
              payload: {
                personId: p.id,
                followUpAction: toolCall.name,
                patchArgs: toolCall.args,
              },
            })),
          };
        }
        return {
          gracefulLevel: 'B',
          replyText: 'ما لقيت الشخص المطلوب بدقة. انقر على صفه في الجدول أو اكتب اسمه الثلاثي.',
        };
      }

      const patchedCall: AssistantToolCall = {
        ...toolCall,
        args: { ...toolCall.args, personId: exact.id },
      };
      const diff = buildBeforeAfterDiff(state, patchedCall, uiContext.focusedPersonId);
      if (!diff) {
        return {
          gracefulLevel: 'B',
          replyText: `السجل «${exact.name}» يطابق القيم المطلوبة أصلاً بدون تغيير.`,
        };
      }
      return {
        gracefulLevel: 'A',
        replyText:
          toolCall.name === 'archive_person'
            ? 'المساعد يحفظ بياناتك بالأرشفة الآمنة فقط (بدون مسح نهائي). وافق للتأكيد:'
            : cloudText || 'راجع التغييرات في بطاقة «قبل ← بعد» ووافق للتنفيذ:',
        confirmationDiff: diff,
      };
    }

    case 'filter_sort_table': {
      const targetAgencyId =
        toolCall.args.agencyId !== undefined && toolCall.args.agencyId !== null
          ? Number(toolCall.args.agencyId)
          : uiContext.selectedAgencyId;

      if (targetAgencyId && targetAgencyId > 0) {
        runtime.selectAgency(targetAgencyId);
        runtime.navigate('agency_roster');
      } else {
        runtime.navigate('master_roster');
      }

      runtime.issueTableCommand({
        agencyId: targetAgencyId ?? null,
        searchQuery:
          toolCall.args.searchQuery !== undefined
            ? String(toolCall.args.searchQuery)
            : undefined,
        statusFilter: toolCall.args.statusFilter as
          | 'all'
          | 'active'
          | 'blocked'
          | 'archived'
          | undefined,
        sortBy: toolCall.args.sortBy as
          | 'default'
          | 'name_asc'
          | 'individuals_desc'
          | undefined,
        hideColumns: Array.isArray(toolCall.args.hideColumns)
          ? (toolCall.args.hideColumns as string[])
          : undefined,
        showColumns: Array.isArray(toolCall.args.showColumns)
          ? (toolCall.args.showColumns as string[])
          : undefined,
      });

      return {
        gracefulLevel: 'A',
        replyText: cloudText || 'طبّقت الفلترة والترتيب المطلوب على الجدول.',
      };
    }

    case 'get_stats_profit': {
      const ag = findAgencyByIdOrFallback(state, toolCall.args.agencyId);
      const scopedPersons = ag
        ? state.persons.filter((p) => p.agencyId === ag.id)
        : state.persons;
      const scopedExpenses = ag
        ? state.expenses.filter((e) => e.agencyId === ag.id)
        : state.expenses;
      const m = computeAgencyMetrics(
        scopedPersons,
        scopedExpenses,
        state.calculationSettings
      );
      const scopeName = ag ? ag.name : 'جميع الوكالات';
      return {
        gracefulLevel: 'A',
        replyText: [
          `إحصائيات ${scopeName} (بحسب إعدادات الحاسبة الحالية):`,
          `• العائلات النشطة: ${m.activeHouseholds} من ${m.registeredHouseholds} (محجوب: ${m.blockedCount})`,
          `• الأفراد المستحقون: ${m.activeIndividuals} فرد`,
          `• إجمالي الحصة: ${formatTotalQuota(m.totalKg, state.calculationSettings)} (${m.fullBags} كيس)`,
          `• الإيرادات: ${formatIqd(m.revenue)} | المصاريف: ${formatIqd(m.totalExpenses)}`,
          `• صافي الربح: ${formatIqd(m.profit)}`,
        ].join('\n'),
      };
    }

    case 'manage_ready_list': {
      const action = String(toolCall.args.action || 'open_list');
      if (action === 'create') {
        const diff = buildBeforeAfterDiff(state, toolCall, uiContext.focusedPersonId);
        return {
          gracefulLevel: 'A',
          replyText: 'جهّزت إنشاء القائمة الجاهزة للتأكيد:',
          confirmationDiff: diff,
        };
      }
      if (action === 'add_member') {
        const listId = Number(toolCall.args.listId) || state.readyLists[0]?.id;
        const { exact } = resolvePersonTarget(
          state,
          { personId: toolCall.args.personId, targetName: toolCall.args.personName },
          uiContext.focusedPersonId
        );
        if (listId && exact) {
          runtime.mutations.addPersonsToReadyList(listId, [exact.id]);
          const listName = state.readyLists.find((l) => l.id === listId)?.name || 'القائمة';
          return {
            gracefulLevel: 'A',
            replyText: `أضفت «${exact.name}» إلى قائمة «${listName}» فوراً.`,
          };
        }
      }
      runtime.navigate('ready_lists');
      return {
        gracefulLevel: 'A',
        replyText: cloudText || 'فتحت لك شاشة القوائم الجاهزة.',
      };
    }

    case 'manage_expense': {
      if (toolCall.args.action === 'add') {
        const diff = buildBeforeAfterDiff(state, toolCall, uiContext.focusedPersonId);
        if (!diff) {
          return {
            gracefulLevel: 'B',
            replyText: 'حدد مبلغ المصروف والوكالة حتى أجهز قيد المصروف للتأكيد.',
          };
        }
        return {
          gracefulLevel: 'A',
          replyText: 'راجع تفاصيل المصروف قبل إضافته:',
          confirmationDiff: diff,
        };
      }
      runtime.navigate('finance');
      return {
        gracefulLevel: 'A',
        replyText: 'فتحت لك شاشة الحسابات والمصاريف.',
      };
    }

    case 'open_import_compare': {
      if (toolCall.args.source === 'backup') {
        runtime.navigate('settings', 'security_data');
        return {
          gracefulLevel: 'A',
          replyText: 'فتحت قسم الأمان والنسخ الاحتياطي.',
        };
      }
      runtime.navigate('quick_extract');
      return {
        gracefulLevel: 'A',
        replyText: 'فتحت شاشة السحب السريع (PDF والكاميرا والاستيراد).',
      };
    }

    case 'export_sandbox': {
      // Strictly clone & recursively freeze data snapshot before running any export
      const sandboxSnapshot = cloneReadOnlySandbox({
        agencies: state.agencies,
        persons: state.persons,
        expenses: state.expenses,
        readyLists: state.readyLists,
        readyListItems: state.readyListItems,
        calculationSettings: state.calculationSettings,
      });

      const format = String(toolCall.args.format || 'excel') as
        | 'excel'
        | 'pdf'
        | 'image'
        | 'text';
      const target = String(toolCall.args.target || 'roster') as
        | 'roster'
        | 'finance'
        | 'ready_list';
      const ag = findAgencyByIdOrFallback(sandboxSnapshot as unknown as AppDatabaseState, toolCall.args.agencyId);
      const hideStatusPref =
        Boolean(toolCall.args.hideStatusColumn) ||
        uiContext.preferences.some(
          (p) => p.key === 'hide_status_in_reports' && String(p.value) === 'true'
        );

      const scopedPersons = ag
        ? sandboxSnapshot.persons.filter((p) => p.agencyId === ag.id)
        : sandboxSnapshot.persons;
      const scopedExpenses = ag
        ? sandboxSnapshot.expenses.filter((e) => e.agencyId === ag.id)
        : sandboxSnapshot.expenses;
      const targetTitle = ag ? ag.name : 'جميع الوكالات';

      if (target === 'finance') {
        exportFinancialReportToExcel({
          agencyName: targetTitle,
          persons: [...scopedPersons],
          expenses: [...scopedExpenses],
          settings: { ...sandboxSnapshot.calculationSettings },
        });
      } else if (target === 'ready_list') {
        const list =
          sandboxSnapshot.readyLists.find(
            (l) => l.id === Number(toolCall.args.listId)
          ) || sandboxSnapshot.readyLists[0];
        if (!list) {
          return {
            gracefulLevel: 'B',
            replyText: 'لا توجد قائمة جاهزة حالياً لتصديرها.',
          };
        }
        const listItems = sandboxSnapshot.readyListItems.filter(
          (it) => it.listId === list.id
        );
        if (format === 'image') {
          void exportReadyListToImage({
            list: { ...list },
            items: listItems.map((it) => ({ ...it })),
            persons: [...sandboxSnapshot.persons],
            settings: { ...sandboxSnapshot.calculationSettings },
          });
        } else if (format === 'text') {
          exportReadyListToTextFile({
            list: { ...list },
            items: listItems.map((it) => ({ ...it })),
            persons: [...sandboxSnapshot.persons],
            settings: { ...sandboxSnapshot.calculationSettings },
          });
        } else {
          exportReadyListToExcel({
            list: { ...list },
            items: listItems.map((it) => ({ ...it })),
            persons: [...sandboxSnapshot.persons],
            settings: { ...sandboxSnapshot.calculationSettings },
          });
        }
      } else if (format === 'pdf') {
        printSandboxRosterPdf({
          title: `تقرير ${targetTitle}`,
          persons: scopedPersons,
          agencies: sandboxSnapshot.agencies,
          settings: sandboxSnapshot.calculationSettings,
          hideStatusColumn: hideStatusPref,
        });
      } else {
        exportSandboxRosterToExcel({
          filename: `تقرير_${targetTitle}`,
          persons: scopedPersons,
          agencies: sandboxSnapshot.agencies,
          settings: sandboxSnapshot.calculationSettings,
          hideStatusColumn: hideStatusPref,
        });
      }

      return {
        gracefulLevel: 'A',
        replyText: `تم تصدير تقرير «${targetTitle}» (${format.toUpperCase()}) بنجاح${
          hideStatusPref ? ' مع إخفاء عمود الحالة حسب تفضيلك' : ''
        }.`,
        sandboxNotice:
          'نُفّذ التصدير على نسخة معزولة للقراءة فقط (Sandbox) — الجدول الأصلي لم يتأثر إطلاقاً.',
      };
    }

    case 'backup_restore': {
      const action = String(toolCall.args.action || 'backup_json');
      if (action === 'archive_period') {
        runtime.archiveCurrentPeriod();
        runtime.navigate('data_archives');
        return {
          gracefulLevel: 'A',
          replyText: 'تم حفظ لقطة أرشفة شهرية جديدة وفتح سجل البيانات التاريخية.',
        };
      }
      if (action === 'list_archives') {
        runtime.navigate('data_archives');
        return {
          gracefulLevel: 'A',
          replyText: `لديك ${(state.monthlyArchives || []).length} أرشيف شهري محفوظ. فتحت لك القسم.`,
        };
      }
      runtime.exportBackupJson(false);
      return {
        gracefulLevel: 'A',
        replyText: 'تم تنزيل نسخة احتياطية كاملة (JSON) إلى جهازك بنجاح.',
      };
    }

    case 'navigate_focus': {
      const view = (toolCall.args.view as AppView) || 'hub';
      const agencyId = toolCall.args.agencyId ? Number(toolCall.args.agencyId) : null;
      const personId = toolCall.args.personId ? Number(toolCall.args.personId) : null;
      const section = toolCall.args.settingsSection as SettingsSectionId | undefined;
      if (agencyId) runtime.selectAgency(agencyId);
      runtime.navigate(view, section);
      if (personId) {
        runtime.focusPerson(personId);
        runtime.issueTableCommand({
          agencyId: agencyId ?? null,
          focusPersonId: personId,
        });
      }
      if (toolCall.args.highlightTargetId) {
        runtime.triggerSpotlight({
          view,
          settingsSection: section,
          targetId: String(toolCall.args.highlightTargetId),
          title: 'تحديد الموضع المطلوب',
          description: 'هذا هو العنصر أو القسم الذي طلبته.',
        });
      }
      return {
        gracefulLevel: 'A',
        replyText: cloudText || 'انتقلت لك للشاشة المطلوبة.',
      };
    }

    case 'update_settings': {
      const action = String(toolCall.args.action || '');
      if (action === 'save_pref') {
        const key = String(toolCall.args.key || 'custom_pref');
        const label = String(toolCall.args.label || 'تفضيل مخصص');
        const value = String(toolCall.args.value ?? 'true');
        runtime.saveUserPref(key, label, value);
        return {
          gracefulLevel: 'A',
          replyText: `تم حفظ التفضيل: «${label}». سأطبقه تلقائياً في المرات القادمة.`,
        };
      }
      if (action === 'set_mode' && toolCall.args.value) {
        runtime.setModeTier(toolCall.args.value as AppModeTier);
        return {
          gracefulLevel: 'A',
          replyText: `تم تبديل وضع التطبيق إلى: ${String(toolCall.args.value)}.`,
        };
      }
      if (action === 'set_theme' && toolCall.args.value) {
        runtime.setAppTheme(toolCall.args.value as AppThemeId);
        return {
          gracefulLevel: 'A',
          replyText: `تم تغيير ثيم التطبيق إلى: ${String(toolCall.args.value)}.`,
        };
      }
      if (action === 'toggle_cloud_names') {
        const allowed = String(toolCall.args.value) === 'true';
        runtime.setAllowCloudNames(allowed);
        return {
          gracefulLevel: 'A',
          replyText: allowed
            ? 'تم تفعيل إرسال الأسماء للسحابة عند الاستفسار.'
            : 'تم حجب إرسال أسماء المستفيدين للسحابة (الوضع الآمن الافتراضي).',
        };
      }
      runtime.navigate('settings', 'general');
      return {
        gracefulLevel: 'A',
        replyText: 'فتحت لك شاشة الإعدادات.',
      };
    }

    case 'explain_feature': {
      const query = String(toolCall.args.query || toolCall.args.topicId || '');
      const kb = findKnowledgeEntry(query);
      if (!kb) {
        return {
          gracefulLevel: 'B',
          replyText:
            cloudText ||
            'اسألني عن أي قسم بالاسم مثل: «وريني القوائم الجاهزة» أو «شلون أحسب الأرباح؟».',
        };
      }
      return {
        gracefulLevel: 'A',
        replyText: formatKnowledgeAnswer(kb),
        spotlightAction: {
          label: `وريني (${kb.title})`,
          view: kb.targetView,
          settingsSection: kb.settingsSection,
          targetId: kb.domTargetId,
        },
      };
    }

    case 'run_diagnostics': {
      const report = runAppDiagnostics(state, uiContext.lastBackupAt);
      const autoFix = Boolean(toolCall.args.autoFix);
      if (autoFix && report.autoFixableCount > 0) {
        return {
          gracefulLevel: 'A',
          replyText: `لقيت ${report.autoFixableCount} مشكلة قابلة للإصلاح الآمن. راجع بطاقة «قبل ← بعد» ووافق:`,
          diagnosticsReport: report,
          confirmationDiff: buildBeforeAfterDiff(state, toolCall, uiContext.focusedPersonId),
        };
      }
      return {
        gracefulLevel: 'A',
        diagnosticsReport: report,
        replyText:
          report.totalIssues === 0
            ? `فحص التطبيق مكتمل (${report.healthScore}%): ما لقيت أي مشاكل أو تكرارات.`
            : `فحص التطبيق مكتمل (${report.healthScore}%): لقيت ${report.totalIssues} ملاحظة (${report.highCount} مهمة · ${report.autoFixableCount} قابلة للإصلاح التلقائي).`,
      };
    }
  }
}

export function executeApprovedToolMutation(
  toolCall: AssistantToolCall,
  runtime: AssistantActionRuntime
): string {
  const { state, mutations } = runtime;
  const agencyMap = new Map(state.agencies.map((a) => [a.id, a.name]));

  if (toolCall.name === 'add_person') {
    const agencyId = Number(toolCall.args.agencyId) || state.agencies[0]?.id || 1;
    const name = String(toolCall.args.name || '').trim();
    const individuals = Math.max(0, Number(toolCall.args.individuals ?? 0));
    const predictedNextId =
      state.persons.reduce((max, p) => Math.max(max, p.id), 100) + 1;

    mutations.addPersonDirect({
      agencyId,
      name,
      nationalId: String(toolCall.args.nationalId || ''),
      individuals,
      notes: String(toolCall.args.notes || ''),
    });

    runtime.selectAgency(agencyId);
    runtime.navigate('agency_roster');
    runtime.focusPerson(predictedNextId);
    runtime.issueTableCommand({
      agencyId,
      searchQuery: '',
      focusPersonId: predictedNextId,
    });
    return `تمت إضافة «${name}» (${individuals} أفراد) إلى ${
      agencyMap.get(agencyId) || 'الوكالة'
    } وتم إبراز سطره في الجدول.`;
  }

  if (toolCall.name === 'update_person') {
    const personId = Number(toolCall.args.personId);
    const patch: Partial<Person> = {};
    if (toolCall.args.name !== undefined) patch.name = String(toolCall.args.name);
    if (toolCall.args.individuals !== undefined) {
      patch.individuals = Math.max(0, Number(toolCall.args.individuals));
    }
    if (toolCall.args.notes !== undefined) patch.notes = String(toolCall.args.notes);
    if (toolCall.args.agencyId !== undefined) {
      patch.agencyId = Number(toolCall.args.agencyId);
    }
    if (toolCall.args.blockType !== undefined) {
      patch.blockType = toolCall.args.blockType as Person['blockType'];
    }
    if (toolCall.args.blockedIndividuals !== undefined) {
      patch.blockedIndividuals = Math.max(
        0,
        Number(toolCall.args.blockedIndividuals)
      );
    }
    if (toolCall.args.blockReason !== undefined) {
      patch.blockReason = String(toolCall.args.blockReason);
    }
    mutations.updatePersonConfirmed(personId, patch);
    const targetPerson = state.persons.find((p) => p.id === personId);
    const targetAg = patch.agencyId || targetPerson?.agencyId;
    if (targetAg) {
      runtime.selectAgency(targetAg);
      runtime.navigate('agency_roster');
      runtime.focusPerson(personId);
      runtime.issueTableCommand({ agencyId: targetAg, focusPersonId: personId });
    }
    return 'تم تنفيذ التعديل بنجاح (ويمكنك استخدام زر التراجع بأي لحظة).';
  }

  if (toolCall.name === 'archive_person') {
    const personId = Number(toolCall.args.personId);
    mutations.updatePersonConfirmed(personId, {
      blockType: 'archived',
      status: 'مؤرشف',
      blockReason: String(toolCall.args.reason || 'أرشفة عبر المساعد الذكي'),
    });
    return 'تمت أرشفة السجل بأمان دون حذفه نهائياً — يبقى محفوظاً ويمكن استرجاعه.';
  }

  if (toolCall.name === 'manage_expense' && toolCall.args.action === 'add') {
    const agencyId = Number(toolCall.args.agencyId) || state.agencies[0]?.id || 1;
    const amountIqd = Math.max(0, Number(toolCall.args.amountIqd ?? 0));
    const category =
      toolCall.args.category === 'worker_wages' ? 'worker_wages' : 'general';
    const description = String(toolCall.args.description || 'مصروف تشغيلي');
    mutations.addExpense({ agencyId, amountIqd, category, description });
    runtime.navigate('finance');
    return `تم تسجيل مصروف بقيمة ${formatIqd(amountIqd)} في ${
      agencyMap.get(agencyId) || 'الوكالة'
    }.`;
  }

  if (toolCall.name === 'manage_ready_list' && toolCall.args.action === 'create') {
    const agencyId = Number(toolCall.args.agencyId) || state.agencies[0]?.id || 1;
    const listName = String(toolCall.args.listName || 'قائمة جديدة');
    mutations.createReadyList({ agencyId, name: listName });
    runtime.navigate('ready_lists');
    return `تم إنشاء القائمة الجاهزة «${listName}» وفتح قسم القوائم.`;
  }

  if (toolCall.name === 'run_diagnostics' && toolCall.args.autoFix) {
    // Automatic JSON backup snapshot before bulk fix
    runtime.exportBackupJson(true);
    const { fixedCount, summaryLines } = runtime.applyAutoFixes();
    if (fixedCount === 0) {
      return 'لا توجد مشاكل إضافية تتطلب إصلاحاً تلقائياً حالياً.';
    }
    return `تم أخذ نسخة احتياطية تلقائية ثم معالجة ${fixedCount} ملاحظة بنجاح:\n• ${summaryLines
      .slice(0, 5)
      .join('\n• ')}`;
  }

  return 'تم تنفيذ الإجراء بنجاح.';
}

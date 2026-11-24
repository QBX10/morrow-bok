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
  AssistantCanvasHandoff,
  AssistantChoiceChip,
  AssistantExternalTableCommand,
  AssistantMessage,
  AssistantMutationHandlers,
  AssistantQuickNote,
  AssistantSlotSession,
  AssistantSmartSuggestion,
  AssistantToolCall,
  AssistantUiContext,
  AssistantUserPref,
  DiagnosticSummary,
  MorrowCanvasMode,
} from '../types/assistant.ts';
import { runAsyncExportTask } from '../hooks/useToastQueue.ts';
import {
  computeAgencyMetrics,
  formatIqd,
  formatTotalQuota,
} from './agencyLogic.ts';
import { runAppDiagnostics } from './assistantDiagnostics.ts';
import {
  findKnowledgeEntry,
  formatKnowledgeAnswer,
} from './assistantKnowledgeBase.ts';
import { fuzzyMatchPersons } from './assistantOfflineBrain.ts';
import {
  computeProactiveInsightsAndForecasts,
  executeMorrowMacro,
  findMatchingMacroByPrompt,
  loadUserMacros,
} from './morrowWorkspaceEngine.ts';
import {
  buildBeforeAfterDiff,
  cloneReadOnlySandbox,
  computeWhatIfSimulation,
  findAgencyByIdOrFallback,
  resolvePersonTarget,
} from './assistantTools.ts';
import {
  exportFinancialReportToExcel,
  exportFormattedRosterToPdf,
  exportReadyListToExcel,
  exportReadyListToImage,
  exportReadyListToTextFile,
  exportRosterToExcel,
} from './excelExport.ts';
import { getExportMemoryFlags } from './exportFormatting.ts';

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
  setDarkTheme: (dark: boolean) => void;
  setAllowCloudNames: (allowed: boolean) => void;
  saveCalculationSettings?: (calc: CalculationSettings) => void;
  saveUserPref: (key: string, label: string, value: string | boolean | number) => void;
  deleteUserPref: (prefId: string) => void;
  applyAutoFixes: (issueIds?: string[]) => { fixedCount: number; summaryLines: string[] };
  exportBackupJson: (silentAuto?: boolean) => void;
  archiveCurrentPeriod: () => void;
  addQuickNote?: (input: {
    text: string;
    source?: 'text' | 'voice';
    overridePersonId?: number | null;
    syncToPerson?: boolean;
  }) => AssistantQuickNote | null;
  openCanvasMode?: (canvasMode: MorrowCanvasMode, agencyId?: number | null) => void;
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
  resultCard?: AssistantMessage['resultCard'];
  canvasHandoff?: AssistantCanvasHandoff;
  suggestedFollowUps?: AssistantSmartSuggestion[];
  extraDraftTools?: AssistantToolCall[];
  switchedToOffline?: boolean;
  stealthExecuted?: boolean;
  autoCloseChat?: boolean;
}

export function exportSandboxRosterToExcel(params: {
  filename: string;
  persons: ReadonlyArray<Person>;
  agencies: ReadonlyArray<Agency>;
  settings: Readonly<CalculationSettings>;
  preferences?: ReadonlyArray<AssistantUserPref>;
  hideStatusColumn?: boolean;
  hideAmountColumn?: boolean;
}) {
  exportRosterToExcel({
    ...params,
    sheetName: 'نسخة معزولة',
  });
}

export function printSandboxRosterPdf(params: {
  title: string;
  persons: ReadonlyArray<Person>;
  agencies: ReadonlyArray<Agency>;
  settings: Readonly<CalculationSettings>;
  preferences?: ReadonlyArray<AssistantUserPref>;
  themeId?: AppThemeId;
  hideStatusColumn?: boolean;
  hideAmountColumn?: boolean;
}) {
  exportFormattedRosterToPdf({
    title: params.title,
    subtitle: 'نسخة تقرير معزولة للقراءة فقط (Sandbox)',
    persons: params.persons,
    agencies: params.agencies,
    settings: params.settings,
    preferences: params.preferences,
    themeId: params.themeId,
    hideStatusColumn: params.hideStatusColumn,
    hideAmountColumn: params.hideAmountColumn,
  });
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
        stealthExecuted: true,
        autoCloseChat: true,
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
      const activePct =
        m.registeredHouseholds > 0
          ? Math.round((m.activeHouseholds / m.registeredHouseholds) * 100)
          : 100;
      const maxMoney = Math.max(m.revenue, m.totalExpenses, Math.abs(m.profit), 1);

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
        resultCard: {
          title: `ملخص ${scopeName}`,
          summary: `${m.activeIndividuals} فرد نشط · ${formatTotalQuota(
            m.totalKg,
            state.calculationSettings
          )} (${m.fullBags} كيس)`,
          scorePercent: activePct,
          scoreLabel: 'نسبة العائلات النشطة',
          tone: m.profit >= 0 ? 'success' : 'warning',
          bars: [
            {
              label: 'الإيرادات المتوقعة',
              value: m.revenue,
              max: maxMoney,
              displayValue: formatIqd(m.revenue),
              color: 'var(--accent)',
            },
            {
              label: 'المصاريف المسجلة',
              value: m.totalExpenses,
              max: maxMoney,
              displayValue: formatIqd(m.totalExpenses),
              color: 'var(--warning)',
            },
            {
              label: 'صافي الربح',
              value: Math.max(0, m.profit),
              max: maxMoney,
              displayValue: formatIqd(m.profit),
              color: m.profit >= 0 ? 'var(--success)' : 'var(--danger)',
            },
          ],
          details: [
            `رسم الفرد المطبق: ${formatIqd(state.calculationSettings.feePerIndividualIqd)}`,
            `العائلات المحجوبة/الموقوفة: ${m.blockedCount}`,
          ],
        },
        canvasHandoff: {
          canvasMode: 'overview_charts',
          label: 'عرض الرسوم البيانية التفاعلية',
          description: `تحليل مرئي لحصص وأرباح ${scopeName} داخل اللوحة`,
          agencyId: ag?.id ?? null,
        },
        suggestedFollowUps: [
          { id: 'fu_stats_fc', label: 'توقعات الحصة القادمة', prompt: 'توقعات الشهر القادم' },
          { id: 'fu_stats_cmp', label: 'مقارنة الوكالات', prompt: 'قارن بين الوكالات' },
        ],
      };
    }

    case 'compare_agencies': {
      const metric = String(toolCall.args.metric || 'individuals');
      const rows = state.agencies.map((ag) => {
        const agPersons = state.persons.filter((p) => p.agencyId === ag.id);
        const agExpenses = state.expenses.filter((e) => e.agencyId === ag.id);
        const m = computeAgencyMetrics(agPersons, agExpenses, state.calculationSettings);
        return { agency: ag, metrics: m };
      });
      if (rows.length === 0) {
        return {
          gracefulLevel: 'B',
          replyText: 'لا توجد وكالات مسجلة للمقارنة حالياً.',
        };
      }
      const sorted = [...rows].sort((a, b) => {
        if (metric === 'profit') return b.metrics.profit - a.metrics.profit;
        if (metric === 'bags') return b.metrics.fullBags - a.metrics.fullBags;
        if (metric === 'blocked') return b.metrics.blockedCount - a.metrics.blockedCount;
        return b.metrics.activeIndividuals - a.metrics.activeIndividuals;
      });
      const metricLabel =
        metric === 'profit'
          ? 'صافي الربح'
          : metric === 'bags'
            ? 'عدد الأكياس'
            : metric === 'blocked'
              ? 'حالات الحجب'
              : 'الأفراد النشطين';
      const maxVal = Math.max(
        1,
        ...sorted.map((r) =>
          metric === 'profit'
            ? Math.max(0, r.metrics.profit)
            : metric === 'bags'
              ? r.metrics.fullBags
              : metric === 'blocked'
                ? r.metrics.blockedCount
                : r.metrics.activeIndividuals
        )
      );
      const top = sorted[0];
      const lines = sorted.map(
        (r, i) =>
          `${i + 1}. ${r.agency.icon || ''} ${r.agency.name}: ${r.metrics.activeIndividuals} أفراد (${r.metrics.activeHouseholds} عائلة) · ${r.metrics.fullBags} كيس · محجوب ${r.metrics.blockedCount} · صافي ${formatIqd(r.metrics.profit)}`
      );
      return {
        gracefulLevel: 'A',
        replyText: `مقارنة الوكالات حسب ${metricLabel} (الأعلى: «${top.agency.name}»):\n${lines.join('\n')}`,
        resultCard: {
          title: `مقارنة الوكالات — حسب ${metricLabel}`,
          summary: `المتصدرة: ${top.agency.name} (${top.metrics.activeIndividuals} فرد · ${top.metrics.fullBags} كيس)`,
          tone: 'accent',
          bars: sorted.slice(0, 6).map((r) => {
            const val =
              metric === 'profit'
                ? Math.max(0, r.metrics.profit)
                : metric === 'bags'
                  ? r.metrics.fullBags
                  : metric === 'blocked'
                    ? r.metrics.blockedCount
                    : r.metrics.activeIndividuals;
            return {
              label: r.agency.name,
              value: val,
              max: maxVal,
              displayValue:
                metric === 'profit'
                  ? formatIqd(r.metrics.profit)
                  : metric === 'bags'
                    ? `${r.metrics.fullBags} كيس`
                    : metric === 'blocked'
                      ? `${r.metrics.blockedCount} محجوب`
                      : `${r.metrics.activeIndividuals} فرد`,
            };
          }),
          details: [
            `إجمالي الوكالات المقارنة: ${rows.length}`,
            `الفرق عن الأعلى قابل للمتابعة في اللوحة التفاعلية`,
          ],
        },
        canvasHandoff: {
          canvasMode: 'overview_charts',
          label: 'فتح لوحة المقارنة الرسومية',
          description: 'تبديل بين الأفراد والأكياس وصافي الربح بصرياً',
        },
        suggestedFollowUps: [
          { id: 'fu_cmp_rep', label: 'توليد تقرير تنفيذي', prompt: 'جهز تقرير تنفيذي شامل' },
          { id: 'fu_cmp_xls', label: 'تصدير إكسل معزول', prompt: 'صدر تقرير اكسل' },
        ],
      };
    }

    case 'add_quick_note': {
      const text = String(toolCall.args.text || '').trim();
      if (!text) {
        return {
          gracefulLevel: 'B',
          replyText: 'اكتب نص الملاحظة المطلوب حفظها.',
        };
      }
      const hasPersonHint =
        toolCall.args.personId !== undefined || Boolean(toolCall.args.personName);
      const resolvedPerson = hasPersonHint
        ? resolvePersonTarget(
            state,
            {
              personId: toolCall.args.personId,
              targetName: toolCall.args.personName,
            },
            uiContext.focusedPersonId
          ).exact
        : null;

      const syncToPerson =
        toolCall.args.syncToPerson === undefined ? true : Boolean(toolCall.args.syncToPerson);

      if (runtime.addQuickNote) {
        const saved = runtime.addQuickNote({
          text,
          source: 'text',
          overridePersonId: resolvedPerson ? resolvedPerson.id : undefined,
          syncToPerson,
        });
        return {
          gracefulLevel: 'A',
          replyText: saved?.linkedPersonName
            ? `تم حفظ الملاحظة السريعة وربطها تلقائياً بـ «${saved.linkedPersonName}»${
                saved.syncedToPersonNotes ? ' ومزامنتها مع سجل العائلة.' : '.'
              }`
            : 'تم حفظ الملاحظة السريعة في قسم الملاحظات بنجاح.',
          choices: [
            {
              id: `open_qn_${Date.now()}`,
              label: 'فتح الملاحظات السريعة',
              actionType: 'open_command_center_tab',
              payload: { tab: 'quick_notes' },
            },
          ],
        };
      }
      return {
        gracefulLevel: 'B',
        replyText: 'افتح قسم الملاحظات السريعة لحفظ هذه الملاحظة.',
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
        const requestedName = String(toolCall.args.listName || '').trim();
        const matchedList =
          (toolCall.args.listId
            ? state.readyLists.find((l) => l.id === Number(toolCall.args.listId))
            : null) ||
          (requestedName
            ? state.readyLists.find((l) => l.name.includes(requestedName))
            : null) ||
          state.readyLists[0];
        const { exact } = resolvePersonTarget(
          state,
          { personId: toolCall.args.personId, targetName: toolCall.args.personName },
          uiContext.focusedPersonId
        );
        if (matchedList && exact) {
          runtime.mutations.addPersonsToReadyList(matchedList.id, [exact.id]);
          return {
            gracefulLevel: 'A',
            replyText: `أضفت «${exact.name}» إلى قائمة «${matchedList.name}» فوراً.`,
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
      const ag = findAgencyByIdOrFallback(
        sandboxSnapshot as unknown as AppDatabaseState,
        toolCall.args.agencyId
      );
      const memFlags = getExportMemoryFlags(uiContext.preferences);
      const hideStatusPref =
        Boolean(toolCall.args.hideStatusColumn) || memFlags.hideStatusColumn;
      const hideAmountPref =
        Boolean(toolCall.args.hideAmountColumn) || memFlags.hideAmountColumn;

      const scopedPersons = ag
        ? sandboxSnapshot.persons.filter((p) => p.agencyId === ag.id)
        : sandboxSnapshot.persons;
      const scopedExpenses = ag
        ? sandboxSnapshot.expenses.filter((e) => e.agencyId === ag.id)
        : sandboxSnapshot.expenses;
      const targetTitle = ag ? ag.name : 'جميع الوكالات';

      if (target === 'ready_list') {
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
        runAsyncExportTask(
          `جاري تجهيز تصدير «${list.name}»...`,
          `تم تصدير «${list.name}» (${format.toUpperCase()}) بنجاح`,
          async () => {
            if (format === 'image') {
              await exportReadyListToImage({
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
                preferences: uiContext.preferences,
              });
            } else {
              exportReadyListToExcel({
                list: { ...list },
                items: listItems.map((it) => ({ ...it })),
                persons: [...sandboxSnapshot.persons],
                settings: { ...sandboxSnapshot.calculationSettings },
                preferences: uiContext.preferences,
              });
            }
          }
        );
      } else if (target === 'finance') {
        runAsyncExportTask(
          `جاري تجهيز التقرير المالي (${targetTitle})...`,
          `تم تصدير التقرير المالي «${targetTitle}» بنجاح`,
          () => {
            exportFinancialReportToExcel({
              agencyName: targetTitle,
              persons: [...scopedPersons],
              expenses: [...scopedExpenses],
              settings: { ...sandboxSnapshot.calculationSettings },
              preferences: uiContext.preferences,
            });
          }
        );
      } else if (format === 'pdf') {
        runAsyncExportTask(
          `جاري تجهيز طباعة PDF (${targetTitle})...`,
          `تم تجهيز تقرير PDF «${targetTitle}» بنجاح`,
          () => {
            printSandboxRosterPdf({
              title: `تقرير ${targetTitle}`,
              persons: scopedPersons,
              agencies: sandboxSnapshot.agencies,
              settings: sandboxSnapshot.calculationSettings,
              preferences: uiContext.preferences,
              themeId: uiContext.themeId,
              hideStatusColumn: hideStatusPref,
              hideAmountColumn: hideAmountPref,
            });
          }
        );
      } else {
        runAsyncExportTask(
          `جاري تجهيز ملف Excel (${targetTitle})...`,
          `تم تصدير ملف Excel «${targetTitle}» بنجاح`,
          () => {
            exportSandboxRosterToExcel({
              filename: `تقرير_${targetTitle}`,
              persons: scopedPersons,
              agencies: sandboxSnapshot.agencies,
              settings: sandboxSnapshot.calculationSettings,
              preferences: uiContext.preferences,
              hideStatusColumn: hideStatusPref,
              hideAmountColumn: hideAmountPref,
            });
          }
        );
      }

      const appliedRulesNotes = [
        ...(hideAmountPref ? ['إخفاء المبلغ'] : []),
        ...(hideStatusPref ? ['إخفاء الحالة'] : []),
      ];

      return {
        gracefulLevel: 'A',
        stealthExecuted: true,
        autoCloseChat: true,
        replyText: `تم بدء تصدير تقرير «${targetTitle}» (${format.toUpperCase()}) في الخلفية${
          appliedRulesNotes.length > 0 ? ` مع تطبيق (${appliedRulesNotes.join(' و')})` : ''
        }.`,
        sandboxNotice:
          'نُفّذ التصدير غير المحجوب على نسخة معزولة للقراءة فقط (Sandbox) — الجدول الأصلي لم يتأثر.',
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
      const view = ((toolCall.args.view || toolCall.args.targetView) as AppView) || 'hub';
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
        stealthExecuted: true,
        autoCloseChat: true,
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
          replyText: `تم حفظ القاعدة في الذاكرة: «${label}». سأطبقها تلقائياً في التقارير القادمة.`,
        };
      }
      if (action === 'set_dark_theme') {
        const isDark = String(toolCall.args.value) === 'true';
        runtime.setDarkTheme(isDark);
        return {
          gracefulLevel: 'A',
          stealthExecuted: true,
          autoCloseChat: true,
          replyText: isDark
            ? 'تم تفعيل الوضع الليلي بنجاح.'
            : 'تم تفعيل الوضع النهاري بنجاح.',
        };
      }
      if (action === 'set_mode' && toolCall.args.value) {
        runtime.setModeTier(toolCall.args.value as AppModeTier);
        return {
          gracefulLevel: 'A',
          stealthExecuted: true,
          replyText: `تم تبديل وضع التطبيق إلى: ${String(toolCall.args.value)}.`,
        };
      }
      if (action === 'set_theme' && toolCall.args.value) {
        runtime.setAppTheme(toolCall.args.value as AppThemeId);
        return {
          gracefulLevel: 'A',
          stealthExecuted: true,
          autoCloseChat: true,
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
      if (action === 'update_calc') {
        const diff = buildBeforeAfterDiff(state, toolCall, uiContext.focusedPersonId);
        if (!diff) {
          return {
            gracefulLevel: 'B',
            replyText: 'إعدادات الحاسبة الحالية تطابق القيمة المطلوبة بالفعل دون تغيير.',
          };
        }
        return {
          gracefulLevel: 'A',
          replyText: 'جهّزت تعديل معادلات الحاسبة للمراجعة في بطاقة «قبل ← بعد»:',
          confirmationDiff: diff,
        };
      }
      runtime.navigate('settings', 'general');
      return {
        gracefulLevel: 'A',
        stealthExecuted: true,
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
      const diagResultCard: AssistantMessage['resultCard'] = {
        title: 'مؤشر سلامة وصحة البيانات',
        summary:
          report.totalIssues === 0
            ? 'جميع الجداول والمعادلات والنسخ الاحتياطية في حالة ممتازة.'
            : `تم رصد ${report.totalIssues} ملاحظة (${report.highCount} مهمة · ${report.autoFixableCount} قابلة للإصلاح الآمن).`,
        scorePercent: report.healthScore,
        scoreLabel: 'درجة السلامة',
        tone: report.healthScore >= 85 ? 'success' : report.healthScore >= 60 ? 'warning' : 'danger',
        bars: [
          {
            label: 'الملاحظات الحرجة',
            value: report.highCount,
            max: Math.max(report.totalIssues, 1),
            displayValue: String(report.highCount),
            color: 'var(--danger)',
          },
          {
            label: 'قابلة للإصلاح الآمن',
            value: report.autoFixableCount,
            max: Math.max(report.totalIssues, 1),
            displayValue: String(report.autoFixableCount),
            color: 'var(--accent)',
          },
        ],
      };

      if (autoFix && report.autoFixableCount > 0) {
        return {
          gracefulLevel: 'A',
          replyText: `لقيت ${report.autoFixableCount} مشكلة قابلة للإصلاح الآمن. راجع بطاقة «قبل ← بعد» ووافق:`,
          diagnosticsReport: report,
          resultCard: diagResultCard,
          confirmationDiff: buildBeforeAfterDiff(state, toolCall, uiContext.focusedPersonId),
        };
      }
      return {
        gracefulLevel: 'A',
        diagnosticsReport: report,
        resultCard: diagResultCard,
        canvasHandoff:
          report.totalIssues > 0
            ? {
                canvasMode: 'editable_table',
                label: 'مراجعة السجلات في الجدول التفاعلي',
                description: 'تعديل الصفوف مباشرة وتجميعها في مسودات الموافقة',
              }
            : undefined,
        suggestedFollowUps:
          report.autoFixableCount > 0
            ? [
                {
                  id: 'fu_diag_fix',
                  label: 'تجهيز مسودة الإصلاح الآمن',
                  prompt: 'صلح مشاكل الفحص تلقائياً',
                },
              ]
            : [
                {
                  id: 'fu_diag_fc',
                  label: 'توقعات الحصة القادمة',
                  prompt: 'توقعات الشهر القادم',
                },
              ],
        replyText:
          report.totalIssues === 0
            ? `فحص التطبيق مكتمل (${report.healthScore}%): ما لقيت أي مشاكل أو تكرارات.`
            : `فحص التطبيق مكتمل (${report.healthScore}%): لقيت ${report.totalIssues} ملاحظة (${report.highCount} مهمة · ${report.autoFixableCount} قابلة للإصلاح التلقائي).`,
      };
    }

    case 'analyze_period_forecast': {
      const targetAg = findAgencyByIdOrFallback(state, toolCall.args.agencyId);
      const { forecast, analytics } = computeProactiveInsightsAndForecasts({
        state,
        monthlyArchives: state.monthlyArchives,
        activePeriod: state.activePeriod,
        lastBackupAt: uiContext.lastBackupAt,
      });

      const scopedForecast = targetAg
        ? forecast.agencyForecasts.find((f) => f.agencyId === targetAg.id)
        : null;

      const deltaSign = forecast.deltaPercent >= 0 ? '+' : '';
      const maxInd = Math.max(
        1,
        ...forecast.agencyForecasts.map((f) =>
          Math.max(f.currentIndividuals, f.projectedIndividuals)
        )
      );

      const replyLines = scopedForecast
        ? [
            `توقعات الحصة القادمة لـ «${scopedForecast.agencyName}» (${forecast.baselineLabel}):`,
            `• الحالي: ${scopedForecast.currentIndividuals} فرد (${scopedForecast.currentBags} كيس)`,
            `• المتوقع: ${scopedForecast.projectedIndividuals} فرد (${scopedForecast.projectedBags} كيس · ${scopedForecast.changePercent >= 0 ? '+' : ''}${scopedForecast.changePercent}%)`,
            `• الملاحظة التحليلية: ${scopedForecast.note}`,
          ]
        : [
            `${forecast.horizonLabel} — ${forecast.baselineLabel}:`,
            `• الأفراد المتوقعون: ${forecast.projectedIndividuals} فرد (الحالي ${analytics.totals.activeIndividuals} · ${deltaSign}${forecast.deltaPercent}%)`,
            `• الأكياس المتوقعة: ${forecast.projectedBags} كيس كامل`,
            `• صافي الربح التقديري: ${formatIqd(forecast.projectedProfit)}`,
            ...(forecast.recommendations[0] ? [`• توصية: ${forecast.recommendations[0]}`] : []),
          ];

      return {
        gracefulLevel: 'A',
        replyText: replyLines.join('\n'),
        resultCard: {
          title: scopedForecast
            ? `توقعات ${scopedForecast.agencyName}`
            : 'توقعات الحصة القادمة',
          summary: `${forecast.projectedIndividuals} فرد متوقع · ${forecast.projectedBags} كيس · ${formatIqd(
            forecast.projectedProfit
          )}`,
          tone: forecast.agencyForecasts.some((f) => f.riskLevel === 'high')
            ? 'warning'
            : 'accent',
          bars: forecast.agencyForecasts.slice(0, 5).map((f) => ({
            label: f.agencyName,
            value: f.projectedIndividuals,
            max: maxInd,
            displayValue: `${f.projectedIndividuals} فرد (${f.projectedBags} كيس)`,
            color:
              f.riskLevel === 'high'
                ? 'var(--danger)'
                : f.riskLevel === 'medium'
                  ? 'var(--warning)'
                  : 'var(--accent)',
          })),
          details: forecast.recommendations.slice(0, 3),
        },
        canvasHandoff: {
          canvasMode: 'forecast',
          label: 'فتح لوحة التوقعات الكاملة',
          description: 'استعراض انحراف كل وكالة والتوصيات التنبؤية',
          agencyId: targetAg?.id ?? null,
        },
        suggestedFollowUps: [
          { id: 'fu_fc_rep', label: 'بناء تقرير تنفيذي', prompt: 'جهز تقرير تنفيذي شامل' },
          { id: 'fu_fc_mac', label: 'تشغيل جرد الصباح', prompt: 'شغل ماكرو جرد الصباح' },
        ],
      };
    }

    case 'run_morrow_macro': {
      const macros = loadUserMacros();
      const requestedId = String(toolCall.args.macroId || '').trim();
      const triggerPhrase = String(toolCall.args.triggerPhrase || '').trim();
      const matched =
        (requestedId ? macros.find((m) => m.id === requestedId) : null) ||
        (triggerPhrase ? findMatchingMacroByPrompt(triggerPhrase, macros) : null) ||
        macros[0];

      if (!matched) {
        return {
          gracefulLevel: 'B',
          replyText: 'لم يتم العثور على ماكرو مطابق لتشغيله.',
        };
      }

      const macroResult = executeMorrowMacro({
        macro: matched,
        state,
        monthlyArchives: state.monthlyArchives,
        activePeriod: state.activePeriod,
        lastBackupAt: uiContext.lastBackupAt,
      });

      const stepLines = macroResult.steps.map(
        (s, idx) => `${idx + 1}. ${s.label}: ${s.detail}`
      );

      return {
        gracefulLevel: 'A',
        replyText: `تم تنفيذ ماكرو «${matched.name}» (${macroResult.steps.length} خطوات):\n${stepLines.join(
          '\n'
        )}`,
        diagnosticsReport: macroResult.diagnosticsSummary,
        extraDraftTools: macroResult.stagedDraftTools,
        resultCard: {
          title: `مخرجات ماكرو: ${matched.name}`,
          summary: `${macroResult.steps.length} خطوات منفذة · ${macroResult.stagedDraftTools.length} إجراء محفوظ في المراجعة الآمنة`,
          scorePercent: macroResult.diagnosticsSummary?.healthScore,
          scoreLabel: macroResult.diagnosticsSummary ? 'سلامة السجلات' : undefined,
          tone: macroResult.steps.some((s) => s.status === 'warning')
            ? 'warning'
            : 'success',
          details: macroResult.steps.map((s) => `${s.label} — ${s.detail}`),
        },
        canvasHandoff: {
          canvasMode: 'macro_studio',
          label: 'فتح استوديو الماكرو في اللوحة',
          description: 'متابعة خطوات الماكرو أو تعديل القوالب المخصصة',
        },
        suggestedFollowUps:
          macroResult.stagedDraftTools.length > 0
            ? [
                {
                  id: 'fu_macro_rev',
                  label: 'عرض إحصائيات التقرير',
                  prompt: 'احصائيات جميع الوكالات',
                },
              ]
            : undefined,
      };
    }

    case 'summon_workspace_canvas': {
      const mode = (String(toolCall.args.canvasMode || 'overview_charts') as MorrowCanvasMode);
      const agencyId = toolCall.args.agencyId ? Number(toolCall.args.agencyId) : null;
      const modeLabels: Record<MorrowCanvasMode, string> = {
        overview_charts: 'الرسوم البيانية ومؤشرات الوكالات',
        editable_table: 'جدول التعديل المباشر الآمن (Zero-Trust)',
        executive_report: 'مولد التقرير التنفيذي التلقائي',
        forecast: 'نموذج توقع التغييرات والحصة القادمة',
        text_analysis: 'محلل النصوص الذكي واستخراج البيانات',
        macro_studio: 'استوديو الماكرو والأتمتة متعددة الخطوات',
      };
      const label = modeLabels[mode] || modeLabels.overview_charts;
      runtime.openCanvasMode?.(mode, agencyId);
      return {
        gracefulLevel: 'A',
        replyText: cloudText || `تم فتح اللوحة التفاعلية على وضع «${label}».`,
        canvasHandoff: {
          canvasMode: mode,
          label: `الانتقال إلى ${label}`,
          agencyId,
        },
      };
    }

    case 'simulate_what_if': {
      const sim = computeWhatIfSimulation(state, toolCall.args);
      const revSign = sim.deltas.revenue >= 0 ? '+' : '';
      const profitSign = sim.deltas.profit >= 0 ? '+' : '';
      const bagsSign = sim.deltas.bags >= 0 ? '+' : '';
      const indSign = sim.deltas.individuals >= 0 ? '+' : '';

      const maxMoney = Math.max(
        1,
        Math.abs(sim.current.revenue),
        Math.abs(sim.simulated.revenue),
        Math.abs(sim.current.profit),
        Math.abs(sim.simulated.profit)
      );

      const lines = [
        `### نتائج محاكاة «ماذا لو» — ${sim.scopeName}`,
        `السيناريو المختبر: **${sim.scenarioLabel}** (محاكاة آمنة دون تعديل السجلات):`,
        `- **الأفراد المستحقون**: ${sim.current.activeIndividuals} ← **${sim.simulated.activeIndividuals}** (${indSign}${sim.deltas.individuals})`,
        `- **إجمالي الحصة**: ${sim.current.fullBags} كيس ← **${sim.simulated.fullBags} كيس** (${bagsSign}${sim.deltas.bags} كيس · ${sim.deltas.totalKg >= 0 ? '+' : ''}${sim.deltas.totalKg} كغم)`,
        `- **الإيرادات المتوقعة**: ${formatIqd(sim.current.revenue)} ← **${formatIqd(sim.simulated.revenue)}** (${revSign}${formatIqd(sim.deltas.revenue)})`,
        `- **صافي الربح بعد المصاريف**: ${formatIqd(sim.current.profit)} ← **${formatIqd(sim.simulated.profit)}** (${profitSign}${formatIqd(sim.deltas.profit)})`,
      ];

      const applyChoices: AssistantChoiceChip[] = [];
      if (sim.simulatedSettingsPatch?.feePerIndividualIqd !== undefined) {
        const fee = Number(sim.simulatedSettingsPatch.feePerIndividualIqd);
        applyChoices.push({
          id: `whatif_apply_fee_${fee}`,
          label: `تجهيز مسودة اعتماد رسم الفرد ${formatIqd(fee)}`,
          sublabel: 'يمر عبر بوابة الموافقة الآمنة قبل ← بعد',
          tone: 'accent',
          actionType: 'send_prompt',
          payload: { prompt: `خلّي رسم الفرد ${fee}` },
        });
      } else if (sim.simulatedSettingsPatch?.kgPerIndividual !== undefined) {
        const kg = Number(sim.simulatedSettingsPatch.kgPerIndividual);
        applyChoices.push({
          id: `whatif_apply_kg_${kg}`,
          label: `تجهيز مسودة اعتماد حصة الفرد ${kg} كغم`,
          sublabel: 'يمر عبر بوابة الموافقة الآمنة قبل ← بعد',
          tone: 'accent',
          actionType: 'send_prompt',
          payload: { prompt: `خلّي حصة الفرد ${kg}` },
        });
      }

      return {
        gracefulLevel: 'A',
        replyText: lines.join('\n'),
        resultCard: {
          title: `محاكاة: ${sim.scenarioLabel}`,
          summary: `${sim.scopeName} · فرق الصافي ${profitSign}${formatIqd(sim.deltas.profit)} · فرق الأكياس ${bagsSign}${sim.deltas.bags}`,
          tone: sim.deltas.profit >= 0 ? 'success' : 'warning',
          bars: [
            {
              label: 'صافي الربح الحالي',
              value: Math.max(0, sim.current.profit),
              max: maxMoney,
              displayValue: formatIqd(sim.current.profit),
              color: 'var(--text-muted)',
            },
            {
              label: 'صافي الربح في المحاكاة',
              value: Math.max(0, sim.simulated.profit),
              max: maxMoney,
              displayValue: `${formatIqd(sim.simulated.profit)} (${profitSign}${formatIqd(sim.deltas.profit)})`,
              color: sim.deltas.profit >= 0 ? 'var(--success)' : 'var(--danger)',
            },
            {
              label: 'الإيراد المتوقع في المحاكاة',
              value: Math.max(0, sim.simulated.revenue),
              max: maxMoney,
              displayValue: formatIqd(sim.simulated.revenue),
              color: 'var(--accent)',
            },
          ],
          details: [
            `العائلات النشطة: ${sim.simulated.activeHouseholds}`,
            `المصاريف المخصومة: ${formatIqd(sim.simulated.totalExpenses)}`,
            `الوضع: محاكاة افتراضية معزولة دون مساس بقاعدة البيانات`,
          ],
        },
        choices: applyChoices.length > 0 ? applyChoices : undefined,
        suggestedFollowUps: [
          { id: 'fu_wi_fc', label: 'توقعات الشهر القادم', prompt: 'توقعات الشهر القادم' },
          { id: 'fu_wi_brief', label: 'الإيجاز التنفيذي لليوم', prompt: 'أعطني ملخص اليوم' },
        ],
      };
    }

    case 'executive_briefing': {
      const targetAg = findAgencyByIdOrFallback(state, toolCall.args.agencyId);
      const scopedPersons = targetAg
        ? state.persons.filter((p) => p.agencyId === targetAg.id)
        : state.persons;
      const scopedExpenses = targetAg
        ? state.expenses.filter((e) => e.agencyId === targetAg.id)
        : state.expenses;
      const metrics = computeAgencyMetrics(
        scopedPersons,
        scopedExpenses,
        state.calculationSettings
      );
      const diag = runAppDiagnostics(state, uiContext.lastBackupAt);
      const { forecast, insights } = computeProactiveInsightsAndForecasts({
        state,
        monthlyArchives: state.monthlyArchives,
        activePeriod: state.activePeriod,
        lastBackupAt: uiContext.lastBackupAt,
      });

      const agencySummaries = state.agencies.map((ag) => {
        const agP = state.persons.filter((p) => p.agencyId === ag.id);
        const agE = state.expenses.filter((e) => e.agencyId === ag.id);
        return {
          agency: ag,
          metrics: computeAgencyMetrics(agP, agE, state.calculationSettings),
        };
      });
      const topAgency = [...agencySummaries].sort(
        (a, b) => b.metrics.activeIndividuals - a.metrics.activeIndividuals
      )[0];
      const mostBlockedAgency = [...agencySummaries].sort(
        (a, b) => b.metrics.blockedCount - a.metrics.blockedCount
      )[0];
      const maxInd = Math.max(
        1,
        ...agencySummaries.map((a) => a.metrics.activeIndividuals)
      );
      const scopeName = targetAg ? targetAg.name : 'جميع الوكالات';
      const periodLabel = state.activePeriod?.quotaName || 'الحصة الحالية';

      const replyLines = [
        `### الإيجاز التنفيذي اليومي — ${scopeName} (${periodLabel})`,
        `- **الاستحقاق الفعلي**: ${metrics.activeHouseholds} عائلة نشطة · **${metrics.activeIndividuals} فرد** · **${metrics.fullBags} كيس** (${formatTotalQuota(metrics.totalKg, state.calculationSettings)})`,
        `- **الموقف المالي**: إيرادات ${formatIqd(metrics.revenue)} · مصاريف ${formatIqd(metrics.totalExpenses)} · **صافي ${formatIqd(metrics.profit)}**`,
        topAgency
          ? `- **الوكالة الأكثر نشاطاً**: ${topAgency.agency.name} (${topAgency.metrics.activeIndividuals} فرد · ${topAgency.metrics.fullBags} كيس)`
          : '',
        `- **السلامة والرقابة**: درجة السلامة **${diag.healthScore}%** (${diag.totalIssues} ملاحظة · ${metrics.blockedCount} عائلة محجوبة/موقوفة${mostBlockedAgency && mostBlockedAgency.metrics.blockedCount > 0 ? `، أعلاها في ${mostBlockedAgency.agency.name}` : ''})`,
        insights[0] ? `- **أهم تنبيه استباقي**: ${insights[0].title} — ${insights[0].detail}` : '',
        `- **توقع القادم**: ${forecast.projectedIndividuals} فرد (${forecast.projectedBags} كيس متوقع)`,
      ].filter(Boolean);

      return {
        gracefulLevel: 'A',
        replyText: replyLines.join('\n'),
        resultCard: {
          title: `الإيجاز التنفيذي — ${scopeName}`,
          summary: `${metrics.activeIndividuals} فرد · ${metrics.fullBags} كيس · صافي ${formatIqd(metrics.profit)}`,
          scorePercent: diag.healthScore,
          scoreLabel: 'مؤشر سلامة السجلات',
          tone: diag.healthScore >= 85 && metrics.profit >= 0 ? 'success' : 'warning',
          bars: agencySummaries.slice(0, 5).map((item) => ({
            label: item.agency.name,
            value: item.metrics.activeIndividuals,
            max: maxInd,
            displayValue: `${item.metrics.activeIndividuals} فرد · ${item.metrics.fullBags} كيس`,
            color: 'var(--accent)',
          })),
          details: [
            `الحصص المسجلة: ${metrics.registeredHouseholds} عائلة (${metrics.blockedCount} محجوب)`,
            `الأرشيفات المحفوظة: ${(state.monthlyArchives || []).length}`,
            ...(forecast.recommendations[0] ? [forecast.recommendations[0]] : []),
          ],
        },
        canvasHandoff: {
          canvasMode: 'executive_report',
          label: 'فتح التقرير التنفيذي الكامل في اللوحة',
          description: 'عرض تفصيلي قابل للطباعة والتدقيق لجميع الوكالات',
          agencyId: targetAg?.id ?? null,
        },
        suggestedFollowUps: [
          { id: 'fu_eb_wi', label: 'اختبر سيناريو ماذا لو؟', prompt: 'ماذا لو رسم الفرد 500' },
          { id: 'fu_eb_blk', label: 'من هم المحجوبون؟', prompt: 'من هم المحجوبين' },
          { id: 'fu_eb_cmp', label: 'قارن بين الوكالات', prompt: 'قارن بين الوكالات' },
        ],
      };
    }

    case 'query_status_breakdown': {
      const status = String(toolCall.args.status || 'blocked');
      const targetAg = findAgencyByIdOrFallback(state, toolCall.args.agencyId);
      const pool = targetAg
        ? state.persons.filter((p) => p.agencyId === targetAg.id)
        : state.persons;

      const matched = pool.filter((p) => {
        if (status === 'partial') return p.blockType === 'partial';
        if (status === 'archived') return p.blockType === 'archived';
        if (status === 'active') return p.blockType === 'none' || p.blockType === 'partial';
        return p.blockType === 'full' || p.blockType === 'partial';
      });

      const statusTitle =
        status === 'partial'
          ? 'حالات الحجب الجزئي'
          : status === 'archived'
            ? 'السجلات المؤرشفة'
            : status === 'active'
              ? 'العائلات النشطة'
              : 'العائلات المحجوبة (كلياً وجزئياً)';

      const scopeName = targetAg ? targetAg.name : 'جميع الوكالات';

      if (matched.length === 0) {
        return {
          gracefulLevel: 'A',
          replyText: `فحصت ${scopeName}: لا توجد أي عائلات ضمن تصنيف **${statusTitle}** حالياً.`,
          suggestedFollowUps: [
            { id: 'fu_sb_all', label: 'إيجاز اليوم الشامل', prompt: 'أعطني ملخص اليوم' },
          ],
        };
      }

      const affectedIndividuals = matched.reduce((acc, p) => {
        if (status === 'partial') return acc + Math.max(0, p.blockedIndividuals ?? 0);
        return acc + Math.max(0, p.individuals ?? 0);
      }, 0);

      const previewLines = matched.slice(0, 8).map((p, idx) => {
        const agLabel = agencyMap.get(p.agencyId) || 'وكالة';
        const extra =
          p.blockType === 'partial'
            ? `جزئي (${p.blockedIndividuals ?? 0} من ${p.individuals ?? 0})`
            : p.blockType === 'full'
              ? `حظر كامل (${p.individuals ?? 0} أفراد)`
              : p.blockType === 'archived'
                ? `مؤرشف (${p.individuals ?? 0} أفراد)`
                : `${p.individuals ?? 0} أفراد`;
        return `${idx + 1}. **${p.name}** — ${agLabel} · ${extra}${p.blockReason ? ` (${p.blockReason})` : ''}`;
      });

      return {
        gracefulLevel: 'A',
        replyText: [
          `### ${statusTitle} — ${scopeName}`,
          `الإجمالي: **${matched.length} سجل** (بمجموع ${affectedIndividuals} فرد):`,
          ...previewLines,
          ...(matched.length > 8 ? [`...و ${matched.length - 8} سجلات أخرى متوفرة في الجدول.`] : []),
        ].join('\n'),
        choices: matched.slice(0, 5).map((p) => ({
          id: `sb_${p.id}`,
          label: p.name,
          sublabel: `${agencyMap.get(p.agencyId) || ''} · ${p.individuals ?? 0} أفراد`,
          tone: p.blockType === 'full' ? 'warning' : 'default',
          actionType: 'select_person',
          payload: { personId: p.id, followUpAction: 'focus_person' },
        })),
        suggestedFollowUps:
          status === 'blocked' || status === 'partial'
            ? [
                {
                  id: 'fu_sb_tbl',
                  label: 'فتح الجدول مفلتر على المحجوبين',
                  prompt: 'اعرض المحجوبين',
                },
              ]
            : undefined,
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
      if (patch.blockType === 'none') {
        patch.status = '';
        patch.blockedIndividuals = 0;
        patch.blockReason = '';
      }
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
    mutations.createReadyList({
      agencyId,
      name: listName,
      populateFromAgency: Boolean(toolCall.args.populateFromAgency),
    });
    runtime.navigate('ready_lists');
    return `تم إنشاء القائمة الجاهزة «${listName}» وفتح قسم القوائم.`;
  }

  if (toolCall.name === 'update_settings' && toolCall.args.action === 'update_calc') {
    const cur = state.calculationSettings;
    const nextCalc: CalculationSettings = {
      ...cur,
      ...(toolCall.args.feePerIndividualIqd !== undefined
        ? { feePerIndividualIqd: Math.max(0, Number(toolCall.args.feePerIndividualIqd)) }
        : {}),
      ...(toolCall.args.fixedCardFeeIqd !== undefined
        ? { fixedCardFeeIqd: Math.max(0, Number(toolCall.args.fixedCardFeeIqd)) }
        : {}),
      ...(toolCall.args.kgPerIndividual !== undefined
        ? { kgPerIndividual: Math.max(0.5, Number(toolCall.args.kgPerIndividual)) }
        : {}),
      ...(toolCall.args.kgPerBag !== undefined
        ? { kgPerBag: Math.max(1, Number(toolCall.args.kgPerBag)) }
        : {}),
      ...(toolCall.args.roundingStepIqd !== undefined
        ? { roundingStepIqd: Math.max(0, Number(toolCall.args.roundingStepIqd)) }
        : {}),
      ...(toolCall.args.discountPercent !== undefined
        ? {
            discountPercent: Math.max(
              0,
              Math.min(100, Number(toolCall.args.discountPercent))
            ),
          }
        : {}),
    };
    runtime.saveCalculationSettings?.(nextCalc);
    return `تم تحديث معادلات الحاسبة بنجاح (رسم الفرد: ${formatIqd(
      nextCalc.feePerIndividualIqd
    )} · حصة الفرد: ${nextCalc.kgPerIndividual} كغم). يمكنك التراجع بأي لحظة.`;
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

  if (toolCall.name === 'backup_restore') {
    const action = String(toolCall.args.action || 'backup_json');
    if (action === 'archive_period') {
      runtime.exportBackupJson(true);
      runtime.archiveCurrentPeriod();
      runtime.navigate('data_archives');
      return 'تم تنزيل نسخة احتياطية آمنة وأرشفة الحصة الحالية في الأرشيف الشهري بنجاح.';
    }
    runtime.exportBackupJson(false);
    return 'تم تنزيل نسخة احتياطية كاملة (JSON) إلى جهازك بنجاح.';
  }

  return 'تم تنفيذ الإجراء بنجاح.';
}

import { Type, type FunctionDeclaration } from '@google/genai';
import type { AppDatabaseState, Person } from '../types/agency.ts';
import type {
  AssistantBeforeAfterDiff,
  AssistantToolCall,
  AssistantToolName,
} from '../types/assistant.ts';
import {
  calculateAllocation,
  computeAgencyMetrics,
  formatIqd,
  formatQuota,
  normalizeArabic,
} from './agencyLogic.ts';
import { enforceSafeArabicTerminology } from './assistantPrivacy.ts';

export const ALLOWED_ASSISTANT_TOOLS: ReadonlySet<AssistantToolName> = new Set([
  'search_person',
  'add_person',
  'update_person',
  'archive_person',
  'filter_sort_table',
  'get_stats_profit',
  'compare_agencies',
  'add_quick_note',
  'manage_ready_list',
  'manage_expense',
  'open_import_compare',
  'export_sandbox',
  'backup_restore',
  'navigate_focus',
  'update_settings',
  'explain_feature',
  'run_diagnostics',
  'run_morrow_macro',
  'analyze_period_forecast',
  'summon_workspace_canvas',
  'simulate_what_if',
  'executive_briefing',
  'query_status_breakdown',
]);

export const ASSISTANT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'search_person',
    description:
      'البحث الضبابي عن مستفيد بالاسم أو رقم البطاقة عبر وكالة محددة أو جميع الوكالات.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'الاسم أو رقم البطاقة للبحث' },
        agencyId: { type: Type.INTEGER, description: 'رقم الوكالة الاختياري' },
        status: {
          type: Type.STRING,
          description: 'فلتر الحالة: all | active | blocked | archived',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_person',
    description:
      'إضافة مستفيد/عائلة جديدة إلى وكالة محددة. يطلب التوضيح إذا نقصت الوكالة أو عدد الأفراد.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'اسم المستفيد الثلاثي أو الكامل' },
        agencyId: { type: Type.INTEGER, description: 'رقم الوكالة (1، 2، 3...)' },
        individuals: { type: Type.INTEGER, description: 'عدد الأفراد (>= 0)' },
        nationalId: { type: Type.STRING, description: 'رقم البطاقة التموينية اختياري' },
        notes: { type: Type.STRING, description: 'ملاحظات اختيارية' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_person',
    description:
      'تعديل بيانات مستفيد (الاسم، عدد الأفراد، الملاحظات، الحظر الكلي أو الجزئي، أو النقل لوكالة). لا يستخدم للحذف النهائي.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        personId: { type: Type.INTEGER, description: 'معرف السجل إذا كان معلوماً أو محدداً' },
        targetName: { type: Type.STRING, description: 'اسم الشخص المطلوب تعديله' },
        name: { type: Type.STRING },
        individuals: { type: Type.INTEGER },
        notes: { type: Type.STRING },
        agencyId: { type: Type.INTEGER },
        blockType: {
          type: Type.STRING,
          description: 'none | partial | full | archived',
        },
        blockedIndividuals: { type: Type.INTEGER },
        blockReason: { type: Type.STRING },
      },
    },
  },
  {
    name: 'archive_person',
    description:
      'أرشفة أو إلغاء تفعيل مستفيد بأمان دون مسح نهائي (الحالة تصبح مؤرشف ويمكن استعادته لاحقاً).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        personId: { type: Type.INTEGER },
        targetName: { type: Type.STRING },
        reason: { type: Type.STRING },
      },
    },
  },
  {
    name: 'filter_sort_table',
    description:
      'فلترة، ترتيب، أو إخفاء/إظهار أعمدة جدول الوكالة أو السجل الشامل.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        agencyId: { type: Type.INTEGER, description: 'اختياري؛ إذا غاب يفتح السجل الشامل أو الحالي' },
        searchQuery: { type: Type.STRING },
        statusFilter: { type: Type.STRING, description: 'all | active | blocked | archived' },
        sortBy: { type: Type.STRING, description: 'default | name_asc | individuals_desc' },
        hideColumns: { type: Type.ARRAY, items: { type: Type.STRING } },
        showColumns: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
  },
  {
    name: 'get_stats_profit',
    description:
      'حساب الإحصائيات والأكياس والإيرادات والمصاريف وصافي الأرباح بدقة وفق إعدادات الحاسبة الحالية.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        agencyId: { type: Type.INTEGER, description: 'اختياري لوكالة معينة، أو بدونه لجميع الوكالات' },
      },
    },
  },
  {
    name: 'compare_agencies',
    description:
      'مقارنة شاملة وترتيب بين جميع الوكالات من حيث عدد الأفراد، العائلات، الأكياس، المحجوبين، وصافي الربح.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        metric: {
          type: Type.STRING,
          description: 'individuals | profit | bags | blocked',
        },
      },
    },
  },
  {
    name: 'add_quick_note',
    description:
      'تسجيل ملاحظة سريعة وربطها تلقائياً باسم المستفيد المذكور ومزامنتها مع ملاحظات سجل العائلة.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: 'نص الملاحظة المطلوب حفظها' },
        personId: { type: Type.INTEGER, description: 'معرف المستفيد الاختياري للربط المباشر' },
        personName: { type: Type.STRING, description: 'اسم المستفيد الاختياري للبحث والربط' },
        syncToPerson: { type: Type.BOOLEAN, description: 'مزامنة الملاحظة لسطر المستفيد بالجدول' },
      },
      required: ['text'],
    },
  },
  {
    name: 'manage_ready_list',
    description: 'إنشاء قائمة جاهزة أو إضافة مستفيد إليها أو فتح قسم القوائم الجاهزة.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: 'create | add_member | open_list' },
        listId: { type: Type.INTEGER },
        listName: { type: Type.STRING },
        agencyId: { type: Type.INTEGER },
        personId: { type: Type.INTEGER },
        personName: { type: Type.STRING },
        populateFromAgency: { type: Type.BOOLEAN },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_expense',
    description: 'إضافة مصروف (أجور عمال أو صرفيات عامة) لوكالة أو استعراض المصاريف.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: 'add | list' },
        agencyId: { type: Type.INTEGER },
        description: { type: Type.STRING },
        amountIqd: { type: Type.NUMBER },
        category: { type: Type.STRING, description: 'worker_wages | general' },
      },
      required: ['action'],
    },
  },
  {
    name: 'open_import_compare',
    description: 'فتح قسم السحب السريع والاستيراد والمقارنة (PDF/كاميرا/Excel) أو النسخ الاحتياطي.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        source: { type: Type.STRING, description: 'quick_extract | backup' },
      },
    },
  },
  {
    name: 'export_sandbox',
    description:
      'تصدير تقرير (Excel أو PDF/طباعة أو صورة PNG أو نص) على نسخة معزولة للقراءة فقط دون تعديل الجدول الأصلي.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        format: { type: Type.STRING, description: 'excel | pdf | image | text' },
        target: { type: Type.STRING, description: 'roster | finance | ready_list' },
        agencyId: { type: Type.INTEGER },
        listId: { type: Type.INTEGER },
        hideStatusColumn: { type: Type.BOOLEAN },
      },
      required: ['format', 'target'],
    },
  },
  {
    name: 'backup_restore',
    description: 'تنزيل نسخة احتياطية JSON أو أرشفة الحصة الحالية أو عرض الأرشيفات.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: 'backup_json | archive_period | list_archives' },
        label: { type: Type.STRING },
      },
      required: ['action'],
    },
  },
  {
    name: 'navigate_focus',
    description:
      'الانتقال إلى صفحة أو وكالة معينة وتحديد/إبراز سطر أو عنصر في الواجهة.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        view: {
          type: Type.STRING,
          description:
            'hub | agency_roster | master_roster | ready_lists | relationships | finance | quick_extract | data_archives | google_workspace | morrow_center | settings',
        },
        agencyId: { type: Type.INTEGER },
        personId: { type: Type.INTEGER },
        settingsSection: { type: Type.STRING },
        highlightTargetId: { type: Type.STRING },
      },
      required: ['view'],
    },
  },
  {
    name: 'update_settings',
    description:
      'تغيير وضع التطبيق أو الثيم أو الوضع الليلي/النهاري أو إعدادات الحاسبة (رسم الفرد، حصة الفرد، وزن الكيس) أو حفظ تفضيل دائم للمستخدم.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description:
            'set_mode | set_theme | set_dark_theme | update_calc | save_pref | delete_pref | toggle_cloud_names',
        },
        key: { type: Type.STRING },
        label: { type: Type.STRING },
        value: { type: Type.STRING },
        feePerIndividualIqd: { type: Type.NUMBER },
        fixedCardFeeIqd: { type: Type.NUMBER },
        kgPerIndividual: { type: Type.NUMBER },
        kgPerBag: { type: Type.NUMBER },
        roundingStepIqd: { type: Type.NUMBER },
        discountPercent: { type: Type.NUMBER },
      },
      required: ['action'],
    },
  },
  {
    name: 'explain_feature',
    description:
      'شرح أي زر أو قسم أو ميزة في التطبيق مع توفير زر «وريني» للانتقال وإبراز العنصر.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topicId: { type: Type.STRING },
        query: { type: Type.STRING },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_diagnostics',
    description:
      'فحص صحة التطبيق: الأسماء المكررة، الحروف الناقصة، الأفراد غير الصالحين، تطابق الحسابات، سلامة التخزين، وحداثة النسخة الاحتياطية.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        autoFix: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: 'run_morrow_macro',
    description:
      'تشغيل ماكرو متكامل متعدد الخطوات مثل «إغلاق الشهر»، «جرد الصباح»، أو «تجهيز كشف التوزيع» مع تجهيز مسودات الموافقة بأمان (Zero-Trust).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        macroId: { type: Type.STRING, description: 'معرف الماكرو اختياري' },
        triggerPhrase: {
          type: Type.STRING,
          description: 'اسم أو عبارة الماكرو مثل: إغلاق الشهر، جرد الصباح، تجهيز كشف التوزيع',
        },
      },
    },
  },
  {
    name: 'analyze_period_forecast',
    description:
      'تحليل وتوقع تغيرات الحصة القادمة مقارنة بأرشيف الشهر السابق وحساب الأكياس والأرباح المتوقعة ومؤشرات المخاطر.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        agencyId: { type: Type.INTEGER, description: 'اختياري لوكالة معينة' },
      },
    },
  },
  {
    name: 'summon_workspace_canvas',
    description:
      'استدعاء أو فتح اللوحة التفاعلية في مركز Morrow على تبويب محدد (الرسوم البيانية، تعديل الجدول، التقرير التنفيذي، التوقعات، محلل النصوص، أو استوديو الماكرو).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        canvasMode: {
          type: Type.STRING,
          description:
            'overview_charts | editable_table | executive_report | forecast | text_analysis | macro_studio',
        },
        agencyId: { type: Type.INTEGER, description: 'اختياري لتصفية وكالة محددة' },
      },
      required: ['canvasMode'],
    },
  },
  {
    name: 'simulate_what_if',
    description:
      'محاكاة سيناريوهات «ماذا لو» المالية والكمية دون تعديل قاعدة البيانات: اختبار أثر تغيير رسم الفرد أو حصة الفرد أو زيادة/نقصان عدد الأفراد على الأكياس والإيرادات وصافي الربح.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        agencyId: { type: Type.INTEGER, description: 'اختياري لوكالة معينة أو لجميع الوكالات' },
        feePerIndividualIqd: { type: Type.NUMBER, description: 'رسم الفرد الافتراضي بالدينار' },
        fixedCardFeeIqd: { type: Type.NUMBER, description: 'رسم البطاقة الافتراضي بالدينار' },
        kgPerIndividual: { type: Type.NUMBER, description: 'حصة الفرد الافتراضية بالكغم' },
        individualsDelta: { type: Type.INTEGER, description: 'تغيير عددي على الأفراد (+/-)' },
        individualsDeltaPercent: { type: Type.NUMBER, description: 'نسبة التغيير المئوية على الأفراد (+/- %)' },
      },
    },
  },
  {
    name: 'executive_briefing',
    description:
      'إيجاز يومي وتنفيذي ذكي يجمع ملخص الأكياس والأرباح وأكثر الوكالات نشاطاً ومخاطر الحجب وحالة السلامة.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        agencyId: { type: Type.INTEGER, description: 'اختياري لوكالة محددة' },
      },
    },
  },
  {
    name: 'query_status_breakdown',
    description:
      'استعلام فوري عن قوائم العائلات حسب الحالة (المحجوبون، الحجب الجزئي، المؤرشفون، أو النشطون) مع الإحصائيات.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: 'blocked | partial | archived | active' },
        agencyId: { type: Type.INTEGER, description: 'اختياري لوكالة محددة' },
      },
    },
  },
];

const VALID_CANVAS_MODES = new Set([
  'overview_charts',
  'editable_table',
  'executive_report',
  'forecast',
  'text_analysis',
  'macro_studio',
]);

const DANGEROUS_SQL_OR_CODE_RE =
  /(;\s*(drop|delete|truncate|alter|insert|update)\s+|union\s+select|<script|eval\s*\(|Function\s*\()/i;

function hasUnsafeStringValue(val: unknown): boolean {
  if (typeof val === 'string') return DANGEROUS_SQL_OR_CODE_RE.test(val);
  if (Array.isArray(val)) return val.some(hasUnsafeStringValue);
  if (val && typeof val === 'object') {
    return Object.values(val as Record<string, unknown>).some(hasUnsafeStringValue);
  }
  return false;
}

export function validateToolCall(call: {
  name?: unknown;
  args?: unknown;
}): { valid: boolean; sanitized?: AssistantToolCall; error?: string } {
  const name = typeof call?.name === 'string' ? (call.name as AssistantToolName) : null;
  if (!name || !ALLOWED_ASSISTANT_TOOLS.has(name)) {
    return {
      valid: false,
      error: `الأداة "${String(call?.name || '')}" غير مسموح بها في النظام.`,
    };
  }

  const rawArgs =
    call.args && typeof call.args === 'object' && !Array.isArray(call.args)
      ? (call.args as Record<string, unknown>)
      : {};

  if (hasUnsafeStringValue(rawArgs)) {
    return {
      valid: false,
      error: 'تم حظر مدخلات غير آمنة (لا يُسمح بأوامر برمجية أو SQL).',
    };
  }

  const sanitizedArgs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawArgs)) {
    if (typeof v === 'string') {
      sanitizedArgs[k] = enforceSafeArabicTerminology(v.trim());
    } else {
      sanitizedArgs[k] = v;
    }
  }

  if (name === 'summon_workspace_canvas') {
    const modeStr = String(sanitizedArgs.canvasMode || '').trim();
    if (!VALID_CANVAS_MODES.has(modeStr)) {
      sanitizedArgs.canvasMode = 'overview_charts';
    } else {
      sanitizedArgs.canvasMode = modeStr;
    }
  }

  return {
    valid: true,
    sanitized: { name, args: sanitizedArgs },
  };
}

/**
 * Recursively clones and freezes data so exports run on a strictly read-only Sandbox snapshot.
 */
export function cloneReadOnlySandbox<T>(input: T): Readonly<T> {
  const cloned = JSON.parse(JSON.stringify(input)) as T;
  const deepFreeze = (obj: unknown): unknown => {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      for (const value of Object.values(obj as Record<string, unknown>)) {
        deepFreeze(value);
      }
    }
    return obj;
  };
  return deepFreeze(cloned) as Readonly<T>;
}

export function findAgencyByIdOrFallback(
  state: AppDatabaseState,
  agencyId: unknown
) {
  const idNum = Number(agencyId);
  if (Number.isFinite(idNum) && idNum > 0) {
    return state.agencies.find((a) => a.id === idNum) || null;
  }
  return null;
}

export function resolvePersonTarget(
  state: AppDatabaseState,
  args: Record<string, unknown>,
  focusedPersonId: number | null
): { exact: Person | null; candidates: Person[] } {
  const pid = Number(args.personId);
  if (Number.isFinite(pid) && pid > 0) {
    const byId = state.persons.find((p) => p.id === pid) || null;
    return { exact: byId, candidates: byId ? [byId] : [] };
  }

  const rawName = String(args.targetName || '').trim();
  if (
    (!rawName ||
      ['هذا', 'هاي', 'نفسه', 'نفسها', 'المحدد'].includes(rawName)) &&
    focusedPersonId !== null
  ) {
    const focused = state.persons.find((p) => p.id === focusedPersonId) || null;
    return { exact: focused, candidates: focused ? [focused] : [] };
  }

  const q = normalizeArabic(rawName);
  if (!q) return { exact: null, candidates: [] };

  const exactMatch = state.persons.find((p) => normalizeArabic(p.name) === q);
  if (exactMatch) return { exact: exactMatch, candidates: [exactMatch] };

  const matches = state.persons.filter((p) =>
    normalizeArabic(p.name).includes(q)
  );
  if (matches.length === 1) return { exact: matches[0], candidates: matches };
  return { exact: null, candidates: matches };
}

export function buildBeforeAfterDiff(
  state: AppDatabaseState,
  toolCall: AssistantToolCall,
  focusedPersonId: number | null
): AssistantBeforeAfterDiff | null {
  const agencyMap = new Map(state.agencies.map((a) => [a.id, a.name]));
  const id = `diff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  if (toolCall.name === 'add_person') {
    const name = String(toolCall.args.name || '').trim();
    const agency = findAgencyByIdOrFallback(state, toolCall.args.agencyId);
    const individuals = Math.max(0, Number(toolCall.args.individuals ?? 0));
    if (!name || !agency) return null;
    const alloc = calculateAllocation(individuals, state.calculationSettings);
    return {
      id,
      title: `تأكيد إضافة مستفيد جديد: ${name}`,
      summary: `سيتم تسجيل العائلة في ${agency.name} بعد موافقتك.`,
      toolCall,
      status: 'pending',
      changes: [
        { fieldLabel: 'الاسم', beforeValue: '— (سجل جديد)', afterValue: name },
        { fieldLabel: 'الوكالة', beforeValue: '—', afterValue: agency.name },
        {
          fieldLabel: 'الأفراد والحصة',
          beforeValue: '0',
          afterValue: `${individuals} أفراد (${formatQuota(
            individuals,
            undefined,
            state.calculationSettings
          )} · ${formatIqd(alloc?.priceIqd ?? 0)})`,
        },
        ...(toolCall.args.notes
          ? [
              {
                fieldLabel: 'الملاحظات',
                beforeValue: '—',
                afterValue: String(toolCall.args.notes),
              },
            ]
          : []),
      ],
    };
  }

  if (toolCall.name === 'update_person') {
    const { exact } = resolvePersonTarget(state, toolCall.args, focusedPersonId);
    if (!exact) return null;
    const changes: AssistantBeforeAfterDiff['changes'] = [];
    if (toolCall.args.name !== undefined && String(toolCall.args.name) !== exact.name) {
      changes.push({
        fieldLabel: 'الاسم',
        beforeValue: exact.name,
        afterValue: String(toolCall.args.name),
      });
    }
    if (
      toolCall.args.individuals !== undefined &&
      Number(toolCall.args.individuals) !== (exact.individuals ?? 0)
    ) {
      const nextInd = Math.max(0, Number(toolCall.args.individuals));
      changes.push({
        fieldLabel: 'الأفراد',
        beforeValue: `${exact.individuals ?? 0} أفراد`,
        afterValue: `${nextInd} أفراد (${formatQuota(
          nextInd,
          undefined,
          state.calculationSettings
        )})`,
      });
    }
    if (
      toolCall.args.agencyId !== undefined &&
      Number(toolCall.args.agencyId) !== exact.agencyId
    ) {
      changes.push({
        fieldLabel: 'الوكالة',
        beforeValue: agencyMap.get(exact.agencyId) || `#${exact.agencyId}`,
        afterValue:
          agencyMap.get(Number(toolCall.args.agencyId)) ||
          `#${String(toolCall.args.agencyId)}`,
      });
    }
    if (toolCall.args.blockType !== undefined && toolCall.args.blockType !== exact.blockType) {
      const scopeMap: Record<string, string> = {
        none: 'نشط',
        partial: 'حظر جزئي',
        full: 'حظر كامل',
        archived: 'مؤرشف',
      };
      changes.push({
        fieldLabel: 'الحالة / الحظر',
        beforeValue: scopeMap[exact.blockType] || exact.blockType,
        afterValue:
          scopeMap[String(toolCall.args.blockType)] ||
          String(toolCall.args.blockType),
      });
    }
    if (toolCall.args.notes !== undefined && String(toolCall.args.notes) !== exact.notes) {
      changes.push({
        fieldLabel: 'الملاحظات',
        beforeValue: exact.notes || '—',
        afterValue: String(toolCall.args.notes) || '—',
      });
    }
    if (changes.length === 0) return null;
    return {
      id,
      title: `مراجعة التعديل: ${exact.name}`,
      summary: 'قارن القيم قبل التعديل وبعده ثم اضغط موافق للتنفيذ (قابل للتراجع).',
      toolCall: {
        ...toolCall,
        args: { ...toolCall.args, personId: exact.id },
      },
      status: 'pending',
      changes,
    };
  }

  if (toolCall.name === 'archive_person') {
    const { exact } = resolvePersonTarget(state, toolCall.args, focusedPersonId);
    if (!exact) return null;
    return {
      id,
      title: `تأكيد الأرشفة الآمنة: ${exact.name}`,
      summary:
        'المساعد لا يحذف أي اسم نهائياً — سيتم تحويل السجل إلى «مؤرشف» ويمكنك استعادته بأي وقت.',
      toolCall: {
        ...toolCall,
        args: { ...toolCall.args, personId: exact.id },
      },
      status: 'pending',
      changes: [
        { fieldLabel: 'الاسم', beforeValue: exact.name, afterValue: exact.name },
        {
          fieldLabel: 'الحالة',
          beforeValue: exact.status || 'نشط',
          afterValue: 'مؤرشف (استبعاد من التوزيع دون مسح)',
        },
      ],
    };
  }

  if (toolCall.name === 'manage_expense' && toolCall.args.action === 'add') {
    const agency = findAgencyByIdOrFallback(state, toolCall.args.agencyId);
    const amount = Math.max(0, Number(toolCall.args.amountIqd ?? 0));
    const desc = String(toolCall.args.description || 'مصروف تشغيلي');
    const cat =
      toolCall.args.category === 'worker_wages' ? 'أجور العمال' : 'صرفيات عامة';
    if (!agency || amount <= 0) return null;
    return {
      id,
      title: `تأكيد تسجيل مصروف مالي (${agency.name})`,
      summary: 'سيُضاف المصروف إلى سجل المالية ويُخصم من صافي الربح.',
      toolCall,
      status: 'pending',
      changes: [
        { fieldLabel: 'الوكالة', beforeValue: '—', afterValue: agency.name },
        { fieldLabel: 'التصنيف', beforeValue: '—', afterValue: cat },
        { fieldLabel: 'البيان', beforeValue: '—', afterValue: desc },
        { fieldLabel: 'المبلغ', beforeValue: '0 د.ع', afterValue: formatIqd(amount) },
      ],
    };
  }

  if (toolCall.name === 'manage_ready_list' && toolCall.args.action === 'create') {
    const agency = findAgencyByIdOrFallback(state, toolCall.args.agencyId) || state.agencies[0];
    const listName = String(toolCall.args.listName || 'قائمة جديدة');
    return {
      id,
      title: `تأكيد إنشاء قائمة جاهزة: ${listName}`,
      summary: 'سيتم إنشاء القائمة وفتحها في قسم القوائم الجاهزة.',
      toolCall: {
        ...toolCall,
        args: { ...toolCall.args, agencyId: agency?.id || 1 },
      },
      status: 'pending',
      changes: [
        { fieldLabel: 'اسم القائمة', beforeValue: '—', afterValue: listName },
        { fieldLabel: 'الوكالة المرجعية', beforeValue: '—', afterValue: agency?.name || 'الوكالة الأولى' },
      ],
    };
  }

  if (toolCall.name === 'run_diagnostics' && toolCall.args.autoFix) {
    return {
      id,
      title: 'تأكيد الإصلاح التلقائي لملاحظات الفحص',
      summary:
        'سيتم أخذ نسخة احتياطية سريعة ثم تطبيق الإصلاحات القابلة للمعالجة التلقائية فقط.',
      requiresBulkBackup: true,
      toolCall,
      status: 'pending',
      changes: [
        {
          fieldLabel: 'نطاق العملية',
          beforeValue: 'الحالة الحالية للسجلات والحسابات',
          afterValue: 'تنظيف الفراغات + مزامنة حالات الحظر + ضبط القيم الشاذة',
        },
      ],
    };
  }

  if (toolCall.name === 'update_settings' && toolCall.args.action === 'update_calc') {
    const cur = state.calculationSettings;
    const changes: AssistantBeforeAfterDiff['changes'] = [];

    if (
      toolCall.args.feePerIndividualIqd !== undefined &&
      Number(toolCall.args.feePerIndividualIqd) !== cur.feePerIndividualIqd
    ) {
      const nextFee = Math.max(0, Number(toolCall.args.feePerIndividualIqd));
      changes.push({
        fieldLabel: 'رسم الفرد التلقائي',
        beforeValue: formatIqd(cur.feePerIndividualIqd),
        afterValue: formatIqd(nextFee),
      });
      changes.push({
        fieldLabel: 'أثر المعادلة (عائلة 5 أفراد)',
        beforeValue: formatIqd(5 * cur.feePerIndividualIqd + cur.fixedCardFeeIqd),
        afterValue: formatIqd(5 * nextFee + cur.fixedCardFeeIqd),
      });
    }

    if (
      toolCall.args.fixedCardFeeIqd !== undefined &&
      Number(toolCall.args.fixedCardFeeIqd) !== cur.fixedCardFeeIqd
    ) {
      const nextCardFee = Math.max(0, Number(toolCall.args.fixedCardFeeIqd));
      changes.push({
        fieldLabel: 'رسم البطاقة الثابت',
        beforeValue: formatIqd(cur.fixedCardFeeIqd),
        afterValue: formatIqd(nextCardFee),
      });
    }

    if (
      toolCall.args.kgPerIndividual !== undefined &&
      Number(toolCall.args.kgPerIndividual) !== cur.kgPerIndividual
    ) {
      const nextKg = Math.max(0.5, Number(toolCall.args.kgPerIndividual));
      changes.push({
        fieldLabel: 'حصة الفرد (كغم)',
        beforeValue: `${cur.kgPerIndividual} كغم`,
        afterValue: `${nextKg} كغم`,
      });
    }

    if (
      toolCall.args.kgPerBag !== undefined &&
      Number(toolCall.args.kgPerBag) !== cur.kgPerBag
    ) {
      const nextBag = Math.max(1, Number(toolCall.args.kgPerBag));
      changes.push({
        fieldLabel: 'وزن الكيس القياسي (كغم)',
        beforeValue: `${cur.kgPerBag} كغم`,
        afterValue: `${nextBag} كغم`,
      });
    }

    if (
      toolCall.args.roundingStepIqd !== undefined &&
      Number(toolCall.args.roundingStepIqd) !== (cur.roundingStepIqd ?? 0)
    ) {
      const nextRound = Math.max(0, Number(toolCall.args.roundingStepIqd));
      changes.push({
        fieldLabel: 'خطوة تقريب المبلغ',
        beforeValue: `${cur.roundingStepIqd ?? 0} د.ع`,
        afterValue: `${nextRound} د.ع`,
      });
    }

    if (
      toolCall.args.discountPercent !== undefined &&
      Number(toolCall.args.discountPercent) !== (cur.discountPercent ?? 0)
    ) {
      const nextDisc = Math.max(0, Math.min(100, Number(toolCall.args.discountPercent)));
      changes.push({
        fieldLabel: 'نسبة الخصم %',
        beforeValue: `${cur.discountPercent ?? 0}%`,
        afterValue: `${nextDisc}%`,
      });
    }

    if (changes.length === 0) return null;
    return {
      id,
      title: 'تأكيد تعديل إعدادات الحاسبة والرسوم',
      summary:
        'راجع مقارنة القيم قبل وبعد التعديل، وعند الموافقة ستنطبق على الحسابات مباشرة مع إمكانية التراجع.',
      toolCall,
      status: 'pending',
      changes,
    };
  }

  if (toolCall.name === 'backup_restore' && toolCall.args.action === 'archive_period') {
    return {
      id,
      title: 'تأكيد أرشفة وإغلاق الحصة الحالية',
      summary:
        'سيتم أخذ لقطة أرشيفية كاملة لجميع الوكالات والسجلات وحفظها في قسم البيانات التاريخية.',
      requiresBulkBackup: true,
      toolCall,
      status: 'pending',
      changes: [
        {
          fieldLabel: 'الأرشفة الشهرية',
          beforeValue: `${(state.monthlyArchives || []).length} أرشيف محفوظ`,
          afterValue: 'إضافة لقطة أرشيف مغلقة جديدة للحصة الحالية',
        },
      ],
    };
  }

  return null;
}

export interface WhatIfSimulationResult {
  scopeName: string;
  agencyId: number | null;
  scenarioLabel: string;
  current: {
    activeHouseholds: number;
    activeIndividuals: number;
    fullBags: number;
    remainderKg: number;
    totalKg: number;
    revenue: number;
    totalExpenses: number;
    profit: number;
  };
  simulated: {
    activeHouseholds: number;
    activeIndividuals: number;
    fullBags: number;
    remainderKg: number;
    totalKg: number;
    revenue: number;
    totalExpenses: number;
    profit: number;
  };
  deltas: {
    individuals: number;
    bags: number;
    totalKg: number;
    revenue: number;
    profit: number;
  };
  simulatedSettingsPatch?: Record<string, unknown>;
}

export function computeWhatIfSimulation(
  state: AppDatabaseState,
  args: Record<string, unknown>
): WhatIfSimulationResult {
  const ag = findAgencyByIdOrFallback(state, args.agencyId);
  const scopedPersons = ag
    ? state.persons.filter((p) => p.agencyId === ag.id)
    : state.persons;
  const scopedExpenses = ag
    ? state.expenses.filter((e) => e.agencyId === ag.id)
    : state.expenses;

  const baseSettings = state.calculationSettings;
  const current = computeAgencyMetrics(scopedPersons, scopedExpenses, baseSettings);

  const nextSettings = {
    ...baseSettings,
    ...(args.feePerIndividualIqd !== undefined &&
    Number.isFinite(Number(args.feePerIndividualIqd))
      ? { feePerIndividualIqd: Math.max(0, Number(args.feePerIndividualIqd)) }
      : {}),
    ...(args.fixedCardFeeIqd !== undefined &&
    Number.isFinite(Number(args.fixedCardFeeIqd))
      ? { fixedCardFeeIqd: Math.max(0, Number(args.fixedCardFeeIqd)) }
      : {}),
    ...(args.kgPerIndividual !== undefined &&
    Number.isFinite(Number(args.kgPerIndividual))
      ? { kgPerIndividual: Math.max(0.5, Number(args.kgPerIndividual)) }
      : {}),
  };

  const pct = Number(args.individualsDeltaPercent);
  const absDelta = Number(args.individualsDelta);
  const hasPct = Number.isFinite(pct) && pct !== 0;
  const hasAbs = Number.isFinite(absDelta) && absDelta !== 0;

  let simulatedPersons = scopedPersons;
  if (hasPct || hasAbs) {
    const activeList = scopedPersons.filter(
      (p) => p.blockType !== 'full' && p.blockType !== 'archived'
    );
    const activeCount = Math.max(1, activeList.length);
    const perRowExtra = hasAbs ? absDelta / activeCount : 0;

    simulatedPersons = scopedPersons.map((p) => {
      if (p.blockType === 'full' || p.blockType === 'archived') return p;
      const baseInd = Math.max(0, p.individuals ?? 0);
      const scaled = hasPct ? baseInd * (1 + pct / 100) : baseInd;
      const nextInd = Math.max(0, Math.round(scaled + perRowExtra));
      return { ...p, individuals: nextInd };
    });

    // If absolute delta is small and rounding left total individuals off, apply remainder to first active row
    if (hasAbs && !hasPct) {
      const targetTotalInd = Math.max(0, current.activeIndividuals + Math.round(absDelta));
      const actualSimInd = simulatedPersons
        .filter((p) => p.blockType !== 'full' && p.blockType !== 'archived')
        .reduce((acc, p) => {
          const partialBlocked = p.blockType === 'partial' ? p.blockedIndividuals ?? 0 : 0;
          return acc + Math.max(0, (p.individuals ?? 0) - partialBlocked);
        }, 0);
      const diff = targetTotalInd - actualSimInd;
      if (diff !== 0) {
        const firstIdx = simulatedPersons.findIndex(
          (p) => p.blockType !== 'full' && p.blockType !== 'archived'
        );
        if (firstIdx >= 0) {
          simulatedPersons = simulatedPersons.map((p, idx) =>
            idx === firstIdx
              ? { ...p, individuals: Math.max(0, (p.individuals ?? 0) + diff) }
              : p
          );
        }
      }
    }
  }

  const simulated = computeAgencyMetrics(
    simulatedPersons,
    scopedExpenses,
    nextSettings
  );

  const labelParts: string[] = [];
  const simulatedSettingsPatch: Record<string, unknown> = {};
  if (nextSettings.feePerIndividualIqd !== baseSettings.feePerIndividualIqd) {
    labelParts.push(`رسم الفرد ${formatIqd(nextSettings.feePerIndividualIqd)}`);
    simulatedSettingsPatch.feePerIndividualIqd = nextSettings.feePerIndividualIqd;
  }
  if (nextSettings.fixedCardFeeIqd !== baseSettings.fixedCardFeeIqd) {
    labelParts.push(`رسم البطاقة ${formatIqd(nextSettings.fixedCardFeeIqd)}`);
    simulatedSettingsPatch.fixedCardFeeIqd = nextSettings.fixedCardFeeIqd;
  }
  if (nextSettings.kgPerIndividual !== baseSettings.kgPerIndividual) {
    labelParts.push(`حصة الفرد ${nextSettings.kgPerIndividual} كغم`);
    simulatedSettingsPatch.kgPerIndividual = nextSettings.kgPerIndividual;
  }
  if (hasPct) {
    labelParts.push(`${pct > 0 ? 'زيادة' : 'نقص'} الأفراد بنسبة ${Math.abs(pct)}%`);
  }
  if (hasAbs) {
    labelParts.push(
      `${absDelta > 0 ? 'إضافة' : 'خصم'} ${Math.abs(Math.round(absDelta))} فرد`
    );
  }

  return {
    scopeName: ag ? ag.name : 'جميع الوكالات',
    agencyId: ag?.id ?? null,
    scenarioLabel: labelParts.length > 0 ? labelParts.join(' · ') : 'السيناريو الافتراضي',
    current: {
      activeHouseholds: current.activeHouseholds,
      activeIndividuals: current.activeIndividuals,
      fullBags: current.fullBags,
      remainderKg: current.remainderKg,
      totalKg: current.totalKg,
      revenue: current.revenue,
      totalExpenses: current.totalExpenses,
      profit: current.profit,
    },
    simulated: {
      activeHouseholds: simulated.activeHouseholds,
      activeIndividuals: simulated.activeIndividuals,
      fullBags: simulated.fullBags,
      remainderKg: simulated.remainderKg,
      totalKg: simulated.totalKg,
      revenue: simulated.revenue,
      totalExpenses: simulated.totalExpenses,
      profit: simulated.profit,
    },
    deltas: {
      individuals: simulated.activeIndividuals - current.activeIndividuals,
      bags: simulated.fullBags - current.fullBags,
      totalKg: simulated.totalKg - current.totalKg,
      revenue: simulated.revenue - current.revenue,
      profit: simulated.profit - current.profit,
    },
    simulatedSettingsPatch:
      Object.keys(simulatedSettingsPatch).length > 0
        ? simulatedSettingsPatch
        : undefined,
  };
}

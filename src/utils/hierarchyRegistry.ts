import type {
  Agency,
  AppView,
  SettingsSectionId,
} from '../types/agency.ts';
import type { MorrowCenterTab } from '../types/assistant.ts';
import { normalizeArabic } from './agencyLogic.ts';

export type HierarchyIconKey =
  | 'home'
  | 'agencies'
  | 'table'
  | 'columns'
  | 'camera'
  | 'list'
  | 'heart'
  | 'wallet'
  | 'archive'
  | 'bot'
  | 'calendar'
  | 'settings'
  | 'palette'
  | 'sparkles'
  | 'layers'
  | 'sliders'
  | 'type'
  | 'calculator'
  | 'scale'
  | 'coins'
  | 'percent'
  | 'flask'
  | 'bell'
  | 'shield'
  | 'cloud'
  | 'file_json'
  | 'lock'
  | 'trash'
  | 'eye';

export type HierarchyAccentTone =
  | 'indigo'
  | 'cyan'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate';

export interface HierarchyTarget {
  view: AppView;
  settingsSection?: SettingsSectionId;
  settingsScreenMode?: 'hub' | 'detail';
  settingsCapsuleId?: string;
  controlAnchorId?: string;
  agencyId?: number;
  openColumnCustomizer?: boolean;
  morrowTab?: MorrowCenterTab;
}

export interface HierarchyBadgeContext {
  agenciesCount: number;
  personsCount: number;
  auditIssuesCount: number;
  readyListsCount: number;
  relationsCount: number;
  archivesCount: number;
  pendingDraftsCount: number;
  recycleBinCount: number;
  activeThemeName?: string;
  activeTableThemeName?: string;
  activeFontName?: string;
  fontSizePx?: number;
  modeLabel?: string;
  feePerIndividualIqd?: number;
  kgPerIndividual?: number;
  settingsDisplayMode?: 'fullscreen' | 'contained';
  savedProfilesCount?: number;
  quickExtractFieldsCount?: number;
  clarityThreshold?: number;
  autoHideTopBar?: boolean;
  privacyLocked?: boolean;
}

export interface HierarchyBadge {
  text: string;
  tone?: 'neutral' | 'accent' | 'warning' | 'success';
}

export interface HierarchyNode {
  id: string;
  parentId: string | null;
  level: number;
  title: string;
  subtitle: string;
  description?: string;
  icon?: HierarchyIconKey;
  logo?: HierarchyIconKey;
  accentTone?: HierarchyAccentTone;
  keywords: string[];
  category: 'root' | 'core' | 'agencies' | 'tools' | 'settings';
  target: HierarchyTarget;
  component?: string;
  defaults?: Record<string, unknown>;
  protected?: boolean;
  tier?: 'main' | 'side';
  settingsGroup?: 'appearance' | 'data' | 'ai' | 'system' | 'system_map';
  badge?: HierarchyBadge | ((ctx: HierarchyBadgeContext) => HierarchyBadge | null);
  getBadge?: (ctx: HierarchyBadgeContext) => HierarchyBadge | null;
  children: HierarchyNode[];
}

export interface HierarchyExtensionRegistration {
  parentId: string;
  node: Omit<HierarchyNode, 'parentId' | 'level' | 'children'> & {
    children?: HierarchyNode[];
  };
}

const runtimeHierarchyExtensions: HierarchyExtensionRegistration[] = [];

export function registerHierarchyExtension(
  registration: HierarchyExtensionRegistration
): () => void {
  const existingIdx = runtimeHierarchyExtensions.findIndex(
    (ext) =>
      ext.parentId === registration.parentId &&
      ext.node.id === registration.node.id
  );
  if (existingIdx !== -1) {
    runtimeHierarchyExtensions[existingIdx] = registration;
  } else {
    runtimeHierarchyExtensions.push(registration);
  }
  return () => {
    const idx = runtimeHierarchyExtensions.findIndex(
      (ext) =>
        ext.parentId === registration.parentId &&
        ext.node.id === registration.node.id
    );
    if (idx !== -1) runtimeHierarchyExtensions.splice(idx, 1);
  };
}

export function resolveHierarchyNodeBadge(
  node: HierarchyNode,
  ctx: HierarchyBadgeContext
): HierarchyBadge | null {
  if (node.getBadge) return node.getBadge(ctx);
  if (typeof node.badge === 'function') return node.badge(ctx);
  if (node.badge && typeof node.badge === 'object') return node.badge;
  return null;
}

function attachExtensionRecursive(
  node: HierarchyNode,
  ext: HierarchyExtensionRegistration
): HierarchyNode {
  if (node.id === ext.parentId) {
    const childLevel = node.level + 1;
    const normalizeChild = (
      raw: Omit<HierarchyNode, 'parentId' | 'level' | 'children'> & {
        children?: HierarchyNode[];
      },
      parentId: string,
      level: number
    ): HierarchyNode => ({
      ...raw,
      description: raw.description ?? raw.subtitle,
      parentId,
      level,
      children: (raw.children || []).map((c) =>
        normalizeChild(c, raw.id, level + 1)
      ),
    });

    const newChild = normalizeChild(ext.node, node.id, childLevel);
    const alreadyExists = node.children.some((c) => c.id === newChild.id);
    return {
      ...node,
      children: alreadyExists
        ? node.children.map((c) => (c.id === newChild.id ? newChild : c))
        : [...node.children, newChild],
    };
  }
  return {
    ...node,
    children: node.children.map((c) => attachExtensionRecursive(c, ext)),
  };
}

function enrichDescriptionsAndLevels(
  node: HierarchyNode,
  parentId: string | null = null,
  level = 1
): HierarchyNode {
  return {
    ...node,
    parentId,
    level,
    description: node.description ?? node.subtitle,
    children: node.children.map((c) =>
      enrichDescriptionsAndLevels(c, node.id, level + 1)
    ),
  };
}

export function buildMorrowHierarchyTree(
  agencies: Agency[],
  extraExtensions: HierarchyExtensionRegistration[] = []
): HierarchyNode {
  const agencyChildren: HierarchyNode[] = [
    {
      id: 'master_roster_node',
      parentId: 'agencies_hub_node',
      level: 3,
      title: 'السجل الشامل لجميع الوكالات',
      subtitle: 'عرض وتحرير وبحث موحد عبر كل الوكالات',
      icon: 'table',
      logo: 'table',
      accentTone: 'indigo',
      keywords: ['السجل الشامل', 'الجدول الشامل', 'جميع الوكالات', 'كل الأفراد'],
      category: 'agencies',
      target: { view: 'master_roster' },
      getBadge: (ctx) => ({
        text: `${ctx.personsCount} سجل`,
        tone: 'accent',
      }),
      children: [],
    },
    {
      id: 'column_customizer_node',
      parentId: 'agencies_hub_node',
      level: 3,
      title: 'تخصيص الأعمدة والترتيب الحر',
      subtitle: 'الترتيب بالسحب أو الرقم، تثبيت عمود مرجعي، وحفظ القوالب',
      icon: 'columns',
      logo: 'columns',
      accentTone: 'violet',
      keywords: ['تخصيص الأعمدة', 'ترتيب الأعمدة', 'القوالب', 'تثبيت العمود', 'الجداول'],
      category: 'tools',
      target: { view: 'master_roster', openColumnCustomizer: true },
      children: [],
    },
    ...agencies.map<HierarchyNode>((ag) => ({
      id: `agency_node_${ag.id}`,
      parentId: 'agencies_hub_node',
      level: 3,
      title: `${ag.icon} ${ag.name}`,
      subtitle: 'جدول الوكالة التفصيلي وإدارة المستفيدين',
      icon: 'agencies',
      logo: 'agencies',
      accentTone: 'emerald',
      keywords: [ag.name, 'وكالة', 'جدول الوكالة'],
      category: 'agencies',
      target: { view: 'agency_roster', agencyId: ag.id },
      children: [],
    })),
  ];

  let root: HierarchyNode = {
    id: 'root',
    parentId: null,
    level: 1,
    title: 'الرئيسية',
    subtitle: 'مركز القيادة الهرمي وإدارة الوكالات والحصص',
    icon: 'home',
    logo: 'home',
    accentTone: 'indigo',
    keywords: ['الرئيسية', 'لوحة التحكم', 'المركز', 'Morrow'],
    category: 'root',
    target: { view: 'hub' },
    getBadge: (ctx) => ({
      text: `${ctx.agenciesCount} وكالات · ${ctx.personsCount} سجل`,
      tone: 'accent',
    }),
    children: [
      {
        id: 'agencies_hub_node',
        parentId: 'root',
        level: 2,
        title: 'الوكالات والجداول',
        subtitle: 'السجل الشامل، جداول الوكالات، وتخصيص الأعمدة',
        icon: 'agencies',
        logo: 'agencies',
        accentTone: 'indigo',
        keywords: ['الوكالات', 'الجداول', 'المستفيدين', 'الأفراد'],
        category: 'agencies',
        target: { view: 'master_roster' },
        getBadge: (ctx) =>
          ctx.auditIssuesCount > 0
            ? { text: `${ctx.auditIssuesCount} تنبيه تدقيق`, tone: 'warning' }
            : { text: `${ctx.personsCount} سجل`, tone: 'success' },
        children: agencyChildren,
      },
      {
        id: 'quick_extract_node',
        parentId: 'root',
        level: 2,
        title: 'السحب الذكي والتدقيق OCR',
        subtitle: 'استخراج الجداول من PDF والكاميرا ومحرك المقارنة',
        icon: 'camera',
        logo: 'camera',
        accentTone: 'cyan',
        keywords: ['السحب الذكي', 'السحب السريع', 'ocr', 'pdf', 'كاميرا', 'مطابقة'],
        category: 'tools',
        target: { view: 'quick_extract' },
        children: [
          {
            id: 'quick_extract_settings_node',
            parentId: 'quick_extract_node',
            level: 3,
            title: 'قوالب وتركيز السحب الذكي',
            subtitle: 'عتبة الوضوح، الحقول المستهدفة، والنماذج المرجعية',
            icon: 'camera',
            logo: 'camera',
            accentTone: 'cyan',
            component: 'QuickExtractCapsules',
            keywords: ['قوالب السحب', 'عتبة الوضوح', 'إعدادات السحب', 'الكاميرا'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'quick_extract_settings',
              settingsScreenMode: 'detail',
            },
            getBadge: (ctx) => ({
              text: `${ctx.quickExtractFieldsCount ?? 4} حقول · ${ctx.clarityThreshold ?? 55}%`,
              tone: 'accent',
            }),
            children: [
              {
                id: 'qe_scan_mode_cap',
                parentId: 'quick_extract_settings_node',
                level: 4,
                title: 'وضع التصوير وعتبة الوضوح',
                subtitle: 'الوضع السريع أم التدقيق الفائق (4 لقطات) وحد وضوح الصورة',
                icon: 'camera',
                logo: 'camera',
                accentTone: 'cyan',
                component: 'QeScanModeCapsule',
                defaults: { defaultScanMode: 'audit', clarityThreshold: 55 },
                keywords: ['وضع التصوير', 'التدقيق الفائق', 'لقطة واحدة', 'عتبة الوضوح'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'quick_extract_settings',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'qe_scan_mode_cap',
                },
                getBadge: (ctx) => ({
                  text: `${ctx.clarityThreshold ?? 55}%`,
                  tone: 'neutral',
                }),
                children: [],
              },
              {
                id: 'qe_fields_cap',
                parentId: 'quick_extract_settings_node',
                level: 4,
                title: 'الحقول الافتراضية المستخرجة',
                subtitle: 'الأسماء، عدد الأفراد، النقصان، وحقول الإضافة والحذف',
                icon: 'layers',
                logo: 'camera',
                accentTone: 'cyan',
                component: 'QeFieldsCapsule',
                defaults: {
                  focusedFields: ['name', 'individuals', 'decreaseCount', 'addOrDelete'],
                },
                keywords: ['الحقول المستهدفة', 'الأسماء', 'النقصان', 'إضافة حذف'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'quick_extract_settings',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'qe_fields_cap',
                },
                getBadge: (ctx) => ({
                  text: `${ctx.quickExtractFieldsCount ?? 4} حقول`,
                  tone: 'accent',
                }),
                children: [],
              },
              {
                id: 'qe_templates_cap',
                parentId: 'quick_extract_settings_node',
                level: 4,
                title: 'الصور المرجعية لقوالب الدفاتر',
                subtitle: 'استعراض وتفعيل وحذف قوالب الدفاتر المصورة المحفوظة',
                icon: 'file_json',
                logo: 'camera',
                accentTone: 'cyan',
                component: 'QeTemplatesCapsule',
                keywords: ['القوالب المرجعية', 'دفتر', 'صورة مرجعية'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'quick_extract_settings',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'qe_templates_cap',
                },
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'ready_lists_node',
        parentId: 'root',
        level: 2,
        title: 'القوائم الجاهزة والتوزيع',
        subtitle: 'إعداد قوائم التسليم المباشر والطباعة والتصدير',
        icon: 'list',
        logo: 'list',
        accentTone: 'emerald',
        keywords: ['القوائم الجاهزة', 'قائمة توزيع', 'تصدير', 'طباعة'],
        category: 'core',
        target: { view: 'ready_lists' },
        getBadge: (ctx) => ({
          text: `${ctx.readyListsCount} قائمة`,
          tone: 'neutral',
        }),
        children: [],
      },
      {
        id: 'relations_finance_node',
        parentId: 'root',
        level: 2,
        title: 'العلاقات والمالية',
        subtitle: 'المتابعة والتذكيرات، حسابات الأرباح، والمصاريف',
        icon: 'heart',
        logo: 'heart',
        accentTone: 'rose',
        keywords: ['العلاقات', 'المالية', 'الحسابات', 'المصاريف', 'الأرباح'],
        category: 'core',
        target: { view: 'relationships' },
        getBadge: (ctx) => ({
          text: `${ctx.relationsCount} متابعة`,
          tone: 'neutral',
        }),
        children: [
          {
            id: 'relationships_detail_node',
            parentId: 'relations_finance_node',
            level: 3,
            title: 'قسم العلاقات والمتابعة',
            subtitle: 'المفضلة، مواعيد التسليم، وملاحظات التدقيق',
            icon: 'heart',
            logo: 'heart',
            accentTone: 'rose',
            keywords: ['العلاقات', 'تذكير', 'توصيل', 'المفضلة'],
            category: 'core',
            target: { view: 'relationships' },
            children: [],
          },
          {
            id: 'finance_detail_node',
            parentId: 'relations_finance_node',
            level: 3,
            title: 'الحسابات والمالية والأجور',
            subtitle: 'الإيرادات، أجور العمال، وصافي الربح',
            icon: 'wallet',
            logo: 'wallet',
            accentTone: 'emerald',
            keywords: ['المالية', 'الحسابات', 'الأجور', 'المصاريف'],
            category: 'core',
            target: { view: 'finance' },
            children: [],
          },
          {
            id: 'relations_lists_prefs_node',
            parentId: 'relations_finance_node',
            level: 3,
            title: 'تفضيلات العلاقات والقوائم',
            subtitle: 'صيغة التصدير الافتراضية والتنبيهات المسبقة',
            icon: 'bell',
            logo: 'bell',
            accentTone: 'rose',
            component: 'RelationsListsCapsules',
            keywords: ['إعدادات العلاقات', 'تفضيلات القوائم', 'صيغة التصدير'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'relations_lists',
              settingsScreenMode: 'detail',
            },
            children: [
              {
                id: 'rel_export_cap',
                parentId: 'relations_lists_prefs_node',
                level: 4,
                title: 'صيغة التصدير والتاريخ التلقائي',
                subtitle: 'Excel أو PDF أو نص أو PNG وتحديث تاريخ القوائم الجاهزة',
                icon: 'list',
                logo: 'bell',
                accentTone: 'rose',
                component: 'RelExportCapsule',
                defaults: {
                  defaultExportFormat: 'excel',
                  autoUpdateReadyListDate: true,
                },
                keywords: ['صيغة التصدير', 'تحديث التاريخ', 'قوائم جاهزة'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'relations_lists',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'rel_export_cap',
                },
                children: [],
              },
              {
                id: 'rel_reminders_cap',
                parentId: 'relations_lists_prefs_node',
                level: 4,
                title: 'تنبيهات التذكير وبادئة التوصيل',
                subtitle: 'أيام التنبيه المسبق وبادئة ملاحظات التسليم التلقائية',
                icon: 'bell',
                logo: 'bell',
                accentTone: 'rose',
                component: 'RelRemindersCapsule',
                defaults: {
                  defaultReminderLeadDays: 2,
                  enableReminderAlerts: true,
                  defaultDeliveryNotePrefix: 'خط التوزيع:',
                },
                keywords: ['تذكير', 'تنبيهات', 'بادئة التوصيل'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'relations_lists',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'rel_reminders_cap',
                },
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'data_archives_node',
        parentId: 'root',
        level: 2,
        title: 'المطابقة والأرشفة الشهرية',
        subtitle: 'حفظ الدورات الشهرية وإغلاق الحصص والمقارنة التاريخية',
        icon: 'archive',
        logo: 'archive',
        accentTone: 'amber',
        keywords: ['الأرشيف', 'الأرشفة الشهرية', 'المطابقة', 'الدورة الشهرية'],
        category: 'core',
        target: { view: 'data_archives' },
        getBadge: (ctx) => ({
          text: `${ctx.archivesCount} أرشيف`,
          tone: 'neutral',
        }),
        children: [],
      },
      {
        id: 'morrow_center_node',
        parentId: 'root',
        level: 2,
        title: 'مركز المساعد الذكي Morrow',
        subtitle: 'غرفة العمليات الذكية، الموافقات، الذاكرة، والملاحظات',
        icon: 'bot',
        logo: 'bot',
        accentTone: 'violet',
        keywords: ['Morrow', 'المساعد الذكي', 'الذكاء الاصطناعي', 'الدماغ الثلاثي'],
        category: 'tools',
        target: { view: 'morrow_center', morrowTab: 'chat' },
        getBadge: (ctx) =>
          ctx.pendingDraftsCount > 0
            ? { text: `${ctx.pendingDraftsCount} مسودة`, tone: 'warning' }
            : null,
        children: [
          {
            id: 'morrow_chat_tab_node',
            parentId: 'morrow_center_node',
            level: 3,
            title: 'محادثة الدماغ الثلاثي',
            subtitle: 'Morrow المحلي + Gemini 2.5 Flash / Pro',
            icon: 'bot',
            logo: 'bot',
            accentTone: 'violet',
            keywords: ['محادثة', 'دردشة', 'مساعد', 'أمر'],
            category: 'tools',
            target: { view: 'morrow_center', morrowTab: 'chat' },
            children: [],
          },
          {
            id: 'morrow_approvals_tab_node',
            parentId: 'morrow_center_node',
            level: 3,
            title: 'مركز الموافقات والمسودات',
            subtitle: 'مراجعة واعتماد التعديلات المقترحة قبل التنفيذ',
            icon: 'shield',
            logo: 'bot',
            accentTone: 'amber',
            keywords: ['الموافقات', 'المسودات', 'اعتماد'],
            category: 'tools',
            target: { view: 'morrow_center', morrowTab: 'approvals' },
            children: [],
          },
          {
            id: 'morrow_memory_tab_node',
            parentId: 'morrow_center_node',
            level: 3,
            title: 'الذاكرة والقواعد الدائمة',
            subtitle: 'توجيهات التصنيف، التصدير، والتنسيق المحفوظة',
            icon: 'layers',
            logo: 'bot',
            accentTone: 'indigo',
            keywords: ['الذاكرة', 'قواعد المساعد', 'تفضيلات'],
            category: 'tools',
            target: { view: 'morrow_center', morrowTab: 'memory' },
            children: [],
          },
          {
            id: 'morrow_notes_tab_node',
            parentId: 'morrow_center_node',
            level: 3,
            title: 'الملاحظات السريعة المرتبطة',
            subtitle: 'تدوين سريع وربط تلقائي بملفات المستفيدين',
            icon: 'sparkles',
            logo: 'bot',
            accentTone: 'cyan',
            keywords: ['الملاحظات السريعة', 'إملاء'],
            category: 'tools',
            target: { view: 'morrow_center', morrowTab: 'quick_notes' },
            children: [],
          },
        ],
      },
      {
        id: 'google_workspace_node',
        parentId: 'root',
        level: 2,
        title: 'التقويم والمهام (Google)',
        subtitle: 'مزامنة مواعيد التسليم ومهام التوزيع السحابية',
        icon: 'calendar',
        logo: 'calendar',
        accentTone: 'indigo',
        keywords: ['التقويم', 'المهام', 'جوجل', 'google'],
        category: 'tools',
        target: { view: 'google_workspace' },
        children: [],
      },
      {
        id: 'settings_hub_node',
        parentId: 'root',
        level: 2,
        title: 'الإعدادات والاستوديوهات',
        subtitle: 'إدارة شاملة لإعدادات المظهر والحاسبة والجداول والأمان بملء الشاشة',
        icon: 'settings',
        logo: 'settings',
        accentTone: 'indigo',
        component: 'SettingsCapsuleHub',
        keywords: ['الإعدادات', 'الاستوديو', 'التحكم', 'التخصيص'],
        category: 'settings',
        target: { view: 'settings', settingsScreenMode: 'hub' },
        getBadge: (ctx) => ({
          text:
            ctx.settingsDisplayMode === 'contained'
              ? `${ctx.modeLabel || 'النظام'} · مدمج`
              : `${ctx.modeLabel || 'النظام'} · ملء الشاشة`,
          tone: 'accent',
        }),
        children: [
          {
            id: 'settings_appearance_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'استوديو المظهر والألوان',
            subtitle: 'الثيمات الكلاسيكية والعصرية والزجاجية، الهندسة، وتصميم الجداول',
            icon: 'palette',
            logo: 'palette',
            accentTone: 'indigo',
            component: 'AppearanceCapsules',
            keywords: [
              'استوديو المظهر',
              'الألوان',
              'الثيم',
              'الوضع الليلي',
              'النهاري',
              'محرك الجدول',
              'الزجاجية',
            ],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'appearance',
              settingsScreenMode: 'detail',
            },
            getBadge: (ctx) =>
              ctx.activeThemeName
                ? { text: ctx.activeThemeName, tone: 'neutral' }
                : null,
            children: [
              {
                id: 'appearance_profiles_cap',
                parentId: 'settings_appearance_node',
                level: 4,
                title: 'ملفات المظهر المحفوظة',
                subtitle: 'تبديل وحفظ التوليفات الجاهزة والمخصصة بنقرة واحدة',
                icon: 'layers',
                logo: 'palette',
                accentTone: 'indigo',
                component: 'AppearanceProfilesCapsule',
                keywords: ['ملفات المظهر', 'حفظ المظهر', 'وضع العمل الليلي', 'وضع القراءة'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'appearance',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'appearance_profiles_cap',
                },
                getBadge: (ctx) => ({
                  text: `${ctx.savedProfilesCount ?? 2} ملفات`,
                  tone: 'neutral',
                }),
                children: [],
              },
              {
                id: 'appearance_themes_cap',
                parentId: 'settings_appearance_node',
                level: 4,
                title: 'ثيمات التطبيق والألوان الحرة',
                subtitle: 'الثيمات الكلاسيكية (8) + ثيمات عصرية وزجاجية + الألوان الحرة',
                icon: 'palette',
                logo: 'palette',
                accentTone: 'indigo',
                component: 'AppearanceThemesCapsule',
                keywords: ['ثيمات التطبيق', 'السبج', 'الشفق', 'المرمر', 'الألوان الحرة'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'appearance',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'appearance_themes_cap',
                },
                getBadge: (ctx) =>
                  ctx.activeThemeName
                    ? { text: ctx.activeThemeName, tone: 'accent' }
                    : null,
                children: [
                  {
                    id: 'appearance_themes_classic_cap',
                    parentId: 'appearance_themes_cap',
                    level: 5,
                    title: 'الثيمات الكلاسيكية الأصيلة (8)',
                    subtitle: 'السبج والذهب، الشفق القطبي، النيون، السراب، الثلج، الزمرد، القرمزي، والبساطة',
                    icon: 'palette',
                    logo: 'palette',
                    accentTone: 'indigo',
                    component: 'ClassicThemesCapsule',
                    keywords: ['السبج والذهب', 'الشفق', 'النيون', 'السراب الصحراوي', 'الثلج القطبي', 'غابة الزمرد', 'القرمزي', 'كلاسيكية'],
                    category: 'settings',
                    target: {
                      view: 'settings',
                      settingsSection: 'appearance',
                      settingsScreenMode: 'detail',
                      settingsCapsuleId: 'appearance_themes_classic_cap',
                    },
                    children: [],
                  },
                  {
                    id: 'appearance_themes_modern_cap',
                    parentId: 'appearance_themes_cap',
                    level: 5,
                    title: 'الثيمات العصرية والزجاجية الجديدة',
                    subtitle: 'المرمر الزجاجي، الكتان الحكيم، غسق الشمال، ونيلي منتصف الليل',
                    icon: 'sparkles',
                    logo: 'palette',
                    accentTone: 'cyan',
                    component: 'ModernThemesCapsule',
                    keywords: ['عصرية', 'زجاجية', 'المرمر', 'الكتان', 'غسق الشمال', 'نيلي منتصف الليل'],
                    category: 'settings',
                    target: {
                      view: 'settings',
                      settingsSection: 'appearance',
                      settingsScreenMode: 'detail',
                      settingsCapsuleId: 'appearance_themes_modern_cap',
                    },
                    children: [],
                  },
                  {
                    id: 'appearance_themes_custom_cap',
                    parentId: 'appearance_themes_cap',
                    level: 5,
                    title: 'تخصيص الألوان الحرة (Color Overrides)',
                    subtitle: 'تعديل لون الخلفية، البطاقات، النصوص، واللون المميز يدوياً',
                    icon: 'palette',
                    logo: 'palette',
                    accentTone: 'amber',
                    component: 'CustomColorsCapsule',
                    protected: true,
                    keywords: ['الألوان الحرة', 'لون الخلفية', 'لون البطاقات', 'Accent'],
                    category: 'settings',
                    target: {
                      view: 'settings',
                      settingsSection: 'appearance',
                      settingsScreenMode: 'detail',
                      settingsCapsuleId: 'appearance_themes_custom_cap',
                    },
                    children: [],
                  },
                ],
              },
              {
                id: 'appearance_geometry_cap',
                parentId: 'settings_appearance_node',
                level: 4,
                title: 'التحكم الهندسي والزجاجية والظلال',
                subtitle: 'حجم الخط، ارتفاع الصف، عرض الأعمدة، التدوير، والظلال',
                icon: 'sliders',
                logo: 'palette',
                accentTone: 'indigo',
                component: 'AppearanceGeometryCapsule',
                defaults: {
                  fontSizePx: 15,
                  rowHeightPx: 42,
                  colWidthScale: 100,
                  borderRadiusPx: 12,
                  cardShadowLevel: 'soft',
                  glassEffect: false,
                },
                keywords: ['التحكم الهندسي', 'انحناء الحواف', 'الظلال', 'الزجاجية', 'ارتفاع صف الجدول'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'appearance',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'appearance_geometry_cap',
                },
                children: [],
              },
              {
                id: 'appearance_tables_cap',
                parentId: 'settings_appearance_node',
                level: 4,
                title: 'تصاميم الجداول والتنسيق الشرطي',
                subtitle: 'محركات الجداول الثمانية، القواعد الشرطية، والميزات الحديثة',
                icon: 'table',
                logo: 'palette',
                accentTone: 'indigo',
                component: 'AppearanceTablesCapsule',
                keywords: ['محركات الجداول', 'الجدول الزجاجي', 'التنسيق الشرطي', 'العرض البطاقي', 'تثبيت عمود الاسم'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'appearance',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'appearance_tables_cap',
                },
                getBadge: (ctx) =>
                  ctx.activeTableThemeName
                    ? { text: ctx.activeTableThemeName, tone: 'neutral' }
                    : null,
                children: [
                  {
                    id: 'appearance_table_engines_cap',
                    parentId: 'appearance_tables_cap',
                    level: 5,
                    title: 'محركات تصميم الجداول (8 تصاميم)',
                    subtitle: 'الزجاجي، الدفتر الورقي، شبكة البيانات، الملكي، الكتل، الخطوط، المصفوفة، البطاقي',
                    icon: 'table',
                    logo: 'palette',
                    accentTone: 'indigo',
                    component: 'TableEnginesCapsule',
                    keywords: ['محركات تصميم الجداول', 'الدفتر الورقي', 'شبكة البيانات', 'المصفوفة الرقمية'],
                    category: 'settings',
                    target: {
                      view: 'settings',
                      settingsSection: 'appearance',
                      settingsScreenMode: 'detail',
                      settingsCapsuleId: 'appearance_table_engines_cap',
                    },
                    children: [],
                  },
                  {
                    id: 'appearance_table_rules_cap',
                    parentId: 'appearance_tables_cap',
                    level: 5,
                    title: 'التنسيق الشرطي والميزات الحديثة',
                    subtitle: 'تمييز المحجوبين، المكررين، 0 أفراد، وتثبيت رأس الجدول والتركيز',
                    icon: 'eye',
                    logo: 'palette',
                    accentTone: 'indigo',
                    component: 'TableRulesCapsule',
                    keywords: ['التنسيق الشرطي', 'الأسماء المكررة', 'السطر النشط', 'تقسيم بصري ذكي'],
                    category: 'settings',
                    target: {
                      view: 'settings',
                      settingsSection: 'appearance',
                      settingsScreenMode: 'detail',
                      settingsCapsuleId: 'appearance_table_rules_cap',
                    },
                    children: [],
                  },
                ],
              },
            ],
          },
          {
            id: 'settings_fonts_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'الخطوط والتباعد والزوايا',
            subtitle: 'الخط العربي، الحجم، الوزن، ارتفاع الصفوف، ومحاذاة الأرقام',
            icon: 'type',
            logo: 'type',
            accentTone: 'cyan',
            component: 'FontsCapsules',
            keywords: ['الخطوط', 'التباعد', 'الحجم', 'ارتفاع الصفوف', 'Cairo', 'Tajawal', 'IBM Plex'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'fonts',
              settingsScreenMode: 'detail',
            },
            getBadge: (ctx) => ({
              text: `${ctx.activeFontName || 'Cairo'} · ${ctx.fontSizePx ?? 15}px`,
              tone: 'neutral',
            }),
            children: [
              {
                id: 'fonts_family_cap',
                parentId: 'settings_fonts_node',
                level: 4,
                title: 'الخطوط العربية الاحترافية (6 خطوط)',
                subtitle: 'Cairo، Tajawal، Almarai، Changa، El Messiri، وIBM Plex Arabic',
                icon: 'type',
                logo: 'type',
                accentTone: 'cyan',
                component: 'FontsFamilyCapsule',
                defaults: { fontFamily: 'cairo' },
                keywords: ['نوع الخط', 'خط عربي', 'Cairo', 'Tajawal', 'Almarai', 'IBM Plex'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'fonts',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'fonts_family_cap',
                },
                children: [],
              },
              {
                id: 'fonts_scale_cap',
                parentId: 'settings_fonts_node',
                level: 4,
                title: 'الحجم والوزن وكثافة الصفوف',
                subtitle: 'مقاسات النصوص، سُمك الخط، التباعد، ووضوح الأرقام المتساوي',
                icon: 'sliders',
                logo: 'type',
                accentTone: 'cyan',
                component: 'FontsScaleCapsule',
                defaults: {
                  fontSize: 'md',
                  fontWeight: 'normal',
                  rowDensity: 'comfortable',
                  tabularNumerals: true,
                  rowHoverHighlight: true,
                },
                keywords: ['حجم الخط', 'وزن الخط', 'ارتفاع الصف', 'Tabular Numerals', 'تتبع السطر'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'fonts',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'fonts_scale_cap',
                },
                children: [],
              },
            ],
          },
          {
            id: 'settings_modes_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'إعدادات التحرير والجداول',
            subtitle: 'قواعد التأكيد والحفظ الفوري، الفئات المخصصة، وتخطيط الأعمدة',
            icon: 'sliders',
            logo: 'sliders',
            accentTone: 'violet',
            component: 'ModesCapsules',
            protected: true,
            settingsGroup: 'system',
            keywords: ['التحرير', 'الجداول', 'الفئات المخصصة', 'تأكيد التعديل', 'تخطيط الأعمدة'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'modes',
              settingsScreenMode: 'detail',
            },
            getBadge: (ctx) =>
              ctx.modeLabel ? { text: ctx.modeLabel, tone: 'accent' } : null,
            children: [
              {
                id: 'modes_tier_cap',
                parentId: 'settings_modes_node',
                level: 4,
                title: 'الحفظ الفوري وقواعد التأكيد',
                subtitle: 'التحكم بنوافذ التأكيد قبل تعديل أو حذف السجلات',
                icon: 'layers',
                logo: 'sliders',
                accentTone: 'violet',
                component: 'ModesTierCapsule',
                tier: 'main',
                keywords: ['التحرير', 'التأكيد', 'الحفظ الفوري'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'modes',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'modes_tier_cap',
                },
                children: [],
              },
              {
                id: 'modes_editor_cap',
                parentId: 'settings_modes_node',
                level: 4,
                title: 'حماية التعديلات والتأكيدات',
                subtitle: 'تفعيل الحفظ الفوري أو إبقاء تأكيدات التعديل والحذف',
                icon: 'lock',
                logo: 'sliders',
                accentTone: 'violet',
                component: 'ModesEditorCapsule',
                tier: 'main',
                keywords: ['قواعد التأكيد', 'الحفظ الفوري', 'التحرير'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'modes',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'modes_editor_cap',
                },
                children: [],
              },
              {
                id: 'modes_expert_cap',
                parentId: 'settings_modes_node',
                level: 4,
                title: 'الفئات المخصصة وتخطيط الجدول',
                subtitle: 'إدارة فئات المستفيدين وإعادة ضبط ترتيب وأسماء الأعمدة',
                icon: 'sliders',
                logo: 'sliders',
                accentTone: 'violet',
                component: 'ModesExpertCapsule',
                protected: true,
                tier: 'side',
                keywords: ['الفئات المخصصة', 'تخطيط الجدول', 'إعادة ضبط الجدول'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'modes',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'modes_expert_cap',
                },
                children: [],
              },
            ],
          },
          {
            id: 'settings_ai_assistant_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'معمارية نماذج الذكاء الاصطناعي Morrow',
            subtitle: 'توجيه النماذج من الأقوى للأضعف، الاحتياطي لكل مهمة، وMorrow الأخير',
            icon: 'bot',
            logo: 'bot',
            accentTone: 'violet',
            component: 'SecurityCapsules',
            settingsGroup: 'ai',
            keywords: ['المساعد الذكي', 'Morrow', 'النماذج', 'التوجيه', 'Gemini', 'أوفلاين'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'ai_assistant',
              settingsScreenMode: 'detail',
            },
            children: [],
          },
          {
            id: 'settings_system_map_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'خريطة النظام والأقسام والأرشيف',
            subtitle: 'الأقسام الـ14، الخريطة التفاعلية، KPI، صحة البيانات، والأرشيف الكامل',
            icon: 'archive',
            logo: 'archive',
            accentTone: 'slate',
            component: 'SystemMapPanel',
            settingsGroup: 'system_map',
            keywords: ['خريطة النظام', 'الأقسام', 'الخريطة التفاعلية', 'KPI', 'الأرشيف الكامل', 'إحصاءات النظام'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'system_map',
              settingsScreenMode: 'detail',
            },
            children: [],
          },
          {
            id: 'settings_calculator_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'ضبط حاسبة الجدول والمعادلات',
            subtitle: 'حصة الفرد (كغم)، وزن الكيس، رسم الفرد (250)، والاختبار الحي',
            icon: 'calculator',
            logo: 'calculator',
            accentTone: 'emerald',
            component: 'CalculatorCapsules',
            protected: true,
            defaults: {
              kgPerIndividual: 9,
              kgPerBag: 50,
              feePerIndividualIqd: 250,
              fixedCardFeeIqd: 250,
              roundingStepIqd: 0,
              discountPercent: 0,
              calculationMode: 'instant',
              includeBlockedInFees: false,
              defaultWorkerWageIqd: 1000,
              defaultGeneralExpenseIqd: 500,
            },
            keywords: ['الحاسبة', 'حاسبة الحصص', 'ضبط حاسبة الجدول', 'المعادلات', 'وزن الكيس', 'الرسوم', 'رسم الفرد'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'calculator',
              settingsScreenMode: 'detail',
            },
            getBadge: (ctx) => ({
              text: `${ctx.kgPerIndividual ?? 9} كغم · رسم الفرد: ${ctx.feePerIndividualIqd ?? 250}`,
              tone: 'success',
            }),
            children: [
              {
                id: 'calc_quotas_cap',
                parentId: 'settings_calculator_node',
                level: 4,
                title: 'الحصص والأوزان القياسية',
                subtitle: 'تحديد وزن حصة الفرد (كغم/فرد) ووزن الكيس الكامل (كغم/كيس)',
                icon: 'scale',
                logo: 'calculator',
                accentTone: 'emerald',
                component: 'CalcQuotasCapsule',
                protected: true,
                defaults: { kgPerIndividual: 9, kgPerBag: 50 },
                keywords: ['كغم فرد', 'كغم كيس', 'وزن الحصة', 'وزن الكيس'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'calculator',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'calc_quotas_cap',
                },
                getBadge: (ctx) => ({
                  text: `${ctx.kgPerIndividual ?? 9} كغم/فرد`,
                  tone: 'neutral',
                }),
                children: [],
              },
              {
                id: 'calc_fees_cap',
                parentId: 'settings_calculator_node',
                level: 4,
                title: 'الرسوم والتكاليف التلقائية',
                subtitle: 'رسم الفرد التلقائي (250 د.ع)، رسم البطاقة الثابت، ومصاريف المالية الافتراضية',
                icon: 'coins',
                logo: 'calculator',
                accentTone: 'emerald',
                component: 'CalcFeesCapsule',
                protected: true,
                defaults: {
                  feePerIndividualIqd: 250,
                  fixedCardFeeIqd: 250,
                  defaultWorkerWageIqd: 1000,
                  defaultGeneralExpenseIqd: 500,
                },
                keywords: ['رسم الفرد', 'رسم الفرد التلقائي', '250', 'رسم البطاقة الثابت', 'أجر العامل'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'calculator',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'calc_fees_cap',
                },
                getBadge: (ctx) => ({
                  text: `رسم الفرد: ${ctx.feePerIndividualIqd ?? 250}`,
                  tone: 'accent',
                }),
                children: [],
              },
              {
                id: 'calc_rules_cap',
                parentId: 'settings_calculator_node',
                level: 4,
                title: 'قواعد التقريب والخصم والمحجوبين',
                subtitle: 'تقريب المبلغ، نسبة الخصم، نمط الاحتساب، وشمول الحظر الكامل',
                icon: 'percent',
                logo: 'calculator',
                accentTone: 'emerald',
                component: 'CalcRulesCapsule',
                protected: true,
                defaults: {
                  roundingStepIqd: 0,
                  discountPercent: 0,
                  calculationMode: 'instant',
                  includeBlockedInFees: false,
                },
                keywords: ['تقريب المبلغ', 'نسبة الخصم', 'المحجوبين', 'نمط الاحتساب'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'calculator',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'calc_rules_cap',
                },
                children: [],
              },
              {
                id: 'calc_preview_cap',
                parentId: 'settings_calculator_node',
                level: 4,
                title: 'معاينة واختبار المعادلة الحالية',
                subtitle: 'اختبار فوري للأفراد (افتراضياً 5 × 250 = 1,250 د.ع) والحصة النهائية',
                icon: 'flask',
                logo: 'calculator',
                accentTone: 'emerald',
                component: 'CalcPreviewCapsule',
                defaults: { testIndividuals: 5 },
                keywords: ['اختبار المعادلة', 'معاينة المعادلة', '5 أفراد', '1250'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'calculator',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'calc_preview_cap',
                },
                getBadge: () => ({ text: 'افتراضي: 5 أفراد', tone: 'success' }),
                children: [],
              },
            ],
          },
          {
            id: 'settings_general_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'الإعدادات العامة والشريط العلوي',
            subtitle: 'وضع ملء الشاشة الافتراضي، تأكيدات الأمان، والإخفاء التلقائي للتركيز',
            icon: 'sparkles',
            logo: 'sparkles',
            accentTone: 'amber',
            component: 'GeneralCapsules',
            keywords: ['الشريط العلوي', 'التركيز', 'عامة', 'تأكيد الحذف', 'ملء الشاشة', 'وضع العرض'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'general',
              settingsScreenMode: 'detail',
            },
            getBadge: (ctx) => ({
              text:
                ctx.settingsDisplayMode === 'contained'
                  ? 'الوضع: مدمج'
                  : 'الوضع: ملء الشاشة',
              tone: 'accent',
            }),
            children: [
              {
                id: 'general_display_cap',
                parentId: 'settings_general_node',
                level: 4,
                title: 'وضع العرض الافتراضي (ملء الشاشة) والتراجع',
                subtitle: 'التبديل بين ملء الشاشة بالكامل أو العرض المدمج، وسعة Undo وبوابة الدخول',
                icon: 'eye',
                logo: 'sparkles',
                accentTone: 'amber',
                component: 'GeneralDisplayCapsule',
                defaults: { settingsDisplayMode: 'fullscreen', undoLimit: 35 },
                keywords: ['ملء الشاشة', 'وضع العرض', 'Undo', 'تسجيل الدخول'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'general',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'general_display_cap',
                },
                getBadge: (ctx) => ({
                  text:
                    ctx.settingsDisplayMode === 'contained'
                      ? 'مدمج'
                      : 'ملء الشاشة',
                  tone: 'accent',
                }),
                children: [],
              },
              {
                id: 'general_behavior_cap',
                parentId: 'settings_general_node',
                level: 4,
                title: 'تأكيدات العمليات والتنبيهات والأرقام',
                subtitle: 'تأكيد الحذف والتعديل، إشعارات العمليات، والأرقام المضغوطة',
                icon: 'shield',
                logo: 'sparkles',
                accentTone: 'amber',
                component: 'GeneralBehaviorCapsule',
                defaults: {
                  confirmBeforeDelete: true,
                  confirmBeforeEdit: true,
                  showActionAlerts: true,
                  compactNumbers: false,
                },
                keywords: ['تأكيد قبل الحذف', 'تأكيد قبل التعديل', 'إشعارات العمليات', 'أرقام مضغوطة'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'general',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'general_behavior_cap',
                },
                children: [],
              },
              {
                id: 'general_topbar_cap',
                parentId: 'settings_general_node',
                level: 4,
                title: 'الشريط العلوي والإخفاء التلقائي بالتركيز',
                subtitle: 'حجم الشريط، سلوك الإخفاء في الجداول، وعناصر الشريط الظاهرة',
                icon: 'layers',
                logo: 'sparkles',
                accentTone: 'amber',
                component: 'GeneralTopBarCapsule',
                defaults: {
                  mode: 'normal',
                  autoFocus: false,
                  autoFocusAction: 'hide',
                  autoHideInTables: false,
                },
                keywords: ['حجم الشريط العلوي', 'إخفاء تلقائي', 'تصغير الشريط', 'زر الحساب'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'general',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'general_topbar_cap',
                },
                getBadge: (ctx) => ({
                  text: ctx.autoHideTopBar ? 'إخفاء تلقائي نشط' : 'شريط قياسي',
                  tone: 'neutral',
                }),
                children: [],
              },
            ],
          },
          {
            id: 'settings_security_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'الأمان والبيانات وسلة المهملات',
            subtitle: 'قفل الخصوصية، النسخ JSON، المزامنة السحابية، المساعد، واسترجاع المحذوفات',
            icon: 'shield',
            logo: 'shield',
            accentTone: 'slate',
            component: 'SecurityCapsules',
            protected: true,
            keywords: ['الأمان', 'سلة المهملات', 'نسخ احتياطي', 'قفل', 'المزامنة', 'المساعد الذكي'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'security_data',
              settingsScreenMode: 'detail',
            },
            getBadge: (ctx) =>
              ctx.privacyLocked
                ? { text: 'القفل مفعّل', tone: 'warning' }
                : ctx.recycleBinCount > 0
                ? { text: `${ctx.recycleBinCount} في المهملات`, tone: 'warning' }
                : null,
            children: [
              {
                id: 'sec_cloud_sync_cap',
                parentId: 'settings_security_node',
                level: 4,
                title: 'الحساب والمزامنة السحابية',
                subtitle: 'ربط الحساب، الحفظ على الخادم، واسترجاع النسخة السحابية',
                icon: 'cloud',
                logo: 'shield',
                accentTone: 'slate',
                component: 'SecCloudSyncCapsule',
                keywords: ['الحساب', 'المزامنة السحابية', 'حفظ في الخادم', 'استرجاع'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'security_data',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'sec_cloud_sync_cap',
                },
                children: [],
              },
              {
                id: 'sec_backup_json_cap',
                parentId: 'settings_security_node',
                level: 4,
                title: 'النسخ الاحتياطي المحلي والخصوصية (JSON)',
                subtitle: 'تصدير واستيراد JSON، الحفظ أوفلاين، وحماية أسماء المستفيدين',
                icon: 'file_json',
                logo: 'shield',
                accentTone: 'slate',
                component: 'SecBackupJsonCapsule',
                protected: true,
                keywords: ['نسخ احتياطي JSON', 'استيراد', 'تصدير', 'Offline Cache', 'خصوصية الأسماء'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'security_data',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'sec_backup_json_cap',
                },
                children: [],
              },
              {
                id: 'sec_ai_assistant_cap',
                parentId: 'settings_security_node',
                level: 4,
                title: 'استوديو النماذج والتوجيه من الأقوى للأضعف',
                subtitle: 'تخصيص النموذج الأساسي والاحتياطي لكل مهمة، سجل القوة، وMorrow المحلي',
                icon: 'bot',
                logo: 'shield',
                accentTone: 'violet',
                component: 'SecAiAssistantCapsule',
                protected: true,
                keywords: ['استوديو النماذج', 'التوجيه', 'الحصة المجانية', 'كاش', 'أوفلاين 100%', 'Gemini', 'Nemotron'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'ai_assistant',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'sec_ai_assistant_cap',
                },
                children: [],
              },
              {
                id: 'sec_privacy_lock_cap',
                parentId: 'settings_security_node',
                level: 4,
                title: 'قفل الخصوصية السريع والرمز',
                subtitle: 'تعيين رمز PIN وقفل الشاشة فوراً لحماية السجلات',
                icon: 'lock',
                logo: 'shield',
                accentTone: 'rose',
                component: 'SecPrivacyLockCapsule',
                protected: true,
                keywords: ['قفل الخصوصية', 'رمز القفل', 'PIN'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'security_data',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'sec_privacy_lock_cap',
                },
                children: [],
              },
              {
                id: 'sec_recycle_bin_cap',
                parentId: 'settings_security_node',
                level: 4,
                title: 'سلة الاسترجاع الآمنة',
                subtitle: 'استعادة السجلات والقوائم والمصاريف المحذوفة أو الحذف النهائي',
                icon: 'trash',
                logo: 'shield',
                accentTone: 'amber',
                component: 'SecRecycleBinCapsule',
                protected: true,
                keywords: ['سلة المهملات', 'سلة الاسترجاع', 'استعادة', 'حذف نهائي'],
                category: 'settings',
                target: {
                  view: 'settings',
                  settingsSection: 'security_data',
                  settingsScreenMode: 'detail',
                  settingsCapsuleId: 'sec_recycle_bin_cap',
                },
                getBadge: (ctx) => ({
                  text: `${ctx.recycleBinCount} عنصر`,
                  tone: ctx.recycleBinCount > 0 ? 'warning' : 'neutral',
                }),
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };

  root = enrichDescriptionsAndLevels(root, null, 1);

  for (const ext of [...runtimeHierarchyExtensions, ...extraExtensions]) {
    root = attachExtensionRecursive(root, ext);
  }

  return root;
}

export function flattenHierarchyNodes(root: HierarchyNode): HierarchyNode[] {
  const result: HierarchyNode[] = [root];
  for (const child of root.children) {
    result.push(...flattenHierarchyNodes(child));
  }
  return result;
}

export function getHierarchyNodeById(
  root: HierarchyNode,
  nodeId: string
): HierarchyNode | null {
  if (root.id === nodeId) return root;
  for (const child of root.children) {
    const hit = getHierarchyNodeById(child, nodeId);
    if (hit) return hit;
  }
  return null;
}

export function getHierarchyPath(
  root: HierarchyNode,
  nodeId: string
): HierarchyNode[] {
  if (root.id === nodeId) return [root];
  for (const child of root.children) {
    const subPath = getHierarchyPath(child, nodeId);
    if (subPath.length > 0) {
      return [root, ...subPath];
    }
  }
  return [];
}

export function getSettingsSectionNodeId(section: SettingsSectionId): string {
  if (section === 'appearance') return 'settings_appearance_node';
  if (section === 'fonts') return 'settings_fonts_node';
  if (section === 'modes') return 'settings_modes_node';
  if (section === 'calculator') return 'settings_calculator_node';
  if (section === 'general') return 'settings_general_node';
  if (section === 'security_data') return 'settings_security_node';
  if (section === 'quick_extract_settings') return 'quick_extract_settings_node';
  if (section === 'relations_lists') return 'relations_lists_prefs_node';
  if (section === 'ai_assistant') return 'settings_ai_assistant_node';
  if (section === 'system_map') return 'settings_system_map_node';
  return 'settings_hub_node';
}

export function resolveActiveHierarchyNodeId(params: {
  activeView: AppView;
  selectedAgencyId?: number | null;
  settingsSection?: SettingsSectionId;
  settingsScreenMode?: 'hub' | 'detail';
  settingsCapsuleId?: string | null;
  morrowTab?: MorrowCenterTab;
  columnCustomizerOpen?: boolean;
}): string {
  const {
    activeView,
    selectedAgencyId,
    settingsSection,
    settingsScreenMode,
    settingsCapsuleId,
    morrowTab,
    columnCustomizerOpen,
  } = params;

  if (activeView === 'hub') return 'root';
  if (activeView === 'master_roster') {
    return columnCustomizerOpen ? 'column_customizer_node' : 'master_roster_node';
  }
  if (activeView === 'agency_roster') {
    if (columnCustomizerOpen) return 'column_customizer_node';
    return selectedAgencyId
      ? `agency_node_${selectedAgencyId}`
      : 'agencies_hub_node';
  }
  if (activeView === 'quick_extract') return 'quick_extract_node';
  if (activeView === 'ready_lists') return 'ready_lists_node';
  if (activeView === 'relationships') return 'relationships_detail_node';
  if (activeView === 'finance') return 'finance_detail_node';
  if (activeView === 'data_archives') return 'data_archives_node';
  if (activeView === 'google_workspace') return 'google_workspace_node';
  if (activeView === 'morrow_center') {
    if (morrowTab === 'approvals') return 'morrow_approvals_tab_node';
    if (morrowTab === 'memory') return 'morrow_memory_tab_node';
    if (morrowTab === 'quick_notes') return 'morrow_notes_tab_node';
    if (morrowTab === 'chat') return 'morrow_chat_tab_node';
    return 'morrow_center_node';
  }
  if (activeView === 'settings') {
    if (settingsScreenMode === 'hub') return 'settings_hub_node';
    if (settingsCapsuleId) return settingsCapsuleId;
    if (settingsSection) return getSettingsSectionNodeId(settingsSection);
    return 'settings_hub_node';
  }
  return 'root';
}

export interface HierarchySearchHit {
  node: HierarchyNode;
  path: HierarchyNode[];
  score: number;
}

export function searchHierarchyNodes(
  root: HierarchyNode,
  query: string
): HierarchySearchHit[] {
  const qNorm = normalizeArabic(query);
  if (!qNorm) return [];

  const tokens = qNorm.split(' ').filter(Boolean);
  const hits: HierarchySearchHit[] = [];

  const visit = (node: HierarchyNode, trail: HierarchyNode[]) => {
    const nextTrail = [...trail, node];
    if (node.id !== 'root') {
      const titleNorm = normalizeArabic(node.title);
      const subNorm = normalizeArabic(node.subtitle);
      const descNorm = normalizeArabic(node.description || '');
      const kwNorm = node.keywords.map((k) => normalizeArabic(k)).join(' ');
      const pathNorm = nextTrail.map((n) => normalizeArabic(n.title)).join(' ');
      const haystack = `${titleNorm} ${subNorm} ${descNorm} ${kwNorm} ${pathNorm}`;

      const matchesAllTokens = tokens.every((t) => haystack.includes(t));
      if (matchesAllTokens) {
        let score = 10;
        if (titleNorm === qNorm) score += 80;
        else if (titleNorm.startsWith(qNorm)) score += 45;
        else if (titleNorm.includes(qNorm)) score += 30;
        if (kwNorm.includes(qNorm)) score += 25;
        if (node.level >= 4) score += 4;
        hits.push({ node, path: nextTrail, score });
      }
    }
    for (const child of node.children) {
      visit(child, nextTrail);
    }
  };

  visit(root, []);
  hits.sort((a, b) => b.score - a.score || a.node.level - b.node.level);
  return hits;
}

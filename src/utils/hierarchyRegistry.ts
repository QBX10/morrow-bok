import type {
  Agency,
  AppView,
  SettingsSectionId,
} from '../types/agency.ts';
import type { MorrowCenterTab } from '../types/assistant.ts';
import { normalizeArabic } from './agencyLogic.ts';

export interface HierarchyTarget {
  view: AppView;
  settingsSection?: SettingsSectionId;
  settingsScreenMode?: 'hub' | 'detail';
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
  modeLabel?: string;
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
  keywords: string[];
  category: 'root' | 'core' | 'agencies' | 'tools' | 'settings';
  target: HierarchyTarget;
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
      keywords: ['تخصيص الأعمدة', 'ترتيب الأعمدة', 'القوالب', 'تثبيت العمود', 'الخبير'],
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
            keywords: ['قوالب السحب', 'عتبة الوضوح', 'إعدادات السحب'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'quick_extract_settings',
              settingsScreenMode: 'detail',
            },
            children: [],
          },
        ],
      },
      {
        id: 'ready_lists_node',
        parentId: 'root',
        level: 2,
        title: 'القوائم الجاهزة والتوزيع',
        subtitle: 'إعداد قوائم التسليم المباشر والطباعة والتصدير',
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
            keywords: ['إعدادات العلاقات', 'تفضيلات القوائم'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'relations_lists',
              settingsScreenMode: 'detail',
            },
            children: [],
          },
        ],
      },
      {
        id: 'data_archives_node',
        parentId: 'root',
        level: 2,
        title: 'المطابقة والأرشفة الشهرية',
        subtitle: 'حفظ الدورات الشهرية وإغلاق الحصص والمقارنة التاريخية',
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
        subtitle: 'مركز التحكم الشامل بالمظهر، الجداول، المعادلات، والأمان',
        keywords: ['الإعدادات', 'الاستوديو', 'التحكم', 'التخصيص'],
        category: 'settings',
        target: { view: 'settings', settingsScreenMode: 'hub' },
        getBadge: (ctx) =>
          ctx.modeLabel ? { text: ctx.modeLabel, tone: 'accent' } : null,
        children: [
          {
            id: 'settings_appearance_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'استوديو المظهر والألوان',
            subtitle: 'الثيمات، ثيمات الجداول، وملفات المظهر الشخصية',
            keywords: ['استوديو المظهر', 'الألوان', 'الثيم', 'الوضع الليلي', 'النهاري', 'محرك الجدول'],
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
            children: [],
          },
          {
            id: 'settings_fonts_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'الخطوط والتباعد والزوايا',
            subtitle: 'الخط العربي، ارتفاع الصفوف، وكثافة الجداول',
            keywords: ['الخطوط', 'التباعد', 'الحجم', 'ارتفاع الصفوف'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'fonts',
              settingsScreenMode: 'detail',
            },
            children: [],
          },
          {
            id: 'settings_modes_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'الأوضاع وتحكم الخبير',
            subtitle: 'تبديل المبتدئ/الخبير، الفئات المخصصة، وحرية التعديل',
            keywords: ['الأوضاع', 'الخبير', 'المبتدئ', 'الفئات المخصصة', 'تحكم الخبير'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'modes',
              settingsScreenMode: 'detail',
            },
            children: [],
          },
          {
            id: 'settings_calculator_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'حاسبة الحصص والمعادلات',
            subtitle: 'حصة الفرد (كغم)، وزن الكيس، ورسوم البطاقة والخصومات',
            keywords: ['الحاسبة', 'حاسبة الحصص', 'المعادلات', 'وزن الكيس', 'الرسوم'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'calculator',
              settingsScreenMode: 'detail',
            },
            children: [],
          },
          {
            id: 'settings_general_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'الإعدادات العامة والشريط العلوي',
            subtitle: 'الإخفاء التلقائي للتركيز، سجل التراجع، والتنبيهات',
            keywords: ['الشريط العلوي', 'التركيز', 'عامة', 'تأكيد الحذف'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'general',
              settingsScreenMode: 'detail',
            },
            children: [],
          },
          {
            id: 'settings_security_node',
            parentId: 'settings_hub_node',
            level: 3,
            title: 'الأمان والبيانات وسلة المهملات',
            subtitle: 'قفل الخصوصية، النسخ JSON، المزامنة، واسترجاع المحذوفات',
            keywords: ['الأمان', 'سلة المهملات', 'نسخ احتياطي', 'قفل', 'المزامنة'],
            category: 'settings',
            target: {
              view: 'settings',
              settingsSection: 'security_data',
              settingsScreenMode: 'detail',
            },
            getBadge: (ctx) =>
              ctx.recycleBinCount > 0
                ? { text: `${ctx.recycleBinCount} في المهملات`, tone: 'warning' }
                : null,
            children: [],
          },
        ],
      },
    ],
  };

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

export function resolveActiveHierarchyNodeId(params: {
  activeView: AppView;
  selectedAgencyId?: number | null;
  settingsSection?: SettingsSectionId;
  settingsScreenMode?: 'hub' | 'detail';
  morrowTab?: MorrowCenterTab;
  columnCustomizerOpen?: boolean;
}): string {
  const {
    activeView,
    selectedAgencyId,
    settingsSection,
    settingsScreenMode,
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
    if (settingsSection === 'appearance') return 'settings_appearance_node';
    if (settingsSection === 'fonts') return 'settings_fonts_node';
    if (settingsSection === 'modes') return 'settings_modes_node';
    if (settingsSection === 'calculator') return 'settings_calculator_node';
    if (settingsSection === 'general') return 'settings_general_node';
    if (settingsSection === 'security_data') return 'settings_security_node';
    if (settingsSection === 'quick_extract_settings') {
      return 'quick_extract_settings_node';
    }
    if (settingsSection === 'relations_lists') {
      return 'relations_lists_prefs_node';
    }
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
      const kwNorm = node.keywords.map((k) => normalizeArabic(k)).join(' ');
      const haystack = `${titleNorm} ${subNorm} ${kwNorm}`;

      const matchesAllTokens = tokens.every((t) => haystack.includes(t));
      if (matchesAllTokens) {
        let score = 10;
        if (titleNorm === qNorm) score += 80;
        else if (titleNorm.startsWith(qNorm)) score += 45;
        else if (titleNorm.includes(qNorm)) score += 30;
        if (kwNorm.includes(qNorm)) score += 20;
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

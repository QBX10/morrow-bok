import type {
  Agency,
  CosmosWorldId,
  FeatureFlagsMap,
  SettingsSectionId,
} from '../types/agency.ts';
import { normalizeArabic } from './agencyLogic.ts';
import type {
  HierarchyAccentTone,
  HierarchyBadge,
  HierarchyBadgeContext,
  HierarchyIconKey,
  HierarchyTarget,
} from './hierarchyRegistry.ts';
import { ALL_APP_THEMES, ARABIC_FONTS, TABLE_THEMES } from './themes.ts';

export type CosmosNodeType = 'hub' | 'world' | 'galaxy' | 'capsule' | 'setting';
export type CosmosRiskLevel = 'safe' | 'caution' | 'protected';
export type CosmosTagId =
  | 'مالي'
  | 'مظهر'
  | 'أمان'
  | 'تصدير'
  | 'جداول'
  | 'ذكاء'
  | 'وصول';

export const COSMOS_TAG_LABELS: Record<CosmosTagId, string> = {
  مالي: 'مالي وحصص',
  مظهر: 'مظهر وثيمات',
  أمان: 'أمان ونسخ',
  تصدير: 'تصدير وقوائم',
  جداول: 'الجدول والوكالات',
  ذكاء: 'ذكاء اصطناعي',
  وصول: 'تفضيلات ووصول',
};

export interface CosmosSettingDescriptor {
  id: string;
  title: string;
  description: string;
  icon: HierarchyIconKey;
  legacyKey: string;
  controlType: 'toggle' | 'number' | 'select' | 'slider' | 'action' | 'color';
  defaultValue?: unknown;
  riskLevel: CosmosRiskLevel;
  why?: string;
  affects?: string[];
  conflictHint?: string;
  safeTrial?: boolean;
  tags?: CosmosTagId[];
  controlAnchorId?: string;
}

export interface CosmosNode {
  id: string;
  parentId: string | null;
  nodeType: CosmosNodeType;
  worldId: CosmosWorldId | 'hub';
  depth: number; // 0 = hub, 1 = world, 2 = galaxy, 3 = capsule
  title: string;
  subtitle: string;
  description: string;
  icon: HierarchyIconKey;
  accentColor: string;
  gradient: string;
  accentTone: HierarchyAccentTone;
  keywords: string[];
  synonyms: string[];
  tags: CosmosTagId[];
  quickItems?: string[];
  riskLevel: CosmosRiskLevel;
  affects?: string[];
  legacyKeys: string[];
  version: number;
  protected?: boolean;
  frozen?: boolean;
  flag?: keyof FeatureFlagsMap;
  isNew?: boolean;
  pinnable?: boolean;
  target: HierarchyTarget;
  tier?: 'main' | 'side';
  settingsGroup?: 'appearance' | 'data' | 'ai' | 'system' | 'system_map';
  settingsList?: CosmosSettingDescriptor[];
  getBadge?: (ctx: HierarchyBadgeContext) => HierarchyBadge | null;
  children: CosmosNode[];
}

export interface LegacyKeyMapping {
  legacyKey: string;
  category:
    | 'settings_section'
    | 'classic_theme'
    | 'modern_theme'
    | 'table_theme'
    | 'arabic_font'
    | 'calc_field'
    | 'pref_key'
    | 'view_route'
    | 'ai_tab';
  label: string;
  worldId: CosmosWorldId;
  nodeId: string;
  protected?: boolean;
}

/**
 * Legacy Guard Map — guarantees 0 deletions across every prior setting,
 * theme (8 classic + 4 modern), table engine (8), font (6), view, and AI tab.
 */
export const LEGACY_KEY_MAP: LegacyKeyMapping[] = [
  // Settings sections (8)
  { legacyKey: 'section:appearance', category: 'settings_section', label: 'استوديو المظهر', worldId: 'world_themes', nodeId: 'cap_themes_classic' },
  { legacyKey: 'section:fonts', category: 'settings_section', label: 'الخطوط والتباعد', worldId: 'world_fonts_typography', nodeId: 'cap_fonts_families' },
  { legacyKey: 'section:modes', category: 'settings_section', label: 'الصلاحيات والتحكم', worldId: 'world_general_access', nodeId: 'cap_modes_tier', protected: true },
  { legacyKey: 'section:calculator', category: 'settings_section', label: 'حاسبة الجدول', worldId: 'world_calculator', nodeId: 'cap_calc_fees', protected: true },
  { legacyKey: 'section:general', category: 'settings_section', label: 'الإعدادات العامة', worldId: 'world_general_access', nodeId: 'cap_general_display' },
  { legacyKey: 'section:quick_extract_settings', category: 'settings_section', label: 'إعدادات السحب الذكي', worldId: 'world_quick_extract', nodeId: 'cap_qe_scan_mode' },
  { legacyKey: 'section:relations_lists', category: 'settings_section', label: 'العلاقات والقوائم', worldId: 'world_ready_lists', nodeId: 'cap_rel_export' },
  { legacyKey: 'section:security_data', category: 'settings_section', label: 'الأمان والبيانات', worldId: 'world_security_backup', nodeId: 'cap_sec_privacy_lock', protected: true },

  // All 12 App Themes (8 classic + 4 modern/glass)
  ...ALL_APP_THEMES.map((t) => ({
    legacyKey: `theme:${t.id}`,
    category: (t.capsuleGroup ? 'modern_theme' : 'classic_theme') as 'classic_theme' | 'modern_theme',
    label: t.name,
    worldId: 'world_themes' as CosmosWorldId,
    nodeId: t.capsuleGroup ? 'cap_themes_modern' : 'cap_themes_classic',
    protected: !t.capsuleGroup,
  })),

  // All 8 Table Themes (Frozen Zone protected)
  ...TABLE_THEMES.map((tt) => ({
    legacyKey: `table_theme:${tt.id}`,
    category: 'table_theme' as const,
    label: tt.name,
    worldId: 'world_themes' as CosmosWorldId,
    nodeId: 'cap_themes_table_engines',
    protected: true,
  })),

  // All 6 Arabic Fonts
  ...ARABIC_FONTS.map((f) => ({
    legacyKey: `font:${f.id}`,
    category: 'arabic_font' as const,
    label: f.name,
    worldId: 'world_fonts_typography' as CosmosWorldId,
    nodeId: 'cap_fonts_families',
  })),

  // Core calculation fields
  { legacyKey: 'calc.kgPerIndividual', category: 'calc_field', label: 'كغم/فرد', worldId: 'world_calculator', nodeId: 'cap_calc_quotas', protected: true },
  { legacyKey: 'calc.kgPerBag', category: 'calc_field', label: 'كغم/كيس', worldId: 'world_calculator', nodeId: 'cap_calc_quotas', protected: true },
  { legacyKey: 'calc.feePerIndividualIqd', category: 'calc_field', label: 'رسم الفرد التلقائي (250)', worldId: 'world_calculator', nodeId: 'cap_calc_fees', protected: true },
  { legacyKey: 'calc.fixedCardFeeIqd', category: 'calc_field', label: 'رسم البطاقة الثابت', worldId: 'world_calculator', nodeId: 'cap_calc_fees', protected: true },
  { legacyKey: 'calc.roundingStepIqd', category: 'calc_field', label: 'تقريب المبلغ', worldId: 'world_calculator', nodeId: 'cap_calc_rules', protected: true },
  { legacyKey: 'calc.discountPercent', category: 'calc_field', label: 'نسبة الخصم', worldId: 'world_calculator', nodeId: 'cap_calc_rules', protected: true },
  { legacyKey: 'calc.includeBlockedInFees', category: 'calc_field', label: 'شمول الحظر الكامل بالرسم', worldId: 'world_calculator', nodeId: 'cap_calc_rules', protected: true },
  { legacyKey: 'calc.defaultWorkerWageIqd', category: 'calc_field', label: 'أجر العامل الافتراضي', worldId: 'world_calculator', nodeId: 'cap_calc_fees' },
  { legacyKey: 'calc.defaultGeneralExpenseIqd', category: 'calc_field', label: 'المصروف العام الافتراضي', worldId: 'world_calculator', nodeId: 'cap_calc_fees' },

  // Key storage & preference buckets
  { legacyKey: 'storage:flour_agency_db_v2', category: 'pref_key', label: 'مفتاح قاعدة البيانات المحلي', worldId: 'world_security_backup', nodeId: 'cap_sec_backup_json', protected: true },
  { legacyKey: 'prefs.general.settingsDisplayMode', category: 'pref_key', label: 'وضع ملء الشاشة للإعدادات', worldId: 'world_general_access', nodeId: 'cap_general_display' },
  { legacyKey: 'prefs.topbar.autoHideInTables', category: 'pref_key', label: 'الإخفاء التلقائي للشريط العلوي', worldId: 'world_general_access', nodeId: 'cap_general_topbar' },
  { legacyKey: 'prefs.security.recycleBin', category: 'pref_key', label: 'سلة الاسترجاع الآمنة', worldId: 'world_security_backup', nodeId: 'cap_sec_recycle', protected: true },

  // App Views (100% preserved)
  { legacyKey: 'view:hub', category: 'view_route', label: 'الرئيسية', worldId: 'world_agencies_tables', nodeId: 'world_agencies_tables' },
  { legacyKey: 'view:master_roster', category: 'view_route', label: 'السجل الشامل (محمي)', worldId: 'world_agencies_tables', nodeId: 'cap_master_roster_portal', protected: true },
  { legacyKey: 'view:agency_roster', category: 'view_route', label: 'جداول الوكالات (محمي)', worldId: 'world_agencies_tables', nodeId: 'cap_agency_roster_portal', protected: true },
  { legacyKey: 'view:quick_extract', category: 'view_route', label: 'السحب الذكي OCR', worldId: 'world_quick_extract', nodeId: 'cap_qe_workspace' },
  { legacyKey: 'view:ready_lists', category: 'view_route', label: 'القوائم الجاهزة', worldId: 'world_ready_lists', nodeId: 'cap_ready_lists_workspace' },
  { legacyKey: 'view:relationships', category: 'view_route', label: 'العلاقات والمتابعة', worldId: 'world_relations_finance', nodeId: 'cap_relations_workspace' },
  { legacyKey: 'view:finance', category: 'view_route', label: 'المالية والأرباح', worldId: 'world_relations_finance', nodeId: 'cap_finance_workspace' },
  { legacyKey: 'view:data_archives', category: 'view_route', label: 'الأرشفة والمطابقة', worldId: 'world_archives', nodeId: 'cap_archives_workspace' },
  { legacyKey: 'view:google_workspace', category: 'view_route', label: 'مزامنة Google', worldId: 'world_google', nodeId: 'cap_google_workspace' },
  { legacyKey: 'view:morrow_center', category: 'view_route', label: 'مركز المساعد Morrow', worldId: 'world_morrow_ai', nodeId: 'cap_ai_chat' },
];

export const RUNTIME_COSMOS_EXTENSIONS: CosmosNode[] = [];

/**
 * 5-field Feature Kit — any future module registers with minimal boilerplate
 * and gets indexed automatically in search, worlds, command palette, and governance checks.
 */
export function createFeatureKitNode(input: {
  id: string;
  title: string;
  icon: HierarchyIconKey;
  parentId: string;
  keywords: string[];
  worldId: CosmosWorldId;
  subtitle?: string;
  target: HierarchyTarget;
  accentColor?: string;
  tags?: CosmosTagId[];
  synonyms?: string[];
  isNew?: boolean;
}): CosmosNode {
  return {
    id: input.id,
    parentId: input.parentId,
    nodeType: 'capsule',
    worldId: input.worldId,
    depth: 3,
    title: input.title,
    subtitle: input.subtitle || `أداة مضافة تلقائياً عبر Feature Kit`,
    description: input.subtitle || input.title,
    icon: input.icon,
    accentColor: input.accentColor || '#6366f1',
    gradient: 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(56,189,248,0.08))',
    accentTone: 'indigo',
    keywords: input.keywords,
    synonyms: input.synonyms || input.keywords,
    tags: input.tags || ['وصول'],
    riskLevel: 'safe',
    legacyKeys: [`kit:${input.id}`],
    version: 1,
    isNew: input.isNew ?? true,
    pinnable: true,
    target: input.target,
    children: [],
  };
}

export function buildCosmosRegistry(agencies: Agency[]): CosmosNode {
  const worlds: CosmosNode[] = [
    // 1. World: Agencies & Frozen Tables
    {
      id: 'world_agencies_tables',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_agencies_tables',
      depth: 1,
      title: 'عالم الوكالات والجداول',
      subtitle: 'بوابة السجل الشامل، الوكالات، وتخصيص الأعمدة (نطاق محمي)',
      description: 'دخول فوري إلى الجداول المحمية بالكامل مع معاينات حية ومختصرات سريعة.',
      icon: 'table',
      accentColor: '#4f46e5',
      gradient: 'linear-gradient(135deg, rgba(79,70,229,0.18), rgba(6,182,212,0.08))',
      accentTone: 'indigo',
      keywords: ['الوكالات', 'الجدول الشامل', 'السجل الشامل', 'الأعمدة', 'المستفيدين'],
      synonyms: ['الجدول', 'اسماء العوائل', 'دفتر الوكالة', 'افتح الجدول', 'ترتيب الأعمدة'],
      tags: ['جداول', 'مالي'],
      quickItems: ['cap_master_roster_portal', 'cap_column_customizer_portal', 'cap_agency_roster_portal'],
      riskLevel: 'protected',
      protected: true,
      frozen: true,
      legacyKeys: ['view:master_roster', 'view:agency_roster'],
      version: 2,
      pinnable: true,
      target: { view: 'master_roster' },
      getBadge: (ctx) => ({
        text: `${ctx.agenciesCount} وكالات · ${ctx.personsCount} سجل`,
        tone: 'accent',
      }),
      children: [
        {
          id: 'gal_tables_portals',
          parentId: 'world_agencies_tables',
          nodeType: 'galaxy',
          worldId: 'world_agencies_tables',
          depth: 2,
          title: 'بوابات الجداول المحمية',
          subtitle: 'فتح السجل الشامل أو جدول وكالة محددة بملء الشاشة دون تغيير البنية',
          description: 'المنطقة المحمية (Frozen Zone): الحسابات والأعمدة ثابتة ومضمونة 100%.',
          icon: 'table',
          accentColor: '#4f46e5',
          gradient: 'linear-gradient(135deg, rgba(79,70,229,0.14), transparent)',
          accentTone: 'indigo',
          keywords: ['السجل الشامل', 'بوابة الجدول', 'الوكالات'],
          synonyms: ['الجدول الكامل', 'كشف الوكالات'],
          tags: ['جداول'],
          riskLevel: 'protected',
          protected: true,
          frozen: true,
          legacyKeys: ['view:master_roster', 'view:agency_roster'],
          version: 2,
          target: { view: 'master_roster' },
          children: [
            {
              id: 'cap_master_roster_portal',
              parentId: 'gal_tables_portals',
              nodeType: 'capsule',
              worldId: 'world_agencies_tables',
              depth: 3,
              title: 'السجل الشامل لجميع الوكالات',
              subtitle: 'معاينة حية + دخول بملء الشاشة للجدول الموحد المحمي',
              description: 'يفتح مكون الجدول الأصلي عبر طبقة التوصيل بدون أي تعديل داخلي.',
              icon: 'table',
              accentColor: '#4f46e5',
              gradient: 'linear-gradient(135deg, rgba(79,70,229,0.14), transparent)',
              accentTone: 'indigo',
              keywords: ['السجل الشامل', 'جميع الوكالات', 'الجدول الشامل'],
              synonyms: ['كل العوائل', 'جدول كل الوكالات'],
              tags: ['جداول'],
              riskLevel: 'protected',
              protected: true,
              frozen: true,
              legacyKeys: ['view:master_roster'],
              version: 2,
              pinnable: true,
              target: { view: 'master_roster' },
              getBadge: (ctx) => ({ text: `${ctx.personsCount} سجل`, tone: 'accent' }),
              children: [],
            },
            {
              id: 'cap_column_customizer_portal',
              parentId: 'gal_tables_portals',
              nodeType: 'capsule',
              worldId: 'world_agencies_tables',
              depth: 3,
              title: 'تخصيص الأعمدة والقوالب الجاهزة',
              subtitle: 'ترتيب الأعمدة، تثبيت العمود المرجعي، وحفظ قوالب الجدول',
              description: 'يفتح لوحة تخصيص الأعمدة الأصلية فوق الجدول المحمي.',
              icon: 'columns',
              accentColor: '#4f46e5',
              gradient: 'linear-gradient(135deg, rgba(99,102,241,0.14), transparent)',
              accentTone: 'violet',
              keywords: ['تخصيص الأعمدة', 'ترتيب الأعمدة', 'إخفاء عمود'],
              synonyms: ['تغيير الأعمدة', 'اظهر عمود', 'اخفي عمود'],
              tags: ['جداول'],
              riskLevel: 'protected',
              protected: true,
              frozen: true,
              legacyKeys: ['column_customizer_node'],
              version: 2,
              pinnable: true,
              target: { view: 'master_roster', openColumnCustomizer: true },
              children: [],
            },
            {
              id: 'cap_agency_roster_portal',
              parentId: 'gal_tables_portals',
              nodeType: 'capsule',
              worldId: 'world_agencies_tables',
              depth: 3,
              title: `جداول الوكالات المستقلة (${agencies.length})`,
              subtitle: agencies.map((a) => `${a.icon} ${a.name}`).slice(0, 3).join(' · '),
              description: 'الدخول المباشر إلى جدول كل وكالة على حدة.',
              icon: 'agencies',
              accentColor: '#10b981',
              gradient: 'linear-gradient(135deg, rgba(16,185,129,0.14), transparent)',
              accentTone: 'emerald',
              keywords: ['الوكالات', ...agencies.map((a) => a.name)],
              synonyms: ['فتح وكالة', 'وكالة الحلو', 'وكالة النور'],
              tags: ['جداول'],
              riskLevel: 'protected',
              protected: true,
              frozen: true,
              legacyKeys: ['view:agency_roster'],
              version: 2,
              pinnable: true,
              target: { view: 'agency_roster', agencyId: agencies[0]?.id ?? 1 },
              children: [],
            },
          ],
        },
      ],
    },

    // 2. World: Themes & Appearance
    {
      id: 'world_themes',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_themes',
      depth: 1,
      title: 'عالم المظهر والألوان',
      subtitle: 'الثيمات الـ12، محرر الثيم المخصص، الزجاجية، وهندسة البطاقات',
      description: 'جميع الثيمات الكلاسيكية الـ8 محمية بالكامل، مع الثيمات العصرية ومحرر الألوان الحرة.',
      icon: 'palette',
      accentColor: '#6366f1',
      gradient: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.08))',
      accentTone: 'indigo',
      keywords: ['الثيمات', 'المظهر', 'الألوان', 'الوضع الليلي', 'النهاري', 'الزجاجية', 'تصميم الجدول'],
      synonyms: ['ابي اغير لون التطبيق', 'ابي اغير لون الجدول', 'ثيم داكن', 'ثيم نهاري', 'الوان'],
      tags: ['مظهر'],
      quickItems: ['cap_themes_classic', 'cap_themes_modern', 'cap_themes_custom_studio', 'cap_themes_table_engines'],
      riskLevel: 'safe',
      legacyKeys: ['section:appearance'],
      version: 2,
      pinnable: true,
      target: { view: 'settings', settingsSection: 'appearance', settingsScreenMode: 'detail' },
      getBadge: (ctx) => ctx.activeThemeName ? { text: ctx.activeThemeName, tone: 'accent' } : null,
      children: [
        {
          id: 'gal_themes_library',
          parentId: 'world_themes',
          nodeType: 'galaxy',
          worldId: 'world_themes',
          depth: 2,
          title: 'مكتبة الثيمات والأوضاع',
          subtitle: 'الكلاسيكية (8) + العصرية والزجاجية (4) + ملفات المظهر',
          description: 'معاينات فورية وبنقرة واحدة مع الحفاظ التام على الثيمات الأصلية.',
          icon: 'palette',
          accentColor: '#6366f1',
          gradient: 'linear-gradient(135deg, rgba(99,102,241,0.14), transparent)',
          accentTone: 'indigo',
          keywords: ['الثيمات', 'السبج', 'الشفق', 'المرمر', 'ملفات المظهر'],
          synonyms: ['تغيير الثيم', 'خلفيات', 'داكن وفاتح'],
          tags: ['مظهر'],
          riskLevel: 'safe',
          legacyKeys: ['section:appearance'],
          version: 2,
          target: { view: 'settings', settingsSection: 'appearance', settingsScreenMode: 'detail', settingsCapsuleId: 'appearance_themes_cap' },
          children: [
            {
              id: 'cap_themes_classic',
              parentId: 'gal_themes_library',
              nodeType: 'capsule',
              worldId: 'world_themes',
              depth: 3,
              title: 'الثيمات الكلاسيكية الأصيلة (8)',
              subtitle: 'السبج والذهب، الشفق، النيون، السراب، الثلج، الزمرد، القرمزي، والبساطة',
              description: 'محمية بنفس ألوانها الأصلية ولا تتغير أو تُحذف.',
              icon: 'palette',
              accentColor: '#eab308',
              gradient: 'linear-gradient(135deg, rgba(234,179,8,0.14), transparent)',
              accentTone: 'amber',
              keywords: ['كلاسيكية', 'السبج والذهب', 'الشفق', 'السراب الصحراوي', 'الثلج القطبي'],
              synonyms: ['ثيم قديم', 'ثيم اصلي'],
              tags: ['مظهر'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['theme:obsidian-gold', 'theme:arctic-snow', 'theme:desert-mirage'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'appearance', settingsScreenMode: 'detail', settingsCapsuleId: 'appearance_themes_classic_cap' },
              children: [],
            },
            {
              id: 'cap_themes_modern',
              parentId: 'gal_themes_library',
              nodeType: 'capsule',
              worldId: 'world_themes',
              depth: 3,
              title: 'الثيمات العصرية والزجاجية (4)',
              subtitle: 'المرمر الزجاجي، الكتان الحكيم، غسق الشمال، ونيلي منتصف الليل',
              description: 'طبقة تصميم معاصرة ناعمة تضاف بجانب الثيمات الكلاسيكية.',
              icon: 'sparkles',
              accentColor: '#06b6d4',
              gradient: 'linear-gradient(135deg, rgba(6,182,212,0.15), transparent)',
              accentTone: 'cyan',
              keywords: ['عصرية', 'زجاجية', 'المرمر', 'الكتان', 'نيلي منتصف الليل'],
              synonyms: ['ثيم جديد', 'شفاف', 'زجاجي'],
              tags: ['مظهر'],
              riskLevel: 'safe',
              legacyKeys: ['theme:alabaster-glass', 'theme:nordic-dusk'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'appearance', settingsScreenMode: 'detail', settingsCapsuleId: 'appearance_themes_modern_cap' },
              children: [],
            },
            {
              id: 'cap_themes_profiles',
              parentId: 'gal_themes_library',
              nodeType: 'capsule',
              worldId: 'world_themes',
              depth: 3,
              title: 'ملفات المظهر المحفوظة',
              subtitle: 'حفظ وتبديل توليفات المظهر الكاملة بنقرة واحدة',
              description: 'يجمع بين وضع العمل الليلي والقراءة السريعة وملفاتك المحفوظة.',
              icon: 'layers',
              accentColor: '#6366f1',
              gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12), transparent)',
              accentTone: 'indigo',
              keywords: ['ملفات المظهر', 'بروفيلات', 'حفظ المظهر'],
              synonyms: ['نسخة مظهر'],
              tags: ['مظهر'],
              riskLevel: 'safe',
              legacyKeys: ['appearance_profiles_cap'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'appearance', settingsScreenMode: 'detail', settingsCapsuleId: 'appearance_profiles_cap' },
              children: [],
            },
          ],
        },
        {
          id: 'gal_themes_studio',
          parentId: 'world_themes',
          nodeType: 'galaxy',
          worldId: 'world_themes',
          depth: 2,
          title: 'محرر الثيم والهندسة والجداول',
          subtitle: 'ابتكر ثيماً خاصاً، اضبط التدوير والزجاجية، واختر تصميم الجدول',
          description: 'إعادة ضبط عالم المظهر لا تمسّ ثيماتك المخصصة المحفوظة.',
          icon: 'sliders',
          accentColor: '#8b5cf6',
          gradient: 'linear-gradient(135deg, rgba(139,92,246,0.14), transparent)',
          accentTone: 'violet',
          keywords: ['محرر الثيم', 'الألوان الحرة', 'الهندسة', 'محركات الجدول', 'التدوير', 'الظلال'],
          synonyms: ['اصنع ثيم', 'لون الجدول', 'زوايا دائرية', 'تثبيت راس الجدول'],
          tags: ['مظهر', 'جداول'],
          riskLevel: 'safe',
          legacyKeys: ['appearance_themes_custom_cap', 'appearance_geometry_cap', 'appearance_tables_cap'],
          version: 2,
          target: { view: 'settings', settingsSection: 'appearance', settingsScreenMode: 'detail', settingsCapsuleId: 'appearance_geometry_cap' },
          children: [
            {
              id: 'cap_themes_custom_studio',
              parentId: 'gal_themes_studio',
              nodeType: 'capsule',
              worldId: 'world_themes',
              depth: 3,
              title: 'محرر الثيم المخصص والألوان الحرة',
              subtitle: 'تخصيص الخلفية والسطح والنص واللون المميز وحفظها كثيم دائم',
              description: 'جرّب التعديلات مباشرة في المسرح الحي واحفظها بنقرة.',
              icon: 'palette',
              accentColor: '#f59e0b',
              gradient: 'linear-gradient(135deg, rgba(245,158,11,0.15), transparent)',
              accentTone: 'amber',
              keywords: ['الألوان الحرة', 'محرر الثيم', 'حفظ ثيم مخصص'],
              synonyms: ['تغيير الخلفية', 'لون الازرار'],
              tags: ['مظهر'],
              riskLevel: 'protected',
              protected: true,
              isNew: true,
              legacyKeys: ['appearance_themes_custom_cap'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'appearance', settingsScreenMode: 'detail', settingsCapsuleId: 'appearance_themes_custom_cap' },
              children: [],
            },
            {
              id: 'cap_themes_geometry',
              parentId: 'gal_themes_studio',
              nodeType: 'capsule',
              worldId: 'world_themes',
              depth: 3,
              title: 'التحكم الهندسي والزجاجية والظلال',
              subtitle: 'تدوير الحواف، قوة الزجاجية، الظلال، وارتفاع الصفوف',
              description: 'تحكم في ملمس الواجهة وزوايا البطاقات.',
              icon: 'sliders',
              accentColor: '#6366f1',
              gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12), transparent)',
              accentTone: 'indigo',
              keywords: ['انحناء الحواف', 'الزجاجية', 'الظلال', 'عرض الأعمدة'],
              synonyms: ['شفافية', 'حواف مدورة'],
              tags: ['مظهر'],
              riskLevel: 'safe',
              legacyKeys: ['appearance_geometry_cap'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'appearance', settingsScreenMode: 'detail', settingsCapsuleId: 'appearance_geometry_cap' },
              children: [],
            },
            {
              id: 'cap_themes_table_engines',
              parentId: 'gal_themes_studio',
              nodeType: 'capsule',
              worldId: 'world_themes',
              depth: 3,
              title: 'محركات تصميم الجداول الـ8 والتنسيق الشرطي',
              subtitle: 'اختيار تصميم الجدول (زجاجي، ورقي، شبكة...) وقواعد التمييز (محمي)',
              description: 'يغير الإطار الخارجي وأنماط التلوين دون مسّ حسابات الجدول المحمي.',
              icon: 'table',
              accentColor: '#4f46e5',
              gradient: 'linear-gradient(135deg, rgba(79,70,229,0.12), transparent)',
              accentTone: 'indigo',
              keywords: ['محركات الجداول', 'تصميم الجدول', 'التنسيق الشرطي', 'تثبيت العمود'],
              synonyms: ['ابي اغير لون الجدول', 'شكل الجدول', 'صفوف الجدول'],
              tags: ['مظهر', 'جداول'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['appearance_tables_cap', ...TABLE_THEMES.map((t) => `table_theme:${t.id}`)],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'appearance', settingsScreenMode: 'detail', settingsCapsuleId: 'appearance_tables_cap' },
              children: [],
            },
          ],
        },
      ],
    },

    // 3. World: Calculator & Formulas (Protected Core)
    {
      id: 'world_calculator',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_calculator',
      depth: 1,
      title: 'عالم الحاسبة والمعادلات',
      subtitle: 'الرسوم (250 د.ع)، الحصص (9 كغم)، القوالب الجاهزة، والاختبار الحي',
      description: 'ضبط المعادلات المالية والوزنية بحماية كاملة ومعاينة قبل/بعد.',
      icon: 'calculator',
      accentColor: '#10b981',
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(52,211,153,0.08))',
      accentTone: 'emerald',
      keywords: ['الحاسبة', 'رسم الفرد', '250', 'كغم', 'وزن الكيس', 'التقريب', 'الخصم', 'المعادلة'],
      synonyms: ['وين رسم الفرد', 'سعر الفرد', 'خلّي رسم الفرد 250', 'سعر النفر', 'الحصة بالكيلو'],
      tags: ['مالي', 'جداول'],
      quickItems: ['cap_calc_fees', 'cap_calc_quotas', 'cap_calc_preview'],
      riskLevel: 'protected',
      affects: ['إجمالي مبالغ الجدول الشامل', 'تقارير المالية وصافي الأرباح', 'مختبر الحاسبة السريعة'],
      legacyKeys: ['section:calculator'],
      version: 2,
      protected: true,
      pinnable: true,
      target: { view: 'settings', settingsSection: 'calculator', settingsScreenMode: 'detail' },
      getBadge: (ctx) => ({
        text: `${ctx.kgPerIndividual ?? 9} كغم · رسم ${ctx.feePerIndividualIqd ?? 250}`,
        tone: 'success',
      }),
      children: [
        {
          id: 'gal_calc_core',
          parentId: 'world_calculator',
          nodeType: 'galaxy',
          worldId: 'world_calculator',
          depth: 2,
          title: 'معادلات الرسوم والأوزان',
          subtitle: 'تحديد الحصص القياسية (9 كغم)، رسم الفرد (250)، وقواعد التقريب',
          description: 'كل تغيير مؤثر محمي بمعاينة فورية ومقارنة قبل/بعد.',
          icon: 'coins',
          accentColor: '#10b981',
          gradient: 'linear-gradient(135deg, rgba(16,185,129,0.14), transparent)',
          accentTone: 'emerald',
          keywords: ['الرسوم', 'الأوزان', 'رسم الفرد', 'وزن الكيس', 'التقريب'],
          synonyms: ['اجور التوزيع', 'نفر', 'كيس'],
          tags: ['مالي'],
          riskLevel: 'protected',
          protected: true,
          legacyKeys: ['calc.feePerIndividualIqd', 'calc.kgPerIndividual', 'calc.roundingStepIqd'],
          version: 2,
          target: { view: 'settings', settingsSection: 'calculator', settingsScreenMode: 'detail', settingsCapsuleId: 'calc_fees_cap' },
          children: [
            {
              id: 'cap_calc_fees',
              parentId: 'gal_calc_core',
              nodeType: 'capsule',
              worldId: 'world_calculator',
              depth: 3,
              title: 'الرسوم والتكاليف التلقائية',
              subtitle: 'رسم الفرد (250 د.ع)، رسم البطاقة، وأجور العمال الافتراضية',
              description: 'إعداد مالي حساس محمي بتجربة آمنة ومقارنة فورية.',
              icon: 'coins',
              accentColor: '#10b981',
              gradient: 'linear-gradient(135deg, rgba(16,185,129,0.14), transparent)',
              accentTone: 'emerald',
              keywords: ['رسم الفرد', '250', 'رسم البطاقة الثابت', 'أجر العامل'],
              synonyms: ['مبلغ الفرد', 'رسم التوزيع'],
              tags: ['مالي'],
              riskLevel: 'protected',
              affects: ['حساب رسوم جميع العوائل النشطة', 'ملخص الإيرادات'],
              protected: true,
              legacyKeys: ['calc.feePerIndividualIqd', 'calc.fixedCardFeeIqd', 'calc.defaultWorkerWageIqd', 'calc.defaultGeneralExpenseIqd'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'calculator', settingsScreenMode: 'detail', settingsCapsuleId: 'calc_fees_cap' },
              children: [],
            },
            {
              id: 'cap_calc_quotas',
              parentId: 'gal_calc_core',
              nodeType: 'capsule',
              worldId: 'world_calculator',
              depth: 3,
              title: 'الحصص والأوزان القياسية',
              subtitle: 'وزن حصة الفرد (9 كغم) ووزن الكيس الكامل (50 كغم)',
              description: 'الأساس الرياضي لحساب الكيلوات والأكياس في كل الجداول.',
              icon: 'scale',
              accentColor: '#10b981',
              gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), transparent)',
              accentTone: 'emerald',
              keywords: ['كغم فرد', 'وزن الكيس', 'حصة الفرد'],
              synonyms: ['وزن الطحين', 'كم كيلو للفرد'],
              tags: ['مالي', 'جداول'],
              riskLevel: 'protected',
              affects: ['عمود الكمية والأكياس في الجدول'],
              protected: true,
              legacyKeys: ['calc.kgPerIndividual', 'calc.kgPerBag'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'calculator', settingsScreenMode: 'detail', settingsCapsuleId: 'calc_quotas_cap' },
              children: [],
            },
            {
              id: 'cap_calc_rules',
              parentId: 'gal_calc_core',
              nodeType: 'capsule',
              worldId: 'world_calculator',
              depth: 3,
              title: 'قواعد التقريب والخصم والمحجوبين',
              subtitle: 'تقريب المبلغ، نسبة الخصم، وشمول الحظر الكامل في الرسوم',
              description: 'ضبط استثناءات الفوترة والتقريب العددي.',
              icon: 'percent',
              accentColor: '#10b981',
              gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), transparent)',
              accentTone: 'emerald',
              keywords: ['التقريب', 'نسبة الخصم', 'المحجوبين', 'نمط الاحتساب'],
              synonyms: ['خصم', 'محجوب يدفع رسم'],
              tags: ['مالي'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['calc.roundingStepIqd', 'calc.discountPercent', 'calc.includeBlockedInFees'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'calculator', settingsScreenMode: 'detail', settingsCapsuleId: 'calc_rules_cap' },
              children: [],
            },
            {
              id: 'cap_calc_preview',
              parentId: 'gal_calc_core',
              nodeType: 'capsule',
              worldId: 'world_calculator',
              depth: 3,
              title: 'مختبر المعاينة والقوالب ومقارنة قبل/بعد',
              subtitle: 'اختبار افتراضي 5 × 250 = 1,250 د.ع + قوالب جاهزة وتطبيق على الوكالة',
              description: 'تحقق من أثر التعديلات رقمياً قبل اعتمادها مع تطبيق مباشر على الوكالات.',
              icon: 'flask',
              accentColor: '#10b981',
              gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), transparent)',
              accentTone: 'emerald',
              keywords: ['اختبار المعادلة', '5 أفراد', '1250', 'قوالب الحاسبة', 'تطبيق على الحالية'],
              synonyms: ['تجربة الحساب', 'مقارنة قبل وبعد'],
              tags: ['مالي'],
              riskLevel: 'safe',
              isNew: true,
              legacyKeys: ['calc_preview_cap'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'calculator', settingsScreenMode: 'detail', settingsCapsuleId: 'calc_preview_cap' },
              children: [],
            },
          ],
        },
      ],
    },

    // 4. World: Fonts, Numerals & Calendar
    {
      id: 'world_fonts_typography',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_fonts_typography',
      depth: 1,
      title: 'عالم الخطوط والقراءة',
      subtitle: 'الخطوط الـ6، المقاس، الأرقام العربية/الهندية، والتقويم الهجري/الميلادي',
      description: 'تحكم كامل في وضوح النصوص والأرقام والتواريخ على الشاشات كافة.',
      icon: 'type',
      accentColor: '#06b6d4',
      gradient: 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(59,130,246,0.08))',
      accentTone: 'cyan',
      keywords: ['الخطوط', 'Cairo', 'Tajawal', 'Almarai', 'IBM Plex', 'الأرقام الهندية', 'الهجري', 'حجم الخط'],
      synonyms: ['تبديل خط', 'اكبر الخط', 'ارقام هندية', 'تاريخ هجري', 'كثافة الصفوف'],
      tags: ['مظهر', 'وصول'],
      quickItems: ['cap_fonts_families', 'cap_fonts_scale', 'cap_fonts_locale'],
      riskLevel: 'safe',
      legacyKeys: ['section:fonts'],
      version: 2,
      pinnable: true,
      target: { view: 'settings', settingsSection: 'fonts', settingsScreenMode: 'detail' },
      getBadge: (ctx) => ({ text: `${ctx.activeFontName || 'Cairo'} · ${ctx.fontSizePx ?? 15}px`, tone: 'neutral' }),
      children: [
        {
          id: 'gal_fonts_design',
          parentId: 'world_fonts_typography',
          nodeType: 'galaxy',
          worldId: 'world_fonts_typography',
          depth: 2,
          title: 'الخطوط والمقاييس والترقيم',
          subtitle: 'اختيار الخط العربي، حجم القراءة، ونظام الأرقام والتقويم',
          description: 'تجربة فورية في المسرح الحي.',
          icon: 'type',
          accentColor: '#06b6d4',
          gradient: 'linear-gradient(135deg, rgba(6,182,212,0.14), transparent)',
          accentTone: 'cyan',
          keywords: ['خطوط عربية', 'وزن الخط', 'تقويم هجري'],
          synonyms: ['خط الجوال', 'وضوح الكتابة'],
          tags: ['مظهر', 'وصول'],
          riskLevel: 'safe',
          legacyKeys: ['section:fonts'],
          version: 2,
          target: { view: 'settings', settingsSection: 'fonts', settingsScreenMode: 'detail' },
          children: [
            {
              id: 'cap_fonts_families',
              parentId: 'gal_fonts_design',
              nodeType: 'capsule',
              worldId: 'world_fonts_typography',
              depth: 3,
              title: 'عائلات الخطوط العربية (6)',
              subtitle: 'Cairo، Tajawal، Almarai، Changa، El Messiri، IBM Plex',
              description: 'جميع الخطوط الـ6 الأصلية محفوظة وتطبق لحظياً.',
              icon: 'type',
              accentColor: '#06b6d4',
              gradient: 'linear-gradient(135deg, rgba(6,182,212,0.14), transparent)',
              accentTone: 'cyan',
              keywords: ['Cairo', 'Tajawal', 'Almarai', 'Changa', 'El Messiri', 'IBM Plex'],
              synonyms: ['تغيير الخط'],
              tags: ['مظهر'],
              riskLevel: 'safe',
              legacyKeys: ARABIC_FONTS.map((f) => `font:${f.id}`),
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'fonts', settingsScreenMode: 'detail', settingsCapsuleId: 'fonts_family_cap' },
              children: [],
            },
            {
              id: 'cap_fonts_scale',
              parentId: 'gal_fonts_design',
              nodeType: 'capsule',
              worldId: 'world_fonts_typography',
              depth: 3,
              title: 'الحجم والوزن وكثافة الصفوف',
              subtitle: 'مقاس الخط، سُمك الحروف، الأرقام المتساوية، وكثافة الواجهة',
              description: 'مريح ومضغوط ومتوازن مع Tabular Numerals.',
              icon: 'sliders',
              accentColor: '#06b6d4',
              gradient: 'linear-gradient(135deg, rgba(6,182,212,0.12), transparent)',
              accentTone: 'cyan',
              keywords: ['حجم الخط', 'وزن الخط', 'كثافة الصفوف', 'Tabular'],
              synonyms: ['تكبير النص', 'خط عريض'],
              tags: ['مظهر', 'وصول'],
              riskLevel: 'safe',
              legacyKeys: ['fonts_scale_cap'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'fonts', settingsScreenMode: 'detail', settingsCapsuleId: 'fonts_scale_cap' },
              children: [],
            },
            {
              id: 'cap_fonts_locale',
              parentId: 'gal_fonts_design',
              nodeType: 'capsule',
              worldId: 'world_fonts_typography',
              depth: 3,
              title: 'صيغة الأرقام والتقويم (هجري / ميلادي)',
              subtitle: 'التبديل بين الأرقام الغربية (123) والهندية (١٢٣) والتقويم',
              description: 'ينعكس فوراً في البطاقات والملخصات والتواريخ.',
              icon: 'calendar',
              accentColor: '#06b6d4',
              gradient: 'linear-gradient(135deg, rgba(14,165,233,0.14), transparent)',
              accentTone: 'cyan',
              keywords: ['الأرقام الهندية', 'الأرقام العربية', 'هجري', 'ميلادي'],
              synonyms: ['ارقام ١٢٣', 'التاريخ الهجري'],
              tags: ['وصول'],
              riskLevel: 'safe',
              isNew: true,
              legacyKeys: ['cosmos.numeralSystem', 'cosmos.calendarSystem'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'fonts', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_fonts_locale' },
              children: [],
            },
          ],
        },
      ],
    },

    // 5. World: Quick Extract OCR
    {
      id: 'world_quick_extract',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_quick_extract',
      depth: 1,
      title: 'عالم السحب الذكي OCR',
      subtitle: 'كاميرا الدفاتر، قراءة PDF، مطابقة الأسماء، وإعدادات الوضوح',
      description: 'استخراج ذكي مع قواعد التعلم والتغطية والمقارنة.',
      icon: 'camera',
      accentColor: '#0ea5e9',
      gradient: 'linear-gradient(135deg, rgba(14,165,233,0.18), rgba(99,102,241,0.08))',
      accentTone: 'cyan',
      keywords: ['السحب الذكي', 'OCR', 'كاميرا', 'PDF', 'دفتر', 'عتبة الوضوح'],
      synonyms: ['تصوير الدفتر', 'سحب القائمة', 'مسح ورقة'],
      tags: ['ذكاء', 'تصدير'],
      quickItems: ['cap_qe_workspace', 'cap_qe_scan_mode', 'cap_qe_fields'],
      riskLevel: 'safe',
      legacyKeys: ['view:quick_extract', 'section:quick_extract_settings'],
      version: 2,
      pinnable: true,
      target: { view: 'quick_extract' },
      children: [
        {
          id: 'gal_qe_hub',
          parentId: 'world_quick_extract',
          nodeType: 'galaxy',
          worldId: 'world_quick_extract',
          depth: 2,
          title: 'الاستخراج وإعدادات القوالب',
          subtitle: 'تشغيل الكاميرا/PDF وضبط الحقول وعتبة الوضوح',
          description: 'توليفة موحدة بين المساحة التنفيذية وإعدادات القراءة.',
          icon: 'camera',
          accentColor: '#0ea5e9',
          gradient: 'linear-gradient(135deg, rgba(14,165,233,0.14), transparent)',
          accentTone: 'cyan',
          keywords: ['السحب', 'القوالب المرجعية', 'وضوح'],
          synonyms: ['سكانر'],
          tags: ['ذكاء'],
          riskLevel: 'safe',
          legacyKeys: ['view:quick_extract'],
          version: 2,
          target: { view: 'quick_extract' },
          children: [
            {
              id: 'cap_qe_workspace',
              parentId: 'gal_qe_hub',
              nodeType: 'capsule',
              worldId: 'world_quick_extract',
              depth: 3,
              title: 'فتح غرفة السحب الذكي والتدقيق',
              subtitle: 'تصوير متعدد اللقطات، رفع PDF، والمطابقة الآلية بالوكالات',
              description: 'يشغل محرك UCRS الكامل بملء الشاشة.',
              icon: 'camera',
              accentColor: '#0ea5e9',
              gradient: 'linear-gradient(135deg, rgba(14,165,233,0.14), transparent)',
              accentTone: 'cyan',
              keywords: ['السحب الذكي', 'PDF', 'UCRS'],
              synonyms: ['افتح السحب الذكي'],
              tags: ['ذكاء'],
              riskLevel: 'safe',
              legacyKeys: ['view:quick_extract'],
              version: 2,
              pinnable: true,
              target: { view: 'quick_extract' },
              children: [],
            },
            {
              id: 'cap_qe_scan_mode',
              parentId: 'gal_qe_hub',
              nodeType: 'capsule',
              worldId: 'world_quick_extract',
              depth: 3,
              title: 'وضع التصوير وعتبة الوضوح',
              subtitle: 'التدقيق الفائق (4 لقطات) أم السريع وحد وضوح الصورة',
              description: 'يضبط حساسية قبول اللقطات تلقائياً.',
              icon: 'camera',
              accentColor: '#0ea5e9',
              gradient: 'linear-gradient(135deg, rgba(14,165,233,0.12), transparent)',
              accentTone: 'cyan',
              keywords: ['عتبة الوضوح', 'وضع التصوير'],
              synonyms: ['جودة الكاميرا'],
              tags: ['ذكاء'],
              riskLevel: 'safe',
              legacyKeys: ['qe_scan_mode_cap'],
              version: 2,
              target: { view: 'settings', settingsSection: 'quick_extract_settings', settingsScreenMode: 'detail', settingsCapsuleId: 'qe_scan_mode_cap' },
              children: [],
            },
            {
              id: 'cap_qe_fields',
              parentId: 'gal_qe_hub',
              nodeType: 'capsule',
              worldId: 'world_quick_extract',
              depth: 3,
              title: 'الحقول المستهدفة والصور المرجعية',
              subtitle: 'تحديد الأعمدة المقروءة وقوالب الدفاتر المحفوظة',
              description: 'تنظيم الحقول والقوالب المرجعية.',
              icon: 'layers',
              accentColor: '#0ea5e9',
              gradient: 'linear-gradient(135deg, rgba(14,165,233,0.12), transparent)',
              accentTone: 'cyan',
              keywords: ['الحقول المستهدفة', 'الصور المرجعية'],
              synonyms: ['قالب الدفتر'],
              tags: ['ذكاء'],
              riskLevel: 'safe',
              legacyKeys: ['qe_fields_cap', 'qe_templates_cap'],
              version: 2,
              target: { view: 'settings', settingsSection: 'quick_extract_settings', settingsScreenMode: 'detail', settingsCapsuleId: 'qe_fields_cap' },
              children: [],
            },
          ],
        },
      ],
    },

    // 6. World: Ready Lists & Export
    {
      id: 'world_ready_lists',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_ready_lists',
      depth: 1,
      title: 'عالم القوائم الجاهزة والتصدير',
      subtitle: 'إعداد قوائم التسليم، الطباعة، وصيغ التصدير (Excel / PDF / صورة)',
      description: 'تجميع مباشر للقوائم الجاهزة وتفضيلات تصديرها.',
      icon: 'list',
      accentColor: '#22c55e',
      gradient: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(16,185,129,0.08))',
      accentTone: 'emerald',
      keywords: ['القوائم الجاهزة', 'تصدير', 'Excel', 'PDF', 'طباعة', 'تسليم'],
      synonyms: ['صدّر اكسل', 'قائمة التوزيع', 'طباعة القائمة'],
      tags: ['تصدير'],
      quickItems: ['cap_ready_lists_workspace', 'cap_rel_export'],
      riskLevel: 'safe',
      legacyKeys: ['view:ready_lists'],
      version: 2,
      pinnable: true,
      target: { view: 'ready_lists' },
      getBadge: (ctx) => ({ text: `${ctx.readyListsCount} قائمة`, tone: 'neutral' }),
      children: [
        {
          id: 'gal_ready_lists_ops',
          parentId: 'world_ready_lists',
          nodeType: 'galaxy',
          worldId: 'world_ready_lists',
          depth: 2,
          title: 'إدارة القوائم وصيغ الإخراج',
          subtitle: 'بوابة القوائم وتفضيلات التصدير الافتراضية',
          description: 'وصول سريع للتجهيز والتصدير.',
          icon: 'list',
          accentColor: '#22c55e',
          gradient: 'linear-gradient(135deg, rgba(34,197,94,0.14), transparent)',
          accentTone: 'emerald',
          keywords: ['قوائم', 'اكسل', 'تصدير'],
          synonyms: ['ملف اكسل'],
          tags: ['تصدير'],
          riskLevel: 'safe',
          legacyKeys: ['view:ready_lists'],
          version: 2,
          target: { view: 'ready_lists' },
          children: [
            {
              id: 'cap_ready_lists_workspace',
              parentId: 'gal_ready_lists_ops',
              nodeType: 'capsule',
              worldId: 'world_ready_lists',
              depth: 3,
              title: 'إدارة القوائم الجاهزة',
              subtitle: 'عرض، ترتيب، وطباعة وتصدير قوائم التوزيع الميدانية',
              description: 'يفتح قسم القوائم الجاهزة بكامل ميزاته.',
              icon: 'list',
              accentColor: '#22c55e',
              gradient: 'linear-gradient(135deg, rgba(34,197,94,0.14), transparent)',
              accentTone: 'emerald',
              keywords: ['القوائم الجاهزة', 'توزيع'],
              synonyms: ['فتح القوائم'],
              tags: ['تصدير'],
              riskLevel: 'safe',
              legacyKeys: ['view:ready_lists'],
              version: 2,
              pinnable: true,
              target: { view: 'ready_lists' },
              children: [],
            },
            {
              id: 'cap_rel_export',
              parentId: 'gal_ready_lists_ops',
              nodeType: 'capsule',
              worldId: 'world_ready_lists',
              depth: 3,
              title: 'صيغة التصدير وتحديث التاريخ التلقائي',
              subtitle: 'تحديد الصيغة المفضلة (Excel / PDF / نص / PNG) وتاريخ القوائم',
              description: 'إعدادات التصدير السريع.',
              icon: 'file_json',
              accentColor: '#22c55e',
              gradient: 'linear-gradient(135deg, rgba(34,197,94,0.12), transparent)',
              accentTone: 'emerald',
              keywords: ['صيغة التصدير', 'تحديث التاريخ'],
              synonyms: ['تصدير افتراضي'],
              tags: ['تصدير'],
              riskLevel: 'safe',
              legacyKeys: ['rel_export_cap'],
              version: 2,
              target: { view: 'settings', settingsSection: 'relations_lists', settingsScreenMode: 'detail', settingsCapsuleId: 'rel_export_cap' },
              children: [],
            },
          ],
        },
      ],
    },

    // 7. World: Relations & Finance
    {
      id: 'world_relations_finance',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_relations_finance',
      depth: 1,
      title: 'عالم العلاقات والمالية',
      subtitle: 'المتابعة والمفضلة والتذكيرات، وحسابات الإيرادات والأجور والأرباح',
      description: 'تكامل المتابعة الميدانية مع المحاسبة المالية للوكالات.',
      icon: 'wallet',
      accentColor: '#f43f5e',
      gradient: 'linear-gradient(135deg, rgba(244,63,94,0.18), rgba(16,185,129,0.08))',
      accentTone: 'rose',
      keywords: ['العلاقات', 'المالية', 'الأرباح', 'المصاريف', 'الأجور', 'تذكير', 'ملاحظات التوصيل'],
      synonyms: ['الفلوس', 'صافي الربح', 'حسابات العمال', 'المتابعة'],
      tags: ['مالي'],
      quickItems: ['cap_finance_workspace', 'cap_relations_workspace', 'cap_rel_reminders'],
      riskLevel: 'safe',
      legacyKeys: ['view:relationships', 'view:finance', 'section:relations_lists'],
      version: 2,
      pinnable: true,
      target: { view: 'finance' },
      getBadge: (ctx) => ({ text: `${ctx.relationsCount} متابعة`, tone: 'neutral' }),
      children: [
        {
          id: 'gal_rel_fin_hub',
          parentId: 'world_relations_finance',
          nodeType: 'galaxy',
          worldId: 'world_relations_finance',
          depth: 2,
          title: 'عمليات المالية والمتابعة',
          subtitle: 'الدخول لصفحة المالية أو العلاقات وضبط التذكيرات',
          description: 'محاسبة كاملة مع جدول المتابعة الميداني.',
          icon: 'wallet',
          accentColor: '#f43f5e',
          gradient: 'linear-gradient(135deg, rgba(244,63,94,0.14), transparent)',
          accentTone: 'rose',
          keywords: ['المالية', 'العلاقات', 'التنبيهات'],
          synonyms: ['الايرادات والصرفيات'],
          tags: ['مالي'],
          riskLevel: 'safe',
          legacyKeys: ['view:finance', 'view:relationships'],
          version: 2,
          target: { view: 'finance' },
          children: [
            {
              id: 'cap_finance_workspace',
              parentId: 'gal_rel_fin_hub',
              nodeType: 'capsule',
              worldId: 'world_relations_finance',
              depth: 3,
              title: 'الحسابات والمالية والأرباح',
              subtitle: 'الإيرادات، أجور العمال، المصروفات العامة، وصافي الربح',
              description: 'يفتح مساحة المالية الكاملة.',
              icon: 'wallet',
              accentColor: '#10b981',
              gradient: 'linear-gradient(135deg, rgba(16,185,129,0.14), transparent)',
              accentTone: 'emerald',
              keywords: ['المالية', 'الأرباح', 'الأجور', 'المصاريف'],
              synonyms: ['الارباح'],
              tags: ['مالي'],
              riskLevel: 'safe',
              legacyKeys: ['view:finance'],
              version: 2,
              pinnable: true,
              target: { view: 'finance' },
              children: [],
            },
            {
              id: 'cap_relations_workspace',
              parentId: 'gal_rel_fin_hub',
              nodeType: 'capsule',
              worldId: 'world_relations_finance',
              depth: 3,
              title: 'العلاقات والمتابعة الميدانية',
              subtitle: 'المفضلة، التعديل لاحقاً، التذكير، وتفاصيل التوصيل',
              description: 'يفتح قسم العلاقات بكل تبويباته.',
              icon: 'heart',
              accentColor: '#f43f5e',
              gradient: 'linear-gradient(135deg, rgba(244,63,94,0.14), transparent)',
              accentTone: 'rose',
              keywords: ['العلاقات', 'المفضلة', 'التوصيل', 'تذكير'],
              synonyms: ['متابعة العوائل'],
              tags: ['وصول'],
              riskLevel: 'safe',
              legacyKeys: ['view:relationships'],
              version: 2,
              pinnable: true,
              target: { view: 'relationships' },
              children: [],
            },
            {
              id: 'cap_rel_reminders',
              parentId: 'gal_rel_fin_hub',
              nodeType: 'capsule',
              worldId: 'world_relations_finance',
              depth: 3,
              title: 'تنبيهات التذكير وبادئة التوصيل',
              subtitle: 'أيام التنبيه المسبق وبادئة ملاحظات التسليم الافتراضية',
              description: 'ضبط سلوك التذكيرات وبادئة التوصيل.',
              icon: 'bell',
              accentColor: '#f43f5e',
              gradient: 'linear-gradient(135deg, rgba(244,63,94,0.12), transparent)',
              accentTone: 'rose',
              keywords: ['تذكير', 'بادئة التوصيل'],
              synonyms: ['اشعار التذكير'],
              tags: ['وصول'],
              riskLevel: 'safe',
              legacyKeys: ['rel_reminders_cap'],
              version: 2,
              target: { view: 'settings', settingsSection: 'relations_lists', settingsScreenMode: 'detail', settingsCapsuleId: 'rel_reminders_cap' },
              children: [],
            },
          ],
        },
      ],
    },

    // 8. World: Monthly Archives
    {
      id: 'world_archives',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_archives',
      depth: 1,
      title: 'عالم الأرشفة والمطابقة',
      subtitle: 'أرشفة الدورات الشهرية، إغلاق الحصة، والمقارنة التاريخية بين الأشهر',
      description: 'حفظ الدورات الشهرية وتدوير الحصص بأمان.',
      icon: 'archive',
      accentColor: '#f59e0b',
      gradient: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(234,179,8,0.08))',
      accentTone: 'amber',
      keywords: ['الأرشفة', 'الأرشيف الشهري', 'المطابقة', 'تدوير الشهر', 'الدورة الشهرية'],
      synonyms: ['اغلاق الشهر', 'الارشيف', 'الشهر السابق'],
      tags: ['تصدير', 'أمان'],
      quickItems: ['cap_archives_workspace'],
      riskLevel: 'safe',
      legacyKeys: ['view:data_archives'],
      version: 2,
      pinnable: true,
      target: { view: 'data_archives' },
      getBadge: (ctx) => ({ text: `${ctx.archivesCount} أرشيف`, tone: 'neutral' }),
      children: [
        {
          id: 'gal_archives_main',
          parentId: 'world_archives',
          nodeType: 'galaxy',
          worldId: 'world_archives',
          depth: 2,
          title: 'سجلات الدورات الشهرية',
          subtitle: 'الأرشفة والمقارنة وإغلاق الشهر',
          description: 'إدارة الفترات التموينية.',
          icon: 'archive',
          accentColor: '#f59e0b',
          gradient: 'linear-gradient(135deg, rgba(245,158,11,0.14), transparent)',
          accentTone: 'amber',
          keywords: ['الأرشيف', 'المقارنة'],
          synonyms: ['الشهور السابقة'],
          tags: ['أمان'],
          riskLevel: 'safe',
          legacyKeys: ['view:data_archives'],
          version: 2,
          target: { view: 'data_archives' },
          children: [
            {
              id: 'cap_archives_workspace',
              parentId: 'gal_archives_main',
              nodeType: 'capsule',
              worldId: 'world_archives',
              depth: 3,
              title: 'مركز الأرشفة والمطابقة الشهرية',
              subtitle: 'حفظ لقطة شهرية، إغلاق الفترة، أو التدوير للحصة التالية',
              description: 'يعرض المساحة الكاملة للأرشفة والمطابقة.',
              icon: 'archive',
              accentColor: '#f59e0b',
              gradient: 'linear-gradient(135deg, rgba(245,158,11,0.14), transparent)',
              accentTone: 'amber',
              keywords: ['الأرشفة الشهرية', 'المطابقة'],
              synonyms: ['فتح الأرشيف'],
              tags: ['أمان'],
              riskLevel: 'safe',
              legacyKeys: ['view:data_archives'],
              version: 2,
              pinnable: true,
              target: { view: 'data_archives' },
              children: [],
            },
          ],
        },
      ],
    },

    // 9. World: Morrow AI
    {
      id: 'world_morrow_ai',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_morrow_ai',
      depth: 1,
      title: 'عالم المساعد الذكي Morrow',
      subtitle: 'محادثة الدماغ الثلاثي، بطاقات الموافقة قبل/بعد، الذاكرة، وضبط الحصة',
      description: 'مساعد فائق الذكاء بملء الشاشة مع أوامر فورية ومساعدة محلية مجانية.',
      icon: 'bot',
      accentColor: '#8b5cf6',
      gradient: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.08))',
      accentTone: 'violet',
      keywords: ['المساعد الذكي', 'Morrow', 'AI', 'Gemini', 'الدماغ الثلاثي', 'الموافقات', 'الذاكرة', 'الملاحظات السريعة'],
      synonyms: ['الذكاء', 'تحدث مع المساعد', 'اسأل مورو', 'اوفلاين المساعد'],
      tags: ['ذكاء'],
      quickItems: ['cap_ai_chat', 'cap_ai_approvals', 'cap_ai_settings'],
      riskLevel: 'safe',
      legacyKeys: ['view:morrow_center', 'sec_ai_assistant_cap'],
      version: 2,
      pinnable: true,
      target: { view: 'morrow_center', morrowTab: 'chat' },
      getBadge: (ctx) => ctx.pendingDraftsCount > 0 ? { text: `${ctx.pendingDraftsCount} مسودة`, tone: 'warning' } : null,
      children: [
        {
          id: 'gal_ai_hub',
          parentId: 'world_morrow_ai',
          nodeType: 'galaxy',
          worldId: 'world_morrow_ai',
          depth: 2,
          title: 'الدماغ الثلاثي والموافقات',
          subtitle: 'المحادثة، المسودات، الذاكرة، وإعدادات النماذج',
          description: 'كل قدرات Morrow في مكان منظم.',
          icon: 'bot',
          accentColor: '#8b5cf6',
          gradient: 'linear-gradient(135deg, rgba(139,92,246,0.14), transparent)',
          accentTone: 'violet',
          keywords: ['محادثة', 'موافقات', 'ذاكرة', 'قواعد'],
          synonyms: ['بوت', 'شخصية المساعد'],
          tags: ['ذكاء'],
          riskLevel: 'safe',
          legacyKeys: ['view:morrow_center'],
          version: 2,
          target: { view: 'morrow_center', morrowTab: 'chat' },
          children: [
            {
              id: 'cap_ai_chat',
              parentId: 'gal_ai_hub',
              nodeType: 'capsule',
              worldId: 'world_morrow_ai',
              depth: 3,
              title: 'محادثة المساعد الذكي الكاملة',
              subtitle: 'تحدث، نفّذ، واطلب تقارير وتعديلات فورية مع بطاقات نتائج',
              description: 'يفتح تجربة المحادثة المطورة بملء الشاشة.',
              icon: 'bot',
              accentColor: '#8b5cf6',
              gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), transparent)',
              accentTone: 'violet',
              keywords: ['محادثة', 'دردشة', 'Morrow'],
              synonyms: ['افتح الشات'],
              tags: ['ذكاء'],
              riskLevel: 'safe',
              legacyKeys: ['morrow_chat_tab_node'],
              version: 2,
              pinnable: true,
              target: { view: 'morrow_center', morrowTab: 'chat' },
              children: [],
            },
            {
              id: 'cap_ai_approvals',
              parentId: 'gal_ai_hub',
              nodeType: 'capsule',
              worldId: 'world_morrow_ai',
              depth: 3,
              title: 'الموافقات والذاكرة والملاحظات السريعة',
              subtitle: 'مراجعة التغييرات المقترحة، القواعد الدائمة، وتدوين الملاحظات',
              description: 'تنظيم المسودات والذاكرة والملاحظات.',
              icon: 'shield',
              accentColor: '#8b5cf6',
              gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12), transparent)',
              accentTone: 'violet',
              keywords: ['الموافقات', 'الذاكرة', 'الملاحظات السريعة'],
              synonyms: ['اعتماد التغييرات'],
              tags: ['ذكاء'],
              riskLevel: 'safe',
              legacyKeys: ['morrow_approvals_tab_node', 'morrow_memory_tab_node', 'morrow_notes_tab_node'],
              version: 2,
              target: { view: 'morrow_center', morrowTab: 'approvals' },
              children: [],
            },
            {
              id: 'cap_ai_settings',
              parentId: 'gal_ai_hub',
              nodeType: 'capsule',
              worldId: 'world_morrow_ai',
              depth: 3,
              title: 'معمارية النماذج والتوجيه من الأقوى للأضعف',
              subtitle: 'تخصيص النموذج الأساسي والاحتياطي لكل مهمة، سجل القوة، والحصة',
              description: 'إدارة نماذج AI المتخصصة، التسلسل التنازلي، والمرجع المحلي الأخير Morrow.',
              icon: 'sliders',
              accentColor: '#8b5cf6',
              gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12), transparent)',
              accentTone: 'violet',
              keywords: ['إعدادات المساعد', 'النماذج', 'التوجيه', 'Gemini', 'Nemotron', 'Groq', 'أوفلاين'],
              synonyms: ['معمارية الذكاء', 'نموذج احتياطي', 'Morrow الأخير'],
              tags: ['ذكاء', 'أمان'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['sec_ai_assistant_cap'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'ai_assistant', settingsScreenMode: 'detail', settingsCapsuleId: 'sec_ai_assistant_cap' },
              children: [],
            },
          ],
        },
      ],
    },

    // 10. World: Google Cloud Integration
    {
      id: 'world_google',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_google',
      depth: 1,
      title: 'عالم التكامل السحابي Google',
      subtitle: 'تقويم التسليم، مهام المتابعة (Google Tasks)، والمزامنة السحابية',
      description: 'مزامنة مواعيد التوزيع مع تقويم Google ومهامك.',
      icon: 'calendar',
      accentColor: '#3b82f6',
      gradient: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(6,182,212,0.08))',
      accentTone: 'indigo',
      keywords: ['جوجل', 'Google', 'التقويم', 'المهام', 'OAuth'],
      synonyms: ['ربط جوجل', 'تقويم المواعيد'],
      tags: ['تصدير', 'وصول'],
      quickItems: ['cap_google_workspace'],
      riskLevel: 'safe',
      legacyKeys: ['view:google_workspace'],
      version: 2,
      target: { view: 'google_workspace' },
      children: [
        {
          id: 'gal_google_sync',
          parentId: 'world_google',
          nodeType: 'galaxy',
          worldId: 'world_google',
          depth: 2,
          title: 'مساحة Google Workspace',
          subtitle: 'المواعيد والمهام والربط الخارجي',
          description: 'تضمين آمن لمكونات Google Workspace.',
          icon: 'calendar',
          accentColor: '#3b82f6',
          gradient: 'linear-gradient(135deg, rgba(59,130,246,0.14), transparent)',
          accentTone: 'indigo',
          keywords: ['Google Calendar', 'Google Tasks'],
          synonyms: ['حساب جوجل'],
          tags: ['وصول'],
          riskLevel: 'safe',
          legacyKeys: ['view:google_workspace'],
          version: 2,
          target: { view: 'google_workspace' },
          children: [
            {
              id: 'cap_google_workspace',
              parentId: 'gal_google_sync',
              nodeType: 'capsule',
              worldId: 'world_google',
              depth: 3,
              title: 'التقويم والمهام السحابية (Google)',
              subtitle: 'ربط الحساب وإدارة المواعيد والمهام مباشرة',
              description: 'يفتح واجهة Google Workspace الكاملة.',
              icon: 'calendar',
              accentColor: '#3b82f6',
              gradient: 'linear-gradient(135deg, rgba(59,130,246,0.14), transparent)',
              accentTone: 'indigo',
              keywords: ['التقويم', 'المهام', 'Google'],
              synonyms: ['مزامنة التقويم'],
              tags: ['وصول'],
              riskLevel: 'safe',
              legacyKeys: ['view:google_workspace'],
              version: 2,
              pinnable: true,
              target: { view: 'google_workspace' },
              children: [],
            },
          ],
        },
      ],
    },

    // 11. World: Security, Backup & Data
    {
      id: 'world_security_backup',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_security_backup',
      depth: 1,
      title: 'عالم الأمان والبيانات',
      subtitle: 'قفل الخصوصية (PIN)، النسخ الاحتياطي JSON، سلة المهملات، واستعادة اللقطات',
      description: 'حماية البيانات المحلية والسحابية واسترجاع المحذوفات ولقطات الترحيل.',
      icon: 'shield',
      accentColor: '#475569',
      gradient: 'linear-gradient(135deg, rgba(71,85,105,0.2), rgba(244,63,94,0.08))',
      accentTone: 'slate',
      keywords: ['الأمان', 'النسخ الاحتياطي', 'JSON', 'قفل', 'PIN', 'سلة المهملات', 'المزامنة', 'لقطة الترحيل'],
      synonyms: ['قفل برقم سري', 'احفظ نسخة احتياطية', 'استرجاع المحذوفين', 'الباسورد'],
      tags: ['أمان'],
      quickItems: ['cap_sec_privacy_lock', 'cap_sec_backup_json', 'cap_sec_recycle', 'cap_sec_cloud_sync'],
      riskLevel: 'protected',
      legacyKeys: ['section:security_data', 'storage:flour_agency_db_v2'],
      version: 2,
      protected: true,
      pinnable: true,
      target: { view: 'settings', settingsSection: 'security_data', settingsScreenMode: 'detail' },
      getBadge: (ctx) =>
        ctx.privacyLocked
          ? { text: 'القفل مفعّل', tone: 'warning' }
          : ctx.recycleBinCount > 0
          ? { text: `${ctx.recycleBinCount} في المهملات`, tone: 'warning' }
          : null,
      children: [
        {
          id: 'gal_sec_vault',
          parentId: 'world_security_backup',
          nodeType: 'galaxy',
          worldId: 'world_security_backup',
          depth: 2,
          title: 'الخزنة والقفل والاسترجاع',
          subtitle: 'PIN، القفل السريع، النسخ JSON، والمزامنة السحابية',
          description: 'حماية محكمة ضد الفقدان أو التطفل.',
          icon: 'shield',
          accentColor: '#475569',
          gradient: 'linear-gradient(135deg, rgba(71,85,105,0.14), transparent)',
          accentTone: 'slate',
          keywords: ['قفل الخصوصية', 'سلة المهملات', 'JSON', 'المزامنة'],
          synonyms: ['تأمين التطبيق'],
          tags: ['أمان'],
          riskLevel: 'protected',
          protected: true,
          legacyKeys: ['section:security_data'],
          version: 2,
          target: { view: 'settings', settingsSection: 'security_data', settingsScreenMode: 'detail' },
          children: [
            {
              id: 'cap_sec_privacy_lock',
              parentId: 'gal_sec_vault',
              nodeType: 'capsule',
              worldId: 'world_security_backup',
              depth: 3,
              title: 'قفل الخصوصية والرمز السري (PIN)',
              subtitle: 'تعيين رمز الحماية، القفل الفوري، ومؤقت القفل التلقائي',
              description: 'يحمي الشاشة والسجلات عند ترك الجهاز.',
              icon: 'lock',
              accentColor: '#f43f5e',
              gradient: 'linear-gradient(135deg, rgba(244,63,94,0.14), transparent)',
              accentTone: 'rose',
              keywords: ['قفل الخصوصية', 'رمز القفل', 'PIN', 'قفل تلقائي'],
              synonyms: ['رقم سري', 'اقفل التطبيق'],
              tags: ['أمان'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['sec_privacy_lock_cap'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'security_data', settingsScreenMode: 'detail', settingsCapsuleId: 'sec_privacy_lock_cap' },
              children: [],
            },
            {
              id: 'cap_sec_backup_json',
              parentId: 'gal_sec_vault',
              nodeType: 'capsule',
              worldId: 'world_security_backup',
              depth: 3,
              title: 'النسخ الاحتياطي المحلي والخصوصية (JSON)',
              subtitle: 'تصدير/استيراد JSON، الحفظ أوفلاين، واسترجاع لقطة ما قبل الترحيل',
              description: 'تشمل زر استعادة اللقطة الاحتياطية الآلية.',
              icon: 'file_json',
              accentColor: '#475569',
              gradient: 'linear-gradient(135deg, rgba(71,85,105,0.14), transparent)',
              accentTone: 'slate',
              keywords: ['JSON', 'نسخ احتياطي', 'استيراد', 'تصدير', 'Offline Cache', 'لقطة احتياطية'],
              synonyms: ['انزل نسخة', 'احفظ بياناتي'],
              tags: ['أمان', 'تصدير'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['sec_backup_json_cap', 'storage:flour_agency_db_v2'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'security_data', settingsScreenMode: 'detail', settingsCapsuleId: 'sec_backup_json_cap' },
              children: [],
            },
            {
              id: 'cap_sec_cloud_sync',
              parentId: 'gal_sec_vault',
              nodeType: 'capsule',
              worldId: 'world_security_backup',
              depth: 3,
              title: 'الحساب والمزامنة السحابية',
              subtitle: 'تسجيل الدخول، رفع النسخة للخادم، واسترجاعها على أي جهاز',
              description: 'مزامنة موثوقة مع حسابك السحابي.',
              icon: 'cloud',
              accentColor: '#3b82f6',
              gradient: 'linear-gradient(135deg, rgba(59,130,246,0.14), transparent)',
              accentTone: 'indigo',
              keywords: ['الحساب', 'المزامنة السحابية', 'الخادم', 'رفع البيانات'],
              synonyms: ['مزامنة السحابة', 'تسجيل دخول'],
              tags: ['أمان'],
              riskLevel: 'safe',
              legacyKeys: ['sec_cloud_sync_cap'],
              version: 2,
              target: { view: 'settings', settingsSection: 'security_data', settingsScreenMode: 'detail', settingsCapsuleId: 'sec_cloud_sync_cap' },
              children: [],
            },
            {
              id: 'cap_sec_recycle',
              parentId: 'gal_sec_vault',
              nodeType: 'capsule',
              worldId: 'world_security_backup',
              depth: 3,
              title: 'سلة الاسترجاع الآمنة (المهملات)',
              subtitle: 'استعادة الأسماء، القوائم، العلاقات، والمصاريف المحذوفة',
              description: 'تحفظ العناصر المحذوفة من التدمير المباشر.',
              icon: 'trash',
              accentColor: '#f59e0b',
              gradient: 'linear-gradient(135deg, rgba(245,158,11,0.14), transparent)',
              accentTone: 'amber',
              keywords: ['سلة المهملات', 'استعادة المحذوفات'],
              synonyms: ['حذفت اسم بالغلط', 'رجع الاسم'],
              tags: ['أمان'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['sec_recycle_bin_cap', 'prefs.security.recycleBin'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'security_data', settingsScreenMode: 'detail', settingsCapsuleId: 'sec_recycle_bin_cap' },
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

    // 12. World: General, Modes & Accessibility
    {
      id: 'world_general_access',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_general_access',
      depth: 1,
      title: 'عالم التفضيلات والوصول',
      subtitle: 'الأوضاع وتحكم الخبير، إمكانية الوصول، اليد الواحدة، وتقليل الحركة',
      description: 'ضبط سلوك الواجهة، الشريط العلوي، والراحة اللمسية والبصرية.',
      icon: 'sliders',
      accentColor: '#ec4899',
      gradient: 'linear-gradient(135deg, rgba(236,72,153,0.18), rgba(168,85,247,0.08))',
      accentTone: 'rose',
      keywords: ['الأوضاع', 'الخبير', 'الشريط العلوي', 'ملء الشاشة', 'تقليل الحركة', 'يد واحدة', 'المميزات التجريبية', 'الجولة'],
      synonyms: ['وضع الخبير', 'قفل التاكيدات', 'اخفي الشريط', 'الاهتزاز والاصوات'],
      tags: ['وصول'],
      quickItems: ['cap_modes_tier', 'cap_access_ergonomics', 'cap_general_display', 'cap_general_topbar'],
      riskLevel: 'caution',
      legacyKeys: ['section:general', 'section:modes'],
      version: 2,
      pinnable: true,
      target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail' },
      getBadge: (ctx) => (ctx.modeLabel ? { text: ctx.modeLabel, tone: 'accent' } : null),
      children: [
        {
          id: 'gal_modes_expert',
          parentId: 'world_general_access',
          nodeType: 'galaxy',
          worldId: 'world_general_access',
          depth: 2,
          title: 'الصلاحيات والتحكم المستقلة',
          subtitle: 'مفاتيح مستقلة لكل قدرة + القراءة فقط + الفئات المخصصة',
          description: 'الوضع الموحد يفتح كل المزايا افتراضياً مع حرية إيقاف أي صلاحية.',
          icon: 'sliders',
          accentColor: '#8b5cf6',
          gradient: 'linear-gradient(135deg, rgba(139,92,246,0.14), transparent)',
          accentTone: 'violet',
          keywords: ['الصلاحيات', 'التحكم', 'وضع القراءة', 'الفئات المخصصة', 'تأكيد التعديل'],
          synonyms: ['فتح التعديل', 'تغيير الصلاحيات', 'الوضع الموحد'],
          tags: ['وصول', 'جداول'],
          riskLevel: 'protected',
          protected: true,
          legacyKeys: ['section:modes'],
          version: 2,
          target: { view: 'settings', settingsSection: 'modes', settingsScreenMode: 'detail' },
          children: [
            {
              id: 'cap_modes_tier',
              parentId: 'gal_modes_expert',
              nodeType: 'capsule',
              worldId: 'world_general_access',
              depth: 3,
              title: 'الوضع الموحد والصلاحيات التشغيلية',
              subtitle: 'تشغيل أو إيقاف التحرير، المالية، السحب الذكي، والأعمدة بحرية',
              description: 'صلاحيات مستقلة بدلاً من أوضاع القفل المعقدة.',
              icon: 'layers',
              accentColor: '#8b5cf6',
              gradient: 'linear-gradient(135deg, rgba(139,92,246,0.14), transparent)',
              accentTone: 'violet',
              keywords: ['الوضع الموحد', 'الصلاحيات', 'التحكم', 'المالية', 'السحب الذكي'],
              synonyms: ['كل الصلاحيات', 'تفعيل التعديل'],
              tags: ['وصول'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['modes_tier_cap'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'modes', settingsScreenMode: 'detail', settingsCapsuleId: 'modes_tier_cap' },
              children: [],
            },
            {
              id: 'cap_modes_editor',
              parentId: 'gal_modes_expert',
              nodeType: 'capsule',
              worldId: 'world_general_access',
              depth: 3,
              title: 'الأمان الإجرائي والفئات المخصصة',
              subtitle: 'تأكيد التعديل والحذف، التحرير السريع، والفئات المخصصة',
              description: 'يتضمن الفئات المخصصة وإعادة تخطيط الأعمدة.',
              icon: 'lock',
              accentColor: '#8b5cf6',
              gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12), transparent)',
              accentTone: 'violet',
              keywords: ['الفئات المخصصة', 'تأكيد الحذف', 'التحرير المباشر'],
              synonyms: ['اقفل التاكيد'],
              tags: ['وصول', 'جداول'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['modes_editor_cap', 'modes_expert_cap'],
              version: 2,
              target: { view: 'settings', settingsSection: 'modes', settingsScreenMode: 'detail', settingsCapsuleId: 'modes_editor_cap' },
              children: [],
            },
          ],
        },
        {
          id: 'gal_general_experience',
          parentId: 'world_general_access',
          nodeType: 'galaxy',
          worldId: 'world_general_access',
          depth: 2,
          title: 'سلوك العرض وإمكانية الوصول واليد الواحدة',
          subtitle: 'ملء الشاشة، الشريط العلوي، تقليل الحركة، والحس اللمسي',
          description: 'صُمم لجعل الجوال مريحاً تماماً بإبهام واحد.',
          icon: 'eye',
          accentColor: '#ec4899',
          gradient: 'linear-gradient(135deg, rgba(236,72,153,0.14), transparent)',
          accentTone: 'rose',
          keywords: ['ملء الشاشة', 'الشريط العلوي', 'تقليل الحركة', 'يد واحدة', 'أصوات'],
          synonyms: ['راحة العين', 'تجربة اللمس'],
          tags: ['وصول'],
          riskLevel: 'safe',
          legacyKeys: ['section:general'],
          version: 2,
          target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail' },
          children: [
            {
              id: 'cap_general_display',
              parentId: 'gal_general_experience',
              nodeType: 'capsule',
              worldId: 'world_general_access',
              depth: 3,
              title: 'وضع العرض الافتراضي والتراجع والتأكيدات',
              subtitle: 'ملء الشاشة / المدمج، سعة التراجع Undo، وبوابة الدخول',
              description: 'ضبط قواعد العمل العامة للنظام.',
              icon: 'eye',
              accentColor: '#f59e0b',
              gradient: 'linear-gradient(135deg, rgba(245,158,11,0.14), transparent)',
              accentTone: 'amber',
              keywords: ['ملء الشاشة', 'Undo', 'تأكيد الحذف', 'الأرقام المضغوطة'],
              synonyms: ['نافذة كاملة'],
              tags: ['وصول'],
              riskLevel: 'safe',
              legacyKeys: ['general_display_cap', 'general_behavior_cap', 'prefs.general.settingsDisplayMode'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'general_display_cap' },
              children: [],
            },
            {
              id: 'cap_general_topbar',
              parentId: 'gal_general_experience',
              nodeType: 'capsule',
              worldId: 'world_general_access',
              depth: 3,
              title: 'الشريط العلوي والإخفاء التلقائي',
              subtitle: 'تصغير الشريط، الإخفاء داخل الجداول، وأزرار الشريط',
              description: 'يحرر مساحة رأسية إضافية للجداول.',
              icon: 'layers',
              accentColor: '#f59e0b',
              gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), transparent)',
              accentTone: 'amber',
              keywords: ['الشريط العلوي', 'إخفاء تلقائي'],
              synonyms: ['اخفي الهيدر'],
              tags: ['وصول'],
              riskLevel: 'safe',
              legacyKeys: ['general_topbar_cap', 'prefs.topbar.autoHideInTables'],
              version: 2,
              target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'general_topbar_cap' },
              children: [],
            },
            {
              id: 'cap_access_ergonomics',
              parentId: 'gal_general_experience',
              nodeType: 'capsule',
              worldId: 'world_general_access',
              depth: 3,
              title: 'إمكانية الوصول ووضع اليد الواحدة واللمس',
              subtitle: 'تقليل الحركة، وضع اليد الواحدة، الاهتزاز/الصوت، وإخفاء العوالم',
              description: 'مزايا راحة وتخصيص ذكية متوافقة مع كل العوالم.',
              icon: 'sparkles',
              accentColor: '#ec4899',
              gradient: 'linear-gradient(135deg, rgba(236,72,153,0.14), transparent)',
              accentTone: 'rose',
              keywords: ['إمكانية الوصول', 'تقليل الحركة', 'يد واحدة', 'اهتزاز', 'ميزات تجريبية'],
              synonyms: ['وضع الابهام', 'اطفاء الحركات', 'جولة تعريفية'],
              tags: ['وصول'],
              riskLevel: 'safe',
              isNew: true,
              legacyKeys: ['cosmos.accessibility'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_access_ergonomics' },
              children: [],
            },
          ],
        },
      ],
    },

    // 13. World: Health, Executive KPIs & Developer Governance
    {
      id: 'world_health_kpi',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_health_kpi',
      depth: 1,
      title: 'عالم الصحة والمؤشرات والتحليل',
      subtitle: 'لوحة مؤشرات الأداء KPI، فحص صحة البيانات والتضاربات، وفاحص الحوكمة',
      description: 'قراءة شاملة لصحة التطبيق وسجلات الحوكمة والأداء المالي.',
      icon: 'flask',
      accentColor: '#14b8a6',
      gradient: 'linear-gradient(135deg, rgba(20,184,166,0.2), rgba(16,185,129,0.08))',
      accentTone: 'emerald',
      keywords: ['مؤشرات الأداء', 'KPI', 'صحة البيانات', 'فحص الأخطاء', 'التضاربات', 'المطور', 'فاحص السجل'],
      synonyms: ['فحص شامل', 'سلامة البيانات', 'تقرير الاداء', 'احصائيات عامة'],
      tags: ['مالي', 'أمان', 'ذكاء'],
      quickItems: ['cap_kpi_dashboard', 'cap_health_center', 'cap_registry_inspector'],
      riskLevel: 'safe',
      isNew: true,
      legacyKeys: ['cosmos.health_center', 'cosmos.kpi_dashboard'],
      version: 2,
      pinnable: true,
      target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_kpi_dashboard' },
      getBadge: (ctx) =>
        ctx.auditIssuesCount > 0
          ? { text: `${ctx.auditIssuesCount} ملاحظة صحة`, tone: 'warning' }
          : { text: 'سليم 100%', tone: 'success' },
      children: [
        {
          id: 'gal_health_telemetry',
          parentId: 'world_health_kpi',
          nodeType: 'galaxy',
          worldId: 'world_health_kpi',
          depth: 2,
          title: 'المؤشرات والصحة والحوكمة',
          subtitle: 'رسوم بيانية تفاعلية، تشخيص آلي، وفحص الحوكمة للمطور',
          description: 'كل البيانات محسوبة حياً من بياناتك دون أرقام وهمية.',
          icon: 'flask',
          accentColor: '#14b8a6',
          gradient: 'linear-gradient(135deg, rgba(20,184,166,0.14), transparent)',
          accentTone: 'emerald',
          keywords: ['KPI', 'صحة', 'حوكمة'],
          synonyms: ['تدقيق كلي'],
          tags: ['مالي', 'أمان'],
          riskLevel: 'safe',
          legacyKeys: ['cosmos.health_center'],
          version: 2,
          target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_kpi_dashboard' },
          children: [
            {
              id: 'cap_kpi_dashboard',
              parentId: 'gal_health_telemetry',
              nodeType: 'capsule',
              worldId: 'world_health_kpi',
              depth: 3,
              title: 'لوحة المؤشرات التنفيذية (KPI)',
              subtitle: 'توزيع الوكالات، الإيرادات مقابل المصروفات، وتدفق الأفراد',
              description: 'رسوم بيانية حية وتفصيل مالي لجميع الوكالات.',
              icon: 'calculator',
              accentColor: '#14b8a6',
              gradient: 'linear-gradient(135deg, rgba(20,184,166,0.15), transparent)',
              accentTone: 'emerald',
              keywords: ['KPI', 'مؤشرات الأداء', 'الرسوم البيانية'],
              synonyms: ['لوحة الإحصائيات'],
              tags: ['مالي'],
              riskLevel: 'safe',
              isNew: true,
              legacyKeys: ['cosmos.kpi_dashboard'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_kpi_dashboard' },
              children: [],
            },
            {
              id: 'cap_health_center',
              parentId: 'gal_health_telemetry',
              nodeType: 'capsule',
              worldId: 'world_health_kpi',
              depth: 3,
              title: 'مركز صحة البيانات وإصلاح التضاربات',
              subtitle: 'كشف الأسماء المكررة، الأرقام الشاذة، والحجب غير المتوازن مع إصلاح فوري',
              description: 'يعرض نقاط الصحة الحقيقية وإصلاحات بنقرة واحدة.',
              icon: 'shield',
              accentColor: '#10b981',
              gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), transparent)',
              accentTone: 'emerald',
              keywords: ['صحة البيانات', 'فحص الأخطاء', 'المكررين', 'إصلاح تلقائي'],
              synonyms: ['كشف التكرار', 'تنظيف السجل'],
              tags: ['أمان', 'جداول'],
              riskLevel: 'safe',
              isNew: true,
              legacyKeys: ['cosmos.health_center'],
              version: 2,
              pinnable: true,
              target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_health_center' },
              children: [],
            },
            {
              id: 'cap_registry_inspector',
              parentId: 'gal_health_telemetry',
              nodeType: 'capsule',
              worldId: 'world_health_kpi',
              depth: 3,
              title: 'فاحص السجل والحوكمة و Feature Flags',
              subtitle: 'فحص تغطية المفاتيح القديمة، الخريطة المدارية، وتبديل الميزات الجديدة',
              description: 'يضمن 0 حذف ويكشف أي تضارب أو عنصر يتيم فوراً.',
              icon: 'layers',
              accentColor: '#6366f1',
              gradient: 'linear-gradient(135deg, rgba(99,102,241,0.14), transparent)',
              accentTone: 'indigo',
              keywords: ['فاحص السجل', 'الحوكمة', 'Feature Flags', 'حارس عدم الحذف'],
              synonyms: ['اداة المطور', 'فحص الشجرة'],
              tags: ['أمان', 'وصول'],
              riskLevel: 'safe',
              isNew: true,
              legacyKeys: ['cosmos.registry_inspector'],
              version: 2,
              target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_registry_inspector' },
              children: [],
            },
          ],
        },
      ],
    },

    // 14. World: Complete Legacy Archive (0-loss guarantee)
    {
      id: 'world_legacy_archive',
      parentId: 'cosmos_hub',
      nodeType: 'world',
      worldId: 'world_legacy_archive',
      depth: 1,
      title: 'عالم الأرشيف الكامل',
      subtitle: 'فهرس شامل لجميع المفاتيح والأقسام القديمة والعوالم المخفية دون أي حذف',
      description: 'يضمن وصولاً سريعاً لكل إعداد كلاسيكي أو عالم مخفي أو ميزة موروثة.',
      icon: 'archive',
      accentColor: '#64748b',
      gradient: 'linear-gradient(135deg, rgba(100,116,139,0.2), rgba(71,85,105,0.08))',
      accentTone: 'slate',
      keywords: ['الأرشيف الكامل', 'Legacy', 'كل الإعدادات', 'المفاتيح القديمة', 'العوالم المخفية'],
      synonyms: ['اعدادات قديمة', 'الارشيف الشامل للاعدادات', 'وين اختفى'],
      tags: ['أمان', 'وصول'],
      quickItems: ['cap_legacy_index'],
      riskLevel: 'protected',
      protected: true,
      legacyKeys: LEGACY_KEY_MAP.map((m) => m.legacyKey),
      version: 2,
      target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_legacy_index' },
      children: [
        {
          id: 'gal_legacy_all',
          parentId: 'world_legacy_archive',
          nodeType: 'galaxy',
          worldId: 'world_legacy_archive',
          depth: 2,
          title: 'سجل التغطية الكامل',
          subtitle: 'فهرس حي يربط كل عنصر قديم بمكانه الجديد مباشرة',
          description: 'صفر حذف — كل ثيم وخط وقسم ومفتاح تخزين مسجل ومختبر هنا.',
          icon: 'archive',
          accentColor: '#64748b',
          gradient: 'linear-gradient(135deg, rgba(100,116,139,0.14), transparent)',
          accentTone: 'slate',
          keywords: ['فهرس', 'Legacy Map'],
          synonyms: ['جدول المفاتيح القديمة'],
          tags: ['أمان'],
          riskLevel: 'protected',
          protected: true,
          legacyKeys: ['storage:flour_agency_db_v2'],
          version: 2,
          target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_legacy_index' },
          children: [
            {
              id: 'cap_legacy_index',
              parentId: 'gal_legacy_all',
              nodeType: 'capsule',
              worldId: 'world_legacy_archive',
              depth: 3,
              title: 'الفهرس الكامل للمفاتيح والعوالم',
              subtitle: 'انتقال مباشر لأي عنصر كلاسيكي أو عالم مخفي مع استرجاع اللقطات',
              description: 'خريطة حية من LEGACY_KEY_MAP.',
              icon: 'archive',
              accentColor: '#64748b',
              gradient: 'linear-gradient(135deg, rgba(100,116,139,0.14), transparent)',
              accentTone: 'slate',
              keywords: ['الأرشيف الكامل', 'فهرس الإعدادات', 'العوالم المخفية'],
              synonyms: ['كل الخيارات'],
              tags: ['أمان'],
              riskLevel: 'protected',
              protected: true,
              legacyKeys: ['cosmos.legacy_index'],
              version: 2,
              target: { view: 'settings', settingsSection: 'general', settingsScreenMode: 'detail', settingsCapsuleId: 'cap_legacy_index' },
              children: [],
            },
          ],
        },
      ],
    },
  ];

  // Attach any runtime feature kit nodes cleanly
  const attachedWorlds = worlds.map((w) => ({
    ...w,
    children: w.children.map((gal) => {
      const kitExtras = RUNTIME_COSMOS_EXTENSIONS.filter(
        (ext) => ext.parentId === gal.id || ext.parentId === w.id
      );
      if (kitExtras.length === 0) return gal;
      return {
        ...gal,
        children: [...gal.children, ...kitExtras],
      };
    }),
  }));

  return {
    id: 'cosmos_hub',
    parentId: null,
    nodeType: 'hub',
    worldId: 'hub',
    depth: 0,
    title: 'مركز الأكوان والعوالم — Morrow',
    subtitle: 'نظام هرمي معزول يدير كل الأدوات والإعدادات والجداول بوضوح وسرعة فائقة',
    description: 'المركز الرئيسي للتنقل بين العوالم الـ14 ومفضلتك وآخر ما فتحته.',
    icon: 'home',
    accentColor: '#6366f1',
    gradient: 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(16,185,129,0.08))',
    accentTone: 'indigo',
    keywords: ['المركز', 'العوالم', 'المجرات', 'الكبسولات', 'الرئيسية'],
    synonyms: ['البداية', 'الصفحة الرئيسية'],
    tags: ['وصول'],
    riskLevel: 'safe',
    legacyKeys: ['view:hub'],
    version: 2,
    target: { view: 'hub' },
    getBadge: (ctx) => ({
      text: `${ctx.agenciesCount} وكالات · ${ctx.personsCount} سجل`,
      tone: 'accent',
    }),
    children: attachedWorlds,
  };
}

export function flattenCosmosNodes(root: CosmosNode): CosmosNode[] {
  const list: CosmosNode[] = [root];
  for (const child of root.children) {
    list.push(...flattenCosmosNodes(child));
  }
  return list;
}

export function getCosmosNodeById(root: CosmosNode, nodeId: string): CosmosNode | null {
  if (root.id === nodeId) return root;
  for (const child of root.children) {
    const hit = getCosmosNodeById(child, nodeId);
    if (hit) return hit;
  }
  return null;
}

export function getCosmosWorldById(root: CosmosNode, worldId: CosmosWorldId): CosmosNode | null {
  return root.children.find((w) => w.worldId === worldId || w.id === worldId) || null;
}

export function getCosmosPath(root: CosmosNode, nodeId: string): CosmosNode[] {
  if (root.id === nodeId) return [root];
  for (const child of root.children) {
    const sub = getCosmosPath(child, nodeId);
    if (sub.length > 0) return [root, ...sub];
  }
  return [];
}

export interface CosmosSearchHit {
  node: CosmosNode;
  path: CosmosNode[];
  score: number;
  matchedReason: string;
}

/**
 * Natural Arabic / Iraqi "وين هذا؟" search across titles, descriptions, keywords,
 * dialect synonyms, and tags — optionally scoped to a specific World.
 */
export function searchCosmosNodes(
  root: CosmosNode,
  query: string,
  options?: { scopeWorldId?: CosmosWorldId | null; tagFilter?: CosmosTagId | null }
): CosmosSearchHit[] {
  const qNorm = normalizeArabic(query);
  const tagFilter = options?.tagFilter || null;
  if (!qNorm && !tagFilter) return [];

  const tokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
  // Common filler words in Iraqi/Arabic questions like "وين", "أبي", "اريد", "شلون"
  const stopWords = new Set(['وين', 'اين', 'ابي', 'اريد', 'شلون', 'كيف', 'ممكن', 'ابغي', 'اغير', 'ال']);
  const meaningfulTokens = tokens.filter((t) => !stopWords.has(t));
  const activeTokens = meaningfulTokens.length > 0 ? meaningfulTokens : tokens;

  const hits: CosmosSearchHit[] = [];

  const visit = (node: CosmosNode, trail: CosmosNode[]) => {
    const nextTrail = [...trail, node];
    if (node.id !== 'cosmos_hub') {
      const inScope =
        !options?.scopeWorldId || node.worldId === options.scopeWorldId;
      const matchesTag = !tagFilter || node.tags.includes(tagFilter);

      if (inScope && matchesTag) {
        if (activeTokens.length === 0) {
          hits.push({
            node,
            path: nextTrail,
            score: node.nodeType === 'world' ? 50 : 30,
            matchedReason: `وسم: ${tagFilter}`,
          });
        } else {
          const titleNorm = normalizeArabic(node.title);
          const subNorm = normalizeArabic(node.subtitle);
          const kwNorm = node.keywords.map((k) => normalizeArabic(k)).join(' ');
          const synNorm = node.synonyms.map((s) => normalizeArabic(s)).join(' ');
          const tagNorm = node.tags.map((t) => normalizeArabic(t)).join(' ');
          const haystack = `${titleNorm} ${subNorm} ${kwNorm} ${synNorm} ${tagNorm}`;

          const allMatch = activeTokens.every((t) => haystack.includes(t));
          const synonymExact = node.synonyms.some((s) => {
            const sn = normalizeArabic(s);
            return sn.includes(qNorm) || qNorm.includes(sn);
          });

          if (allMatch || synonymExact) {
            let score = 15;
            let matchedReason = 'تطابق بالاسم أو الوصف';
            if (synonymExact) {
              score += 55;
              matchedReason = 'تطابق طبيعي ("وين هذا؟")';
            }
            if (titleNorm.includes(qNorm)) {
              score += 65;
              matchedReason = 'العنوان';
            } else if (kwNorm.includes(qNorm)) {
              score += 35;
              matchedReason = 'الكلمات المفتاحية';
            }
            if (node.nodeType === 'capsule') score += 8;
            hits.push({ node, path: nextTrail, score, matchedReason });
          }
        }
      }
    }
    for (const child of node.children) {
      visit(child, nextTrail);
    }
  };

  visit(root, []);
  hits.sort((a, b) => b.score - a.score || a.node.depth - b.node.depth);
  return hits;
}

export interface GovernanceViolation {
  nodeId: string;
  title: string;
  rule: 'max_capsules_per_galaxy' | 'max_depth' | 'duplicate_id' | 'orphan_parent';
  message: string;
}

export interface GovernanceReport {
  passed: boolean;
  worldCount: number;
  galaxyCount: number;
  capsuleCount: number;
  violations: GovernanceViolation[];
}

export function validateRegistryGovernance(root: CosmosNode): GovernanceReport {
  const all = flattenCosmosNodes(root);
  const violations: GovernanceViolation[] = [];
  const seenIds = new Set<string>();
  const idSet = new Set(all.map((n) => n.id));

  let worldCount = 0;
  let galaxyCount = 0;
  let capsuleCount = 0;

  for (const n of all) {
    if (seenIds.has(n.id)) {
      violations.push({
        nodeId: n.id,
        title: n.title,
        rule: 'duplicate_id',
        message: `معرف مكرر: ${n.id}`,
      });
    }
    seenIds.add(n.id);

    if (n.parentId && !idSet.has(n.parentId)) {
      violations.push({
        nodeId: n.id,
        title: n.title,
        rule: 'orphan_parent',
        message: `عنصر يتيم بدون أب صالح (${n.parentId})`,
      });
    }

    if (n.nodeType === 'world') worldCount++;
    if (n.nodeType === 'galaxy') {
      galaxyCount++;
      if (n.children.length > 6) {
        violations.push({
          nodeId: n.id,
          title: n.title,
          rule: 'max_capsules_per_galaxy',
          message: `المجرة "${n.title}" تحتوي ${n.children.length} كبسولات (الحد الموصى به ≤ 6).`,
        });
      }
    }
    if (n.nodeType === 'capsule') capsuleCount++;

    if (n.depth > 4) {
      violations.push({
        nodeId: n.id,
        title: n.title,
        rule: 'max_depth',
        message: `العنصر "${n.title}" في مستوى مرئي ${n.depth} (الأقصى المسموح 4).`,
      });
    }
  }

  return {
    passed: violations.length === 0,
    worldCount,
    galaxyCount,
    capsuleCount,
    violations,
  };
}

export interface LegacyCoverageReport {
  passed: boolean;
  totalLegacyKeys: number;
  missingLegacyKeys: string[];
  protectedZonesCount: number;
}

export function verifyLegacyCoverage(root: CosmosNode): LegacyCoverageReport {
  const all = flattenCosmosNodes(root);
  const idSet = new Set(all.map((n) => n.id));
  const indexedKeys = new Set<string>();
  let protectedZonesCount = 0;

  for (const n of all) {
    for (const k of n.legacyKeys) indexedKeys.add(k);
    if (n.protected || n.frozen) protectedZonesCount++;
  }

  const missingLegacyKeys: string[] = [];
  for (const entry of LEGACY_KEY_MAP) {
    const hasNode = idSet.has(entry.nodeId);
    const hasWorld = idSet.has(entry.worldId);
    if (!hasNode || !hasWorld) {
      missingLegacyKeys.push(entry.legacyKey);
    }
  }

  return {
    passed: missingLegacyKeys.length === 0,
    totalLegacyKeys: LEGACY_KEY_MAP.length,
    missingLegacyKeys,
    protectedZonesCount,
  };
}

export function resolveCosmosNodeForTarget(
  root: CosmosNode,
  target: Partial<HierarchyTarget>
): CosmosNode {
  const all = flattenCosmosNodes(root);
  if (target.settingsCapsuleId) {
    const byCap = all.find(
      (n) =>
        n.id === target.settingsCapsuleId ||
        n.target.settingsCapsuleId === target.settingsCapsuleId ||
        n.legacyKeys.includes(target.settingsCapsuleId!)
    );
    if (byCap) return byCap;
  }
  if (target.view === 'settings' && target.settingsSection) {
    const secKey = `section:${target.settingsSection}`;
    const bySec =
      all.find((n) => n.nodeType === 'world' && n.legacyKeys.includes(secKey)) ||
      all.find((n) => n.legacyKeys.includes(secKey));
    if (bySec) return bySec;
  }
  if (target.view) {
    const viewKey = `view:${target.view}`;
    const byView =
      all.find((n) => n.nodeType === 'world' && n.legacyKeys.includes(viewKey)) ||
      all.find((n) => n.target.view === target.view);
    if (byView) return byView;
  }
  return root;
}

export function mapSettingsSectionToWorldId(section: SettingsSectionId): CosmosWorldId {
  switch (section) {
    case 'appearance':
      return 'world_themes';
    case 'calculator':
      return 'world_calculator';
    case 'fonts':
      return 'world_fonts_typography';
    case 'quick_extract_settings':
      return 'world_quick_extract';
    case 'relations_lists':
      return 'world_ready_lists';
    case 'security_data':
      return 'world_security_backup';
    case 'ai_assistant':
      return 'world_morrow_ai';
    case 'system_map':
      return 'world_legacy_archive';
    case 'modes':
    case 'general':
    default:
      return 'world_general_access';
  }
}

// Local Usage Analyzer (privacy-first, 100% browser localStorage)
const USAGE_KEY = 'morrow_cosmos_usage_v1';

export type CosmosUsageMap = Record<string, { count: number; lastVisited: string }>;

export function loadCosmosUsageMap(): CosmosUsageMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CosmosUsageMap) : {};
  } catch {
    return {};
  }
}

export function recordCosmosNodeVisit(nodeId: string): CosmosUsageMap {
  const map = loadCosmosUsageMap();
  const prev = map[nodeId] || { count: 0, lastVisited: '' };
  const next: CosmosUsageMap = {
    ...map,
    [nodeId]: {
      count: prev.count + 1,
      lastVisited: new Date().toISOString(),
    },
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
  }
  return next;
}

export function getSmartCosmosSuggestions(params: {
  root: CosmosNode;
  usageMap: CosmosUsageMap;
  pinnedNodeIds: string[];
  dismissedIds: string[];
  auditIssuesCount: number;
  feePerIndividualIqd: number;
}): Array<{
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  targetNodeId: string;
  tone: 'accent' | 'warning' | 'success';
}> {
  const { root, usageMap, pinnedNodeIds, dismissedIds, auditIssuesCount } = params;
  const suggestions: Array<{
    id: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    targetNodeId: string;
    tone: 'accent' | 'warning' | 'success';
  }> = [];

  if (auditIssuesCount > 0 && !dismissedIds.includes('sug_health_audit')) {
    suggestions.push({
      id: 'sug_health_audit',
      title: `تم رصد ${auditIssuesCount} ملاحظات في تدقيق السجلات`,
      subtitle: 'افحصها وأصلح المكررين والأرقام الشاذة بنقرة واحدة من مركز الصحة.',
      ctaLabel: 'افحص وأصلح الآن',
      targetNodeId: 'cap_health_center',
      tone: 'warning',
    });
  }

  // Suggest pinning frequently used unpinned nodes
  const topUsed = Object.entries(usageMap)
    .filter(
      ([id, stat]) =>
        stat.count >= 2 &&
        id !== 'cosmos_hub' &&
        !pinnedNodeIds.includes(id) &&
        Boolean(getCosmosNodeById(root, id))
    )
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 2);

  for (const [id, stat] of topUsed) {
    const sugId = `sug_pin_${id}`;
    if (dismissedIds.includes(sugId)) continue;
    const node = getCosmosNodeById(root, id);
    if (!node) continue;
    suggestions.push({
      id: sugId,
      title: `تستخدم «${node.title}» بكثرة (${stat.count} مرات)`,
      subtitle: 'افتحه مباشرة أو ثبّته في شريط المفضلة للوصول السريع.',
      ctaLabel: 'فتح الآن',
      targetNodeId: id,
      tone: 'accent',
    });
  }

  if (suggestions.length === 0 && !dismissedIds.includes('sug_kpi_explore')) {
    suggestions.push({
      id: 'sug_kpi_explore',
      title: 'استكشف لوحة المؤشرات التنفيذية KPI',
      subtitle: 'توزيع الأفراد والأكياس وصافي الأرباح عبر جميع الوكالات في رسم تفاعلي.',
      ctaLabel: 'فتح المؤشرات',
      targetNodeId: 'cap_kpi_dashboard',
      tone: 'success',
    });
  }

  return suggestions;
}

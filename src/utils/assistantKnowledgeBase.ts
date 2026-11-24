import type { AppView, SettingsSectionId } from '../types/agency.ts';
import { normalizeIraqiDialect } from './assistantPrivacy.ts';

export interface KnowledgeGuideEntry {
  id: string;
  title: string;
  keywords: string[];
  whatItIs: string;
  benefit: string;
  howToUse: string;
  targetView: AppView;
  settingsSection?: SettingsSectionId;
  domTargetId: string;
}

export const ASSISTANT_KNOWLEDGE_BASE: KnowledgeGuideEntry[] = [
  {
    id: 'hub_overview',
    title: 'الشاشة الرئيسية والوكالات',
    keywords: ['رئيسية', 'الشاشة الرئيسية', 'بطاقات', 'الوكالات', 'المدير', 'اربع بطاقات'],
    whatItIs: 'لوحة البدء التي تعرض بطاقة السجل الشامل (جميع الوكالات) وبطاقات الوكالات الثلاث مع ملخص فوري.',
    benefit: 'تصل لأي وكالة بنقرة واحدة وتشوف إجمالي الأسر والأفراد والأكياس والأرباح مباشرة.',
    howToUse: 'اضغط على بطاقة الوكالة لفتح جدولها، أو «السجل الشامل» لعرض كل الوكالات معاً.',
    targetView: 'hub',
    domTargetId: 'hub-agencies-grid',
  },
  {
    id: 'agency_roster_table',
    title: 'جدول الوكالة والبحث والفلترة',
    keywords: ['جدول', 'بحث', 'فلترة', 'ترتيب', 'تعديل', 'المحرر', 'مستفيد', 'سجل', 'اضافة سجل'],
    whatItIs: 'جدول سجل المستفيدين التفاعلي لكل وكالة مع حساب تلقائي للأكياس والمبالغ والحجب.',
    benefit: 'تنظيم الأسماء، حساب الحصص والمبالغ حسب إعداداتك، والبحث الضبابي السريع بدون أخطاء.',
    howToUse: 'استخدم مربع البحث أعلى الجدول، أو اضغط «إضافة سجل» لإدخال عائلة جديدة، أو انقر على أي صف لتحديده.',
    targetView: 'agency_roster',
    domTargetId: 'agency-roster-toolbar',
  },
  {
    id: 'master_roster',
    title: 'السجل الشامل لجميع الوكالات',
    keywords: ['السجل الشامل', 'جميع الوكالات', 'كل الوكالات', 'شامل'],
    whatItIs: 'جدول موحّد يجمع كل المستفيدين من الوكالات كافة في مكان واحد.',
    benefit: 'يسهّل المقارنة، اكتشاف التكرارات بين الوكالات، والتصدير الموحّد.',
    howToUse: 'اختر «السجل الشامل» من الرئيسية أو القائمة، ثم ابحث أو صدّر ملف Excel أو PDF.',
    targetView: 'master_roster',
    domTargetId: 'agency-roster-toolbar',
  },
  {
    id: 'ready_lists_section',
    title: 'القوائم الجاهزة والتوزيع',
    keywords: ['قائمة جاهزة', 'القوائم الجاهزة', 'قوائم', 'توصيل', 'عمال التوصيل', 'صورة', 'واتساب'],
    whatItIs: 'قسم لإنشاء قوائم مخصصة (مثل قوائم عمال التوصيل أو الوجبات المستعجلة) بعناوين وتواريخ مستقلة.',
    benefit: 'تجمع أسماء من عدة وكالات أو تضيف أسماء مباشرة وتصدرها كصورة PNG أو نص جاهز للمشاركة أو Excel.',
    howToUse: 'اضغط «إنشاء قائمة جديدة»، أضف الأعضاء بالبحث أو من قسم العلاقات، ثم افتح القائمة بملء الشاشة.',
    targetView: 'ready_lists',
    domTargetId: 'ready-lists-create-btn',
  },
  {
    id: 'relationships_section',
    title: 'قسم العلاقات والمتابعة',
    keywords: ['علاقات', 'العلاقات', 'مفضلة', 'تعديل لاحقا', 'تذكير', 'ملاحظات التوصيل', 'متابعة'],
    whatItIs: 'دفتر متابعة منظم يضم: المفضلة، التعديل لاحقاً، التذكيرات، وملاحظات التوصيل.',
    benefit: 'يمنع نسيان الأسماء المؤجلة أو مواعيد التذكير ويسمح بإرسالهم مباشرة لأي قائمة جاهزة.',
    howToUse: 'اختر التصنيف من الأعلى أو حدد أشخاصاً من أي جدول واختر إضافتهم للعلاقات.',
    targetView: 'relationships',
    domTargetId: 'relationships-header',
  },
  {
    id: 'finance_section',
    title: 'الحسابات والمالية وصافي الأرباح',
    keywords: ['مالية', 'الحسابات', 'ارباح', 'صافي', 'مصاريف', 'اجور', 'صرفيات', 'كيس', 'اكياس'],
    whatItIs: 'شاشة احتساب الإيرادات من الأفراد والبطاقات وخصم أجور العمال والصرفيات.',
    benefit: 'تعطيك صافي الربح الدقيق وعدد الأكياس لكل وكالة بناءً على معادلة الحاسبة المضبوطة في التطبيق.',
    howToUse: 'اختر الوكالة من الأعلى لمراجعة أرقامها أو أضف مصروفاً جديداً من نموذج الصرفيات.',
    targetView: 'finance',
    domTargetId: 'finance-kpi-grid',
  },
  {
    id: 'quick_extract_section',
    title: 'السحب السريع (PDF والكاميرا - UCRS)',
    keywords: ['سحب سريع', 'السحب السريع', 'كاميرا', 'pdf', 'استخراج', 'مقارنة', 'استيراد', 'دفتر يدوي'],
    whatItIs: 'منظومة قراءة ذكية لجداول الـ PDF والدفاتر اليدوية والصور والملفات مع فحص الشك والتوجيه.',
    benefit: 'تستخرج الأسماء والأفراد والانخفاض/الإضافة بدون أخطاء صامتة وتوزعها على الوكالات أو القوائم.',
    howToUse: 'ارفع ملف PDF أو التقط صورة للدفتر، راجع الخلايا المظللة بالشك، ثم اضغط الترحيل النهائي.',
    targetView: 'quick_extract',
    domTargetId: 'quick-extract-root',
  },
  {
    id: 'data_archives_section',
    title: 'الأرشفة الشهرية والبيانات التاريخية',
    keywords: ['أرشفة', 'الارشيف', 'البيانات', 'تاريخي', 'تدوير', 'الشهر القادم', 'حصة شهرية'],
    whatItIs: 'سجل يحفظ لقطات كاملة للوكالات والقوائم والمصاريف حسب الشهر والحصة.',
    benefit: 'تراجع شهور سابقة وتصدرها دون أن تتأثر بيانات الشهر الحالي، مع تدوير سلس للحصة الجديدة.',
    howToUse: 'اضغط «أرشفة الفترة الحالية» لحفظ لقطة أو «بدء تدوير الشهر القادم» لفتح حصة جديدة.',
    targetView: 'data_archives',
    domTargetId: 'data-archives-actions',
  },
  {
    id: 'google_workspace_section',
    title: 'التقويم والمهام (Google Calendar & Tasks)',
    keywords: ['تقويم', 'جوجل', 'كالندر', 'مهام', 'google', 'calendar', 'tasks'],
    whatItIs: 'تكامل مباشر مع تقويم ومهام Google لمزامنة مواعيد الحصص والتذكيرات.',
    benefit: 'ينبهك على هاتفك وحسابك لمواعيد التوزيع والتذكيرات المهمة.',
    howToUse: 'سجل دخولك بحساب Google وصادق الصلاحيات لمزامنة مواعيد القوائم والتذكيرات.',
    targetView: 'google_workspace',
    domTargetId: 'google-workspace-root',
  },
  {
    id: 'settings_calculator',
    title: 'ضبط حاسبة الجدول ومعادلات الرسوم',
    keywords: ['حاسبة', 'حساب', 'معادلة', 'رسوم', 'كغم', 'كيلو', 'سعر الفرد', 'مبلغ البطاقة'],
    whatItIs: 'إعدادات الأرقام المرجعية (الكيلو للفرد، وزن الكيس، رسم الفرد، ورسم البطاقة).',
    benefit: 'تتحكم في كل الحسابات المالية وجداول التوزيع من مكان واحد دون أرقام ثابتة.',
    howToUse: 'عدّل القيم وجرب المعاينة المباشرة أسفل النموذج ثم اضغط حفظ.',
    targetView: 'settings',
    settingsSection: 'calculator',
    domTargetId: 'settings-content-pane',
  },
  {
    id: 'settings_appearance',
    title: 'استوديو المظهر والثيمات (8 ثيمات)',
    keywords: ['ثيم', 'مظهر', 'الوان', 'خط', 'تصميم الجدول', 'كارت', 'داكن', 'فاتح'],
    whatItIs: 'استوديو تخصيص كامل يضم 8 ثيمات تطبيق، 8 أنماط جداول، 6 خطوط عربية، وملفات مظهر محفوظة.',
    benefit: 'تكيّف شكل الجداول وأحجامها للعمل الليلي أو الطباعة المريحة بنقرة واحدة.',
    howToUse: 'اختر أي ثيم أو نمط جدول وشاهد التغيير فوراً، أو احفظ توليفتك كملف مظهر.',
    targetView: 'settings',
    settingsSection: 'appearance',
    domTargetId: 'settings-content-pane',
  },
  {
    id: 'settings_modes',
    title: 'إعدادات التحرير والجداول والفئات',
    keywords: ['تحرير', 'تخصيص الاعمدة', 'حفظ فوري', 'تأكيد', 'فئات'],
    whatItIs: 'تفضيلات التحرير المباشر وقواعد التأكيد قبل التعديل والحذف وإدارة الفئات المخصصة.',
    benefit: 'يمكنك إخفاء وإعادة ترتيب الأعمدة وإضافة أعمدة وفئات مخصصة بحرية كاملة مع اختيار أسلوب الحفظ المناسب.',
    howToUse: 'انتقل إلى قسم إعدادات التحرير والجداول لتعديل قواعد التأكيد أو إدارة الفئات وتخطيط الأعمدة.',
    targetView: 'settings',
    settingsSection: 'modes',
    domTargetId: 'settings-content-pane',
  },
  {
    id: 'settings_security',
    title: 'الأمان والنسخ الاحتياطي وسلة الاسترجاع',
    keywords: ['نسخة احتياطية', 'نسخ احتياطي', 'استعادة', 'سلة', 'محذوفات', 'قفل', 'خصوصية', 'امان', 'json'],
    whatItIs: 'مركز حماية البيانات: تصدير واستيراد JSON، سلة الاسترجاع الآمنة، وقفل الخصوصية.',
    benefit: 'لا يضيع أي سجل أبداً؛ كل حذف ينتقل للسلة الآمنة ويمكنك تنزيل نسخة احتياطية محلية في أي لحظة.',
    howToUse: 'اضغط «تصدير نسخة احتياطية (JSON)» لحفظ ملفك، أو استعد أي سجل من سلة الاسترجاع أسفل الصفحة.',
    targetView: 'settings',
    settingsSection: 'security_data',
    domTargetId: 'settings-content-pane',
  },
];

export function findKnowledgeEntry(query: string): KnowledgeGuideEntry | null {
  const norm = normalizeIraqiDialect(query);
  if (!norm) return null;

  let best: { entry: KnowledgeGuideEntry; score: number } | null = null;
  for (const entry of ASSISTANT_KNOWLEDGE_BASE) {
    let score = 0;
    const normTitle = normalizeIraqiDialect(entry.title);
    if (norm.includes(normTitle)) score += 6;
    for (const kw of entry.keywords) {
      const nkw = normalizeIraqiDialect(kw);
      if (!nkw) continue;
      if (norm === nkw) score += 8;
      else if (norm.includes(nkw)) score += 3 + Math.min(3, nkw.split(' ').length);
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }
  return best ? best.entry : null;
}

export function formatKnowledgeAnswer(entry: KnowledgeGuideEntry): string {
  return [
    `**${entry.title}**`,
    `• شنو هذا: ${entry.whatItIs}`,
    `• الفايدة: ${entry.benefit}`,
    `• شلون تستخدمه: ${entry.howToUse}`,
  ].join('\n');
}

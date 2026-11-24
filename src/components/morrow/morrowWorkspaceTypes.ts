import type {
  AiCollaborationMode,
  AssistantBrainMode,
  AssistantResponseStyle,
} from '../../types/assistant';

export type MorrowWorkspacePage =
  | 'chat'
  | 'history'
  | 'models'
  | 'assistants'
  | 'canvas'
  | 'approvals'
  | 'memory'
  | 'quick_notes'
  | 'diagnostics'
  | 'voice_settings'
  | 'live'
  | 'camera';

export interface SpecializedAssistantProfile {
  id: string;
  name: string;
  roleTitle: string;
  description: string;
  recommendedBrain: AssistantBrainMode;
  recommendedStyle: AssistantResponseStyle;
  recommendedCollaboration: AiCollaborationMode;
  starterPrompts: string[];
  accentHex: string;
  badgeText: string;
}

export const SPECIALIZED_ASSISTANTS: SpecializedAssistantProfile[] = [
  {
    id: 'general_morrow',
    name: 'مساعد Morrow الشامل',
    roleTitle: 'المنسق العام للوكالات',
    description:
      'يفهم اللهجة العراقية، يوجّه الطلبات بين النماذج الستة، ويجيب عن الأسئلة اليومية بدقة وتوازن.',
    recommendedBrain: 'auto',
    recommendedStyle: 'balanced',
    recommendedCollaboration: 'council_review',
    starterPrompts: [
      'أعطني ملخص اليوم',
      'قارن بين الوكالات',
      'افحص التطبيق',
    ],
    accentHex: '#818cf8',
    badgeText: 'تلقائي ذكي',
  },
  {
    id: 'financial_auditor',
    name: 'المدقق المالي والمحاسبي',
    roleTitle: 'مراقبة الحصص والأرباح والمصروفات',
    description:
      'يركز على حسابات الأكياس، رسوم الأفراد، المصروفات، محاكاة «ماذا لو؟»، وكشف الفروقات المالية.',
    recommendedBrain: 'gemini_3_8_flash',
    recommendedStyle: 'financial_auditor',
    recommendedCollaboration: 'council_review',
    starterPrompts: [
      'ماذا لو رسم الفرد 500',
      'كم صافي ربح كل وكالة هذا الشهر؟',
      'احصائيات جميع الوكالات',
    ],
    accentHex: '#34d399',
    badgeText: 'تدقيق مالي',
  },
  {
    id: 'vision_extractor',
    name: 'محلل الكشوفات والصور',
    roleTitle: 'قراءة الدفاتر وملفات PDF والصور',
    description:
      'يستخرج الأسماء والأفراد من صور السجلات وملفات PDF ويجهّزها للمراجعة أو السحب الذكي.',
    recommendedBrain: 'gemini_3_8_flash',
    recommendedStyle: 'balanced',
    recommendedCollaboration: 'multi_step_agent',
    starterPrompts: [
      'كيف أرفع كشف PDF لتحليله واستخراج الأسماء؟',
      'فحص الأسماء المكررة والنواقص في الجداول',
    ],
    accentHex: '#38bdf8',
    badgeText: 'رؤية ومستندات',
  },
  {
    id: 'ops_macros',
    name: 'وكيل العمليات والماكرو',
    roleTitle: 'إغلاق الشهر، الحجب، والتقارير',
    description:
      'يدير إغلاق الحصص الشهرية، حصر العائلات المحجوبة، وتوليد تقارير Excel المعزولة بأقل خطوات.',
    recommendedBrain: 'gemini_3_5_flash',
    recommendedStyle: 'concise',
    recommendedCollaboration: 'multi_step_agent',
    starterPrompts: [
      'إغلاق الشهر',
      'من هم المحجوبين',
      'صدر تقرير اكسل',
    ],
    accentHex: '#fbbf24',
    badgeText: 'عمليات وماكرو',
  },
  {
    id: 'deep_advisor',
    name: 'المستشار الاستراتيجي للوكالات',
    roleTitle: 'تحليل الاتجاهات والتوقعات',
    description:
      'يقدّم تحليلاً معمقاً لأداء الوكالات وتوقعات الأشهر القادمة بالاعتماد على الأرشيف التاريخي.',
    recommendedBrain: 'nemotron_free',
    recommendedStyle: 'deep_advisor',
    recommendedCollaboration: 'council_review',
    starterPrompts: [
      'ما توقعات الحصة والأفراد للشهر القادم؟',
      'حلل نقاط الضعف والمخاطر في الوكالات الحالية',
    ],
    accentHex: '#a78bfa',
    badgeText: 'استنتاج معمّق',
  },
];

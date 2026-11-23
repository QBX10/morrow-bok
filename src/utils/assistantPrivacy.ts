import type { AssistantMessage, AssistantUiContext } from '../types/assistant.ts';
import { normalizeArabic } from './agencyLogic.ts';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_INDIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function convertArabicIndicDigits(input: string): string {
  return String(input || '')
    .replace(/[٠-٩]/g, (ch) => {
      const idx = ARABIC_INDIC_DIGITS.indexOf(ch);
      return idx >= 0 ? String(idx) : ch;
    })
    .replace(/[۰-۹]/g, (ch) => {
      const idx = PERSIAN_INDIC_DIGITS.indexOf(ch);
      return idx >= 0 ? String(idx) : ch;
    });
}

/**
 * Enforces mandatory domain terminology: "الأفراد" / "أفراد" everywhere.
 */
export function enforceSafeArabicTerminology(text: string): string {
  return String(text || '')
    .replace(/\u0627\u0644[\u0623\u0627]\u0646\u0641\u0627\u0631|\u0627\u0644[\u0623\u0627]\u0646\u0641\u0631/g, 'الأفراد')
    .replace(/[\u0623\u0627]\u0646\u0641\u0627\u0631/g, 'أفراد')
    .replace(/(^|\s)\u0646\u0641\u0631(?=\s|$)/g, '$1فرد');
}

/**
 * Collapses repeated elongated Arabic letters (e.g. "ضيييف" -> "ضيف", "شلووون" -> "شلون")
 * while keeping normal doubled consonants like "محمد" intact (3+ repeats -> 1, common 2-char elongation normalized gently).
 */
function collapseArabicElongation(text: string): string {
  return text
    .replace(/\u0640+/g, '') // remove tatweel
    .replace(/([\u0621-\u064A])\1{2,}/g, '$1')
    .replace(/(ض)ي+(ف)/g, '$1ي$2')
    .replace(/(شل)و+(ن)/g, '$1و$2')
    .replace(/(شك)و+/g, '$1و');
}

/**
 * Normalizes Iraqi dialect & Arabic orthographic variants for deterministic matching.
 */
export function normalizeIraqiDialect(input: string): string {
  const digitsNormalized = convertArabicIndicDigits(input);
  const termFixed = enforceSafeArabicTerminology(digitsNormalized);
  const collapsed = collapseArabicElongation(termFixed);

  return normalizeArabic(collapsed)
    .replace(/[ؤئ]/g, (ch) => (ch === 'ؤ' ? 'و' : 'ي'))
    .replace(/(^|\s)شلونك?م?(?=\s|$)/g, '$1كيف')
    .replace(/(^|\s)(?:شكد|كميه)(?=\s|$)/g, '$1كم')
    .replace(/(^|\s)(?:هسه|هسا|هسة|هساع|الان)(?=\s|$)/g, '$1الآن')
    .replace(/(^|\s)اكو(?=\s|$)/g, '$1يوجد')
    .replace(/(^|\s)ماكو(?=\s|$)/g, '$1لا يوجد')
    .replace(
      /(^|\s)(?:شوفلي|طلعلي|دورلي|لقالي|ابحثلي|فتشلي|فتش|لكيلي|كلي عن|جيبلي|انطيني معلومات|اندل)(?=\s|$)/g,
      '$1ابحث'
    )
    .replace(
      /(^|\s)(?:ضيفلي|ضفلي|خليلي|نزلي|سجلي|دخللي|دخلي|اكتبلي|ثبتلي|اضفلي)(?=\s|$)/g,
      '$1ضيف'
    )
    .replace(
      /(^|\s)(عدلي|غيرلي|بدلي|صلحلي|سويلي|حوللي|عدله|غيره|بدله|سويه)(?=\s|$)/g,
      (_, p1: string, w: string) => `${p1}${w.endsWith('ه') ? 'عدله' : 'عدل'}`
    )
    .replace(
      /(^|\s)(زوده|زيده|زود|زيد)(?=\s|$)/g,
      (_, p1: string, w: string) => `${p1}${w.endsWith('ه') ? 'زوده' : 'زود'}`
    )
    .replace(
      /(^|\s)(نقصه|قلله|نقص|قلل)(?=\s|$)/g,
      (_, p1: string, w: string) => `${p1}${w.endsWith('ه') ? 'نقصه' : 'نقص'}`
    )
    .replace(/(^|\s)(?:وريني|دليني|راويني|فرجيني|شوفني|وين القى)(?=\s|$)/g, '$1وريني')
    .replace(/(^|\s)(?:اشرحلي|فهمني|وضحلي|علمني)(?=\s|$)/g, '$1اشرح')
    .replace(/(^|\s)(?:افحصلي|شيكلي|دققلي|جيكلي|جيك|شيك)(?=\s|$)/g, '$1افحص')
    .replace(
      /(^|\s)(امسحلي|احذفلي|شيللي|ارشفيلي|شطبه|طيره|احذفه|ارشفه|امسحه|شيله)(?=\s|$)/g,
      (_, p1: string, w: string) => `${p1}${w.endsWith('ه') ? 'ارشفه' : 'ارشف'}`
    )
    .replace(/(^|\s)(?:اطبعلي|طبعلي|طبع|اطبع|صدرلي|كشف)(?=\s|$)/g, '$1صدر')
    .replace(/(^|\s)(?:تراجع|رجعني|الغي اخر عمليه|رجع اخر خطوه)(?=\s|$)/g, '$1تراجع')
    .replace(/(^|\s)(?:لا تخلي|لا تظهر|اخفيلي)(?=\s|$)/g, '$1اخفي')
    .replace(/أفراد|افراد/g, 'افراد')
    .trim();
}

export interface MaskedCloudContext {
  activeView: string;
  selectedAgencyId: number | null;
  selectedAgencyName: string | null;
  hasFocusedRow: boolean;
  focusedRowRef: string | null;
  modeTier: string;
  themeId: string;
  agencies: Array<{ id: number; name: string }>;
  readyLists: Array<{ id: number; name: string; agencyId: number }>;
  preferences: Array<{ key: string; label: string; value: string | boolean | number }>;
  totalPersonsCount: number;
  privacyMode: 'masked_no_beneficiaries' | 'names_allowed_by_user';
  focusedPersonName?: string;
}

export function redactPotentialPiiText(text: string): string {
  return String(text || '')
    // Redact emails
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[بريد محجوب]')
    // Redact Iraqi/international phone numbers
    .replace(/(?:\+?964|00964|0)?7\d{9}\b/g, '[رقم هاتف محجوب]')
    .replace(/\+\d{8,15}\b/g, '[رقم هاتف محجوب]')
    // Redact 7+ digit national / ration card / reference IDs
    .replace(/\b\d{7,16}\b/g, '[رقم بطاقة محجوب]');
}

export function buildCloudContextPayload(
  uiContext: AssistantUiContext,
  history: AssistantMessage[],
  allowCloudBeneficiaryNames: boolean
): {
  cloudContext: MaskedCloudContext;
  cloudHistory: Array<{ role: 'user' | 'assistant'; text: string }>;
} {
  const selectedAgency = uiContext.agencies.find(
    (a) => a.id === uiContext.selectedAgencyId
  );

  const cloudContext: MaskedCloudContext = {
    activeView: uiContext.activeView,
    selectedAgencyId: uiContext.selectedAgencyId,
    selectedAgencyName: selectedAgency ? selectedAgency.name : null,
    hasFocusedRow: uiContext.focusedPersonId !== null,
    focusedRowRef:
      uiContext.focusedPersonId !== null
        ? allowCloudBeneficiaryNames && uiContext.focusedPersonName
          ? `${uiContext.focusedPersonName} (#${uiContext.focusedPersonId})`
          : `[مستفيد محدد #${uiContext.focusedPersonId}]`
        : null,
    modeTier: uiContext.modeTier,
    themeId: uiContext.themeId,
    agencies: uiContext.agencies.map((a) => ({ id: a.id, name: a.name })),
    readyLists: uiContext.readyLists.slice(0, 8).map((l) => ({
      id: l.id,
      name: l.name,
      agencyId: l.agencyId,
    })),
    preferences: uiContext.preferences.slice(0, 8).map((p) => ({
      key: p.key,
      label: p.label,
      value: p.value,
    })),
    totalPersonsCount: uiContext.totalPersonsCount,
    privacyMode: allowCloudBeneficiaryNames
      ? 'names_allowed_by_user'
      : 'masked_no_beneficiaries',
    ...(allowCloudBeneficiaryNames && uiContext.focusedPersonName
      ? { focusedPersonName: uiContext.focusedPersonName }
      : {}),
  };

  // Keep cloud history minimal (last 4 turns, max 420 chars each) to minimize context & quota usage
  const cloudHistory = history.slice(-4).map((msg) => ({
    role: msg.role,
    text: allowCloudBeneficiaryNames
      ? enforceSafeArabicTerminology(msg.text).slice(0, 420)
      : redactPotentialPiiText(
          enforceSafeArabicTerminology(msg.text).slice(0, 420)
        ),
  }));

  return { cloudContext, cloudHistory };
}


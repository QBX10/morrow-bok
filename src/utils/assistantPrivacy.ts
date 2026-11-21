import type { AssistantMessage, AssistantUiContext } from '../types/assistant.ts';
import { normalizeArabic } from './agencyLogic.ts';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function convertArabicIndicDigits(input: string): string {
  return String(input || '').replace(/[٠-٩]/g, (ch) => {
    const idx = ARABIC_INDIC_DIGITS.indexOf(ch);
    return idx >= 0 ? String(idx) : ch;
  });
}

/**
 * Enforces mandatory domain terminology: "الأفراد" / "أفراد" instead of "الأنفار" / "أنفار".
 */
export function enforceSafeArabicTerminology(text: string): string {
  return String(text || '')
    .replace(/الأنفار|الانفار|الأنفر|الانفر/g, 'الأفراد')
    .replace(/أنفار|انفار/g, 'أفراد')
    .replace(/\bنفر\b/g, 'فرد');
}

/**
 * Normalizes Iraqi dialect & Arabic orthographic variants for deterministic matching.
 */
export function normalizeIraqiDialect(input: string): string {
  const digitsNormalized = convertArabicIndicDigits(input);
  const termFixed = enforceSafeArabicTerminology(digitsNormalized);
  return normalizeArabic(termFixed)
    .replace(/شلون/g, 'كيف')
    .replace(/شكد/g, 'كم')
    .replace(/هسه|هسا|الان/g, 'الآن')
    .replace(/اكو/g, 'يوجد')
    .replace(/ماكو/g, 'لا يوجد')
    .replace(/شوفلي|طلعلي|دورلي|لقالي|ابحثلي/g, 'ابحث')
    .replace(/ضيفلي|ضفلي|خليلي|نزلي|سجلي/g, 'ضيف')
    .replace(/عدلي|غيرلي|بدلي|صلحلي/g, 'عدل')
    .replace(/وريني|دليني|راويني|فرجيني/g, 'وريني')
    .replace(/اشرحلي|فهمني|وضحلي/g, 'اشرح')
    .replace(/افحصلي|شيكلي|دققلي/g, 'افحص')
    .replace(/امسحلي|احذفلي|شيللي|ارشفيلي/g, 'ارشف')
    .replace(/لا تخلي|لا تظهر|اخفيلي/g, 'اخفي')
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
    // Redact 8+ digit national IDs or phone numbers
    .replace(/(?:\+?964|00964|0)?7\d{9}\b/g, '[رقم هاتف محجوب]')
    .replace(/\b\d{8,16}\b/g, '[رقم بطاقة محجوب]');
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
    readyLists: uiContext.readyLists.map((l) => ({
      id: l.id,
      name: l.name,
      agencyId: l.agencyId,
    })),
    preferences: uiContext.preferences.map((p) => ({
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

  const cloudHistory = history.slice(-6).map((msg) => ({
    role: msg.role,
    text: allowCloudBeneficiaryNames
      ? enforceSafeArabicTerminology(msg.text).slice(0, 600)
      : redactPotentialPiiText(
          enforceSafeArabicTerminology(msg.text).slice(0, 600)
        ),
  }));

  return { cloudContext, cloudHistory };
}

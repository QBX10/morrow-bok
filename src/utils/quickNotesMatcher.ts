import type { Agency, Person } from '../types/agency.ts';
import { fuzzyMatchPersons } from './assistantOfflineBrain.ts';
import { convertArabicIndicDigits, enforceSafeArabicTerminology } from './assistantPrivacy.ts';

export interface QuickNoteMatchResult {
  person: Person | null;
  agencyName: string | null;
  confidence: number;
  candidates: Array<{ person: Person; agencyName: string; score: number }>;
}

const STOP_WORDS_RE =
  /(?:^|\s)(?:ملاحظه|ملاحظة|تذكير|عاجل|مهم|اتصال|هاتف|اتصل|بخصوص|عائله|عائلة|مستفيد|سجل|اسم|على|عن|من|الى|إلى|في|لا|تنسى|راجع|تم|اليوم|غدا|غداً|موعد|دفع|سلم|استلم|الحصة|حصته|افراد|أفراد)(?=\s|$)/g;

/**
 * Automatically extracts candidate names from typed or voice-dictated Arabic notes
 * and links them to the closest matching family/beneficiary in the agency database.
 */
export function autoLinkQuickNoteToPerson(
  noteText: string,
  persons: ReadonlyArray<Person>,
  agencies: ReadonlyArray<Agency>
): QuickNoteMatchResult {
  const clean = enforceSafeArabicTerminology(convertArabicIndicDigits(noteText))
    .replace(/[،,.!?:؛\-_()[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || persons.length === 0) {
    return { person: null, agencyName: null, confidence: 0, candidates: [] };
  }

  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));

  // Strip common note filler words to isolate person/family names
  const stripped = clean.replace(STOP_WORDS_RE, ' ').replace(/\s+/g, ' ').trim();
  const candidatesPrimary = fuzzyMatchPersons(stripped || clean, [...persons]);
  const candidatesFallback =
    candidatesPrimary.length > 0 ? candidatesPrimary : fuzzyMatchPersons(clean, [...persons]);

  if (candidatesFallback.length === 0) {
    return { person: null, agencyName: null, confidence: 0, candidates: [] };
  }

  const best = candidatesFallback[0];
  // Require reasonable score (>= 18) for automatic linking to prevent false positives
  const normalizedConfidence = Math.min(0.99, Math.round((best.score / 100) * 100) / 100);
  const autoPerson = best.score >= 18 ? best.person : null;

  return {
    person: autoPerson,
    agencyName: autoPerson ? agencyMap.get(autoPerson.agencyId) || null : null,
    confidence: autoPerson ? normalizedConfidence : 0,
    candidates: candidatesFallback.slice(0, 5).map((c) => ({
      person: c.person,
      agencyName: agencyMap.get(c.person.agencyId) || '',
      score: c.score,
    })),
  };
}

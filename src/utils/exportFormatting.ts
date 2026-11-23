import type { AppThemeId } from '../types/agency.ts';
import type { AssistantUserPref } from '../types/assistant.ts';
import { normalizeIraqiDialect } from './assistantPrivacy.ts';

export interface ExportMemoryFlags {
  hideAmountColumn: boolean;
  hideStatusColumn: boolean;
  hideNotesColumn: boolean;
  activeRuleLabels: string[];
}

const PREFS_STORAGE_KEY = 'tabrix_assistant_prefs_v1';

/**
 * Safely reads persisted Memory preferences when not explicitly passed to export helpers.
 */
export function readPersistedAssistantPrefs(): AssistantUserPref[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AssistantUserPref[]) : [];
  } catch {
    return [];
  }
}

/**
 * Evaluates saved Memory rules to determine which sensitive/optional columns
 * (such as Amount or Status) should be hidden automatically across PDF & Excel exports.
 */
export function getExportMemoryFlags(
  preferences?: ReadonlyArray<AssistantUserPref>
): ExportMemoryFlags {
  const list = preferences ?? readPersistedAssistantPrefs();
  let hideAmountColumn = false;
  let hideStatusColumn = false;
  let hideNotesColumn = false;
  const activeRuleLabels: string[] = [];

  for (const pref of list) {
    if (String(pref.value) === 'false') continue;
    const key = String(pref.key || '').toLowerCase();
    const normLabel = normalizeIraqiDialect(`${pref.label || ''} ${String(pref.value || '')}`);

    if (
      key === 'hide_amount_in_reports' ||
      (/(اخفي|اخفاء|لا تخلي|ازاله|بدون)/.test(normLabel) &&
        /(مبلغ|المبلغ|سعر|السعر|دينار|فلوس|المبالغ)/.test(normLabel))
    ) {
      hideAmountColumn = true;
      activeRuleLabels.push(pref.label);
    }

    if (
      key === 'hide_status_in_reports' ||
      (/(اخفي|اخفاء|لا تخلي|ازاله|بدون)/.test(normLabel) &&
        /(حاله|الحاله|الحظر)/.test(normLabel))
    ) {
      hideStatusColumn = true;
      activeRuleLabels.push(pref.label);
    }

    if (
      key === 'hide_notes_in_reports' ||
      (/(اخفي|اخفاء|لا تخلي|ازاله|بدون)/.test(normLabel) &&
        /(ملاحظات|الملاحظات)/.test(normLabel))
    ) {
      hideNotesColumn = true;
      activeRuleLabels.push(pref.label);
    }
  }

  return {
    hideAmountColumn,
    hideStatusColumn,
    hideNotesColumn,
    activeRuleLabels: Array.from(new Set(activeRuleLabels)),
  };
}

/**
 * Prevents Excel formula injection on untrusted/free-form Arabic text cells
 * while preserving clean UTF-8 display.
 */
export function sanitizeExcelCellText(value: unknown): string {
  const raw = String(value ?? '').replace(/\u0000/g, '').trim();
  if (!raw) return '';
  if (/^[=+\-@\t\r]/.test(raw)) {
    return `'${raw}`;
  }
  return raw;
}

/**
 * Strict HTML entity escaping so Arabic names, notes, and punctuation never corrupt
 * generated print/PDF documents or inject markup.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeExportFilename(name: string, extension: string): string {
  const cleanBase =
    String(name || '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
      .replace(/\s+/g, '_')
      .trim() || 'Morrow_Export';
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return cleanBase.endsWith(ext) ? cleanBase : `${cleanBase}${ext}`;
}

export interface PrintThemePalette {
  headerBg: string;
  headerText: string;
  accent: string;
  tableHeadBg: string;
  border: string;
}

export function resolveThemePrintPalette(
  themeId?: AppThemeId
): PrintThemePalette {
  switch (themeId) {
    case 'emerald-forest':
      return {
        headerBg: '#064e3b',
        headerText: '#ffffff',
        accent: '#059669',
        tableHeadBg: '#ecfdf5',
        border: '#a7f3d0',
      };
    case 'desert-mirage':
      return {
        headerBg: '#78350f',
        headerText: '#ffffff',
        accent: '#d97706',
        tableHeadBg: '#fffbeb',
        border: '#fde68a',
      };
    case 'royal-crimson':
      return {
        headerBg: '#7f1d1d',
        headerText: '#ffffff',
        accent: '#dc2626',
        tableHeadBg: '#fef2f2',
        border: '#fecaca',
      };
    case 'obsidian-gold':
    case 'cyberpunk':
      return {
        headerBg: '#111827',
        headerText: '#f9fafb',
        accent: '#ca8a04',
        tableHeadBg: '#f3f4f6',
        border: '#d1d5db',
      };
    case 'aurora':
    default:
      return {
        headerBg: '#0f172a',
        headerText: '#ffffff',
        accent: '#1d4ed8',
        tableHeadBg: '#eef3f9',
        border: '#cbd5e1',
      };
  }
}

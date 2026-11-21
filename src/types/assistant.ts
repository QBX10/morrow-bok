import type {
  AppModeTier,
  AppThemeId,
  AppView,
  BlockScope,
  ExpenseCategory,
  Person,
  RelationCategory,
  SettingsSectionId,
} from './agency.ts';

export type AssistantBrainMode =
  | 'auto'
  | 'local'
  | 'gemini_hydrogen'
  | 'gemini_lite'
  | 'collaborative';

export type AssistantConnectivityState = 'online' | 'offline';

export type AssistantToolName =
  | 'search_person'
  | 'add_person'
  | 'update_person'
  | 'archive_person'
  | 'filter_sort_table'
  | 'get_stats_profit'
  | 'manage_ready_list'
  | 'manage_expense'
  | 'open_import_compare'
  | 'export_sandbox'
  | 'backup_restore'
  | 'navigate_focus'
  | 'update_settings'
  | 'explain_feature'
  | 'run_diagnostics';

export interface AssistantToolCall {
  name: AssistantToolName;
  args: Record<string, unknown>;
}

export interface AssistantChoiceChip {
  id: string;
  label: string;
  sublabel?: string;
  tone?: 'default' | 'accent' | 'warning';
  actionType:
    | 'slot_answer'
    | 'select_person'
    | 'navigate_spotlight'
    | 'run_tool'
    | 'queue_offline';
  payload: Record<string, unknown>;
}

export interface AssistantBeforeAfterRow {
  fieldLabel: string;
  beforeValue: string;
  afterValue: string;
}

export interface AssistantBeforeAfterDiff {
  id: string;
  title: string;
  summary: string;
  requiresBulkBackup?: boolean;
  toolCall: AssistantToolCall;
  changes: AssistantBeforeAfterRow[];
  status: 'pending' | 'approved' | 'cancelled';
}

export interface AssistantSlotSession {
  intent: 'add_person' | 'update_person' | 'archive_person' | 'export_sandbox' | 'manage_expense';
  collectedArgs: Record<string, unknown>;
  missingSlot: 'agencyId' | 'individuals' | 'personId' | 'amountIqd' | 'format';
  originalPrompt: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  engineUsed?: 'local' | 'gemini_hydrogen' | 'gemini_lite' | 'collaborative';
  engineLabel?: string;
  gracefulLevel?: 'A' | 'B' | 'C';
  choices?: AssistantChoiceChip[];
  confirmationDiff?: AssistantBeforeAfterDiff;
  spotlightAction?: {
    label: string;
    view: AppView;
    settingsSection?: SettingsSectionId;
    targetId: string;
  };
  sandboxNotice?: string;
  diagnosticsReport?: DiagnosticSummary;
  queuePrompt?: {
    prompt: string;
    saved: boolean;
  };
}

export interface AssistantQueuedTask {
  id: string;
  prompt: string;
  createdAt: string;
  reason: string;
}

export interface AssistantUserPref {
  id: string;
  key: string;
  label: string;
  value: string | boolean | number;
  createdAt: string;
}

export interface DiagnosticIssueItem {
  id: string;
  category:
    | 'duplicate_name'
    | 'missing_letter_or_name'
    | 'invalid_individuals'
    | 'calculation_mismatch'
    | 'data_integrity'
    | 'backup_staleness';
  severity: 'high' | 'medium' | 'info';
  title: string;
  detail: string;
  agencyId?: number;
  personId?: number;
  autoFixable: boolean;
  fixDescription?: string;
}

export interface DiagnosticSummary {
  checkedAt: string;
  totalIssues: number;
  highCount: number;
  mediumCount: number;
  autoFixableCount: number;
  healthScore: number;
  issues: DiagnosticIssueItem[];
}

export interface AssistantSpotlightState {
  targetId: string;
  title: string;
  description: string;
  activatedAt: number;
}

export interface AssistantExternalTableCommand {
  agencyId: number | null;
  searchQuery?: string;
  statusFilter?: 'all' | 'active' | 'blocked' | 'archived';
  sortBy?: 'default' | 'name_asc' | 'individuals_desc';
  focusPersonId?: number | null;
  hideColumns?: string[];
  showColumns?: string[];
  nonce: number;
}

export interface AssistantUiContext {
  activeView: AppView;
  selectedAgencyId: number | null;
  focusedPersonId: number | null;
  focusedPersonName?: string;
  modeTier: AppModeTier;
  themeId: AppThemeId;
  agencies: Array<{ id: number; name: string }>;
  readyLists: Array<{ id: number; name: string; agencyId: number }>;
  preferences: AssistantUserPref[];
  lastBackupAt?: string | null;
  totalPersonsCount: number;
}

export interface AssistantMutationHandlers {
  addPersonDirect: (input: {
    agencyId: number;
    name: string;
    nationalId: string;
    individuals: number | null;
    notes: string;
    blockType?: BlockScope;
    blockedIndividuals?: number;
    blockReason?: string;
  }) => void;
  updatePersonConfirmed: (personId: number, patch: Partial<Person>) => void;
  createReadyList: (input: {
    agencyId: number;
    name: string;
    listDate?: string;
    subtitle1?: string;
    subtitle2?: string;
    autoUpdateDate?: boolean;
    populateFromAgency?: boolean;
  }) => number;
  addPersonsToReadyList: (listId: number, personIds: number[]) => number;
  addExpense: (input: {
    agencyId: number;
    description: string;
    amountIqd: number;
    category: ExpenseCategory;
  }) => void;
  upsertRelationEntry: (input: {
    personId: number;
    category: RelationCategory;
    note: string;
  }) => void;
}

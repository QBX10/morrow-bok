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

/**
 * Strictly restricted to the 3 Morrow brains:
 * - auto: Morrow Local -> Gemini 2.5 Flash -> Gemini 2.5 Pro escalation chain
 * - local: Morrow (Local/Offline) only
 * - gemini_2_5_flash: Fast cloud model (gemini-2.5-flash)
 * - gemini_2_5_pro: Deep analytical cloud model (gemini-2.5-pro)
 */
export type AssistantBrainMode =
  | 'auto'
  | 'local'
  | 'gemini_2_5_flash'
  | 'gemini_2_5_pro';

export type AssistantEngineSource =
  | 'morrow_local'
  | 'gemini_2_5_flash'
  | 'gemini_2_5_pro';

export type MorrowCenterTab = 'chat' | 'approvals' | 'memory' | 'quick_notes';

export type AssistantConnectivityState = 'online' | 'offline' | 'quota_exhausted';

export interface AssistantSettingsConfig {
  preferredModelId: string;
  fallbackModelId: string;
  onlineDisabled: boolean;
  cacheEnabled: boolean;
  dailyRequestLimit: number;
  minuteRequestLimit: number;
  quotaWarningPercent: number;
}

export interface AssistantQuotaStats {
  dateKey: string;
  dailyCount: number;
  minuteTimestamps: number[];
  lastModelUsed?: string;
  quotaExhaustedUntil?: number | null;
}

export interface AssistantConversationMemory {
  lastPersonId?: number | null;
  lastPersonName?: string;
  lastAgencyId?: number | null;
  lastIntent?: string;
  lastQuery?: string;
  lastToolName?: AssistantToolName;
}

export interface AssistantSmartSuggestion {
  id: string;
  label: string;
  prompt: string;
}

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
    | 'queue_offline'
    | 'send_prompt'
    | 'open_command_center_tab'
    | 'approve_draft'
    | 'undo_action';
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

export interface AssistantApprovalDraft {
  id: string;
  createdAt: string;
  sourceEngine: AssistantEngineSource;
  sourceLabel: string;
  promptOrigin?: string;
  diff: AssistantBeforeAfterDiff;
  status: 'pending' | 'approved' | 'rejected';
  resolvedAt?: string;
  resultText?: string;
}

export interface AssistantQuickNote {
  id: string;
  text: string;
  source: 'text' | 'voice';
  createdAt: string;
  linkedPersonId?: number | null;
  linkedPersonName?: string;
  linkedAgencyId?: number | null;
  linkedAgencyName?: string;
  matchConfidence?: number;
  syncedToPersonNotes?: boolean;
}

export interface AppToastItem {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  createdAt: number;
}

export interface AssistantSlotSession {
  intent: 'add_person' | 'update_person' | 'archive_person' | 'export_sandbox' | 'manage_expense';
  collectedArgs: Record<string, unknown>;
  missingSlot: 'agencyId' | 'individuals' | 'personId' | 'amountIqd' | 'format';
  originalPrompt: string;
}

export interface AssistantResultCardBar {
  label: string;
  value: number;
  max: number;
  displayValue: string;
  color?: string;
}

export interface AssistantResultCardPayload {
  title: string;
  summary: string;
  scorePercent?: number;
  scoreLabel?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  bars?: AssistantResultCardBar[];
  details?: string[];
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  isPinned?: boolean;
  engineUsed?: AssistantEngineSource;
  engineLabel?: string;
  modelId?: string;
  fromCache?: boolean;
  confidence?: number;
  canUndo?: boolean;
  undoUsed?: boolean;
  stealthExecuted?: boolean;
  gracefulLevel?: 'A' | 'B' | 'C';
  choices?: AssistantChoiceChip[];
  confirmationDiff?: AssistantBeforeAfterDiff;
  pendingDraftId?: string;
  spotlightAction?: {
    label: string;
    view: AppView;
    settingsSection?: SettingsSectionId;
    targetId: string;
  };
  sandboxNotice?: string;
  diagnosticsReport?: DiagnosticSummary;
  resultCard?: AssistantResultCardPayload;
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

export type MorrowCanvasMode =
  | 'overview_charts'
  | 'editable_table'
  | 'executive_report'
  | 'forecast'
  | 'text_analysis'
  | 'macro_studio';

export interface MorrowChartSeriesItem {
  id: string;
  agencyId: number;
  label: string;
  icon: string;
  activeHouseholds: number;
  blockedCount: number;
  activeIndividuals: number;
  fullBags: number;
  remainderKg: number;
  revenue: number;
  totalExpenses: number;
  profit: number;
  sharePercent: number;
}

export interface MorrowProactiveInsight {
  id: string;
  severity: 'high' | 'medium' | 'info';
  category: 'forecast' | 'anomaly' | 'backup' | 'audit' | 'opportunity';
  title: string;
  detail: string;
  metricLabel?: string;
  resolutionMode: 'summon_canvas' | 'navigate_spotlight';
  targetCanvasMode?: MorrowCanvasMode;
  targetView?: AppView;
  targetAgencyId?: number;
  targetId?: string;
  promptToRun?: string;
}

export interface MorrowEditableRowDraft {
  personId: number;
  name: string;
  agencyId: number;
  agencyName: string;
  originalIndividuals: number;
  individuals: number;
  originalBlockType: BlockScope;
  blockType: BlockScope;
  originalNotes: string;
  notes: string;
}

export interface MorrowExecutiveReport {
  id: string;
  title: string;
  generatedAt: string;
  periodLabel: string;
  scopeLabel: string;
  summaryPoints: string[];
  agencyRows: MorrowChartSeriesItem[];
  totals: {
    registeredHouseholds: number;
    activeHouseholds: number;
    blockedCount: number;
    activeIndividuals: number;
    fullBags: number;
    remainderKg: number;
    revenue: number;
    totalExpenses: number;
    profit: number;
  };
}

export interface MorrowAgencyForecast {
  agencyId: number;
  agencyName: string;
  currentIndividuals: number;
  projectedIndividuals: number;
  currentBags: number;
  projectedBags: number;
  changePercent: number;
  riskLevel: 'low' | 'medium' | 'high';
  note: string;
}

export interface MorrowForecastReport {
  id: string;
  horizonLabel: string;
  baselineLabel: string;
  projectedIndividuals: number;
  deltaIndividuals: number;
  deltaPercent: number;
  projectedBags: number;
  projectedRevenue: number;
  projectedProfit: number;
  trendDirection: 'up' | 'down' | 'stable';
  agencyForecasts: MorrowAgencyForecast[];
  recommendations: string[];
}

export interface MorrowTextExtractedEntry {
  id: string;
  rawLine: string;
  candidateName: string;
  extractedIndividuals: number | null;
  matchedPersonId: number | null;
  matchedPersonName: string | null;
  matchedAgencyId: number | null;
  matchedAgencyName: string | null;
  actionHint: 'update_individuals' | 'block_full' | 'add_person' | 'note';
  confidence: number;
}

export interface MorrowTextAnalysisResult {
  id: string;
  rawText: string;
  analyzedAt: string;
  usedCloudAi: boolean;
  summary: string;
  entries: MorrowTextExtractedEntry[];
}

export type MorrowMacroStepAction =
  | 'run_diagnostics'
  | 'compute_forecast'
  | 'generate_report'
  | 'stage_auto_fixes'
  | 'prepare_backup'
  | 'prepare_archive_month';

export interface MorrowMacroDefinition {
  id: string;
  name: string;
  triggerPhrase: string;
  description: string;
  builtIn?: boolean;
  steps: MorrowMacroStepAction[];
}

export interface MorrowMacroStepTrace {
  action: MorrowMacroStepAction;
  label: string;
  status: 'done' | 'staged_draft' | 'warning';
  detail: string;
}

export interface MorrowMacroExecutionResult {
  macroId: string;
  macroName: string;
  executedAt: string;
  steps: MorrowMacroStepTrace[];
  report?: MorrowExecutiveReport;
  forecast?: MorrowForecastReport;
  diagnosticsSummary?: DiagnosticSummary;
  stagedDraftTools: AssistantToolCall[];
}

export interface MorrowSummonNavigateDecision {
  mode: 'summon_canvas' | 'navigate_spotlight' | 'chat_standard';
  canvasMode?: MorrowCanvasMode;
  targetAgencyId?: number | null;
  targetView?: AppView;
  settingsSection?: SettingsSectionId;
  targetDomId?: string;
  title: string;
  reason: string;
}

export interface MorrowLiveAgencyDigest {
  id: number;
  name: string;
  activeHouseholds: number;
  activeIndividuals: number;
  blockedCount: number;
  fullBags: number;
  remainderKg: number;
  revenueIqd: number;
  expensesIqd: number;
  profitIqd: number;
}

export interface MorrowLiveWorkspaceContext {
  periodName: string;
  feePerIndividualIqd: number;
  fixedCardFeeIqd: number;
  kgPerIndividual: number;
  kgPerBag: number;
  roundingStepIqd: number;
  discountPercent: number;
  totalRegisteredHouseholds: number;
  totalActiveHouseholds: number;
  totalActiveIndividuals: number;
  totalBlockedCount: number;
  totalFullBags: number;
  totalKg: number;
  totalRevenueIqd: number;
  totalExpensesIqd: number;
  totalProfitIqd: number;
  archivesCount: number;
  latestArchiveName: string | null;
  quickNotesCount: number;
  pendingDraftsCount: number;
  agenciesBreakdown: MorrowLiveAgencyDigest[];
}

export interface MorrowSystemCheckItem {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

export interface MorrowSystemVerificationReport {
  checkedAt: string;
  allPassed: boolean;
  activeModelLabel: string;
  boundAgenciesCount: number;
  boundPersonsCount: number;
  checks: MorrowSystemCheckItem[];
}

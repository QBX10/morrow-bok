export type AppModeTier =
  | 'beginner'
  | 'intermediate'
  | 'professional'
  | 'expert';

export type AppView =
  | 'hub'
  | 'agency_roster'
  | 'master_roster'
  | 'ready_lists'
  | 'relationships'
  | 'finance'
  | 'quick_extract'
  | 'data_archives'
  | 'settings';

export type FreeformHeaderAlign = 'right' | 'center' | 'left';
export type FreeformHeaderSize = 'sm' | 'md' | 'lg' | 'xl';
export type FreeformHeaderStylePreset =
  | 'classic_official'
  | 'accent_frame'
  | 'minimal_divider'
  | 'dark_ledger';

export interface PeriodQuotaMeta {
  fullDate: string; // YYYY-MM-DD
  year: number;
  monthNumber: number; // 1..12
  monthName: string;
  quotaName: string;
  quotaNumber: string;
  quotaDate: string; // YYYY-MM-DD
}

export interface FreeformHeaderConfig {
  topCustomTitle?: string;
  freeSubtitles?: string[];
  subtitlesLayout?: 'stacked' | 'inline';
  align?: FreeformHeaderAlign;
  size?: FreeformHeaderSize;
  stylePreset?: FreeformHeaderStylePreset;
  customColor?: string;
  borderColor?: string;
  showPeriodCard?: boolean;
}

export type RelationCategory =
  | 'favorites'
  | 'edit_later'
  | 'reminder'
  | 'delivery_notes'
  | 'pending_audit';

export interface RelationEntry {
  id: number;
  personId: number;
  personName: string;
  agencyId: number;
  category: RelationCategory;
  note: string;
  reminderDate?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SectionTableHeaderMeta {
  title: string;
  subtitle: string;
  date: string;
  autoUpdateDate: boolean;
  lastUpdatedAt: string;
  periodMeta?: PeriodQuotaMeta;
  freeformHeader?: FreeformHeaderConfig;
}

export type TopBarFocusMode = 'normal' | 'compact' | 'hidden';
export type TopBarAutoFocusAction = 'compact' | 'hide';

export interface TopBarConfig {
  mode: TopBarFocusMode;
  autoFocus: boolean;
  autoFocusAction?: TopBarAutoFocusAction;
  autoHideInTables?: boolean;
  showViewTitle?: boolean;
  showQuickFocusToggle?: boolean;
  showUndoRedo?: boolean;
  showAuthButton?: boolean;
}

export type AuthProviderType = 'google' | 'username' | 'phone';

export interface AuthUser {
  uid: string;
  provider: AuthProviderType;
  displayName: string;
  email?: string;
  username?: string;
  phone?: string;
  role: 'manager' | 'viewer';
}

export interface Agency {
  id: number;
  name: string;
  icon: string;
  isLocked: boolean;
}

export type BlockScope = 'none' | 'partial' | 'full' | 'archived';

export interface Person {
  id: number;
  agencyId: number;
  name: string;
  nationalId: string;
  individuals: number | null;
  legacyQuantity?: string;
  blockType: BlockScope;
  blockedIndividuals: number;
  blockReason: string;
  status: '' | 'محجوب' | 'مؤرشف';
  notes: string;
  decreaseCount?: number;
  addOrDeleteCount?: number;
  addOrDeleteAction?: 'إضافة' | 'حذف' | 'لا يوجد';
  customCategory?: string;
  customFields?: Record<string, string>;
  cleanFamilyUnderline?: boolean;
  updatedAt: string;
}

export type ExpenseCategory = 'worker_wages' | 'general';

export interface AgencyExpense {
  id: number;
  agencyId: number;
  description: string;
  amountIqd: number;
  category: ExpenseCategory;
  occurredAt: string;
}

export type CoreColumnKey =
  | 'serial'
  | 'letter'
  | 'name'
  | 'agency'
  | 'category'
  | 'individuals'
  | 'quantity'
  | 'price'
  | 'status'
  | 'notes';

export type ColumnKey = CoreColumnKey | string;

export interface ExpertCustomColumn {
  id: string;
  label: string;
  type: 'text' | 'number';
}

export interface ExpertTableConfig {
  visibleColumns: string[];
  columnOrder: string[];
  columnLabels: Record<string, string>;
  customCategories: string[];
  customColumns: ExpertCustomColumn[];
  allowDirectNoConfirmEdit: boolean;
}

export interface CalculationSettings {
  kgPerIndividual: number;
  kgPerBag: number;
  feePerIndividualIqd: number;
  fixedCardFeeIqd: number;
  calculationMode?: 'instant' | 'manual';
  includeBlockedInFees?: boolean;
  roundingStepIqd?: number;
  discountPercent?: number;
  defaultWorkerWageIqd?: number;
  defaultGeneralExpenseIqd?: number;
}

export interface ReadyList {
  id: number;
  agencyId: number;
  name: string;
  listDate: string;
  subtitle1: string;
  subtitle2: string;
  autoUpdateDate?: boolean;
  lastUpdatedAt?: string;
  createdAt: string;
  note: string;
  periodMeta?: PeriodQuotaMeta;
  freeformHeader?: FreeformHeaderConfig;
}

export interface ReadyListItem {
  id: number;
  listId: number;
  position: number;
  sourcePersonId: number | null;
  name: string;
  nationalId?: string;
  individuals: number | null;
  blockType?: BlockScope;
  blockedIndividuals?: number;
  blockReason?: string;
  status: '' | 'محجوب' | 'مؤرشف';
  notes: string;
  isOverridden?: boolean;
}

export type QuickExtractLegibility = 'clear' | 'needs_review' | 'rejected';

export type QuickExtractCaptureMode = 'pdf' | 'camera_burst';

export type QuickExtractScanMode = 'fast' | 'audit';

export type QuickExtractFocusField =
  | 'name'
  | 'individuals'
  | 'decreaseCount'
  | 'addOrDelete';

export interface NormalizedBox {
  ymin: number; // 0..1000
  xmin: number; // 0..1000
  ymax: number; // 0..1000
  xmax: number; // 0..1000
}

export interface QuickExtractTemplateRegion {
  id: string;
  field: QuickExtractFocusField;
  label: string;
  box: NormalizedBox;
}

export interface QuickExtractReferenceTemplate {
  id: string;
  name: string;
  createdAt: string;
  imageDataUrl: string;
  mimeType: string;
  notes?: string;
  regions: QuickExtractTemplateRegion[];
}

export interface QuickExtractPrefs {
  defaultScanMode: QuickExtractScanMode;
  focusedFields: QuickExtractFocusField[];
  clarityThreshold: number;
  referenceTemplates: QuickExtractReferenceTemplate[];
  activeTemplateId: string | null;
}

export interface QuickExtractSuspectSpan {
  word: string;
  reason: string;
}

export interface QuickExtractSuspectSegment {
  word: string;
  wordIndex: number;
  uncertainChars: string[];
  reason: string;
}

export interface QuickExtractRawRow {
  rowIndex: number;
  pageNumber: number;
  name: string | null;
  individuals: number | null;
  decreaseCount: number | null;
  addOrDeleteCount: number | null;
  addOrDeleteAction: 'إضافة' | 'حذف' | 'لا يوجد' | 'غير محدد';
  nameConfidence: number;
  numbersConfidence: number;
  modelDoubtFlag: boolean;
  modelDoubtReason: string;
  rawSnippet: string;
  suspectSpans?: QuickExtractSuspectSpan[];
  suspectBox?: NormalizedBox;
}

export interface QuickExtractEvaluatedRow extends QuickExtractRawRow {
  id: string;
  sourceMode: QuickExtractCaptureMode;
  hasDoubt: boolean;
  doubtReasons: string[];
  doubtConfirmed: boolean;
  suspectSegments: QuickExtractSuspectSegment[];
  mathIssues: string[];
  mathConfirmed: boolean;
  missingFields: Array<
    'name' | 'individuals' | 'decreaseCount' | 'addOrDeleteCount'
  >;
  isComplete: boolean;
  resolvedName: string;
  resolvedIndividuals: number | null;
  resolvedDecreaseCount: number | null;
  resolvedAddOrDeleteCount: number | null;
  resolvedAddOrDeleteAction: 'إضافة' | 'حذف' | 'لا يوجد';
  notes?: string;
}

export interface QuickExtractAnalysisResult {
  status: QuickExtractLegibility;
  sourceMode: QuickExtractCaptureMode;
  scanMode?: QuickExtractScanMode;
  focusedFields?: QuickExtractFocusField[];
  clarityScore: number;
  pageCount: number;
  rejectionReasons: string[];
  documentSummary: string;
  rows: QuickExtractEvaluatedRow[];
  sourceImageUrls?: Record<number, string>;
}

export type QuickExtractMergeStrategy =
  | 'add_new'
  | 'update_matched'
  | 'replace';

export type QuickExtractDestinationKind =
  | 'agency'
  | 'master_roster'
  | 'existing_ready_list'
  | 'ready_list';

export interface QuickExtractReadyListMeta {
  name: string;
  listDate: string;
  subtitle1: string;
  subtitle2: string;
  autoUpdateDate: boolean;
}

export interface QuickExtractDestinationSpec {
  kind: QuickExtractDestinationKind;
  agencyId: number;
  existingReadyListId?: number;
  mergeStrategy?: QuickExtractMergeStrategy;
  readyListMeta: QuickExtractReadyListMeta;
}

export type QuickExtractRuleCondition =
  | 'has_addition'
  | 'has_decrease'
  | 'has_deletion'
  | 'name_contains'
  | 'individuals_gte'
  | 'individuals_lte'
  | 'matched_existing'
  | 'unmatched_new';

export interface QuickExtractRoutingRule {
  id: string;
  enabled: boolean;
  label: string;
  condition: QuickExtractRuleCondition;
  textValue?: string;
  numberValue?: number;
  mergeStrategy: QuickExtractMergeStrategy;
  destination: QuickExtractDestinationSpec;
}

export interface QuickExtractRowRouteOverride {
  excluded?: boolean;
  destination?: QuickExtractDestinationSpec;
  mergeStrategy?: QuickExtractMergeStrategy;
}

export interface QuickExtractRoutingConfig {
  mode: 'single' | 'split_by_change' | 'custom_rules';
  mergeStrategy: QuickExtractMergeStrategy;
  primaryDestination: QuickExtractDestinationSpec;
  additionsDestination: QuickExtractDestinationSpec;
  decreasesDestination: QuickExtractDestinationSpec;
  customRules?: QuickExtractRoutingRule[];
  rowOverrides?: Record<string, QuickExtractRowRouteOverride>;
}

export interface QuickExtractCommitBucketSummary {
  destinationLabel: string;
  destinationKind: QuickExtractDestinationKind;
  agencyId?: number;
  readyListId?: number;
  added: number;
  updated: number;
  replaced: number;
}

export interface QuickExtractCommitSummary {
  totalRows: number;
  added: number;
  updated: number;
  replaced: number;
  buckets: QuickExtractCommitBucketSummary[];
}

export interface AuditIssue {
  id: string;
  severity: 'high' | 'medium';
  personId: number;
  personName: string;
  agencyId: number;
  message: string;
}

export type AppThemeId =
  | 'midnight-slate'
  | 'warm-paper'
  | 'crisp-daylight'
  | 'charcoal-emerald'
  | 'nordic-navy'
  | 'soft-mint';

export type TableThemeId =
  | 'classic-quota'
  | 'financial-audit'
  | 'pdf-reader'
  | 'high-contrast'
  | 'compact-modern';

export type ArabicFontId =
  | 'ibm-plex'
  | 'cairo'
  | 'tajawal'
  | 'noto-sans';

export type FontSizeStep = 'sm' | 'md' | 'lg' | 'xl';
export type FontWeightStep = 'light' | 'normal' | 'bold';
export type RowDensityStep = 'compact' | 'comfortable' | 'spacious';

export interface ThemePreferences {
  appTheme: AppThemeId;
  tableTheme: TableThemeId;
  fontFamily: ArabicFontId;
  fontSize: FontSizeStep;
  fontWeight: FontWeightStep;
  rowDensity: RowDensityStep;
  tabularNumerals: boolean;
  rowHoverHighlight: boolean;
  stickyHeaderAndName: boolean;
  compactStatusBadges: boolean;
  smartNumericSplit: boolean;
  softGroupDividers: boolean;
  activeRowFocusMode: boolean;
}

export type SettingsSectionId =
  | 'appearance'
  | 'fonts'
  | 'modes'
  | 'calculator'
  | 'general'
  | 'quick_extract_settings'
  | 'relations_lists'
  | 'security_data';

export interface RelationsReadyListsPrefs {
  defaultExportFormat: 'excel' | 'pdf' | 'text' | 'image';
  defaultReminderLeadDays: number;
  enableReminderAlerts: boolean;
  autoUpdateReadyListDate: boolean;
  defaultDeliveryNotePrefix: string;
}

export interface GeneralAppPrefs {
  confirmBeforeDelete: boolean;
  confirmBeforeEdit: boolean;
  undoLimit: number;
  showActionAlerts: boolean;
  compactNumbers: boolean;
}

export interface SecurityPrefs {
  privacyPin: string;
  privacyLocked: boolean;
  offlineCacheEnabled: boolean;
}

export type RecycleBinItemKind =
  | 'person'
  | 'ready_list'
  | 'relation'
  | 'expense';

export interface RecycleBinEntry {
  id: string;
  kind: RecycleBinItemKind;
  label: string;
  deletedAt: string;
  payload:
    | { kind: 'person'; person: Person }
    | { kind: 'ready_list'; list: ReadyList; items: ReadyListItem[] }
    | { kind: 'relation'; relation: RelationEntry }
    | { kind: 'expense'; expense: AgencyExpense };
}

export interface MonthlyArchiveSummary {
  totalAgencies: number;
  totalHouseholds: number;
  activeHouseholds: number;
  totalIndividuals: number;
  totalKg: number;
  totalRevenueIqd: number;
  totalExpensesIqd: number;
}

export interface MonthlyArchiveRecord {
  id: string;
  label: string;
  createdAt: string;
  closedAt?: string;
  isClosed: boolean;
  archiveSource: 'manual' | 'auto';
  syncedToCloudAt?: string;
  periodMeta: PeriodQuotaMeta;
  freeformHeader?: FreeformHeaderConfig;
  agencies: Agency[];
  persons: Person[];
  readyLists: ReadyList[];
  readyListItems: ReadyListItem[];
  expenses: AgencyExpense[];
  relations: RelationEntry[];
  tableHeaders: Record<string, SectionTableHeaderMeta>;
  calculationSettings: CalculationSettings;
  summary: MonthlyArchiveSummary;
}

export interface AppDatabaseState {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  readyLists: ReadyList[];
  readyListItems: ReadyListItem[];
  relations: RelationEntry[];
  tableHeaders: Record<string, SectionTableHeaderMeta>;
  topBarConfig: TopBarConfig;
  modeTier: AppModeTier;
  editorEnabled: boolean;
  darkTheme: boolean;
  calculationSettings: CalculationSettings;
  requireLoginOnStart: boolean;
  activePeriod?: PeriodQuotaMeta;
  monthlyArchives?: MonthlyArchiveRecord[];
  themePrefs?: ThemePreferences;
  expertTableConfig?: ExpertTableConfig;
  quickExtractPrefs?: QuickExtractPrefs;
  relationsPrefs?: RelationsReadyListsPrefs;
  generalPrefs?: GeneralAppPrefs;
  securityPrefs?: SecurityPrefs;
  recycleBin?: RecycleBinEntry[];
}

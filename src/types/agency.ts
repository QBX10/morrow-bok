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
  | 'google_workspace'
  | 'morrow_center'
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
  avatarUrl?: string;
  role: 'manager' | 'viewer';
}

export interface Agency {
  id: number;
  name: string;
  icon: string;
  logoDataUrl?: string;
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

export interface ExpertColumnPreset {
  id: string;
  name: string;
  visibleColumns: string[];
  columnOrder: string[];
  pinnedColumnId?: string | null;
  isBuiltIn?: boolean;
}

export interface ExpertTableConfig {
  visibleColumns: string[];
  columnOrder: string[];
  columnLabels: Record<string, string>;
  customCategories: string[];
  customColumns: ExpertCustomColumn[];
  allowDirectNoConfirmEdit: boolean;
  pinnedColumnId?: string | null;
  columnPresets?: ExpertColumnPreset[];
  activePresetId?: string | null;
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

export interface InferredDocumentMetadata {
  agencyName: string | null;
  agencyNameConfidence: number;
  matchedAgencyId?: number | null;
  tableDateLabel: string | null;
  tableDateConfidence: number;
  centerOrAgencyNumber: string | null;
  centerNumberConfidence: number;
  headerSnippet?: string;
  confirmedByUser: boolean;
}

export interface QuickExtractRawRow {
  rowIndex: number;
  pageNumber: number;
  name: string | null;
  individuals: number | null;
  decreaseCount: number | null;
  addOrDeleteCount: number | null;
  addOrDeleteAction: 'إضافة' | 'حذف' | 'لا يوجد' | 'غير محدد';
  rowDate?: string | null;
  nameConfidence: number;
  numbersConfidence: number;
  dateConfidence?: number;
  modelDoubtFlag: boolean;
  modelDoubtReason: string;
  rawSnippet: string;
  suspectSpans?: QuickExtractSuspectSpan[];
  suspectBox?: NormalizedBox;
  rowBox?: NormalizedBox;
  notes?: string;
}

export type ZeroTrustCellStatus = 'verified' | 'yellow' | 'red';

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
  resolvedRowDate?: string;
  zeroTrustNameStatus?: ZeroTrustCellStatus;
  zeroTrustNumbersStatus?: ZeroTrustCellStatus;
  zeroTrustDateStatus?: ZeroTrustCellStatus;
  zeroTrustConfirmed?: boolean;
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
  sourcePdfUrl?: string;
  inferredMetadata?: InferredDocumentMetadata | null;
}

// --- Universal Cognitive Reading & Progressive Comprehension System (UCRS) ---

export type UcrsSourceKind =
  | 'pdf'
  | 'image'
  | 'image_batch'
  | 'camera_burst'
  | 'word'
  | 'excel'
  | 'csv'
  | 'text';

export type UcrsContentType =
  | 'جدول مستفيدين'
  | 'قائمة أسماء'
  | 'دفتر يدوي'
  | 'كتاب / مقال'
  | 'فاتورة'
  | 'وثيقة رسمية'
  | 'صفحة ويب / لقطة شاشة'
  | 'بيانات عامة';

export type UcrsRelevanceLevel =
  | 'important'
  | 'useful'
  | 'neutral'
  | 'irrelevant';

export type UcrsIntentMode =
  | 'discover'
  | 'extract_all'
  | 'extract_useful'
  | 'semantic_search'
  | 'understand_book'
  | 'focus_notes'
  | 'custom';

export interface UcrsHypothesis {
  label: string;
  probability: number; // 0..100
  suggestedFix: string;
}

export interface UcrsDiagnosticEntry {
  id: string;
  targetId: string;
  targetLabel: string;
  layer: 'intake' | 'classification' | 'extraction' | 'coverage' | 'math';
  severity: 'info' | 'warning' | 'critical';
  whyMessage: string;
  reasoningChain: string[];
  hypotheses: UcrsHypothesis[];
}

export interface UcrsCoverageRegion {
  id: string;
  pageNumber: number;
  label: string;
  state: 'confident' | 'doubtful' | 'unreadable' | 'skipped';
  box: NormalizedBox;
  extractedText?: string;
  reason?: string;
}

export interface UcrsSmartCoverage {
  overallPercent: number;
  contentCoveragePercent: number;
  itemsCoveragePercent: number;
  fieldsCoverage: {
    namePercent: number;
    individualsPercent: number;
    decreasePercent: number;
    addOrDeletePercent: number;
    notesPercent: number;
  };
  qualityCoveragePercent: number;
  totalEstimatedItems: number;
  confidentCount: number;
  doubtfulCount: number;
  unreadableCount: number;
  missingHint: string;
}

export interface UcrsContentIdentity {
  contentType: UcrsContentType;
  topic: string;
  qualityLabel: 'واضح' | 'متوسط' | 'صعب' | 'غير مقروء';
  qualityScore: number; // 0..100
  relevanceLevel: UcrsRelevanceLevel;
  relevanceReasons: string[];
  languageSummary: string;
  estimatedTotalRows: number;
  estimatedColumns: number;
  estimatedConfidentCount: number;
  estimatedDoubtfulCount: number;
  estimatedUnreadableCount: number;
  wordCount: number;
  detectedNamesCount: number;
  detectedDates: string[];
  detectedLocations: string[];
  opinionAndRecommendation: string;
  suggestedActions: Array<{
    id: string;
    label: string;
    intent: UcrsIntentMode;
  }>;
}

export interface UcrsReadingPlan {
  intent: UcrsIntentMode;
  customCommand?: string;
  willExtract: string[];
  willIgnore: string[];
  minCoverageThreshold: number; // e.g. 90
  autoApplyLearningRules: boolean;
  approved: boolean;
}

export interface UcrsExtractedTextEntity {
  id: string;
  kind: 'name' | 'number' | 'date' | 'location' | 'note' | 'paragraph';
  text: string;
  context: string;
  pageNumber: number;
  rowOrLineIndex: number;
  confidence: number; // 0..1
  relevance: UcrsRelevanceLevel;
  relevanceReason: string;
  box?: NormalizedBox;
}

export interface UcrsSourceRecord {
  id: string;
  label: string;
  kind: UcrsSourceKind;
  addedAt: string;
  clarityScore: number;
  pageCount: number;
  previewDataUrl?: string;
  rawTextExcerpt?: string;
}

export interface UcrsLearningRule {
  id: string;
  wrongToken: string;
  correctedToken: string;
  sourceContext: string;
  usageCount: number;
  createdAt: string;
  enabled: boolean;
}

export interface UcrsFusionDiff {
  addedAt: string;
  sourceLabel: string;
  newlyRecoveredCount: number;
  upgradedFromDoubtCount: number;
  duplicatesSkippedCount: number;
  previousCoveragePercent: number;
  newCoveragePercent: number;
  remainingUnreadableCount: number;
  summaryMessage: string;
}

export interface UcrsSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'scanning' | 'in_progress' | 'needs_completion' | 'ready' | 'committed' | 'rejected';
  sources: UcrsSourceRecord[];
  identity: UcrsContentIdentity | null;
  plan: UcrsReadingPlan;
  rows: QuickExtractEvaluatedRow[];
  entities: UcrsExtractedTextEntity[];
  coverage: UcrsSmartCoverage;
  coverageRegions: UcrsCoverageRegion[];
  diagnostics: UcrsDiagnosticEntry[];
  documentSummary: string;
  inferredMetadata?: InferredDocumentMetadata | null;
  lastFusionDiff?: UcrsFusionDiff | null;
  coverageOverrideNote?: string;
  committedAt?: string;
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

export type ClassicAppThemeId =
  | 'obsidian-gold'
  | 'aurora'
  | 'cyberpunk'
  | 'desert-mirage'
  | 'arctic-snow'
  | 'emerald-forest'
  | 'royal-crimson'
  | 'zen-minimal';

export type ModernAppThemeId =
  | 'alabaster-glass'
  | 'nordic-dusk'
  | 'sage-linen'
  | 'midnight-indigo';

export type AppThemeId = ClassicAppThemeId | ModernAppThemeId;

export type TableThemeId =
  | 'glass'
  | 'paper-ledger'
  | 'data-grid'
  | 'royal-executive'
  | 'pastel-blocks'
  | 'minimalist-lines'
  | 'neon-matrix'
  | 'card-based';

export type ArabicFontId =
  | 'cairo'
  | 'tajawal'
  | 'almarai'
  | 'changa'
  | 'el-messiri'
  | 'ibm-plex';

export type FontSizeStep = 'sm' | 'md' | 'lg' | 'xl';
export type FontWeightStep = 'light' | 'normal' | 'bold';
export type RowDensityStep = 'compact' | 'comfortable' | 'spacious';
export type CardShadowLevel = 'none' | 'soft' | 'elevated';

export interface ConditionalFormattingPrefs {
  highlightBlockedRows: boolean;
  highlightDuplicateNames: boolean;
  highlightZeroIndividuals: boolean;
}

export interface AppearanceProfile {
  id: string;
  name: string;
  appTheme: AppThemeId;
  tableTheme: TableThemeId;
  fontFamily: ArabicFontId;
  fontSizePx: number;
  rowHeightPx: number;
  colWidthScale: number;
  borderRadiusPx: number;
  cardShadowLevel: CardShadowLevel;
  glassEffect: boolean;
  customBgColor?: string;
  customSurfaceColor?: string;
  customTextColor?: string;
  customAccentColor?: string;
  conditionalFormatting?: ConditionalFormattingPrefs;
  createdAt?: string;
}

export type ThemeColorMode = 'dark' | 'light' | 'auto';

export interface CustomThemePreset {
  id: string;
  name: string;
  isDark: boolean;
  bgMain: string;
  bgSurface: string;
  textPrimary: string;
  accent: string;
  borderRadiusPx: number;
  glassOpacityPct: number;
  cardShadowLevel: CardShadowLevel;
  createdAt: string;
}

export interface ThemePreferences {
  appTheme: AppThemeId;
  tableTheme: TableThemeId;
  fontFamily: ArabicFontId;
  fontSize: FontSizeStep;
  fontWeight: FontWeightStep;
  rowDensity: RowDensityStep;
  fontSizePx?: number;
  rowHeightPx?: number;
  colWidthScale?: number;
  borderRadiusPx?: number;
  cardShadowLevel?: CardShadowLevel;
  glassEffect?: boolean;
  glassOpacityPct?: number;
  themeColorMode?: ThemeColorMode;
  customBgColor?: string;
  customSurfaceColor?: string;
  customTextColor?: string;
  customAccentColor?: string;
  customSavedThemes?: CustomThemePreset[];
  conditionalFormatting?: ConditionalFormattingPrefs;
  savedProfiles?: AppearanceProfile[];
  activeProfileId?: string | null;
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
  | 'security_data'
  | 'ai_assistant'
  | 'system_map';

export type UiDensity = 'comfortable' | 'balanced' | 'compact';

export interface GranularControlPrefs {
  readonlyPdfMode: boolean;
  enableSortAndFilter: boolean;
  enableFinance: boolean;
  enableManageFinance: boolean;
  enableQuickExtract: boolean;
  enableEditRecords: boolean;
  enableReadyListBuilder: boolean;
  enableAgencyManagement: boolean;
  enableSmartAudit: boolean;
  enableExcelTools: boolean;
  enableColumnCustomization: boolean;
  enableCustomCategories: boolean;
  enableBulkEdit: boolean;
  bypassEditConfirm: boolean;
}

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
  settingsDisplayMode?: 'fullscreen' | 'contained';
  uiDensity?: UiDensity;
  granularControls?: GranularControlPrefs;
  hubShortcutIds?: string[];
  quickToggleIds?: string[];
  agencyAccentColors?: Record<number, string>;
  dismissedAttentionIds?: string[];
}

export interface SecurityPrefs {
  privacyPin: string;
  privacyLocked: boolean;
  offlineCacheEnabled: boolean;
  allowCloudBeneficiaryNames?: boolean;
  autoLockMinutes?: 0 | 5 | 15 | 30;
  quickUnlockHintEnabled?: boolean;
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

export type CosmosNumeralSystem = 'western' | 'hindi';
export type CosmosCalendarSystem = 'gregorian' | 'hijri';
export type CosmosExperienceMode = 'simple' | 'expert';
export type CosmosWorldId =
  | 'world_agencies_tables'
  | 'world_themes'
  | 'world_calculator'
  | 'world_fonts_typography'
  | 'world_quick_extract'
  | 'world_ready_lists'
  | 'world_relations_finance'
  | 'world_archives'
  | 'world_morrow_ai'
  | 'world_google'
  | 'world_security_backup'
  | 'world_general_access'
  | 'world_health_kpi'
  | 'world_legacy_archive';

export interface AccessibilityAndExperiencePrefs {
  experienceMode: CosmosExperienceMode;
  reduceMotion: boolean;
  hapticFeedback: boolean;
  soundFeedback: boolean;
  oneHandedMode: boolean;
  numeralSystem: CosmosNumeralSystem;
  calendarSystem: CosmosCalendarSystem;
  simpleCalculatorTestIndividuals: number;
  developerMode: boolean;
  onboardingCompleted: boolean;
}

export interface WorldChangeLogEntry {
  id: string;
  worldId: string;
  settingId?: string;
  label: string;
  beforeValue?: string;
  afterValue?: string;
  timestamp: string;
}

export interface FeatureFlagsMap {
  orbitalMapView: boolean;
  smartUsageSuggestions: boolean;
  longPressPeek: boolean;
  safeTrialTenSeconds: boolean;
  voiceCommandsIq: boolean;
  tactileAudioCues: boolean;
}

export interface WorkspaceCosmosState {
  pinnedNodeIds: string[];
  recentNodeIds: string[];
  hiddenWorldIds: string[];
  dismissedSuggestionIds: string[];
  accessibility: AccessibilityAndExperiencePrefs;
  featureFlags: FeatureFlagsMap;
  changeLog: WorldChangeLogEntry[];
  activeCalcPresetId?: string | null;
  dismissedAiAlertIds?: string[];
  pinnedAiMessageIds?: string[];
}

export interface MigrationSnapshotRecord {
  version: number;
  createdAt: string;
  reason: string;
  modeTier?: AppModeTier;
  editorEnabled?: boolean;
  calculationSettings: CalculationSettings;
  themePrefs?: ThemePreferences;
  generalPrefs?: GeneralAppPrefs;
  securityPrefs?: SecurityPrefs;
}

export interface AppDatabaseState {
  stateVersion?: number;
  migrationSnapshot?: MigrationSnapshotRecord;
  workspaceCosmos?: WorkspaceCosmosState;
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
  ucrsSessions?: UcrsSession[];
  ucrsLearningRules?: UcrsLearningRule[];
}

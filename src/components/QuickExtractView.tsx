import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  FileSearch,
  FileText,
  FileWarning,
  Filter,
  FolderClock,
  Layers,
  Loader2,
  Lock,
  MousePointerSquareDashed,
  Redo2,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Undo2,
  Upload,
  Volume2,
  Zap,
} from 'lucide-react';
import type {
  Agency,
  AppView,
  CalculationSettings,
  NormalizedBox,
  Person,
  QuickExtractAnalysisResult,
  QuickExtractCommitSummary,
  QuickExtractDestinationSpec,
  QuickExtractEvaluatedRow,
  QuickExtractFocusField,
  QuickExtractPrefs,
  QuickExtractRawRow,
  QuickExtractReferenceTemplate,
  QuickExtractRoutingConfig,
  QuickExtractScanMode,
  ReadyList,
  ReadyListItem,
  RelationCategory,
  RelationEntry,
  ThemePreferences,
  UcrsContentIdentity,
  UcrsCoverageRegion,
  UcrsExtractedTextEntity,
  UcrsIntentMode,
  UcrsLearningRule,
  UcrsReadingPlan,
  UcrsSession,
  UcrsSourceRecord,
} from '../types/agency';
import { normalizeArabic } from '../utils/agencyLogic';
import type { BurstFusionSummary } from '../utils/ledgerImageProcessor';
import {
  ALL_QUICK_EXTRACT_FIELDS,
  buildArabicNameTree,
  computeAdjustedIndividuals,
  computeQuickExtractRoutingPlan,
  evaluateExtractedRow,
  findExistingMatchInAgency,
  recomputeRowValidation,
  resolveFocusedFields,
} from '../utils/quickExtractEngine';
import { parseLocalStructuredDocument } from '../utils/ucrsDocParser';
import {
  applyLearningRulesToName,
  buildCoverageRegionsFromRows,
  buildDefaultReadingPlan,
  buildDiagnosticsForSession,
  classifyIntakeSource,
  computeSmartCoverage,
  extractLearningRuleFromCorrection,
  mergeSupplementaryExtraction,
} from '../utils/ucrsEngine';
import { CoreRosterTable, type CoreRosterRow } from './CoreRosterTable';
import {
  SelectionActionBar,
  type SelectablePersonRecord,
} from './SelectionActionBar';
import { BurstCameraCapture } from './quickExtract/BurstCameraCapture';
import { RedFlagDoubtSegment } from './quickExtract/RedFlagDoubtSegment';
import { ReferenceTemplateModal } from './quickExtract/ReferenceTemplateModal';
import { RoutingPanel } from './quickExtract/RoutingPanel';
import { UcrsCoverageAndSessionsPanel } from './quickExtract/UcrsCoverageAndSessionsPanel';
import { UcrsIdentityAndPlanCard } from './quickExtract/UcrsIdentityAndPlanCard';
import { UcrsReportsAndStatsModal } from './quickExtract/UcrsReportsAndStatsModal';
import { UcrsSemanticSearchPanel } from './quickExtract/UcrsSemanticSearchPanel';

interface QuickExtractViewProps {
  agencies: Agency[];
  persons: Person[];
  readyLists: ReadyList[];
  readyListItems?: ReadyListItem[];
  relations: RelationEntry[];
  calculationSettings: CalculationSettings;
  themePrefs: ThemePreferences;
  quickExtractPrefs: QuickExtractPrefs;
  defaultAgencyId: number;
  ucrsSessions?: UcrsSession[];
  ucrsLearningRules?: UcrsLearningRule[];
  onUpdateQuickExtractPrefs: (patch: Partial<QuickExtractPrefs>) => void;
  onSaveQuickExtractTemplate: (template: QuickExtractReferenceTemplate) => void;
  onCommitQuickExtractPlan: (params: {
    rows: QuickExtractEvaluatedRow[];
    routing: QuickExtractRoutingConfig;
  }) => QuickExtractCommitSummary;
  onMovePersonsToAgency: (personIds: number[], targetAgencyId: number) => void;
  onAddPersonsToReadyList: (listId: number, personIds: number[]) => number;
  onUpsertRelation: (input: {
    personId: number;
    category: RelationCategory;
    note: string;
    reminderDate?: string;
    deliveryAddress?: string;
    deliveryPhone?: string;
    deliveryTime?: string;
  }) => void;
  onUpsertUcrsSession?: (session: UcrsSession) => void;
  onDeleteUcrsSession?: (sessionId: string) => void;
  onUpsertUcrsLearningRule?: (rule: UcrsLearningRule) => void;
  onToggleUcrsLearningRule?: (ruleId: string) => void;
  onDeleteUcrsLearningRule?: (ruleId: string) => void;
  onDoneNavigateToAgency: (agencyId: number) => void;
  onNavigateToView: (view: AppView) => void;
}

type IntakeTabMode = 'pdf' | 'camera_burst' | 'universal_files';
type UcrsWorkspaceTab = 'pipeline' | 'identity_plan' | 'coverage_sessions' | 'semantic_search';

interface StoredSourcePayload {
  kind: 'pdf' | 'frames' | 'text';
  filename: string;
  base64Pdf?: string;
  frames?: Array<{ mimeType: string; data: string; label?: string }>;
  rawText?: string;
}

function createDefaultDestSpec(
  agencyId: number,
  labelPrefix = 'كشف السحب السريع',
  existingReadyListId?: number
): QuickExtractDestinationSpec {
  const today = new Date().toISOString().slice(0, 10);
  return {
    kind: 'agency',
    agencyId,
    existingReadyListId,
    readyListMeta: {
      name: `${labelPrefix} — ${today}`,
      listDate: today,
      subtitle1: 'مستخرج عبر السحب السريع',
      subtitle2: 'مراجع ومعتمد للترحيل',
      autoUpdateDate: false,
    },
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`تعذر قراءة الملف: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function compressImageDataUrl(rawUrl: string): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(120, Math.round(img.width * scale));
      canvas.height = Math.max(120, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: rawUrl, mimeType: 'image/jpeg' });
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', 0.9),
        mimeType: 'image/jpeg',
      });
    };
    img.onerror = () => resolve({ dataUrl: rawUrl, mimeType: 'image/jpeg' });
    img.src = rawUrl;
  });
}

const INTENT_OPTIONS: Array<{ id: UcrsIntentMode; label: string }> = [
  { id: 'extract_all', label: 'استخراج كامل' },
  { id: 'discover', label: 'اكتشاف وفهم المحتوى' },
  { id: 'extract_useful', label: 'استخراج ما يفيدني فقط' },
  { id: 'semantic_search', label: 'بحث دلالي' },
  { id: 'understand_book', label: 'فهم كتاب / وثيقة' },
  { id: 'focus_notes', label: 'الملاحظات والتوصيل فقط' },
  { id: 'custom', label: 'أمر مخصص' },
];

export const QuickExtractView: React.FC<QuickExtractViewProps> = ({
  agencies,
  persons,
  readyLists,
  readyListItems = [],
  relations,
  calculationSettings,
  themePrefs,
  quickExtractPrefs,
  defaultAgencyId,
  ucrsSessions = [],
  ucrsLearningRules = [],
  onUpdateQuickExtractPrefs,
  onSaveQuickExtractTemplate,
  onCommitQuickExtractPlan,
  onMovePersonsToAgency,
  onAddPersonsToReadyList,
  onUpsertRelation,
  onUpsertUcrsSession,
  onDeleteUcrsSession,
  onUpsertUcrsLearningRule,
  onToggleUcrsLearningRule,
  onDeleteUcrsLearningRule,
  onDoneNavigateToAgency,
  onNavigateToView,
}) => {
  const fallbackAgencyId = agencies[0]?.id ?? 1;
  const initialAgencyId = agencies.some((a) => a.id === defaultAgencyId)
    ? defaultAgencyId
    : fallbackAgencyId;

  const [captureMode, setCaptureMode] = useState<IntakeTabMode>('pdf');
  const [ucrsTab, setUcrsTab] = useState<UcrsWorkspaceTab>('pipeline');
  const [intentMode, setIntentMode] = useState<UcrsIntentMode>('extract_all');
  const [customCommand, setCustomCommand] = useState('');
  const [pastedText, setPastedText] = useState('');

  const [scanMode, setScanMode] = useState<QuickExtractScanMode>(
    quickExtractPrefs.defaultScanMode || 'audit'
  );
  const [focusedFields, setFocusedFields] = useState<QuickExtractFocusField[]>(
    resolveFocusedFields(quickExtractPrefs.focusedFields)
  );
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [reportsModalOpen, setReportsModalOpen] = useState(false);

  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [ttsStatus, setTtsStatus] = useState('');
  const [analysis, setAnalysis] =
    useState<QuickExtractAnalysisResult | null>(null);
  const [activeSession, setActiveSession] = useState<UcrsSession | null>(null);
  const [allParsedRowsBackup, setAllParsedRowsBackup] = useState<
    QuickExtractEvaluatedRow[] | null
  >(null);
  const lastPayloadRef = useRef<StoredSourcePayload | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Local Undo / Redo history for inline edits inside Quick Extract
  const [pastRows, setPastRows] = useState<QuickExtractEvaluatedRow[][]>([]);
  const [futureRows, setFutureRows] = useState<QuickExtractEvaluatedRow[][]>([]);

  const [filterQuery, setFilterQuery] = useState('');
  const [filterScope, setFilterScope] = useState<
    'all' | 'new_only' | 'updates_only'
  >('all');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null);
  const [showConfirmUpdates, setShowConfirmUpdates] = useState(false);
  const [coverageOverrideConfirmed, setCoverageOverrideConfirmed] =
    useState(false);
  const [commitSummary, setCommitSummary] =
    useState<QuickExtractCommitSummary | null>(null);

  const [routingConfig, setRoutingConfig] = useState<QuickExtractRoutingConfig>(
    () => ({
      mode: 'single',
      mergeStrategy: 'update_matched',
      primaryDestination: createDefaultDestSpec(initialAgencyId, 'كشف مستخرج'),
      additionsDestination: createDefaultDestSpec(
        initialAgencyId,
        'كشف الإضافات المستخرجة'
      ),
      decreasesDestination: createDefaultDestSpec(
        initialAgencyId,
        'كشف النزول والحذف المستخرج'
      ),
    })
  );

  useEffect(() => {
    const validId = agencies.some((a) => a.id === defaultAgencyId)
      ? defaultAgencyId
      : agencies[0]?.id ?? 1;
    setRoutingConfig((prev) => ({
      ...prev,
      primaryDestination: {
        ...prev.primaryDestination,
        agencyId: prev.primaryDestination.agencyId || validId,
      },
      additionsDestination: {
        ...prev.additionsDestination,
        agencyId: prev.additionsDestination.agencyId || validId,
      },
      decreasesDestination: {
        ...prev.decreasesDestination,
        agencyId: prev.decreasesDestination.agencyId || validId,
      },
    }));
  }, [defaultAgencyId, agencies]);

  const nameTree = useMemo(() => buildArabicNameTree(persons), [persons]);

  const activeReferenceTemplate = useMemo(
    () =>
      quickExtractPrefs.referenceTemplates.find(
        (t) => t.id === quickExtractPrefs.activeTemplateId
      ) || null,
    [quickExtractPrefs]
  );

  const persistSession = (session: UcrsSession) => {
    setActiveSession(session);
    onUpsertUcrsSession?.(session);
  };

  const buildAnalysisWithLearning = (params: {
    rawResult: QuickExtractAnalysisResult & {
      identity?: UcrsContentIdentity | null;
      missingHint?: string;
      entities?: UcrsExtractedTextEntity[];
      unreadableRegions?: Array<{
        pageNumber: number;
        label: string;
        reason: string;
        box: NormalizedBox;
      }>;
    };
    sourceRecord: UcrsSourceRecord;
    plan: UcrsReadingPlan;
    entities?: UcrsExtractedTextEntity[];
  }) => {
    const { rawResult, sourceRecord, plan } = params;
    const activeScanMode = rawResult.scanMode || scanMode;
    const activeFocused = resolveFocusedFields(
      rawResult.focusedFields || focusedFields
    );

    const enrichedRows = rawResult.rows.map((r, idx) => {
      const learned =
        plan.autoApplyLearningRules && r.name
          ? applyLearningRulesToName(r.name, ucrsLearningRules)
          : null;
      const adjustedRaw: QuickExtractRawRow =
        learned && learned.appliedRules.length > 0
          ? {
              ...r,
              name: learned.updatedName,
              notes: r.notes
                ? `${r.notes} · مصحح بالتعلم الذاتي`
                : 'مصحح بالتعلم الذاتي',
            }
          : r;

      return evaluateExtractedRow(adjustedRaw, idx, {
        sourceMode: rawResult.sourceMode || 'pdf',
        scanMode: activeScanMode,
        focusedFields: activeFocused,
        tree: nameTree,
        persons,
      });
    });

    const hasAnyDoubt = enrichedRows.some(
      (r) => r.hasDoubt || !r.isComplete || r.mathIssues.length > 0
    );

    const normalizedResult: QuickExtractAnalysisResult = {
      ...rawResult,
      scanMode: activeScanMode,
      focusedFields: activeFocused,
      status:
        rawResult.status === 'rejected'
          ? 'rejected'
          : hasAnyDoubt
          ? 'needs_review'
          : 'clear',
      rows: enrichedRows,
    };

    const extraRegions: UcrsCoverageRegion[] = (
      rawResult.unreadableRegions || []
    ).map((u, idx) => ({
      id: `unr_${idx}`,
      pageNumber: u.pageNumber || 1,
      label: u.label || 'منطقة غير مقروءة',
      state: 'unreadable',
      box: u.box,
      reason: u.reason,
    }));

    const identity: UcrsContentIdentity = rawResult.identity
      ? {
          ...rawResult.identity,
          suggestedActions: rawResult.identity.suggestedActions || [
            { id: 'act_all', label: 'استخراج كامل الجدول', intent: 'extract_all' },
            {
              id: 'act_useful',
              label: 'استخراج ما يفيدني فقط',
              intent: 'extract_useful',
            },
            {
              id: 'act_search',
              label: 'بحث دلالي في المحتوى',
              intent: 'semantic_search',
            },
          ],
        }
      : {
          contentType:
            sourceRecord.kind === 'camera_burst'
              ? 'دفتر يدوي'
              : 'جدول مستفيدين',
          topic: sourceRecord.label,
          qualityLabel:
            rawResult.clarityScore >= 80
              ? 'واضح'
              : rawResult.clarityScore >= 55
              ? 'متوسط'
              : 'صعب',
          qualityScore: rawResult.clarityScore,
          relevanceLevel: enrichedRows.length > 0 ? 'important' : 'useful',
          relevanceReasons: [
            `تم استخراج ${enrichedRows.length} صفًا من «${sourceRecord.label}».`,
          ],
          languageSummary: 'عربي وأرقام',
          estimatedTotalRows:
            enrichedRows.length + (rawResult.unreadableRegions?.length ?? 0),
          estimatedColumns: 4,
          estimatedConfidentCount: enrichedRows.filter(
            (r) => !r.hasDoubt && r.isComplete
          ).length,
          estimatedDoubtfulCount: enrichedRows.filter(
            (r) => r.hasDoubt || !r.isComplete
          ).length,
          estimatedUnreadableCount: rawResult.unreadableRegions?.length ?? 0,
          wordCount: enrichedRows.reduce(
            (s, r) => s + r.resolvedName.split(/\s+/).filter(Boolean).length,
            0
          ),
          detectedNamesCount: enrichedRows.length,
          detectedDates: [],
          detectedLocations: [],
          opinionAndRecommendation:
            rawResult.documentSummary ||
            'تم تحليل المحتوى وتجهيزه للمراجعة والتدقيق.',
          suggestedActions: [
            { id: 'act_all', label: 'استخراج كامل', intent: 'extract_all' },
            {
              id: 'act_useful',
              label: 'ما يفيدني فقط',
              intent: 'extract_useful',
            },
            { id: 'act_search', label: 'بحث دلالي', intent: 'semantic_search' },
          ],
        };

    const coverage = computeSmartCoverage({
      rows: enrichedRows,
      estimatedTotalItems: Math.max(
        identity.estimatedTotalRows,
        enrichedRows.length + extraRegions.length
      ),
      unreadableCount: extraRegions.length,
      pageCount: rawResult.pageCount || 1,
      coveredPages: rawResult.pageCount || 1,
      missingHint: rawResult.missingHint,
    });

    const coverageRegions = buildCoverageRegionsFromRows(
      enrichedRows,
      extraRegions
    );
    const diagnostics = buildDiagnosticsForSession({
      rows: enrichedRows,
      identity,
      coverage,
    });

    const session: UcrsSession = {
      id: `ucrs_${Date.now().toString(36)}`,
      title: sourceRecord.label,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status:
        rawResult.status === 'rejected'
          ? 'rejected'
          : coverage.overallPercent >= plan.minCoverageThreshold &&
            coverage.doubtfulCount === 0 &&
            coverage.unreadableCount === 0
          ? 'ready'
          : 'needs_completion',
      sources: [sourceRecord],
      identity,
      plan,
      rows: enrichedRows,
      entities: params.entities || rawResult.entities || [],
      coverage,
      coverageRegions,
      diagnostics,
      documentSummary: rawResult.documentSummary || identity.topic,
      lastFusionDiff: null,
    };

    setAllParsedRowsBackup(enrichedRows);
    setAnalysis(normalizedResult);
    persistSession(session);
    setPastRows([]);
    setFutureRows([]);
    setSelectedRowIds(enrichedRows.map((r) => r.id));
    setFocusedRowKey(null);
    setCoverageOverrideConfirmed(false);
  };

  // Sync activeSession whenever rows in `analysis` are edited by user
  const syncSessionFromRows = (
    nextRows: QuickExtractEvaluatedRow[],
    nextPlan?: UcrsReadingPlan
  ) => {
    if (!activeSession) return;
    const plan = nextPlan || activeSession.plan;
    const unreadableCount = activeSession.coverageRegions.filter(
      (r) => r.state === 'unreadable'
    ).length;
    const coverage = computeSmartCoverage({
      rows: nextRows,
      estimatedTotalItems: Math.max(
        activeSession.identity?.estimatedTotalRows ?? 0,
        nextRows.length + unreadableCount
      ),
      unreadableCount,
      pageCount: Math.max(1, activeSession.sources.length),
    });
    const extraUnreadable = activeSession.coverageRegions.filter(
      (r) => r.state === 'unreadable'
    );
    const coverageRegions = buildCoverageRegionsFromRows(
      nextRows,
      extraUnreadable
    );
    const diagnostics = buildDiagnosticsForSession({
      rows: nextRows,
      identity: activeSession.identity,
      coverage,
    });
    const nextSession: UcrsSession = {
      ...activeSession,
      updatedAt: new Date().toISOString(),
      plan,
      rows: nextRows,
      coverage,
      coverageRegions,
      diagnostics,
      status:
        coverage.overallPercent >= plan.minCoverageThreshold &&
        coverage.doubtfulCount === 0 &&
        coverage.unreadableCount === 0
          ? 'ready'
          : 'needs_completion',
    };
    persistSession(nextSession);
  };

  const handleToggleFocusField = (field: QuickExtractFocusField) => {
    const exists = focusedFields.includes(field);
    if (exists && focusedFields.length <= 1) return;
    const next = exists
      ? focusedFields.filter((f) => f !== field)
      : [...focusedFields, field];
    setFocusedFields(next);
    onUpdateQuickExtractPrefs({ focusedFields: next });
  };

  const applyFocusPreset = (preset: QuickExtractFocusField[]) => {
    setFocusedFields(preset);
    onUpdateQuickExtractPrefs({ focusedFields: preset });
  };

  const speakArabicText = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTtsStatus('جارٍ تحضير القراءة الصوتية...');
    try {
      const res = await fetch('/api/ucrs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          audioBase64?: string;
          mimeType?: string;
        };
        if (data.audioBase64) {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          const audio = new Audio(
            `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
          );
          audioRef.current = audio;
          await audio.play();
          setTtsStatus('يتم تشغيل القراءة الصوتية الآن.');
          return;
        }
      }
    } catch {
      // Fallback gracefully to browser SpeechSynthesis
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = 'ar-IQ';
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
      setTtsStatus('يتم تشغيل القراءة الصوتية عبر المتصفح.');
    } else {
      setTtsStatus('القراءة الصوتية غير مدعومة في هذا المتصفح.');
    }
  };

  const callUcrsAnalyzeEndpoint = async (payload: {
    phase: 'classify_only' | 'progressive_extract' | 'fusion_complete';
    sourceKind: string;
    intent: UcrsIntentMode;
    filename: string;
    base64Pdf?: string;
    frames?: Array<{ mimeType: string; data: string; label?: string }>;
    rawText?: string;
    enhancementReport?: string;
    existingSummary?: {
      extractedNames: string[];
      doubtfulCount: number;
      unreadableCount: number;
      missingHint: string;
    };
  }) => {
    const res = await fetch('/api/ucrs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        customCommand: customCommand.trim() || undefined,
        scanMode,
        focusedFields,
        clarityThreshold: quickExtractPrefs.clarityThreshold,
        learningRules: ucrsLearningRules
          .filter((r) => r.enabled)
          .map((r) => ({
            wrongToken: r.wrongToken,
            correctedToken: r.correctedToken,
          })),
        referenceTemplate: activeReferenceTemplate
          ? {
              name: activeReferenceTemplate.name,
              notes: activeReferenceTemplate.notes,
              imageBase64: activeReferenceTemplate.imageDataUrl,
              mimeType: activeReferenceTemplate.mimeType,
              regions: activeReferenceTemplate.regions,
            }
          : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok && data?.status !== 'rejected' && data?.legibilityStatus !== 'rejected') {
      throw new Error(data?.error || 'فشل تحليل المحتوى عبر منظومة القراءة الكونية.');
    }
    return data;
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError('');
    setCommitSummary(null);

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setUploadError('يرجى رفع ملف بصيغة PDF حصرًا من هذا التبويب، أو استخدم تبويب "الاستيعاب الشامل" لملفات Word و Excel والصور.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('حجم الملف يتجاوز الحد المسموح (20 ميجابايت).');
      return;
    }

    setFileName(file.name);
    setLoading(true);

    try {
      const base64Pdf = await fileToDataUrl(file);
      lastPayloadRef.current = {
        kind: 'pdf',
        filename: file.name,
        base64Pdf,
      };
      const plan = buildDefaultReadingPlan(intentMode, customCommand);
      const data = await callUcrsAnalyzeEndpoint({
        phase: intentMode === 'discover' ? 'classify_only' : 'progressive_extract',
        sourceKind: 'pdf',
        intent: intentMode,
        filename: file.name,
        base64Pdf,
      });

      buildAnalysisWithLearning({
        rawResult: data,
        sourceRecord: {
          id: `src_${Date.now()}`,
          label: file.name,
          kind: 'pdf',
          addedAt: new Date().toISOString(),
          clarityScore: data.clarityScore ?? 0,
          pageCount: data.pageCount ?? 1,
        },
        plan,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الملف.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCameraBurstAnalyze = async (summary: BurstFusionSummary) => {
    setUploadError('');
    setCommitSummary(null);
    const label = `لقطة الدفتر اليدوي (${summary.acceptedFrames.length} إطارات)`;
    setFileName(label);
    setLoading(true);

    try {
      const framesPayload = summary.acceptedFrames.map((f) => ({
        mimeType: f.mimeType,
        data: f.enhancedBase64,
        label: f.label,
      }));
      lastPayloadRef.current = {
        kind: 'frames',
        filename: label,
        frames: framesPayload,
      };

      const plan = buildDefaultReadingPlan(intentMode, customCommand);
      const data = await callUcrsAnalyzeEndpoint({
        phase: intentMode === 'discover' ? 'classify_only' : 'progressive_extract',
        sourceKind: 'camera_burst',
        intent: intentMode,
        filename: label,
        enhancementReport: summary.enhancementReport,
        frames: framesPayload,
      });

      if (summary.acceptedFrames[0]?.enhancedPreviewUrl) {
        data.sourceImageUrls = {
          1: summary.acceptedFrames[0].enhancedPreviewUrl,
        };
      }

      buildAnalysisWithLearning({
        rawResult: data,
        sourceRecord: {
          id: `src_${Date.now()}`,
          label,
          kind: 'camera_burst',
          addedAt: new Date().toISOString(),
          clarityScore: data.clarityScore ?? 0,
          pageCount: 1,
          previewDataUrl: summary.acceptedFrames[0]?.enhancedPreviewUrl,
        },
        plan,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة لقطات الكاميرا.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUniversalFilesUpload = async (
    fileList: FileList | File[],
    mode: 'new' | 'append_fusion' = 'new'
  ) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setUploadError('');
    if (mode === 'new') setCommitSummary(null);
    setLoading(true);

    try {
      const first = files[0];
      const intake = classifyIntakeSource({
        fileName: first.name,
        mimeType: first.type,
        fileCount: files.length,
      });

      const plan = buildDefaultReadingPlan(intentMode, customCommand);

      if (intake.supportsOfflineLocalParse) {
        const parsed = await parseLocalStructuredDocument({
          file: first,
          knownPersons: persons,
          learningRules: ucrsLearningRules.filter((r) => r.enabled),
          focusedFields,
          customCommand,
        });

        lastPayloadRef.current = {
          kind: 'text',
          filename: first.name,
          rawText: parsed.rawText,
        };

        if (mode === 'append_fusion' && activeSession) {
          const { updatedSession } = mergeSupplementaryExtraction({
            session: activeSession,
            sourceLabel: first.name,
            incomingRows: parsed.rows,
            incomingEntities: parsed.entities,
            knownPersons: persons,
            learningRules: ucrsLearningRules,
            focusedFields,
          });
          updatedSession.sources = [
            ...updatedSession.sources,
            {
              id: `src_${Date.now()}`,
              label: first.name,
              kind: intake.kind,
              addedAt: new Date().toISOString(),
              clarityScore: 98,
              pageCount: 1,
            },
          ];
          setAnalysis((prev) =>
            prev ? { ...prev, rows: updatedSession.rows } : prev
          );
          persistSession(updatedSession);
          setSelectedRowIds(updatedSession.rows.map((r) => r.id));
        } else {
          setFileName(first.name);
          buildAnalysisWithLearning({
            rawResult: {
              status: 'clear',
              sourceMode: 'pdf',
              scanMode,
              focusedFields,
              clarityScore: 98,
              pageCount: 1,
              rejectionReasons: [],
              documentSummary: parsed.documentSummary,
              rows: parsed.rows,
              identity: parsed.identity,
              entities: parsed.entities,
            },
            sourceRecord: {
              id: `src_${Date.now()}`,
              label: first.name,
              kind: intake.kind,
              addedAt: new Date().toISOString(),
              clarityScore: 98,
              pageCount: 1,
              rawTextExcerpt: parsed.rawText.slice(0, 300),
            },
            plan,
            entities: parsed.entities,
          });
        }
        return;
      }

      // Visual intake (Single/Batch Images or PDF supplementary)
      if (intake.kind === 'pdf') {
        const base64Pdf = await fileToDataUrl(first);
        const data = await callUcrsAnalyzeEndpoint({
          phase: mode === 'append_fusion' ? 'fusion_complete' : 'progressive_extract',
          sourceKind: 'pdf',
          intent: intentMode,
          filename: first.name,
          base64Pdf,
          existingSummary:
            mode === 'append_fusion' && activeSession
              ? {
                  extractedNames: activeSession.rows.map((r) => r.resolvedName),
                  doubtfulCount: activeSession.coverage.doubtfulCount,
                  unreadableCount: activeSession.coverage.unreadableCount,
                  missingHint: activeSession.coverage.missingHint,
                }
              : undefined,
        });

        if (mode === 'append_fusion' && activeSession) {
          const incomingRows = (data.rows || []).map(
            (r: QuickExtractRawRow, idx: number) =>
              evaluateExtractedRow(r, idx, {
                sourceMode: 'pdf',
                scanMode,
                focusedFields,
                tree: nameTree,
                persons,
              })
          );
          const { updatedSession } = mergeSupplementaryExtraction({
            session: activeSession,
            sourceLabel: first.name,
            incomingRows,
            incomingEntities: data.entities,
            knownPersons: persons,
            learningRules: ucrsLearningRules,
            focusedFields,
          });
          setAnalysis((prev) =>
            prev ? { ...prev, rows: updatedSession.rows } : prev
          );
          persistSession(updatedSession);
          setSelectedRowIds(updatedSession.rows.map((r) => r.id));
        } else {
          lastPayloadRef.current = {
            kind: 'pdf',
            filename: first.name,
            base64Pdf,
          };
          setFileName(first.name);
          buildAnalysisWithLearning({
            rawResult: data,
            sourceRecord: {
              id: `src_${Date.now()}`,
              label: first.name,
              kind: 'pdf',
              addedAt: new Date().toISOString(),
              clarityScore: data.clarityScore ?? 0,
              pageCount: data.pageCount ?? 1,
            },
            plan,
          });
        }
        return;
      }

      // Image batch (up to 8 images)
      const selectedImages = files.slice(0, 8);
      const frames: Array<{ mimeType: string; data: string; label: string }> = [];
      let firstPreviewUrl = '';
      for (const imgFile of selectedImages) {
        const rawUrl = await fileToDataUrl(imgFile);
        const compressed = await compressImageDataUrl(rawUrl);
        if (!firstPreviewUrl) firstPreviewUrl = compressed.dataUrl;
        frames.push({
          mimeType: compressed.mimeType,
          data: compressed.dataUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''),
          label: imgFile.name,
        });
      }

      const label =
        selectedImages.length === 1
          ? selectedImages[0].name
          : `حزمة صور (${selectedImages.length})`;

      const data = await callUcrsAnalyzeEndpoint({
        phase:
          mode === 'append_fusion'
            ? 'fusion_complete'
            : intentMode === 'discover'
            ? 'classify_only'
            : 'progressive_extract',
        sourceKind: intake.kind,
        intent: intentMode,
        filename: label,
        frames,
        existingSummary:
          mode === 'append_fusion' && activeSession
            ? {
                extractedNames: activeSession.rows.map((r) => r.resolvedName),
                doubtfulCount: activeSession.coverage.doubtfulCount,
                unreadableCount: activeSession.coverage.unreadableCount,
                missingHint: activeSession.coverage.missingHint,
              }
            : undefined,
      });

      if (firstPreviewUrl) {
        data.sourceImageUrls = {
          ...(analysis?.sourceImageUrls || {}),
          1: firstPreviewUrl,
        };
      }

      if (mode === 'append_fusion' && activeSession) {
        const incomingRows = (data.rows || []).map(
          (r: QuickExtractRawRow, idx: number) =>
            evaluateExtractedRow(r, idx, {
              sourceMode: 'camera_burst',
              scanMode,
              focusedFields,
              tree: nameTree,
              persons,
            })
        );
        const { updatedSession } = mergeSupplementaryExtraction({
          session: activeSession,
          sourceLabel: label,
          incomingRows,
          incomingEntities: data.entities,
          knownPersons: persons,
          learningRules: ucrsLearningRules,
          focusedFields,
        });
        updatedSession.sources = [
          ...updatedSession.sources,
          {
            id: `src_${Date.now()}`,
            label,
            kind: intake.kind,
            addedAt: new Date().toISOString(),
            clarityScore: data.clarityScore ?? 80,
            pageCount: selectedImages.length,
            previewDataUrl: firstPreviewUrl,
          },
        ];
        setAnalysis((prev) =>
          prev
            ? {
                ...prev,
                rows: updatedSession.rows,
                sourceImageUrls: data.sourceImageUrls,
              }
            : prev
        );
        persistSession(updatedSession);
        setSelectedRowIds(updatedSession.rows.map((r) => r.id));
      } else {
        lastPayloadRef.current = {
          kind: 'frames',
          filename: label,
          frames,
        };
        setFileName(label);
        buildAnalysisWithLearning({
          rawResult: data,
          sourceRecord: {
            id: `src_${Date.now()}`,
            label,
            kind: intake.kind,
            addedAt: new Date().toISOString(),
            clarityScore: data.clarityScore ?? 0,
            pageCount: selectedImages.length,
            previewDataUrl: firstPreviewUrl,
          },
          plan,
        });
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء استيعاب الملف.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzePastedText = async () => {
    if (!pastedText.trim()) return;
    setUploadError('');
    setCommitSummary(null);
    setLoading(true);
    try {
      const parsed = await parseLocalStructuredDocument({
        rawTextInput: pastedText,
        knownPersons: persons,
        learningRules: ucrsLearningRules.filter((r) => r.enabled),
        focusedFields,
        customCommand,
      });
      lastPayloadRef.current = {
        kind: 'text',
        filename: 'نص مباشر',
        rawText: parsed.rawText,
      };
      setFileName('محتوى نصي مباشر');
      const plan = buildDefaultReadingPlan(intentMode, customCommand);
      buildAnalysisWithLearning({
        rawResult: {
          status: 'clear',
          sourceMode: 'pdf',
          scanMode,
          focusedFields,
          clarityScore: 100,
          pageCount: 1,
          rejectionReasons: [],
          documentSummary: parsed.documentSummary,
          rows: parsed.rows,
          identity: parsed.identity,
          entities: parsed.entities,
        },
        sourceRecord: {
          id: `src_${Date.now()}`,
          label: 'محتوى نصي مباشر',
          kind: 'text',
          addedAt: new Date().toISOString(),
          clarityScore: 100,
          pageCount: 1,
          rawTextExcerpt: pastedText.slice(0, 300),
        },
        plan,
        entities: parsed.entities,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'تعذر تحليل النص المدخل.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeCroppedRegion = async (
    croppedDataUrl: string,
    _box: NormalizedBox
  ) => {
    if (!activeSession) return;
    setUploadError('');
    setLoading(true);
    try {
      const cleanB64 = croppedDataUrl.replace(
        /^data:image\/[a-zA-Z+]+;base64,/,
        ''
      );
      const data = await callUcrsAnalyzeEndpoint({
        phase: 'fusion_complete',
        sourceKind: 'image',
        intent: 'extract_all',
        filename: 'منطقة مقصوصة يدويًا',
        frames: [
          {
            mimeType: 'image/jpeg',
            data: cleanB64,
            label: 'قص يدوي لجزء غير مقروء',
          },
        ],
        existingSummary: {
          extractedNames: activeSession.rows.map((r) => r.resolvedName),
          doubtfulCount: activeSession.coverage.doubtfulCount,
          unreadableCount: activeSession.coverage.unreadableCount,
          missingHint: 'اقرأ هذه المنطقة المقصوصة المكبّرة بدقة واستخرج الصفوف المفقودة.',
        },
      });
      const incomingRows = (data.rows || []).map(
        (r: QuickExtractRawRow, idx: number) =>
          evaluateExtractedRow(r, idx, {
            sourceMode: 'camera_burst',
            scanMode,
            focusedFields,
            tree: nameTree,
            persons,
          })
      );
      const { updatedSession } = mergeSupplementaryExtraction({
        session: activeSession,
        sourceLabel: 'قص يدوي مكبّر',
        incomingRows,
        incomingEntities: data.entities,
        knownPersons: persons,
        learningRules: ucrsLearningRules,
        focusedFields,
      });
      setAnalysis((prev) =>
        prev ? { ...prev, rows: updatedSession.rows } : prev
      );
      persistSession(updatedSession);
      setSelectedRowIds(updatedSession.rows.map((r) => r.id));
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'تعذر قراءة الجزء المقصوص.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAndExecutePlan = async (overrideIntent?: UcrsIntentMode) => {
    if (!activeSession) return;
    const chosenIntent = overrideIntent || activeSession.plan.intent;
    const nextPlan: UcrsReadingPlan = {
      ...activeSession.plan,
      intent: chosenIntent,
      approved: true,
    };
    setIntentMode(chosenIntent);

    if (chosenIntent === 'semantic_search') {
      persistSession({ ...activeSession, plan: nextPlan });
      setUcrsTab('semantic_search');
      return;
    }

    const baseRows = allParsedRowsBackup || activeSession.rows;
    let filtered = baseRows;
    if (chosenIntent === 'extract_useful') {
      filtered = baseRows.filter(
        (r) =>
          Boolean(findExistingMatchInAgency(r.resolvedName, persons)) ||
          r.resolvedAddOrDeleteAction !== 'لا يوجد' ||
          (r.resolvedDecreaseCount ?? 0) > 0 ||
          (r.notes || '').trim().length > 0
      );
      if (filtered.length === 0) filtered = baseRows;
    } else if (chosenIntent === 'focus_notes') {
      const noted = baseRows.filter((r) => (r.notes || '').trim().length > 0);
      if (noted.length > 0) filtered = noted;
    }

    if (
      activeSession.rows.length === 0 &&
      lastPayloadRef.current &&
      lastPayloadRef.current.kind !== 'text'
    ) {
      setLoading(true);
      try {
        const p = lastPayloadRef.current;
        const data = await callUcrsAnalyzeEndpoint({
          phase: 'progressive_extract',
          sourceKind: p.kind === 'pdf' ? 'pdf' : 'image_batch',
          intent: chosenIntent,
          filename: p.filename,
          base64Pdf: p.base64Pdf,
          frames: p.frames,
        });
        buildAnalysisWithLearning({
          rawResult: data,
          sourceRecord: activeSession.sources[0],
          plan: nextPlan,
        });
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : 'تعذر تنفيذ الخطة.'
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    setAnalysis((prev) => (prev ? { ...prev, rows: filtered } : prev));
    setSelectedRowIds(filtered.map((r) => r.id));
    syncSessionFromRows(filtered, nextPlan);
    setUcrsTab('pipeline');
  };

  const updateRow = (
    rowId: string,
    patch: Partial<QuickExtractEvaluatedRow>,
    options?: { resetConfirmOnNameEdit?: boolean }
  ) => {
    if (!analysis) return;
    const existingRow = analysis.rows.find((r) => r.id === rowId);
    if (
      existingRow &&
      patch.resolvedName !== undefined &&
      patch.resolvedName.trim() !== existingRow.resolvedName.trim()
    ) {
      const rule = extractLearningRuleFromCorrection({
        originalName: existingRow.resolvedName,
        correctedName: patch.resolvedName,
        sourceContext: activeSession?.title || fileName || 'تصحيح يدوي',
      });
      if (rule) {
        onUpsertUcrsLearningRule?.(rule);
      }
    }

    setPastRows((p) => [...p.slice(-24), analysis.rows]);
    setFutureRows([]);
    const activeFocused = resolveFocusedFields(
      analysis.focusedFields || focusedFields
    );
    const activeScanMode = analysis.scanMode || scanMode;
    const nextRows = analysis.rows.map((row) => {
      if (row.id !== rowId) return row;
      return recomputeRowValidation(
        { ...row, ...patch },
        {
          tree: nameTree,
          persons,
          resetConfirmOnNameEdit: options?.resetConfirmOnNameEdit,
          focusedFields: activeFocused,
          scanMode: activeScanMode,
        }
      );
    });
    setAnalysis({ ...analysis, rows: nextRows });
    syncSessionFromRows(nextRows);
  };

  const handleLocalUndo = () => {
    if (!analysis || pastRows.length === 0) return;
    const prevSnapshot = pastRows[pastRows.length - 1];
    setFutureRows((f) => [analysis.rows, ...f.slice(0, 24)]);
    setPastRows((p) => p.slice(0, -1));
    setAnalysis({ ...analysis, rows: prevSnapshot });
    syncSessionFromRows(prevSnapshot);
  };

  const handleLocalRedo = () => {
    if (!analysis || futureRows.length === 0) return;
    const [nextSnapshot, ...rest] = futureRows;
    setPastRows((p) => [...p.slice(-24), analysis.rows]);
    setFutureRows(rest);
    setAnalysis({ ...analysis, rows: nextSnapshot });
    syncSessionFromRows(nextSnapshot);
  };

  const handleLoadSession = (sess: UcrsSession) => {
    const previewImg = sess.sources.find((s) => s.previewDataUrl)?.previewDataUrl;
    setActiveSession(sess);
    setAllParsedRowsBackup(sess.rows);
    setFileName(sess.title);
    setUploadError('');
    setAnalysis({
      status:
        sess.status === 'rejected'
          ? 'rejected'
          : sess.rows.some(
              (r) =>
                (r.hasDoubt && !r.doubtConfirmed) ||
                !r.isComplete ||
                r.mathIssues.length > 0
            )
          ? 'needs_review'
          : 'clear',
      sourceMode: sess.sources[0]?.kind === 'camera_burst' ? 'camera_burst' : 'pdf',
      scanMode,
      focusedFields,
      clarityScore: sess.identity?.qualityScore ?? 90,
      pageCount: sess.sources.length || 1,
      rejectionReasons: [],
      documentSummary: sess.documentSummary,
      rows: sess.rows,
      sourceImageUrls: previewImg ? { 1: previewImg } : undefined,
    });
    setSelectedRowIds(sess.rows.map((r) => r.id));
    setPastRows([]);
    setFutureRows([]);
    setUcrsTab('pipeline');
  };

  const handleDuplicateSession = (sess: UcrsSession) => {
    const copy: UcrsSession = {
      ...sess,
      id: `ucrs_${Date.now().toString(36)}`,
      title: `${sess.title} (نسخة)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onUpsertUcrsSession?.(copy);
  };

  const handleMergeWithSession = (other: UcrsSession) => {
    if (!activeSession) return;
    const { updatedSession } = mergeSupplementaryExtraction({
      session: activeSession,
      sourceLabel: other.title,
      incomingRows: other.rows,
      incomingEntities: other.entities,
      knownPersons: persons,
      learningRules: ucrsLearningRules,
      focusedFields,
    });
    setAnalysis((prev) =>
      prev ? { ...prev, rows: updatedSession.rows } : prev
    );
    persistSession(updatedSession);
    setSelectedRowIds(updatedSession.rows.map((r) => r.id));
  };

  const rows = analysis?.rows || [];
  const doubtedRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (r.hasDoubt && !r.doubtConfirmed) ||
          (r.mathIssues.length > 0 && !r.mathConfirmed)
      ),
    [rows]
  );
  const missingRows = useMemo(() => rows.filter((r) => !r.isComplete), [rows]);
  const verifiedRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!r.hasDoubt || r.doubtConfirmed) &&
          (r.mathIssues.length === 0 || r.mathConfirmed) &&
          r.isComplete
      ),
    [rows]
  );

  // Zero-Blind-Commit Gate: strict lock until ALL doubts & missing fields = 0
  const gateUnlocked =
    analysis !== null &&
    analysis.status !== 'rejected' &&
    rows.length > 0 &&
    doubtedRows.length === 0 &&
    missingRows.length === 0;

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, `${a.icon} ${a.name}`])),
    [agencies]
  );

  const primaryPool = useMemo(() => {
    if (routingConfig.primaryDestination.kind === 'master_roster') {
      return persons;
    }
    return persons.filter(
      (p) => p.agencyId === routingConfig.primaryDestination.agencyId
    );
  }, [persons, routingConfig.primaryDestination]);

  const filteredReadyRows = useMemo(() => {
    const qNorm = normalizeArabic(filterQuery);
    return verifiedRows.filter((row) => {
      if (qNorm && !normalizeArabic(row.resolvedName).includes(qNorm)) {
        return false;
      }
      const existing = findExistingMatchInAgency(row.resolvedName, primaryPool);
      if (filterScope === 'new_only' && existing) return false;
      if (filterScope === 'updates_only' && !existing) return false;
      return true;
    });
  }, [verifiedRows, filterQuery, filterScope, primaryPool]);

  const rowsChosenForCommit = useMemo(() => {
    const picked = new Set(selectedRowIds);
    return filteredReadyRows.filter((r) => picked.has(r.id));
  }, [filteredReadyRows, selectedRowIds]);

  const routingPlan = useMemo(
    () =>
      computeQuickExtractRoutingPlan({
        rows: filteredReadyRows,
        routing: routingConfig,
        agencies,
        persons,
        readyLists,
        readyListItems,
      }),
    [filteredReadyRows, routingConfig, agencies, persons, readyLists, readyListItems]
  );

  const selectedPlanCounts = useMemo(
    () =>
      computeQuickExtractRoutingPlan({
        rows: rowsChosenForCommit,
        routing: routingConfig,
        agencies,
        persons,
        readyLists,
        readyListItems,
      }).counts,
    [rowsChosenForCommit, routingConfig, agencies, persons, readyLists, readyListItems]
  );

  const planItemByRowId = useMemo(
    () => new Map(routingPlan.items.map((it) => [it.row.id, it])),
    [routingPlan]
  );

  const corePreviewRows: CoreRosterRow[] = useMemo(() => {
    return filteredReadyRows.map((row) => {
      const calc = computeAdjustedIndividuals(row);
      const planned = planItemByRowId.get(row.id);
      const rowOverride = routingConfig.rowOverrides?.[row.id];
      const overrideValue: CoreRosterRow['routeOverrideValue'] =
        rowOverride?.excluded
          ? 'exclude'
          : rowOverride?.mergeStrategy || 'auto';

      const targetAgencyId =
        planned?.destination.kind === 'agency'
          ? planned.destination.agencyId
          : routingConfig.primaryDestination.agencyId;
      const actionLabel =
        planned?.actionType === 'skip_unmatched'
          ? 'مستبعد'
          : planned?.actionType === 'update_matched'
          ? `تحديث موجود (${planned.matchedPerson?.individuals ?? '—'} ← ${
              calc.finalIndividuals
            })`
          : planned?.actionType === 'replace'
          ? 'استبدال'
          : 'إضافة جديدة';

      const tone: CoreRosterRow['routeActionTone'] =
        planned?.actionType === 'skip_unmatched'
          ? 'muted'
          : planned?.actionType === 'update_matched'
          ? 'warning'
          : planned?.actionType === 'replace'
          ? 'danger'
          : 'success';

      return {
        rowKey: row.id,
        selectionId: row.id,
        agencyId: targetAgencyId,
        agencyName: agencyMap.get(targetAgencyId) || '—',
        name: row.resolvedName,
        individuals: calc.finalIndividuals,
        status: '',
        notes: row.notes || calc.adjustmentNote,
        extractSource: row,
        extractDecreaseCount: row.resolvedDecreaseCount,
        extractAddOrDeleteCount: row.resolvedAddOrDeleteCount,
        extractAddOrDeleteAction: row.resolvedAddOrDeleteAction,
        destinationLabel: planned?.matchedRuleLabel
          ? `${planned.destinationLabel} (${planned.matchedRuleLabel})`
          : planned?.destinationLabel,
        routeActionLabel: actionLabel,
        routeActionTone: tone,
        routeOverrideValue: overrideValue,
      };
    });
  }, [
    filteredReadyRows,
    planItemByRowId,
    routingConfig.primaryDestination.agencyId,
    routingConfig.rowOverrides,
    agencyMap,
  ]);

  const selectablePreviewRecords: SelectablePersonRecord[] = useMemo(() => {
    const picked = new Set(selectedRowIds);
    return filteredReadyRows
      .filter((r) => picked.has(r.id))
      .map((r) => {
        const calc = computeAdjustedIndividuals(r);
        const planned = planItemByRowId.get(r.id);
        return {
          selectionKey: `qe:${r.id}`,
          personId: planned?.matchedPerson?.id ?? null,
          name: r.resolvedName,
          agencyId:
            planned?.destination.kind === 'agency'
              ? planned.destination.agencyId
              : routingConfig.primaryDestination.agencyId,
          agencyName: planned?.destinationLabel || 'السحب السريع',
          individuals: calc.finalIndividuals,
          notes: r.notes || calc.adjustmentNote,
        };
      });
  }, [
    filteredReadyRows,
    selectedRowIds,
    planItemByRowId,
    routingConfig.primaryDestination.agencyId,
  ]);

  const activeCommitCount =
    selectedPlanCounts.add +
    selectedPlanCounts.update +
    selectedPlanCounts.replace;
  const belowMinCoverage =
    Boolean(activeSession) &&
    (activeSession?.coverage.overallPercent ?? 100) <
      (activeSession?.plan.minCoverageThreshold ?? 90);
  const canProceedToCommit =
    gateUnlocked && rowsChosenForCommit.length > 0 && activeCommitCount > 0;

  const executeCommit = () => {
    const summary = onCommitQuickExtractPlan({
      rows: rowsChosenForCommit,
      routing: routingConfig,
    });
    if (activeSession) {
      persistSession({
        ...activeSession,
        status: 'committed',
        committedAt: new Date().toISOString(),
        coverageOverrideNote:
          belowMinCoverage && coverageOverrideConfirmed
            ? `تم الترحيل بتجاوز المستخدم لحد التغطية (${activeSession.coverage.overallPercent}% < ${activeSession.plan.minCoverageThreshold}%)`
            : undefined,
      });
    }
    setCommitSummary(summary);
    setShowConfirmUpdates(false);
  };

  const resetAll = () => {
    setAnalysis(null);
    setActiveSession(null);
    setAllParsedRowsBackup(null);
    lastPayloadRef.current = null;
    setFileName('');
    setUploadError('');
    setCommitSummary(null);
    setPastRows([]);
    setFutureRows([]);
    setSelectedRowIds([]);
  };

  const handleJumpToRow = (rowId: string) => {
    setUcrsTab('pipeline');
    setFocusedRowKey(rowId);
  };

  const stage2Active =
    analysis !== null && analysis.status !== 'rejected' && !gateUnlocked;
  const stage3Active = gateUnlocked;
  const activeSourceImageUrl =
    analysis?.sourceImageUrls?.[1] ||
    activeSession?.sources.find((s) => s.previewDataUrl)?.previewDataUrl;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 pb-24 sm:p-6 sm:pb-20">
      {/* Top Pipeline Header + Universal Intake Switcher */}
      <section
        data-assistant-target="quick-extract-root"
        className="tabrix-card rounded-2xl border p-4 sm:p-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex items-start gap-3.5 min-w-0 sm:flex-1">
            <span
              className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: 'var(--bg-nav-active)',
                borderColor: 'color-mix(in srgb, var(--accent) 26%, var(--border-color))',
                color: 'var(--accent)',
              }}
              aria-hidden="true"
            >
              <FileSearch className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold leading-snug sm:text-lg">
                السحب السريع — منظومة القراءة الكونية والإدراك التدريجي
              </h1>
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                قراءة وفهم شامل لملفات PDF، كاميرا الدفتر اليدوي، حزم الصور، Word،
                Excel، CSV، والنصوص — مع تحديد هوية المحتوى، التغطية التفاعلية،
                البحث الدلالي، والتوجيه الذكي قبل الترحيل.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeSession && (
              <button
                type="button"
                onClick={() => setReportsModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>التقارير والإحصاء</span>
              </button>
            )}
            {(analysis || activeSession) && (
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>بدء عملية جديدة</span>
              </button>
            )}
          </div>
        </div>

        {/* 3-Stage Stepper Strip */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div
            className="rounded-lg border px-3 py-2 text-xs font-bold"
            style={{
              backgroundColor:
                analysis === null || analysis.status === 'rejected'
                  ? 'var(--bg-nav-active)'
                  : 'var(--bg-main)',
              borderColor:
                analysis === null || analysis.status === 'rejected'
                  ? 'var(--accent)'
                  : 'var(--border-color)',
            }}
          >
            01. الاستيعاب الشامل وفهم المحتوى وخطة القراءة
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-xs font-bold"
            style={{
              backgroundColor: stage2Active
                ? 'var(--danger-bg)'
                : 'var(--bg-main)',
              borderColor: stage2Active
                ? 'var(--danger)'
                : 'var(--border-color)',
              color: stage2Active ? 'var(--danger)' : 'var(--text-primary)',
            }}
          >
            02. كشف الشك باللون الأحمر والتغطية والدمج التدريجي
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-xs font-bold"
            style={{
              backgroundColor: stage3Active
                ? 'var(--success-bg)'
                : 'var(--bg-main)',
              borderColor: stage3Active
                ? 'var(--success)'
                : 'var(--border-color)',
              color: stage3Active ? 'var(--success)' : 'var(--text-muted)',
            }}
          >
            03. التحضير والفلترة النهائية والتوجيه والترحيل
          </div>
        </div>

        {/* Universal Intake Segmented Tabs */}
        <div
          className="mt-4 flex w-full flex-wrap items-center gap-1 rounded-xl border p-1 sm:inline-flex sm:w-auto"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setCaptureMode('pdf');
              setUploadError('');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold sm:px-4 sm:py-2 sm:text-xs"
            style={{
              backgroundColor:
                captureMode === 'pdf' ? 'var(--accent)' : 'transparent',
              color:
                captureMode === 'pdf'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span>ملفات PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCaptureMode('camera_burst');
              setUploadError('');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold sm:px-4 sm:py-2 sm:text-xs"
            style={{
              backgroundColor:
                captureMode === 'camera_burst'
                  ? 'var(--accent)'
                  : 'transparent',
              color:
                captureMode === 'camera_burst'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <Camera className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span>كاميرا الدفتر اليدوي (Burst)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCaptureMode('universal_files');
              setUploadError('');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-start text-[11px] font-bold sm:px-4 sm:py-2 sm:text-xs"
            style={{
              backgroundColor:
                captureMode === 'universal_files'
                  ? 'var(--accent)'
                  : 'transparent',
              color:
                captureMode === 'universal_files'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <Layers className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span>استيعاب شامل (صور / Word / Excel / نص)</span>
          </button>
        </div>

        {/* Intent & Custom Command Bar */}
        <div
          className="mt-4 grid grid-cols-1 gap-3 rounded-xl border p-3.5 text-xs lg:grid-cols-2"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="ucrs-intent-select"
              className="block font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              هدف القراءة (النية قبل الاستخراج):
            </label>
            <select
              id="ucrs-intent-select"
              value={intentMode}
              onChange={(e) => setIntentMode(e.target.value as UcrsIntentMode)}
              className="w-full rounded-lg border px-3 py-2 text-xs font-semibold"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              {INTENT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ucrs-custom-cmd"
              className="block font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              أمرك أو سؤالك المخصص للمحتوى (اختياري):
            </label>
            <input
              id="ucrs-custom-cmd"
              type="text"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              placeholder='مثلاً: "استخرج أسماء المحجوبين فقط" أو "احسب تغييرات شهر 11"'
              className="w-full rounded-lg border px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            />
          </div>
        </div>

        {/* Custom Field Focus + Scan Mode + Reference Template Config Strip */}
        <div
          className="mt-3 grid grid-cols-1 gap-3 rounded-xl border p-3.5 text-xs lg:grid-cols-3"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          {/* 1. Fast vs Audit Mode */}
          <div className="space-y-1.5">
            <div className="font-bold" style={{ color: 'var(--text-muted)' }}>
              وضع السحب والتصوير:
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setScanMode('fast');
                  onUpdateQuickExtractPrefs({ defaultScanMode: 'fast' });
                }}
                className="inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-2 font-bold"
                style={{
                  backgroundColor:
                    scanMode === 'fast' ? 'var(--accent)' : 'var(--bg-surface)',
                  borderColor:
                    scanMode === 'fast'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    scanMode === 'fast'
                      ? 'var(--accent-fg)'
                      : 'var(--text-primary)',
                }}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>الوضع السريع</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanMode('audit');
                  onUpdateQuickExtractPrefs({ defaultScanMode: 'audit' });
                }}
                className="inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-2 font-bold"
                style={{
                  backgroundColor:
                    scanMode === 'audit' ? 'var(--accent)' : 'var(--bg-surface)',
                  borderColor:
                    scanMode === 'audit'
                      ? 'var(--accent)'
                      : 'var(--border-color)',
                  color:
                    scanMode === 'audit'
                      ? 'var(--accent-fg)'
                      : 'var(--text-primary)',
                }}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>الوضع المدقق</span>
              </button>
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {scanMode === 'fast'
                ? 'التقاط واستخراج فوري للجدول مباشرة بدون تعقيد.'
                : 'تدقيق شامل للحروف مع قص مقتطف الصورة بجانب الأسماء المشكوك بها.'}
            </div>
          </div>

          {/* 2. Custom Field Focus */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-bold" style={{ color: 'var(--text-muted)' }}>
                التركيز المخصص على الحقول:
              </span>
              <div className="flex gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => applyFocusPreset(['name'])}
                  className="rounded border px-1.5 py-0.5 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  الأسماء فقط
                </button>
                <button
                  type="button"
                  onClick={() => applyFocusPreset(['name', 'individuals'])}
                  className="rounded border px-1.5 py-0.5 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  الأسماء + الأفراد
                </button>
                <button
                  type="button"
                  onClick={() => applyFocusPreset(ALL_QUICK_EXTRACT_FIELDS)}
                  className="rounded border px-1.5 py-0.5 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  الكل (4)
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'name', label: 'الاسم' },
                  { id: 'individuals', label: 'عدد الأفراد' },
                  { id: 'decreaseCount', label: 'النزول / النقصان' },
                  { id: 'addOrDelete', label: 'الإضافة / الحذف' },
                ] as const
              ).map((f) => {
                const checked = focusedFields.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 font-semibold"
                    style={{
                      backgroundColor: checked
                        ? 'var(--bg-nav-active)'
                        : 'var(--bg-surface)',
                      borderColor: checked
                        ? 'var(--accent)'
                        : 'var(--border-color)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleFocusField(f.id)}
                    />
                    <span>{f.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Reference Template */}
          <div className="space-y-1.5">
            <div className="font-bold" style={{ color: 'var(--text-muted)' }}>
              الصورة المرجعية / النموذج الأولي:
            </div>
            <div className="flex flex-wrap gap-1.5">
              <select
                aria-label="اختيار النموذج المرجعي"
                value={quickExtractPrefs.activeTemplateId || ''}
                onChange={(e) =>
                  onUpdateQuickExtractPrefs({
                    activeTemplateId: e.target.value || null,
                  })
                }
                className="min-w-[140px] flex-1 rounded-lg border px-2.5 py-1.5 font-semibold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value="">بدون نموذج مرجعي</option>
                {quickExtractPrefs.referenceTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.regions.length} تحديد)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold"
                style={{
                  backgroundColor: 'var(--bg-nav-active)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
              >
                <MousePointerSquareDashed className="h-3.5 w-3.5" />
                <span>تحديد نموذج جديد</span>
              </button>
            </div>
            {activeReferenceTemplate && (
              <div
                className="flex items-center gap-2 text-[11px]"
                style={{ color: 'var(--success)' }}
              >
                <span>
                  النموذج النشط: <strong>{activeReferenceTemplate.name}</strong> (
                  {activeReferenceTemplate.regions.length} منطقة محددة)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Intake Dropzones */}
        {captureMode === 'pdf' && (
          <label
            className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors hover:opacity-90"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--accent)',
            }}
          >
            {loading ? (
              <>
                <Loader2
                  className="h-8 w-8 animate-spin"
                  style={{ color: 'var(--accent)' }}
                />
                <div className="mt-2 text-sm font-bold">
                  جارٍ فحص جودة الصفحات وعزل الجداول العربية ({fileName})...
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  تحديد الهوية · القراءة التدريجية · تقرير النواقص
                </div>
              </>
            ) : (
              <>
                <Upload
                  className="h-8 w-8"
                  style={{ color: 'var(--accent)' }}
                />
                <div className="mt-2 text-sm font-bold">
                  {fileName
                    ? `ملف محدد: ${fileName} — انقر لاختيار ملف آخر`
                    : 'اضغط هنا لرفع ملف PDF (جداول قديمة أو مرسلة)'}
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  صيغة PDF (بحد أقصى 20 ميجابايت) · يدعم القراءة التدريجية والرفض الآمن
                </div>
              </>
            )}
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={loading}
              onChange={handlePdfUpload}
              className="hidden"
            />
          </label>
        )}

        {captureMode === 'camera_burst' && (
          <BurstCameraCapture
            analyzing={loading}
            scanMode={scanMode}
            onBurstReadyAndAnalyze={handleCameraBurstAnalyze}
          />
        )}

        {captureMode === 'universal_files' && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--accent)',
              }}
            >
              {loading ? (
                <Loader2
                  className="h-7 w-7 animate-spin"
                  style={{ color: 'var(--accent)' }}
                />
              ) : (
                <Upload className="h-7 w-7" style={{ color: 'var(--accent)' }} />
              )}
              <div className="mt-2 text-xs font-bold sm:text-sm">
                ارفع صورًا (حتى 8)، أو ملف Excel / CSV / Word (.docx) / TXT
              </div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                يتعرف النظام تلقائيًا على صيغة الملف ويستخرج الجداول والكيانات بدقة
              </div>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv,.docx,.txt,.md"
                disabled={loading}
                onChange={(e) => {
                  if (e.target.files) {
                    void handleUniversalFilesUpload(e.target.files, 'new');
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>

            <div
              className="flex flex-col justify-between gap-2 rounded-xl border p-3.5"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
              }}
            >
              <label htmlFor="ucrs-paste-text" className="text-xs font-bold">
                أو الصق نصًا / كشفًا جاهزًا (مثل رسالة واتساب أو جدول منسوخ):
              </label>
              <textarea
                id="ucrs-paste-text"
                rows={3}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="مثال:&#10;الاسم,الأفراد,الملاحظات&#10;أحمد علي حسن,5,توصيل الكرادة&#10;سالم محمد جاسم,3,محجوب مؤقت"
                className="w-full rounded-lg border p-2 text-xs"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={loading || !pastedText.trim()}
                  onClick={handleAnalyzePastedText}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold disabled:opacity-40"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>قراءة وفهم النص مباشرة</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {uploadError && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-lg border px-4 py-3 text-xs font-semibold"
            style={{
              borderColor: 'var(--danger)',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {ttsStatus && (
          <div
            className="mt-2 flex items-center gap-2 text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            <Volume2 className="h-3.5 w-3.5 shrink-0" />
            <span>{ttsStatus}</span>
          </div>
        )}
      </section>

      {/* UCRS Workspace Sub-Navigation */}
      <nav
        aria-label="أقسام منظومة القراءة الكونية"
        className="flex flex-wrap items-center gap-1.5 rounded-xl border p-1.5 text-xs"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
        }}
      >
        {(
          [
            {
              id: 'pipeline',
              label: 'المراجعة والترحيل',
              icon: Sparkles,
            },
            {
              id: 'identity_plan',
              label: 'هوية المحتوى وخطة القراءة',
              icon: Compass,
            },
            {
              id: 'coverage_sessions',
              label: `التغطية والخريطة وجلساتي (${ucrsSessions.length})`,
              icon: FolderClock,
            },
            {
              id: 'semantic_search',
              label: 'البحث الدلالي والضبابي',
              icon: Search,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = ucrsTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setUcrsTab(tab.id)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-bold whitespace-nowrap"
              style={{
                backgroundColor: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--accent-fg)' : 'var(--text-primary)',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Always show Identity & Plan card inside identity_plan tab, OR right after extraction when not yet approved */}
      {(ucrsTab === 'identity_plan' ||
        (activeSession?.identity && ucrsTab === 'pipeline' && !activeSession.plan.approved)) &&
        activeSession?.identity && (
          <UcrsIdentityAndPlanCard
            identity={activeSession.identity}
            plan={activeSession.plan}
            onUpdatePlan={(nextPlan) =>
              persistSession({ ...activeSession, plan: nextPlan })
            }
            onApproveAndExecute={handleApproveAndExecutePlan}
            onDiscardSession={resetAll}
          />
        )}

      {/* Semantic Search Panel */}
      {ucrsTab === 'semantic_search' && (
        <UcrsSemanticSearchPanel
          activeSession={activeSession}
          allSessions={ucrsSessions}
          onJumpToRow={handleJumpToRow}
          onSpeakText={speakArabicText}
        />
      )}

      {/* Coverage, Visual Map, Diagnostics, Fusion, Sessions & Learning Rules */}
      {ucrsTab === 'coverage_sessions' && (
        <UcrsCoverageAndSessionsPanel
          activeSession={activeSession}
          allSessions={ucrsSessions}
          learningRules={ucrsLearningRules}
          sourceImageUrl={activeSourceImageUrl}
          loading={loading}
          onAppendSupplementaryFiles={(fl) =>
            void handleUniversalFilesUpload(fl, 'append_fusion')
          }
          onAnalyzeCroppedRegion={handleAnalyzeCroppedRegion}
          onLoadSession={handleLoadSession}
          onDuplicateSession={handleDuplicateSession}
          onMergeWithSession={handleMergeWithSession}
          onDeleteSession={(id) => onDeleteUcrsSession?.(id)}
          onAddLearningRule={(wrongToken, correctedToken) =>
            onUpsertUcrsLearningRule?.({
              id: `lr_${Date.now().toString(36)}`,
              wrongToken,
              correctedToken,
              sourceContext: 'إضافة يدوية من المستخدم',
              usageCount: 1,
              createdAt: new Date().toISOString().slice(0, 10),
              enabled: true,
            })
          }
          onToggleLearningRule={(id) => onToggleUcrsLearningRule?.(id)}
          onDeleteLearningRule={(id) => onDeleteUcrsLearningRule?.(id)}
          onJumpToRow={handleJumpToRow}
          onSpeakText={speakArabicText}
          onOpenReportsModal={() => setReportsModalOpen(true)}
        />
      )}

      {/* Safe Rejection Gate Banner */}
      {analysis?.status === 'rejected' && (
        <section
          role="alert"
          className="rounded-xl border p-5"
          style={{
            backgroundColor: 'var(--danger-bg)',
            borderColor: 'var(--danger)',
            color: 'var(--danger)',
          }}
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0" />
            <div className="space-y-2">
              <h2 className="text-base font-bold">
                تم رفض المستند بأمان منعًا للأخطاء الصامتة (درجة الوضوح:{' '}
                {analysis.clarityScore}%)
              </h2>
              <ul className="list-disc space-y-1 pr-5 text-xs font-semibold">
                {analysis.rejectionReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Commit Receipt Banner */}
      {commitSummary && (
        <section
          className="space-y-3 rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--success-bg)',
            borderColor: 'var(--success)',
            color: 'var(--success)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>
                تم اعتماد وترحيل ({commitSummary.totalRows}) سجل بنجاح: إضافة{' '}
                {commitSummary.added} · تحديث {commitSummary.updated}
                {commitSummary.replaced > 0
                  ? ` · استبدال ${commitSummary.replaced}`
                  : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {commitSummary.buckets.map((b, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (b.destinationKind === 'agency' && b.agencyId) {
                      onDoneNavigateToAgency(b.agencyId);
                    } else if (b.destinationKind === 'master_roster') {
                      onNavigateToView('master_roster');
                    } else {
                      onNavigateToView('ready_lists');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--success)',
                    color: 'var(--success-fg)',
                  }}
                >
                  <span>فتح {b.destinationLabel}</span>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Post-Extraction Pipeline */}
      {ucrsTab === 'pipeline' && analysis && analysis.status !== 'rejected' && (
        <>
          {/* Honest Progressive Summary Strip */}
          {activeSession && (
            <section
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="space-y-0.5">
                <div className="font-bold tabular-nums">
                  التغطية التدريجية: {activeSession.coverage.overallPercent}% ·{' '}
                  <span style={{ color: 'var(--success)' }}>
                    {activeSession.coverage.confidentCount} واضح
                  </span>{' '}
                  ·{' '}
                  <span style={{ color: 'var(--warning)' }}>
                    {activeSession.coverage.doubtfulCount} مشكوك
                  </span>{' '}
                  ·{' '}
                  <span style={{ color: 'var(--danger)' }}>
                    {activeSession.coverage.unreadableCount} غير مقروء
                  </span>
                </div>
                {activeSession.coverage.missingHint && (
                  <div style={{ color: 'var(--text-muted)' }}>
                    {activeSession.coverage.missingHint}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUcrsTab('coverage_sessions')}
                  className="rounded-lg border px-3 py-1.5 font-bold"
                  style={{
                    borderColor: 'var(--accent)',
                    color: 'var(--accent)',
                  }}
                >
                  خريطة التغطية و«لماذا؟» والدمج
                </button>
                <button
                  type="button"
                  onClick={() =>
                    speakArabicText(
                      `تم استخراج ${rows.length} صف. الواضحة ${verifiedRows.length}، وتوجد ${doubtedRows.length} ملاحظات شك و${missingRows.length} نواقص.`
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-semibold"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>قراءة صوتية</span>
                </button>
              </div>
            </section>
          )}

          {/* 4-Metric Audit Bar */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="rounded-xl border px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                فحص جودة المصدر
              </div>
              <div
                className="mt-1 text-lg font-bold tabular-nums"
                style={{ color: 'var(--success)' }}
              >
                {analysis.clarityScore}% · مقبول
              </div>
            </div>

            <div
              className="rounded-xl border px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                الصفوف المؤكدة 100%
              </div>
              <div
                className="mt-1 text-lg font-bold tabular-nums"
                style={{ color: 'var(--accent)' }}
              >
                {verifiedRows.length} من {rows.length} صف
              </div>
            </div>

            <div
              className="rounded-xl border px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor:
                  doubtedRows.length > 0
                    ? 'var(--danger)'
                    : 'var(--border-color)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                كشف الشك باللون الأحمر
              </div>
              <div
                className="mt-1 text-lg font-bold tabular-nums"
                style={{
                  color:
                    doubtedRows.length > 0
                      ? 'var(--danger)'
                      : 'var(--success)',
                }}
              >
                {doubtedRows.length} قيد للمراجعة
              </div>
            </div>

            <div
              className="rounded-xl border px-4 py-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor:
                  missingRows.length > 0
                    ? 'var(--danger)'
                    : 'var(--border-color)',
              }}
            >
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                تقرير النواقص الإجباري
              </div>
              <div
                className="mt-1 text-lg font-bold tabular-nums"
                style={{
                  color:
                    missingRows.length > 0
                      ? 'var(--danger)'
                      : 'var(--success)',
                }}
              >
                {missingRows.length} صف ناقص
              </div>
            </div>
          </section>

          {/* Stage 2A: Red-Flag Doubt & Arabic Glyph Decomposition Panel */}
          {doubtedRows.length > 0 && (
            <section
              aria-label="منطقة الشك الحمراء وتفكيك الحروف"
              className="space-y-3 rounded-xl border p-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--danger)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    className="h-5 w-5"
                    style={{ color: 'var(--danger)' }}
                  />
                  <h2
                    className="text-sm font-bold"
                    style={{ color: 'var(--danger)' }}
                  >
                    منطقة الشك باللون الأحمر وتدقيق الحروف ({doubtedRows.length}) —
                    تتطلب مطابقتك وتأكيدك الصريح
                  </h2>
                </div>
              </div>

              <div className="space-y-3">
                {doubtedRows.map((row) => (
                  <RedFlagDoubtSegment
                    key={row.id}
                    row={row}
                    nameTree={nameTree}
                    sourceImageUrl={
                      analysis.sourceImageUrls?.[row.pageNumber] ||
                      analysis.sourceImageUrls?.[1]
                    }
                    focusedFields={analysis.focusedFields || focusedFields}
                    onUpdateRow={updateRow}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Stage 2B: Mandatory Missing Fields Report */}
          {missingRows.length > 0 && (
            <section
              aria-label="تقرير النواقص والإدخال اليدوي الإجباري"
              className="rounded-xl border p-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--danger)',
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <FileWarning
                  className="h-5 w-5"
                  style={{ color: 'var(--danger)' }}
                />
                <h2
                  className="text-sm font-bold"
                  style={{ color: 'var(--danger)' }}
                >
                  تقرير النواقص والإدخال اليدوي الإجباري ({missingRows.length} صف)
                </h2>
              </div>

              <div className="space-y-2">
                {missingRows.map((row) => {
                  const labels: Record<string, string> = {
                    name: 'الاسم',
                    individuals: 'الأفراد',
                    decreaseCount: 'النزول/النقصان',
                    addOrDeleteCount: 'الإضافة/الحذف',
                  };
                  return (
                    <div
                      key={row.id}
                      className="rounded-lg border p-3"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--danger)',
                      }}
                    >
                      <div className="mb-2 text-xs font-bold">
                        صف {row.rowIndex} — الحقول الناقصة:{' '}
                        <span style={{ color: 'var(--danger)' }}>
                          {row.missingFields.map((f) => labels[f]).join('، ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                        <input
                          type="text"
                          value={row.resolvedName}
                          onChange={(e) =>
                            updateRow(row.id, { resolvedName: e.target.value })
                          }
                          placeholder="الاسم الكامل *"
                          className="rounded-lg border px-2.5 py-1.5 text-xs sm:col-span-2"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: row.missingFields.includes('name')
                              ? 'var(--danger)'
                              : 'var(--border-color)',
                          }}
                        />
                        <input
                          type="number"
                          min={0}
                          value={row.resolvedIndividuals ?? ''}
                          onChange={(e) =>
                            updateRow(row.id, {
                              resolvedIndividuals:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="الأفراد *"
                          className="rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: row.missingFields.includes('individuals')
                              ? 'var(--danger)'
                              : 'var(--border-color)',
                          }}
                        />
                        <input
                          type="number"
                          min={0}
                          value={row.resolvedDecreaseCount ?? ''}
                          onChange={(e) =>
                            updateRow(row.id, {
                              resolvedDecreaseCount:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="النزول/النقصان *"
                          className="rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: row.missingFields.includes(
                              'decreaseCount'
                            )
                              ? 'var(--danger)'
                              : 'var(--border-color)',
                          }}
                        />
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min={0}
                            value={row.resolvedAddOrDeleteCount ?? ''}
                            onChange={(e) =>
                              updateRow(row.id, {
                                resolvedAddOrDeleteCount:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                            placeholder="إضافة/حذف *"
                            className="w-full rounded-lg border px-2 py-1.5 text-xs tabular-nums"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: row.missingFields.includes(
                                'addOrDeleteCount'
                              )
                                ? 'var(--danger)'
                                : 'var(--border-color)',
                            }}
                          />
                          <select
                            value={row.resolvedAddOrDeleteAction}
                            onChange={(e) =>
                              updateRow(row.id, {
                                resolvedAddOrDeleteAction: e.target
                                  .value as QuickExtractEvaluatedRow['resolvedAddOrDeleteAction'],
                              })
                            }
                            className="rounded-lg border px-1.5 py-1.5 text-xs"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            <option value="لا يوجد">لا يوجد</option>
                            <option value="إضافة">إضافة</option>
                            <option value="حذف">حذف</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Zero-Blind-Commit Gate Lock Card */}
          {!gateUnlocked ? (
            <section
              aria-label="بوابة القفل الصارم قبل التحضير النهائي"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5"
              style={{
                backgroundColor: 'var(--warning-bg)',
                borderColor: 'var(--warning)',
                color: 'var(--warning)',
              }}
            >
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 shrink-0" />
                <div className="text-xs font-bold leading-relaxed">
                  شاشة التحضير النهائي والترحيل مقفلة حاليًا (Zero-Blind-Commit):
                  تأكد أولًا من حل جميع الأسماء المشكوك فيها باللون الأحمر وإكمال
                  كافة الحقول الناقصة أعلاه ({doubtedRows.length} شك ·{' '}
                  {missingRows.length} نواقص).
                </div>
              </div>
            </section>
          ) : (
            /* Stage 4: Final Preparation, Core Table Reuse & Smart Multi-Destination Routing */
            <section
              aria-label="شاشة التحضير والفلترة النهائية"
              className="space-y-4"
            >
              <RoutingPanel
                routing={routingConfig}
                agencies={agencies}
                readyLists={readyLists}
                planCounts={selectedPlanCounts}
                onChange={setRoutingConfig}
              />

              {/* Minimum Coverage Safety Warning */}
              {belowMinCoverage && activeSession && (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-xs"
                  style={{
                    backgroundColor: 'var(--warning-bg)',
                    borderColor: 'var(--warning)',
                    color: 'var(--warning)',
                  }}
                >
                  <div className="font-bold">
                    تنبيه أمان التغطية: التغطية الحالية (
                    {activeSession.coverage.overallPercent}%) أقل من الحد
                    الأدنى المطلوب ({activeSession.plan.minCoverageThreshold}%).
                    {activeSession.coverage.missingHint}
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={coverageOverrideConfirmed}
                      onChange={(e) =>
                        setCoverageOverrideConfirmed(e.target.checked)
                      }
                    />
                    <span>أقر بمتابعة الترحيل رغم نقص التغطية</span>
                  </label>
                </div>
              )}

              <div
                className="space-y-3 rounded-xl border p-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="h-4 w-4"
                      style={{ color: 'var(--accent)' }}
                    />
                    <h2 className="text-sm font-bold">
                      معاينة الجدول الأساسي والتحرير المباشر ({filteredReadyRows.length})
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={pastRows.length === 0}
                      onClick={handleLocalUndo}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-35"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <Undo2
                        className="h-3.5 w-3.5"
                        style={{ color: 'var(--accent)' }}
                      />
                      <span>تراجع</span>
                    </button>

                    <button
                      type="button"
                      disabled={futureRows.length === 0}
                      onClick={handleLocalRedo}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-35"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <Redo2
                        className="h-3.5 w-3.5"
                        style={{ color: 'var(--accent)' }}
                      />
                      <span>إعادة</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <Filter
                        className="h-3.5 w-3.5"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <input
                        type="search"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="فلترة الأسماء..."
                        className="rounded-lg border px-2.5 py-1.5 text-xs"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      />
                    </div>

                    <select
                      value={filterScope}
                      onChange={(e) =>
                        setFilterScope(
                          e.target.value as 'all' | 'new_only' | 'updates_only'
                        )
                      }
                      aria-label="فلترة نوع السجل"
                      className="rounded-lg border px-2.5 py-1.5 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <option value="all">الكل (جديد + تحديث)</option>
                      <option value="new_only">الأسماء الجديدة فقط</option>
                      <option value="updates_only">
                        المطابقة الموجودة فقط
                      </option>
                    </select>
                  </div>
                </div>

                {/* Shared Selection Action Bar */}
                <SelectionActionBar
                  selectedRecords={selectablePreviewRecords}
                  totalVisibleCount={filteredReadyRows.length}
                  agencies={agencies}
                  readyLists={readyLists}
                  relations={relations}
                  calculationSettings={calculationSettings}
                  tableTitle={fileName || 'السحب السريع'}
                  tableDate={new Date().toISOString().slice(0, 10)}
                  onSelectAll={() =>
                    setSelectedRowIds(filteredReadyRows.map((r) => r.id))
                  }
                  onClearSelection={() => setSelectedRowIds([])}
                  onMoveToAgency={onMovePersonsToAgency}
                  onAddToReadyList={onAddPersonsToReadyList}
                  onUpsertRelation={onUpsertRelation}
                />

                {/* Reused Core Application Spreadsheet Table */}
                <CoreRosterTable
                  rows={corePreviewRows}
                  selectedIds={selectedRowIds}
                  focusedRowKey={focusedRowKey}
                  calculationSettings={calculationSettings}
                  themePrefs={themePrefs}
                  showExtractColumns
                  editableInline
                  emptyMessage="لا توجد صفوف مطابقة لخيارات الفلترة الحالية."
                  onToggleSelectRow={(rowId) =>
                    setSelectedRowIds((prev) =>
                      prev.includes(rowId)
                        ? prev.filter((id) => id !== rowId)
                        : [...prev, rowId]
                    )
                  }
                  onToggleSelectAll={(checked) =>
                    setSelectedRowIds(
                      checked ? filteredReadyRows.map((r) => r.id) : []
                    )
                  }
                  onFocusRow={setFocusedRowKey}
                  onInlinePatchRow={(rowKey, patch) =>
                    updateRow(
                      rowKey,
                      {
                        ...(patch.name !== undefined
                          ? { resolvedName: patch.name }
                          : {}),
                        ...(patch.individuals !== undefined
                          ? { resolvedIndividuals: patch.individuals }
                          : {}),
                        ...(patch.decreaseCount !== undefined
                          ? { resolvedDecreaseCount: patch.decreaseCount }
                          : {}),
                        ...(patch.addOrDeleteCount !== undefined
                          ? { resolvedAddOrDeleteCount: patch.addOrDeleteCount }
                          : {}),
                        ...(patch.addOrDeleteAction !== undefined
                          ? {
                              resolvedAddOrDeleteAction:
                                patch.addOrDeleteAction,
                            }
                          : {}),
                        ...(patch.notes !== undefined
                          ? { notes: patch.notes }
                          : {}),
                      },
                      { resetConfirmOnNameEdit: false }
                    )
                  }
                  onOverrideRowRoute={(rowKey, mode) => {
                    setRoutingConfig((prev) => {
                      const nextOverrides = { ...(prev.rowOverrides || {}) };
                      if (mode === 'auto') {
                        delete nextOverrides[rowKey];
                      } else if (mode === 'exclude') {
                        nextOverrides[rowKey] = { excluded: true };
                      } else {
                        nextOverrides[rowKey] = {
                          excluded: false,
                          mergeStrategy: mode,
                        };
                      }
                      return { ...prev, rowOverrides: nextOverrides };
                    });
                  }}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    يتم الترحيل الفعلي فقط بعد ضغط زر الموافقة والاعتماد النهائي.
                  </div>

                  <button
                    type="button"
                    disabled={
                      !canProceedToCommit ||
                      (belowMinCoverage && !coverageOverrideConfirmed)
                    }
                    onClick={() => {
                      if (
                        selectedPlanCounts.update > 0 ||
                        selectedPlanCounts.replace > 0
                      ) {
                        setShowConfirmUpdates(true);
                      } else {
                        executeCommit();
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold whitespace-nowrap disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <Check className="h-4 w-4" />
                    <span>
                      الموافقة والترحيل النهائي ({rowsChosenForCommit.length} سجل)
                    </span>
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Confirmation Modal for Existing Record Updates or Replacement */}
      {showConfirmUpdates && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد التعديلات قبل الترحيل"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
        >
          <div
            className="w-full max-w-md rounded-xl border p-5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-color)',
            }}
          >
            <h3 className="text-base font-bold">
              تأكيد اعتماد التغييرات والترحيل النهائي
            </h3>
            <p
              className="mt-2 text-xs leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              يشمل الترحيل: إضافة <strong>{selectedPlanCounts.add}</strong> سجل
              جديد، وتحديث <strong>{selectedPlanCounts.update}</strong> سجل
              موجود
              {selectedPlanCounts.replace > 0
                ? `، واستبدال ${selectedPlanCounts.replace} سجل في الوجهة المختارة`
                : ''}
              . هل توافق على التنفيذ؟
            </p>
            <div className="mt-5 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowConfirmUpdates(false)}
                className="rounded-lg border px-4 py-2 font-medium"
                style={{ borderColor: 'var(--border-color)' }}
              >
                مراجعة وإلغاء
              </button>
              <button
                type="button"
                onClick={executeCommit}
                className="rounded-lg px-4 py-2 font-bold"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                موافق — تنفيذ الترحيل الآن
              </button>
            </div>
          </div>
        </div>
      )}

      <ReferenceTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSaveTemplate={onSaveQuickExtractTemplate}
      />

      <UcrsReportsAndStatsModal
        open={reportsModalOpen}
        session={activeSession}
        agencies={agencies}
        persons={persons}
        onClose={() => setReportsModalOpen(false)}
        onSpeakText={speakArabicText}
      />
    </main>
  );
};

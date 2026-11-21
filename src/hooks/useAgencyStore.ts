import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_EXPERT_TABLE_CONFIG,
  DEFAULT_GENERAL_PREFS,
  DEFAULT_QUICK_EXTRACT_PREFS,
  DEFAULT_RELATIONS_PREFS,
  DEFAULT_SECURITY_PREFS,
  INITIAL_DATABASE_STATE,
} from '../data/seedData';
import {
  deleteServerAppearanceProfile,
  getActiveBearerToken,
  getStoredSession,
  saveServerAppearanceProfile,
} from '../lib/authClient';
import {
  deleteAppearanceProfileFromFirestore,
  saveAppearanceProfileToFirestore,
  syncWorkspaceSummaryToFirestore,
} from '../lib/firestoreSync';
import type {
  Agency,
  AgencyExpense,
  AppearanceProfile,
  AppDatabaseState,
  AppModeTier,
  BlockScope,
  CalculationSettings,
  ExpenseCategory,
  ExpertCustomColumn,
  ExpertTableConfig,
  FreeformHeaderConfig,
  GeneralAppPrefs,
  MonthlyArchiveRecord,
  PeriodQuotaMeta,
  Person,
  QuickExtractCommitBucketSummary,
  QuickExtractCommitSummary,
  QuickExtractEvaluatedRow,
  QuickExtractPrefs,
  QuickExtractReferenceTemplate,
  QuickExtractRoutingConfig,
  ReadyList,
  ReadyListItem,
  RelationCategory,
  RelationEntry,
  RelationsReadyListsPrefs,
  SectionTableHeaderMeta,
  SecurityPrefs,
  ThemePreferences,
  TopBarConfig,
  UcrsLearningRule,
  UcrsSession,
} from '../types/agency';
import { DEFAULT_CALCULATION_SETTINGS, normalizeArabic } from '../utils/agencyLogic';
import { applyDiagnosticAutoFixes } from '../utils/assistantDiagnostics';
import {
  createMonthlyArchiveSnapshot,
  prepareNextMonthRollover,
  resolvePeriodMeta,
} from '../utils/archiveLogic';
import {
  computeAdjustedIndividuals,
  computeQuickExtractRoutingPlan,
  findExistingMatchInAgency,
} from '../utils/quickExtractEngine';
import {
  pushRecycleBinEntry,
  restoreRecycleBinEntryFromState,
} from '../utils/recycleBin';
import {
  applyThemePreferencesToDocument,
  DEFAULT_APPEARANCE_PROFILES,
  DEFAULT_THEME_PREFERENCES,
  getAppThemeById,
  resolveAppThemeId,
  resolveArabicFontId,
  resolveTableThemeId,
} from '../utils/themes';

const DB_STORAGE_KEY = 'flour_agency_db_v2';
const DEFAULT_MAX_UNDO_HISTORY = 35;

interface DataSnapshot {
  agencies: Agency[];
  persons: Person[];
  expenses: AgencyExpense[];
  readyLists: ReadyList[];
  readyListItems: ReadyListItem[];
  relations: RelationEntry[];
  tableHeaders: Record<string, SectionTableHeaderMeta>;
}

function pickDataSnapshot(state: AppDatabaseState): DataSnapshot {
  return {
    agencies: state.agencies,
    persons: state.persons,
    expenses: state.expenses,
    readyLists: state.readyLists,
    readyListItems: state.readyListItems,
    relations: state.relations,
    tableHeaders: state.tableHeaders,
  };
}

function normalizeReadyLists(
  lists: Partial<ReadyList>[],
  agencies: Agency[]
): ReadyList[] {
  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));
  const today = new Date().toISOString().slice(0, 10);
  return lists.map((l, idx) => ({
    id: l.id ?? idx + 1,
    agencyId: l.agencyId ?? agencies[0]?.id ?? 1,
    name: l.name || 'قائمة جاهزة',
    listDate: l.listDate || l.createdAt || today,
    subtitle1:
      l.subtitle1 ??
      (l.agencyId ? `الوكالة: ${agencyMap.get(l.agencyId) || ''}` : ''),
    subtitle2: l.subtitle2 ?? l.note ?? '',
    autoUpdateDate: l.autoUpdateDate ?? false,
    lastUpdatedAt: l.lastUpdatedAt || l.listDate || l.createdAt || today,
    createdAt: l.createdAt || l.listDate || today,
    note: l.note ?? l.subtitle2 ?? '',
  }));
}

function loadInitialState(): AppDatabaseState {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) return INITIAL_DATABASE_STATE;
    const parsed = JSON.parse(raw) as Partial<AppDatabaseState>;
    const agencies =
      Array.isArray(parsed.agencies) && parsed.agencies.length > 0
        ? parsed.agencies
        : INITIAL_DATABASE_STATE.agencies;
    return {
      ...INITIAL_DATABASE_STATE,
      ...parsed,
      agencies,
      persons: Array.isArray(parsed.persons)
        ? parsed.persons
        : INITIAL_DATABASE_STATE.persons,
      expenses: Array.isArray(parsed.expenses)
        ? parsed.expenses
        : INITIAL_DATABASE_STATE.expenses,
      readyLists: Array.isArray(parsed.readyLists)
        ? normalizeReadyLists(parsed.readyLists, agencies)
        : INITIAL_DATABASE_STATE.readyLists,
      readyListItems: Array.isArray(parsed.readyListItems)
        ? parsed.readyListItems
        : INITIAL_DATABASE_STATE.readyListItems,
      relations: Array.isArray(parsed.relations)
        ? parsed.relations
        : INITIAL_DATABASE_STATE.relations,
      tableHeaders:
        parsed.tableHeaders && typeof parsed.tableHeaders === 'object'
          ? { ...INITIAL_DATABASE_STATE.tableHeaders, ...parsed.tableHeaders }
          : INITIAL_DATABASE_STATE.tableHeaders,
      topBarConfig:
        parsed.topBarConfig && typeof parsed.topBarConfig === 'object'
          ? { ...INITIAL_DATABASE_STATE.topBarConfig, ...parsed.topBarConfig }
          : INITIAL_DATABASE_STATE.topBarConfig,
      modeTier: parsed.modeTier || 'beginner',
      editorEnabled: Boolean(parsed.editorEnabled),
      darkTheme: Boolean(parsed.darkTheme),
      requireLoginOnStart: Boolean(parsed.requireLoginOnStart),
      calculationSettings: {
        ...DEFAULT_CALCULATION_SETTINGS,
        ...(parsed.calculationSettings || {}),
      },
      themePrefs: {
        ...DEFAULT_THEME_PREFERENCES,
        ...(parsed.themePrefs || {}),
        appTheme: resolveAppThemeId(parsed.themePrefs?.appTheme),
        tableTheme: resolveTableThemeId(parsed.themePrefs?.tableTheme),
        fontFamily: resolveArabicFontId(parsed.themePrefs?.fontFamily),
        savedProfiles:
          Array.isArray(parsed.themePrefs?.savedProfiles) &&
          parsed.themePrefs!.savedProfiles!.length > 0
            ? parsed.themePrefs!.savedProfiles!
            : DEFAULT_APPEARANCE_PROFILES,
        conditionalFormatting: {
          ...DEFAULT_THEME_PREFERENCES.conditionalFormatting!,
          ...(parsed.themePrefs?.conditionalFormatting || {}),
        },
      },
      expertTableConfig: {
        ...DEFAULT_EXPERT_TABLE_CONFIG,
        ...(parsed.expertTableConfig || {}),
      },
      quickExtractPrefs: {
        ...DEFAULT_QUICK_EXTRACT_PREFS,
        ...(parsed.quickExtractPrefs || {}),
      },
      relationsPrefs: {
        ...DEFAULT_RELATIONS_PREFS,
        ...(parsed.relationsPrefs || {}),
      },
      generalPrefs: {
        ...DEFAULT_GENERAL_PREFS,
        ...(parsed.generalPrefs || {}),
      },
      securityPrefs: {
        ...DEFAULT_SECURITY_PREFS,
        ...(parsed.securityPrefs || {}),
      },
      recycleBin: Array.isArray(parsed.recycleBin) ? parsed.recycleBin : [],
      activePeriod: resolvePeriodMeta(
        parsed.activePeriod,
        INITIAL_DATABASE_STATE.activePeriod?.fullDate
      ),
      monthlyArchives: Array.isArray(parsed.monthlyArchives)
        ? parsed.monthlyArchives
        : INITIAL_DATABASE_STATE.monthlyArchives || [],
      ucrsSessions: Array.isArray(parsed.ucrsSessions)
        ? parsed.ucrsSessions
        : [],
      ucrsLearningRules: Array.isArray(parsed.ucrsLearningRules)
        ? parsed.ucrsLearningRules
        : [],
    };
  } catch {
    return INITIAL_DATABASE_STATE;
  }
}

export function useAgencyStore() {
  const [state, setState] = useState<AppDatabaseState>(loadInitialState);
  const [past, setPast] = useState<DataSnapshot[]>([]);
  const [future, setFuture] = useState<DataSnapshot[]>([]);

  useEffect(() => {
    const offlineEnabled = state.securityPrefs?.offlineCacheEnabled !== false;
    if (!offlineEnabled) return;
    try {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const activeThemePrefs: ThemePreferences = {
    ...DEFAULT_THEME_PREFERENCES,
    ...(state.themePrefs || {}),
  };

  useEffect(() => {
    applyThemePreferencesToDocument(activeThemePrefs);
  }, [
    activeThemePrefs.appTheme,
    activeThemePrefs.tableTheme,
    activeThemePrefs.fontFamily,
    activeThemePrefs.fontSize,
    activeThemePrefs.fontWeight,
    activeThemePrefs.rowDensity,
    activeThemePrefs.fontSizePx,
    activeThemePrefs.rowHeightPx,
    activeThemePrefs.colWidthScale,
    activeThemePrefs.borderRadiusPx,
    activeThemePrefs.cardShadowLevel,
    activeThemePrefs.glassEffect,
    activeThemePrefs.customBgColor,
    activeThemePrefs.customSurfaceColor,
    activeThemePrefs.customTextColor,
    activeThemePrefs.customAccentColor,
  ]);

  const maxUndo = Math.max(
    5,
    Math.min(100, state.generalPrefs?.undoLimit ?? DEFAULT_MAX_UNDO_HISTORY)
  );

  const commitDataMutation = useCallback(
    (mutator: (prev: AppDatabaseState) => AppDatabaseState) => {
      setState((prev) => {
        const snapshot = pickDataSnapshot(prev);
        const next = mutator(prev);
        if (next === prev) return prev;
        setPast((p) => [...p.slice(-(maxUndo - 1)), snapshot]);
        setFuture([]);
        return next;
      });
    },
    [maxUndo]
  );

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setState((curr) => {
        const currentSnap = pickDataSnapshot(curr);
        setFuture((f) => [currentSnap, ...f.slice(0, maxUndo - 1)]);
        return {
          ...curr,
          ...previous,
        };
      });
      return prevPast.slice(0, -1);
    });
  }, [maxUndo]);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const [nextSnap, ...restFuture] = prevFuture;
      setState((curr) => {
        const currentSnap = pickDataSnapshot(curr);
        setPast((p) => [...p.slice(-(maxUndo - 1)), currentSnap]);
        return {
          ...curr,
          ...nextSnap,
        };
      });
      return restFuture;
    });
  }, [maxUndo]);

  const setModeTier = useCallback((modeTier: AppModeTier) => {
    setState((prev) => ({
      ...prev,
      modeTier,
      editorEnabled: modeTier === 'beginner' ? false : prev.editorEnabled,
    }));
  }, []);

  const setEditorEnabled = useCallback((editorEnabled: boolean) => {
    setState((prev) => ({
      ...prev,
      editorEnabled: prev.modeTier === 'beginner' ? false : editorEnabled,
    }));
  }, []);

  const setDarkTheme = useCallback((darkTheme: boolean) => {
    setState((prev) => ({
      ...prev,
      darkTheme,
      themePrefs: {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
        appTheme: darkTheme ? 'obsidian-gold' : 'arctic-snow',
      },
    }));
  }, []);

  const setThemePrefs = useCallback((patch: Partial<ThemePreferences>) => {
    setState((prev) => {
      const merged: ThemePreferences = {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
        ...patch,
        activeProfileId:
          patch.activeProfileId !== undefined
            ? patch.activeProfileId
            : prev.themePrefs?.activeProfileId ?? null,
      };
      const themeMeta = getAppThemeById(merged.appTheme);
      return {
        ...prev,
        darkTheme: themeMeta.isDark,
        themePrefs: merged,
      };
    });
  }, []);

  const resetThemePrefs = useCallback(() => {
    setState((prev) => ({
      ...prev,
      darkTheme: false,
      themePrefs: {
        ...DEFAULT_THEME_PREFERENCES,
        savedProfiles:
          prev.themePrefs?.savedProfiles && prev.themePrefs.savedProfiles.length > 0
            ? prev.themePrefs.savedProfiles
            : DEFAULT_APPEARANCE_PROFILES,
      },
    }));
  }, []);

  const saveAppearanceProfile = useCallback((name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const id = `prof_${Date.now().toString(36)}`;
    let createdProfile: AppearanceProfile | null = null;
    setState((prev) => {
      const cur = {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
      };
      const profile: AppearanceProfile = {
        id,
        name: cleanName.slice(0, 80),
        appTheme: resolveAppThemeId(cur.appTheme),
        tableTheme: resolveTableThemeId(cur.tableTheme),
        fontFamily: resolveArabicFontId(cur.fontFamily),
        fontSizePx: cur.fontSizePx ?? 15,
        rowHeightPx: cur.rowHeightPx ?? 42,
        colWidthScale: cur.colWidthScale ?? 100,
        borderRadiusPx: cur.borderRadiusPx ?? 12,
        cardShadowLevel: cur.cardShadowLevel ?? 'soft',
        glassEffect: Boolean(cur.glassEffect),
        customBgColor: cur.customBgColor || '',
        customSurfaceColor: cur.customSurfaceColor || '',
        customTextColor: cur.customTextColor || '',
        customAccentColor: cur.customAccentColor || '',
        conditionalFormatting: cur.conditionalFormatting,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      createdProfile = profile;
      const existing = cur.savedProfiles || DEFAULT_APPEARANCE_PROFILES;
      return {
        ...prev,
        themePrefs: {
          ...cur,
          savedProfiles: [profile, ...existing].slice(0, 16),
          activeProfileId: profile.id,
        },
      };
    });
    if (createdProfile) {
      const sess = getStoredSession();
      void saveServerAppearanceProfile(createdProfile).catch(() => {});
      if (sess?.user?.uid) {
        void saveAppearanceProfileToFirestore(sess.user.uid, createdProfile).catch(() => {});
      }
    }
  }, []);

  const applyAppearanceProfile = useCallback((profileId: string) => {
    setState((prev) => {
      const cur = {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
      };
      const list = cur.savedProfiles || DEFAULT_APPEARANCE_PROFILES;
      const found = list.find((p) => p.id === profileId);
      if (!found) return prev;
      const themeMeta = getAppThemeById(found.appTheme);
      return {
        ...prev,
        darkTheme: themeMeta.isDark,
        themePrefs: {
          ...cur,
          appTheme: resolveAppThemeId(found.appTheme),
          tableTheme: resolveTableThemeId(found.tableTheme),
          fontFamily: resolveArabicFontId(found.fontFamily),
          fontSizePx: found.fontSizePx,
          rowHeightPx: found.rowHeightPx,
          colWidthScale: found.colWidthScale,
          borderRadiusPx: found.borderRadiusPx,
          cardShadowLevel: found.cardShadowLevel,
          glassEffect: found.glassEffect,
          customBgColor: found.customBgColor || '',
          customSurfaceColor: found.customSurfaceColor || '',
          customTextColor: found.customTextColor || '',
          customAccentColor: found.customAccentColor || '',
          conditionalFormatting:
            found.conditionalFormatting || cur.conditionalFormatting,
          activeProfileId: found.id,
        },
      };
    });
  }, []);

  const deleteAppearanceProfile = useCallback((profileId: string) => {
    setState((prev) => {
      const cur = {
        ...DEFAULT_THEME_PREFERENCES,
        ...(prev.themePrefs || {}),
      };
      const existing = cur.savedProfiles || DEFAULT_APPEARANCE_PROFILES;
      return {
        ...prev,
        themePrefs: {
          ...cur,
          savedProfiles: existing.filter((p) => p.id !== profileId),
          activeProfileId:
            cur.activeProfileId === profileId ? null : cur.activeProfileId,
        },
      };
    });
    const sess = getStoredSession();
    void deleteServerAppearanceProfile(profileId).catch(() => {});
    if (sess?.user?.uid) {
      void deleteAppearanceProfileFromFirestore(sess.user.uid, profileId).catch(() => {});
    }
  }, []);

  const setRequireLoginOnStart = useCallback((requireLoginOnStart: boolean) => {
    setState((prev) => ({ ...prev, requireLoginOnStart }));
  }, []);

  const setCalculationSettings = useCallback(
    (calculationSettings: CalculationSettings) => {
      setState((prev) => ({ ...prev, calculationSettings }));
    },
    []
  );

  const setTopBarConfig = useCallback((patch: Partial<TopBarConfig>) => {
    setState((prev) => ({
      ...prev,
      topBarConfig: {
        ...prev.topBarConfig,
        ...patch,
      },
    }));
  }, []);

  const updateTableHeaderMeta = useCallback(
    (key: string, patch: Partial<SectionTableHeaderMeta>) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const current = prev.tableHeaders?.[key] || {
          title: '',
          subtitle: '',
          date: today,
          autoUpdateDate: true,
          lastUpdatedAt: today,
        };
        return {
          ...prev,
          tableHeaders: {
            ...(prev.tableHeaders || {}),
            [key]: {
              ...current,
              ...patch,
              lastUpdatedAt: today,
            },
          },
        };
      });
    },
    [commitDataMutation]
  );

  // Expert Table Config, Quick Extract Prefs, Relations/General/Security Prefs
  const setExpertTableConfig = useCallback(
    (patch: Partial<ExpertTableConfig>) => {
      setState((prev) => ({
        ...prev,
        expertTableConfig: {
          ...DEFAULT_EXPERT_TABLE_CONFIG,
          ...(prev.expertTableConfig || {}),
          ...patch,
        },
      }));
    },
    []
  );

  const resetExpertTableConfig = useCallback(() => {
    setState((prev) => ({
      ...prev,
      expertTableConfig: { ...DEFAULT_EXPERT_TABLE_CONFIG },
    }));
  }, []);

  const addExpertCustomColumn = useCallback(
    (input: { label: string; type: 'text' | 'number' }) => {
      const cleanLabel = input.label.trim();
      if (!cleanLabel) return;
      const colId = `custom_${Date.now().toString(36)}`;
      const col: ExpertCustomColumn = {
        id: colId,
        label: cleanLabel,
        type: input.type,
      };
      setState((prev) => {
        const cur = {
          ...DEFAULT_EXPERT_TABLE_CONFIG,
          ...(prev.expertTableConfig || {}),
        };
        return {
          ...prev,
          expertTableConfig: {
            ...cur,
            customColumns: [...cur.customColumns, col],
            columnOrder: [...cur.columnOrder, colId],
            visibleColumns: [...cur.visibleColumns, colId],
            columnLabels: { ...cur.columnLabels, [colId]: cleanLabel },
          },
        };
      });
    },
    []
  );

  const removeExpertCustomColumn = useCallback((colId: string) => {
    setState((prev) => {
      const cur = {
        ...DEFAULT_EXPERT_TABLE_CONFIG,
        ...(prev.expertTableConfig || {}),
      };
      const nextLabels = { ...cur.columnLabels };
      delete nextLabels[colId];
      return {
        ...prev,
        expertTableConfig: {
          ...cur,
          customColumns: cur.customColumns.filter((c) => c.id !== colId),
          columnOrder: cur.columnOrder.filter((id) => id !== colId),
          visibleColumns: cur.visibleColumns.filter((id) => id !== colId),
          columnLabels: nextLabels,
        },
      };
    });
  }, []);

  const setQuickExtractPrefs = useCallback(
    (patch: Partial<QuickExtractPrefs>) => {
      setState((prev) => ({
        ...prev,
        quickExtractPrefs: {
          ...DEFAULT_QUICK_EXTRACT_PREFS,
          ...(prev.quickExtractPrefs || {}),
          ...patch,
        },
      }));
    },
    []
  );

  const saveQuickExtractTemplate = useCallback(
    (template: QuickExtractReferenceTemplate) => {
      setState((prev) => {
        const cur = {
          ...DEFAULT_QUICK_EXTRACT_PREFS,
          ...(prev.quickExtractPrefs || {}),
        };
        const exists = cur.referenceTemplates.some((t) => t.id === template.id);
        const nextTemplates = exists
          ? cur.referenceTemplates.map((t) =>
              t.id === template.id ? template : t
            )
          : [template, ...cur.referenceTemplates].slice(0, 8);
        return {
          ...prev,
          quickExtractPrefs: {
            ...cur,
            referenceTemplates: nextTemplates,
            activeTemplateId: template.id,
          },
        };
      });
    },
    []
  );

  const deleteQuickExtractTemplate = useCallback((templateId: string) => {
    setState((prev) => {
      const cur = {
        ...DEFAULT_QUICK_EXTRACT_PREFS,
        ...(prev.quickExtractPrefs || {}),
      };
      const remaining = cur.referenceTemplates.filter(
        (t) => t.id !== templateId
      );
      return {
        ...prev,
        quickExtractPrefs: {
          ...cur,
          referenceTemplates: remaining,
          activeTemplateId:
            cur.activeTemplateId === templateId
              ? remaining[0]?.id ?? null
              : cur.activeTemplateId,
        },
      };
    });
  }, []);

  const setRelationsPrefs = useCallback(
    (patch: Partial<RelationsReadyListsPrefs>) => {
      setState((prev) => ({
        ...prev,
        relationsPrefs: {
          ...DEFAULT_RELATIONS_PREFS,
          ...(prev.relationsPrefs || {}),
          ...patch,
        },
      }));
    },
    []
  );

  const setGeneralPrefs = useCallback((patch: Partial<GeneralAppPrefs>) => {
    setState((prev) => ({
      ...prev,
      generalPrefs: {
        ...DEFAULT_GENERAL_PREFS,
        ...(prev.generalPrefs || {}),
        ...patch,
      },
    }));
  }, []);

  const setSecurityPrefs = useCallback((patch: Partial<SecurityPrefs>) => {
    setState((prev) => ({
      ...prev,
      securityPrefs: {
        ...DEFAULT_SECURITY_PREFS,
        ...(prev.securityPrefs || {}),
        ...patch,
      },
    }));
  }, []);

  const restoreRecycleBinItem = useCallback((entryId: string) => {
    setState((prev) => restoreRecycleBinEntryFromState(prev, entryId));
  }, []);

  const purgeRecycleBinItem = useCallback((entryId: string) => {
    setState((prev) => ({
      ...prev,
      recycleBin: (prev.recycleBin || []).filter((e) => e.id !== entryId),
    }));
  }, []);

  const clearRecycleBin = useCallback(() => {
    setState((prev) => ({
      ...prev,
      recycleBin: [],
    }));
  }, []);

  const importWorkspaceJson = useCallback((rawJson: string) => {
    const parsed = JSON.parse(rawJson) as Partial<AppDatabaseState>;
    if (!Array.isArray(parsed.agencies) || !Array.isArray(parsed.persons)) {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو ينقصه سجل الوكالات والأفراد.');
    }
    setState((prev) => ({
      ...prev,
      ...parsed,
      agencies: parsed.agencies!,
      persons: parsed.persons!,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : prev.expenses,
      readyLists: Array.isArray(parsed.readyLists)
        ? normalizeReadyLists(parsed.readyLists, parsed.agencies!)
        : prev.readyLists,
      readyListItems: Array.isArray(parsed.readyListItems)
        ? parsed.readyListItems
        : prev.readyListItems,
      relations: Array.isArray(parsed.relations)
        ? parsed.relations
        : prev.relations,
    }));
    setPast([]);
    setFuture([]);
  }, []);

  // Add Person — Direct without confirmation per Editor rules
  const addPersonDirect = useCallback(
    (input: {
      agencyId: number;
      name: string;
      nationalId: string;
      individuals: number | null;
      notes: string;
      blockType?: Person['blockType'];
      blockedIndividuals?: number;
      blockReason?: string;
      customCategory?: string;
      customFields?: Record<string, string>;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const nextId =
          prev.persons.reduce((max, p) => Math.max(max, p.id), 100) + 1;
        const bType = input.blockType || 'none';
        const status: Person['status'] =
          bType === 'full' ? 'محجوب' : bType === 'archived' ? 'مؤرشف' : '';
        const newPerson: Person = {
          id: nextId,
          agencyId: input.agencyId,
          name: input.name.trim(),
          nationalId: input.nationalId.trim(),
          individuals: input.individuals,
          blockType: bType,
          blockedIndividuals: input.blockedIndividuals ?? 0,
          blockReason: input.blockReason || '',
          status,
          notes: input.notes.trim(),
          customCategory: input.customCategory || '',
          customFields: input.customFields || {},
          updatedAt: today,
        };
        return {
          ...prev,
          persons: [...prev.persons, newPerson],
        };
      });
    },
    [commitDataMutation]
  );

  // Update Person — Invoked after confirmation modal (or directly in Expert unrestricted mode)
  const updatePersonConfirmed = useCallback(
    (
      personId: number,
      patch: Partial<
        Pick<
          Person,
          | 'name'
          | 'nationalId'
          | 'individuals'
          | 'blockType'
          | 'blockedIndividuals'
          | 'blockReason'
          | 'status'
          | 'notes'
          | 'agencyId'
          | 'customCategory'
          | 'customFields'
        >
      >
    ) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => ({
        ...prev,
        persons: prev.persons.map((p) => {
          if (p.id !== personId) return p;
          const nextBlockType = patch.blockType ?? p.blockType;
          const nextStatus: Person['status'] =
            nextBlockType === 'full'
              ? 'محجوب'
              : nextBlockType === 'archived'
              ? 'مؤرشف'
              : '';
          const nextTotal =
            patch.individuals !== undefined ? patch.individuals : p.individuals;
          const nextBlocked =
            nextBlockType === 'partial'
              ? Math.min(
                  nextTotal ?? 0,
                  Math.max(0, patch.blockedIndividuals ?? p.blockedIndividuals)
                )
              : nextBlockType === 'full'
              ? nextTotal ?? 0
              : 0;
          return {
            ...p,
            ...patch,
            customFields: patch.customFields
              ? { ...(p.customFields || {}), ...patch.customFields }
              : p.customFields,
            blockType: nextBlockType,
            status: nextStatus,
            blockedIndividuals: nextBlocked,
            updatedAt: today,
          };
        }),
      }));
    },
    [commitDataMutation]
  );

  const bulkUpdatePersonsCategory = useCallback(
    (personIds: number[], customCategory: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const idSet = new Set(personIds);
      commitDataMutation((prev) => ({
        ...prev,
        persons: prev.persons.map((p) =>
          idSet.has(p.id) ? { ...p, customCategory, updatedAt: today } : p
        ),
      }));
    },
    [commitDataMutation]
  );

  // Delete Person — Invoked after confirmation modal (and pushed to Safe Recycle Bin)
  const deletePersonConfirmed = useCallback(
    (personId: number) => {
      commitDataMutation((prev) => {
        const target = prev.persons.find((p) => p.id === personId);
        return {
          ...prev,
          persons: prev.persons.filter((p) => p.id !== personId),
          readyListItems: prev.readyListItems.filter(
            (item) => item.sourcePersonId !== personId
          ),
          recycleBin: target
            ? pushRecycleBinEntry(prev.recycleBin, {
                kind: 'person',
                label: target.name,
                payload: { kind: 'person', person: target },
              })
            : prev.recycleBin,
        };
      });
    },
    [commitDataMutation]
  );

  // Quick Extract Commit (Multi-Destination, Split & Merge Strategy)
  const commitQuickExtractPlan = useCallback(
    (params: {
      rows: QuickExtractEvaluatedRow[];
      routing: QuickExtractRoutingConfig;
    }): QuickExtractCommitSummary => {
      const today = new Date().toISOString().slice(0, 10);
      let summaryResult: QuickExtractCommitSummary = {
        totalRows: params.rows.length,
        added: 0,
        updated: 0,
        replaced: 0,
        buckets: [],
      };

      commitDataMutation((prev) => {
        const plan = computeQuickExtractRoutingPlan({
          rows: params.rows,
          routing: params.routing,
          agencies: prev.agencies,
          persons: prev.persons,
          readyLists: prev.readyLists,
          readyListItems: prev.readyListItems,
        });

        let nextPersons = [...prev.persons];
        let nextReadyLists = [...prev.readyLists];
        let nextReadyListItems = [...prev.readyListItems];

        let maxPersonId = nextPersons.reduce((m, p) => Math.max(m, p.id), 100);
        let maxListId = nextReadyLists.reduce((m, l) => Math.max(m, l.id), 0);
        let maxItemId = nextReadyListItems.reduce(
          (m, it) => Math.max(m, it.id),
          0
        );

        const bucketMap = new Map<string, QuickExtractCommitBucketSummary>();
        const createdReadyListIds = new Map<string, number>();

        // Handle "replace" strategy per targeted destination bucket before inserting replacements
        const agencyIdsToReplace = new Set<number>();
        const existingReadyListIdsToReplace = new Set<number>();
        for (const item of plan.items) {
          if (item.actionType === 'skip_unmatched') continue;
          if (item.mergeStrategy === 'replace') {
            if (item.destination.kind === 'agency') {
              agencyIdsToReplace.add(item.destination.agencyId);
            } else if (
              item.destination.kind === 'existing_ready_list' &&
              item.destination.existingReadyListId
            ) {
              existingReadyListIdsToReplace.add(
                item.destination.existingReadyListId
              );
            }
          }
        }
        if (agencyIdsToReplace.size > 0) {
          nextPersons = nextPersons.filter(
            (p) => !agencyIdsToReplace.has(p.agencyId)
          );
        }
        if (existingReadyListIdsToReplace.size > 0) {
          nextReadyListItems = nextReadyListItems.filter(
            (it) => !existingReadyListIdsToReplace.has(it.listId)
          );
        }

        let effectiveTotal = 0;

        for (const item of plan.items) {
          if (item.actionType === 'skip_unmatched') continue;
          effectiveTotal += 1;

          const { row, destination, finalIndividuals, adjustmentNote } = item;

          if (!bucketMap.has(item.bucketKey)) {
            bucketMap.set(item.bucketKey, {
              destinationLabel: item.destinationLabel,
              destinationKind: destination.kind,
              agencyId:
                destination.kind === 'agency' ? destination.agencyId : undefined,
              readyListId:
                destination.kind === 'existing_ready_list'
                  ? destination.existingReadyListId
                  : undefined,
              added: 0,
              updated: 0,
              replaced: 0,
            });
          }
          const bucket = bucketMap.get(item.bucketKey)!;

          if (destination.kind === 'existing_ready_list') {
            const targetListId =
              destination.existingReadyListId || nextReadyLists[0]?.id;
            if (!targetListId) continue;
            bucket.readyListId = targetListId;
            const normName = normalizeArabic(row.resolvedName);

            if (item.mergeStrategy === 'update_matched') {
              const existingIdx = nextReadyListItems.findIndex(
                (it) =>
                  it.listId === targetListId &&
                  normalizeArabic(it.name) === normName
              );
              if (existingIdx !== -1) {
                nextReadyListItems[existingIdx] = {
                  ...nextReadyListItems[existingIdx],
                  individuals: finalIndividuals,
                  notes: adjustmentNote,
                  isOverridden: true,
                };
                bucket.updated += 1;
                summaryResult.updated += 1;
                continue;
              }
            }

            const currentPos = nextReadyListItems.filter(
              (it) => it.listId === targetListId
            ).length;
            maxItemId += 1;
            const matchedGlobal = findExistingMatchInAgency(
              row.resolvedName,
              nextPersons
            );
            nextReadyListItems.push({
              id: maxItemId,
              listId: targetListId,
              position: currentPos + 1,
              sourcePersonId: matchedGlobal ? matchedGlobal.id : null,
              name: row.resolvedName.trim(),
              nationalId: matchedGlobal?.nationalId || '',
              individuals: finalIndividuals,
              blockType: 'none',
              blockedIndividuals: 0,
              blockReason: '',
              status: '',
              notes: adjustmentNote,
              isOverridden: true,
            });
            if (item.mergeStrategy === 'replace') {
              bucket.replaced += 1;
              summaryResult.replaced += 1;
            } else {
              bucket.added += 1;
              summaryResult.added += 1;
            }
            continue;
          }

          if (destination.kind === 'ready_list') {
            let listId = createdReadyListIds.get(item.bucketKey);
            if (!listId) {
              maxListId += 1;
              listId = maxListId;
              createdReadyListIds.set(item.bucketKey, listId);
              const meta = destination.readyListMeta;
              const newList: ReadyList = {
                id: listId,
                agencyId: destination.agencyId || prev.agencies[0]?.id || 1,
                name: meta.name.trim() || 'قائمة مستخرجة (السحب السريع)',
                listDate: meta.listDate || today,
                subtitle1: meta.subtitle1.trim(),
                subtitle2: meta.subtitle2.trim(),
                autoUpdateDate: meta.autoUpdateDate,
                lastUpdatedAt: today,
                createdAt: today,
                note: meta.subtitle2.trim(),
              };
              nextReadyLists.push(newList);
            }
            bucket.readyListId = listId;
            const currentPos = nextReadyListItems.filter(
              (it) => it.listId === listId
            ).length;
            maxItemId += 1;
            const matchedInAgency = findExistingMatchInAgency(
              row.resolvedName,
              nextPersons.filter((p) => p.agencyId === destination.agencyId)
            );
            nextReadyListItems.push({
              id: maxItemId,
              listId,
              position: currentPos + 1,
              sourcePersonId: matchedInAgency ? matchedInAgency.id : null,
              name: row.resolvedName.trim(),
              nationalId: matchedInAgency?.nationalId || '',
              individuals: finalIndividuals,
              blockType: 'none',
              blockedIndividuals: 0,
              blockReason: '',
              status: '',
              notes: adjustmentNote,
              isOverridden: true,
            });
            bucket.added += 1;
            summaryResult.added += 1;
            continue;
          }

          // Target is specific agency OR master_roster
          const targetAgencyForNew =
            destination.kind === 'agency'
              ? destination.agencyId
              : prev.agencies[0]?.id || 1;

          const searchPool =
            destination.kind === 'master_roster'
              ? nextPersons
              : nextPersons.filter((p) => p.agencyId === targetAgencyForNew);

          const existing =
            item.mergeStrategy === 'add_new'
              ? null
              : findExistingMatchInAgency(row.resolvedName, searchPool);

          if (existing && item.mergeStrategy === 'update_matched') {
            const idx = nextPersons.findIndex((p) => p.id === existing.id);
            if (idx !== -1) {
              nextPersons[idx] = {
                ...nextPersons[idx],
                individuals: finalIndividuals,
                decreaseCount: row.resolvedDecreaseCount ?? nextPersons[idx].decreaseCount ?? 0,
                addOrDeleteCount:
                  row.resolvedAddOrDeleteCount ?? nextPersons[idx].addOrDeleteCount ?? 0,
                addOrDeleteAction:
                  row.resolvedAddOrDeleteAction || nextPersons[idx].addOrDeleteAction || 'لا يوجد',
                notes: nextPersons[idx].notes
                  ? `${nextPersons[idx].notes} · ${adjustmentNote}`
                  : adjustmentNote,
                updatedAt: today,
              };
              bucket.updated += 1;
              summaryResult.updated += 1;
              continue;
            }
          }

          maxPersonId += 1;
          nextPersons.push({
            id: maxPersonId,
            agencyId: existing ? existing.agencyId : targetAgencyForNew,
            name: row.resolvedName.trim(),
            nationalId: '',
            individuals: finalIndividuals,
            decreaseCount: row.resolvedDecreaseCount ?? 0,
            addOrDeleteCount: row.resolvedAddOrDeleteCount ?? 0,
            addOrDeleteAction: row.resolvedAddOrDeleteAction || 'لا يوجد',
            blockType: 'none',
            blockedIndividuals: 0,
            blockReason: '',
            status: '',
            notes: adjustmentNote,
            updatedAt: today,
          });
          if (item.mergeStrategy === 'replace') {
            bucket.replaced += 1;
            summaryResult.replaced += 1;
          } else {
            bucket.added += 1;
            summaryResult.added += 1;
          }
        }

        summaryResult = {
          ...summaryResult,
          totalRows: effectiveTotal,
          buckets: Array.from(bucketMap.values()),
        };

        return {
          ...prev,
          persons: nextPersons,
          readyLists: nextReadyLists,
          readyListItems: nextReadyListItems,
        };
      });

      return summaryResult;
    },
    [commitDataMutation]
  );

  // Legacy single-agency helper preserved for compatibility
  const commitQuickExtractRows = useCallback(
    (params: { targetAgencyId: number; rows: QuickExtractEvaluatedRow[] }) => {
      const today = new Date().toISOString().slice(0, 10);
      let added = 0;
      let updated = 0;

      commitDataMutation((prev) => {
        const nextPersons = [...prev.persons];
        let maxId = nextPersons.reduce((m, p) => Math.max(m, p.id), 100);

        for (const row of params.rows) {
          const calc = computeAdjustedIndividuals(row);
          const agencyPersons = nextPersons.filter(
            (p) => p.agencyId === params.targetAgencyId
          );
          const existing = findExistingMatchInAgency(
            row.resolvedName,
            agencyPersons
          );

          if (existing) {
            const idx = nextPersons.findIndex((p) => p.id === existing.id);
            if (idx !== -1) {
              nextPersons[idx] = {
                ...nextPersons[idx],
                individuals: calc.finalIndividuals,
                notes: nextPersons[idx].notes
                  ? `${nextPersons[idx].notes} · ${calc.adjustmentNote}`
                  : calc.adjustmentNote,
                updatedAt: today,
              };
              updated += 1;
            }
          } else {
            maxId += 1;
            nextPersons.push({
              id: maxId,
              agencyId: params.targetAgencyId,
              name: row.resolvedName.trim(),
              nationalId: '',
              individuals: calc.finalIndividuals,
              blockType: 'none',
              blockedIndividuals: 0,
              blockReason: '',
              status: '',
              notes: calc.adjustmentNote,
              updatedAt: today,
            });
            added += 1;
          }
        }

        return {
          ...prev,
          persons: nextPersons,
        };
      });

      return { added, updated };
    },
    [commitDataMutation]
  );

  // Finance Expenses (Worker Wages vs General Expenses)
  const addExpense = useCallback(
    (input: {
      agencyId: number;
      description: string;
      amountIqd: number;
      category: ExpenseCategory;
      occurredAt?: string;
    }) => {
      const dateStr = input.occurredAt || new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const nextId =
          prev.expenses.reduce((m, e) => Math.max(m, e.id), 0) + 1;
        const entry: AgencyExpense = {
          id: nextId,
          agencyId: input.agencyId,
          description: input.description.trim(),
          amountIqd: Math.max(0, Math.round(input.amountIqd)),
          category: input.category,
          occurredAt: dateStr,
        };
        return {
          ...prev,
          expenses: [entry, ...prev.expenses],
        };
      });
    },
    [commitDataMutation]
  );

  const deleteExpenseConfirmed = useCallback(
    (expenseId: number) => {
      commitDataMutation((prev) => {
        const target = prev.expenses.find((e) => e.id === expenseId);
        return {
          ...prev,
          expenses: prev.expenses.filter((e) => e.id !== expenseId),
          recycleBin: target
            ? pushRecycleBinEntry(prev.recycleBin, {
                kind: 'expense',
                label: target.description,
                payload: { kind: 'expense', expense: target },
              })
            : prev.recycleBin,
        };
      });
    },
    [commitDataMutation]
  );

  // Ready Lists
  const createReadyList = useCallback(
    (input: {
      agencyId: number;
      name: string;
      listDate?: string;
      subtitle1?: string;
      subtitle2?: string;
      autoUpdateDate?: boolean;
      note?: string;
      populateFromAgency?: boolean;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      let createdListId = 0;
      commitDataMutation((prev) => {
        const nextListId =
          prev.readyLists.reduce((m, l) => Math.max(m, l.id), 0) + 1;
        createdListId = nextListId;
        const agencyName =
          prev.agencies.find((a) => a.id === input.agencyId)?.name || '';
        const shouldPopulate = input.populateFromAgency !== false;
        const agencyPersons = shouldPopulate
          ? prev.persons.filter(
              (p) => p.agencyId === input.agencyId && p.status !== 'مؤرشف'
            )
          : [];
        let nextItemId =
          prev.readyListItems.reduce((m, it) => Math.max(m, it.id), 0) + 1;

        const newItems: ReadyListItem[] = agencyPersons.map((p, idx) => ({
          id: nextItemId++,
          listId: nextListId,
          position: idx + 1,
          sourcePersonId: p.id,
          name: p.name,
          nationalId: p.nationalId,
          individuals: p.individuals,
          blockType: p.blockType,
          blockedIndividuals: p.blockedIndividuals,
          blockReason: p.blockReason,
          status: p.status,
          notes: p.notes,
        }));

        const listDate = input.listDate?.trim() || today;
        const subtitle1 =
          input.subtitle1?.trim() ||
          (agencyName ? `الوكالة: ${agencyName}` : '');
        const subtitle2 = input.subtitle2?.trim() || input.note?.trim() || '';

        return {
          ...prev,
          readyLists: [
            ...prev.readyLists,
            {
              id: nextListId,
              agencyId: input.agencyId,
              name: input.name.trim(),
              listDate,
              subtitle1,
              subtitle2,
              autoUpdateDate: input.autoUpdateDate ?? true,
              lastUpdatedAt: today,
              createdAt: today,
              note: subtitle2,
            },
          ],
          readyListItems: [...prev.readyListItems, ...newItems],
        };
      });
      return createdListId;
    },
    [commitDataMutation]
  );

  const updateReadyListMetaConfirmed = useCallback(
    (
      listId: number,
      patch: {
        name?: string;
        listDate?: string;
        subtitle1?: string;
        subtitle2?: string;
        autoUpdateDate?: boolean;
        periodMeta?: PeriodQuotaMeta;
        freeformHeader?: FreeformHeaderConfig;
      }
    ) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => ({
        ...prev,
        readyLists: prev.readyLists.map((l) =>
          l.id === listId
            ? {
                ...l,
                name: patch.name !== undefined ? patch.name.trim() : l.name,
                listDate: patch.listDate?.trim() || l.listDate,
                subtitle1:
                  patch.subtitle1 !== undefined ? patch.subtitle1.trim() : l.subtitle1,
                subtitle2:
                  patch.subtitle2 !== undefined ? patch.subtitle2.trim() : l.subtitle2,
                autoUpdateDate: patch.autoUpdateDate ?? l.autoUpdateDate ?? false,
                lastUpdatedAt: today,
                note:
                  patch.subtitle2 !== undefined ? patch.subtitle2.trim() : l.note,
                periodMeta: patch.periodMeta ?? l.periodMeta,
                freeformHeader: patch.freeformHeader ?? l.freeformHeader,
              }
            : l
        ),
      }));
    },
    [commitDataMutation]
  );

  const deleteReadyListConfirmed = useCallback(
    (listId: number) => {
      commitDataMutation((prev) => {
        const targetList = prev.readyLists.find((l) => l.id === listId);
        const listItems = prev.readyListItems.filter(
          (it) => it.listId === listId
        );
        return {
          ...prev,
          readyLists: prev.readyLists.filter((l) => l.id !== listId),
          readyListItems: prev.readyListItems.filter((it) => it.listId !== listId),
          recycleBin: targetList
            ? pushRecycleBinEntry(prev.recycleBin, {
                kind: 'ready_list',
                label: targetList.name,
                payload: { kind: 'ready_list', list: targetList, items: listItems },
              })
            : prev.recycleBin,
        };
      });
    },
    [commitDataMutation]
  );

  const addReadyListItemDirect = useCallback(
    (input: {
      listId: number;
      name: string;
      nationalId?: string;
      individuals: number | null;
      notes: string;
    }) => {
      commitDataMutation((prev) => {
        const nextId =
          prev.readyListItems.reduce((m, it) => Math.max(m, it.id), 0) + 1;
        const maxPos = prev.readyListItems
          .filter((it) => it.listId === input.listId)
          .reduce((m, it) => Math.max(m, it.position), 0);
        const newItem: ReadyListItem = {
          id: nextId,
          listId: input.listId,
          position: maxPos + 1,
          sourcePersonId: null,
          name: input.name.trim(),
          nationalId: input.nationalId?.trim() || '',
          individuals: input.individuals,
          blockType: 'none',
          blockedIndividuals: 0,
          blockReason: '',
          status: '',
          notes: input.notes.trim(),
          isOverridden: true,
        };
        return {
          ...prev,
          readyListItems: [...prev.readyListItems, newItem],
        };
      });
    },
    [commitDataMutation]
  );

  const updateReadyListItemConfirmed = useCallback(
    (
      itemId: number,
      patch: {
        name?: string;
        nationalId?: string;
        individuals?: number | null;
        blockType?: BlockScope;
        blockedIndividuals?: number;
        blockReason?: string;
        notes?: string;
      }
    ) => {
      commitDataMutation((prev) => ({
        ...prev,
        readyListItems: prev.readyListItems.map((it) => {
          if (it.id !== itemId) return it;
          const nextBlockType = patch.blockType ?? it.blockType ?? 'none';
          const nextStatus: ReadyListItem['status'] =
            nextBlockType === 'full'
              ? 'محجوب'
              : nextBlockType === 'archived'
              ? 'مؤرشف'
              : '';
          const nextTotal =
            patch.individuals !== undefined ? patch.individuals : it.individuals;
          const nextBlocked =
            nextBlockType === 'partial'
              ? Math.min(
                  nextTotal ?? 0,
                  Math.max(
                    0,
                    patch.blockedIndividuals ?? it.blockedIndividuals ?? 0
                  )
                )
              : nextBlockType === 'full'
              ? nextTotal ?? 0
              : 0;
          return {
            ...it,
            ...patch,
            blockType: nextBlockType,
            status: nextStatus,
            blockedIndividuals: nextBlocked,
            isOverridden: true,
          };
        }),
      }));
    },
    [commitDataMutation]
  );

  const removeReadyListItemConfirmed = useCallback(
    (itemId: number) => {
      commitDataMutation((prev) => ({
        ...prev,
        readyListItems: prev.readyListItems.filter((it) => it.id !== itemId),
      }));
    },
    [commitDataMutation]
  );

  const addPersonsToReadyList = useCallback(
    (listId: number, personIds: number[], overrideNotesMap?: Record<number, string>) => {
      const today = new Date().toISOString().slice(0, 10);
      let addedCount = 0;
      commitDataMutation((prev) => {
        const existingSourceIds = new Set(
          prev.readyListItems
            .filter((it) => it.listId === listId && it.sourcePersonId !== null)
            .map((it) => it.sourcePersonId as number)
        );
        let nextId =
          prev.readyListItems.reduce((m, it) => Math.max(m, it.id), 0) + 1;
        let maxPos = prev.readyListItems
          .filter((it) => it.listId === listId)
          .reduce((m, it) => Math.max(m, it.position), 0);

        const newItems: ReadyListItem[] = [];
        for (const pid of personIds) {
          if (existingSourceIds.has(pid)) continue;
          const p = prev.persons.find((cand) => cand.id === pid);
          if (!p) continue;
          existingSourceIds.add(pid);
          maxPos += 1;
          addedCount += 1;
          newItems.push({
            id: nextId++,
            listId,
            position: maxPos,
            sourcePersonId: p.id,
            name: p.name,
            nationalId: p.nationalId,
            individuals: p.individuals,
            blockType: p.blockType,
            blockedIndividuals: p.blockedIndividuals,
            blockReason: p.blockReason,
            status: p.status,
            notes: overrideNotesMap?.[pid] ?? p.notes,
          });
        }

        if (newItems.length === 0) return prev;
        return {
          ...prev,
          readyLists: prev.readyLists.map((l) =>
            l.id === listId ? { ...l, lastUpdatedAt: today } : l
          ),
          readyListItems: [...prev.readyListItems, ...newItems],
        };
      });
      return addedCount;
    },
    [commitDataMutation]
  );

  const moveReadyListItemOrder = useCallback(
    (itemId: number, direction: 'up' | 'down') => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const target = prev.readyListItems.find((it) => it.id === itemId);
        if (!target) return prev;
        const siblings = prev.readyListItems
          .filter((it) => it.listId === target.listId)
          .sort((a, b) => a.position - b.position);
        const idx = siblings.findIndex((it) => it.id === itemId);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) {
          return prev;
        }
        const a = siblings[idx];
        const b = siblings[swapIdx];
        return {
          ...prev,
          readyLists: prev.readyLists.map((l) =>
            l.id === target.listId ? { ...l, lastUpdatedAt: today } : l
          ),
          readyListItems: prev.readyListItems.map((it) => {
            if (it.id === a.id) return { ...it, position: b.position };
            if (it.id === b.id) return { ...it, position: a.position };
            return it;
          }),
        };
      });
    },
    [commitDataMutation]
  );

  const movePersonsToAgencyConfirmed = useCallback(
    (personIds: number[], targetAgencyId: number) => {
      const today = new Date().toISOString().slice(0, 10);
      const idSet = new Set(personIds);
      commitDataMutation((prev) => ({
        ...prev,
        persons: prev.persons.map((p) =>
          idSet.has(p.id)
            ? { ...p, agencyId: targetAgencyId, updatedAt: today }
            : p
        ),
        relations: prev.relations.map((r) =>
          idSet.has(r.personId)
            ? { ...r, agencyId: targetAgencyId, updatedAt: today }
            : r
        ),
      }));
    },
    [commitDataMutation]
  );

  // Relationships Section
  const upsertRelationEntry = useCallback(
    (input: {
      personId: number;
      category: RelationCategory;
      note: string;
      reminderDate?: string;
      deliveryAddress?: string;
      deliveryPhone?: string;
      deliveryTime?: string;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      commitDataMutation((prev) => {
        const person = prev.persons.find((p) => p.id === input.personId);
        if (!person) return prev;
        const existingIdx = prev.relations.findIndex(
          (r) => r.personId === input.personId && r.category === input.category
        );
        if (existingIdx !== -1) {
          const updated = [...prev.relations];
          updated[existingIdx] = {
            ...updated[existingIdx],
            personName: person.name,
            agencyId: person.agencyId,
            note: input.note.trim(),
            reminderDate: input.reminderDate?.trim() || '',
            deliveryAddress: input.deliveryAddress?.trim() || '',
            deliveryPhone: input.deliveryPhone?.trim() || '',
            deliveryTime: input.deliveryTime?.trim() || '',
            updatedAt: today,
          };
          return { ...prev, relations: updated };
        }
        const nextId =
          prev.relations.reduce((m, r) => Math.max(m, r.id), 0) + 1;
        const entry: RelationEntry = {
          id: nextId,
          personId: person.id,
          personName: person.name,
          agencyId: person.agencyId,
          category: input.category,
          note: input.note.trim(),
          reminderDate: input.reminderDate?.trim() || '',
          deliveryAddress: input.deliveryAddress?.trim() || '',
          deliveryPhone: input.deliveryPhone?.trim() || '',
          deliveryTime: input.deliveryTime?.trim() || '',
          createdAt: today,
          updatedAt: today,
        };
        return {
          ...prev,
          relations: [entry, ...prev.relations],
        };
      });
    },
    [commitDataMutation]
  );

  const removeRelationEntryConfirmed = useCallback(
    (relationId: number) => {
      commitDataMutation((prev) => {
        const target = prev.relations.find((r) => r.id === relationId);
        return {
          ...prev,
          relations: prev.relations.filter((r) => r.id !== relationId),
          recycleBin: target
            ? pushRecycleBinEntry(prev.recycleBin, {
                kind: 'relation',
                label: target.personName,
                payload: { kind: 'relation', relation: target },
              })
            : prev.recycleBin,
        };
      });
    },
    [commitDataMutation]
  );

  // Agencies (Expert Mode)
  const addAgencyDirect = useCallback(
    (name: string, icon: string) => {
      commitDataMutation((prev) => {
        const nextId = prev.agencies.reduce((m, a) => Math.max(m, a.id), 0) + 1;
        return {
          ...prev,
          agencies: [
            ...prev.agencies,
            { id: nextId, name: name.trim(), icon: icon || '🏢', isLocked: false },
          ],
        };
      });
    },
    [commitDataMutation]
  );

  const updateAgencyDetails = useCallback(
    (
      agencyId: number,
      patch: Partial<Pick<Agency, 'name' | 'icon' | 'logoDataUrl' | 'isLocked'>>
    ) => {
      commitDataMutation((prev) => ({
        ...prev,
        agencies: prev.agencies.map((a) =>
          a.id === agencyId ? { ...a, ...patch } : a
        ),
      }));
    },
    [commitDataMutation]
  );

  const syncWorkspaceToServer = useCallback(async () => {
    const token = await getActiveBearerToken();
    const sess = getStoredSession();
    if (!token || !sess) {
      throw new Error('يرجى تسجيل الدخول أولًا لمزامنة البيانات.');
    }
    const res = await fetch('/api/workspace', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ snapshot: state }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'تعذرت المزامنة.');

    void syncWorkspaceSummaryToFirestore({
      uid: sess.user.uid,
      title: state.activePeriod?.quotaName || 'مساحة عمل تابريكس',
      agencyCount: state.agencies.length,
      recordCount: state.persons.length,
      themePrefs: state.themePrefs,
    }).catch(() => {});

    return data;
  }, [state]);

  const restoreWorkspaceFromServer = useCallback(async () => {
    const token = await getActiveBearerToken();
    if (!token) {
      throw new Error('يرجى تسجيل الدخول أولًا.');
    }
    const res = await fetch('/api/workspace', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'تعذر استرجاع البيانات.');
    if (data?.exists && data.snapshot) {
      setState((prev) => ({
        ...prev,
        ...data.snapshot,
      }));
      setPast([]);
      setFuture([]);
      return true;
    }
    return false;
  }, []);

  // --- Monthly Archives & Active Period Management ---
  const activePeriod = resolvePeriodMeta(state.activePeriod);

  const updateActivePeriod = useCallback((patch: Partial<PeriodQuotaMeta>) => {
    setState((prev) => ({
      ...prev,
      activePeriod: resolvePeriodMeta({
        ...resolvePeriodMeta(prev.activePeriod),
        ...patch,
      }),
    }));
  }, []);

  const archiveCurrentPeriod = useCallback(
    (options?: {
      label?: string;
      isClosed?: boolean;
      archiveSource?: 'manual' | 'auto';
      periodOverride?: PeriodQuotaMeta;
      freeformHeader?: FreeformHeaderConfig;
    }): MonthlyArchiveRecord => {
      let createdRecord: MonthlyArchiveRecord | null = null;
      setState((prev) => {
        const periodMeta = resolvePeriodMeta(
          options?.periodOverride || prev.activePeriod
        );
        const snap = createMonthlyArchiveSnapshot({
          label: options?.label,
          archiveSource: options?.archiveSource || 'manual',
          isClosed: options?.isClosed ?? true,
          periodMeta,
          freeformHeader:
            options?.freeformHeader || prev.tableHeaders?.master_roster?.freeformHeader,
          agencies: prev.agencies,
          persons: prev.persons,
          readyLists: prev.readyLists,
          readyListItems: prev.readyListItems,
          expenses: prev.expenses,
          relations: prev.relations,
          tableHeaders: prev.tableHeaders,
          calculationSettings: prev.calculationSettings,
        });
        createdRecord = snap;
        const existing = prev.monthlyArchives || [];
        return {
          ...prev,
          monthlyArchives: [snap, ...existing],
        };
      });
      return (
        createdRecord ||
        createMonthlyArchiveSnapshot({
          label: options?.label,
          archiveSource: options?.archiveSource || 'manual',
          isClosed: options?.isClosed ?? true,
          periodMeta: activePeriod,
          agencies: state.agencies,
          persons: state.persons,
          readyLists: state.readyLists,
          readyListItems: state.readyListItems,
          expenses: state.expenses,
          relations: state.relations,
          tableHeaders: state.tableHeaders,
          calculationSettings: state.calculationSettings,
        })
      );
    },
    [activePeriod, state]
  );

  const startNextMonthRollover = useCallback(
    (options?: {
      nextQuotaName?: string;
      nextQuotaNumber?: string;
      nextDate?: string;
      autoArchiveCurrent?: boolean;
      resetNotesAndChanges?: boolean;
    }) => {
      setState((prev) => {
        const curPeriod = resolvePeriodMeta(prev.activePeriod);
        let nextArchives = prev.monthlyArchives || [];

        if (options?.autoArchiveCurrent !== false) {
          const archived = createMonthlyArchiveSnapshot({
            archiveSource: 'auto',
            isClosed: true,
            periodMeta: curPeriod,
            freeformHeader: prev.tableHeaders?.master_roster?.freeformHeader,
            agencies: prev.agencies,
            persons: prev.persons,
            readyLists: prev.readyLists,
            readyListItems: prev.readyListItems,
            expenses: prev.expenses,
            relations: prev.relations,
            tableHeaders: prev.tableHeaders,
            calculationSettings: prev.calculationSettings,
          });
          nextArchives = [archived, ...nextArchives];
        }

        const nextPeriod = prepareNextMonthRollover({
          currentPeriod: curPeriod,
          nextQuotaName: options?.nextQuotaName,
          nextQuotaNumber: options?.nextQuotaNumber,
          nextDate: options?.nextDate,
        });

        const nextPersons = options?.resetNotesAndChanges
          ? prev.persons.map((p) => ({
              ...p,
              decreaseCount: 0,
              addOrDeleteCount: 0,
              addOrDeleteAction: 'لا يوجد' as const,
              updatedAt: nextPeriod.fullDate,
            }))
          : prev.persons;

        return {
          ...prev,
          activePeriod: nextPeriod,
          monthlyArchives: nextArchives,
          persons: nextPersons,
        };
      });
      setPast([]);
      setFuture([]);
    },
    []
  );

  const markArchiveCloudSynced = useCallback((archiveId: string) => {
    const syncedAt = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      monthlyArchives: (prev.monthlyArchives || []).map((a) =>
        a.id === archiveId ? { ...a, syncedToCloudAt: syncedAt } : a
      ),
    }));
  }, []);

  const deleteMonthlyArchive = useCallback((archiveId: string) => {
    setState((prev) => ({
      ...prev,
      monthlyArchives: (prev.monthlyArchives || []).filter(
        (a) => a.id !== archiveId
      ),
    }));
  }, []);

  const upsertUcrsSession = useCallback((session: UcrsSession) => {
    // Strip oversized image previews on older sessions to keep localStorage well within quota
    const compactSources = session.sources.map((s) => ({
      ...s,
      previewDataUrl:
        s.previewDataUrl && s.previewDataUrl.length > 260000
          ? undefined
          : s.previewDataUrl,
    }));
    const compactSession: UcrsSession = {
      ...session,
      sources: compactSources,
    };
    setState((prev) => {
      const existing = prev.ucrsSessions || [];
      const idx = existing.findIndex((s) => s.id === compactSession.id);
      const nextList =
        idx === -1
          ? [compactSession, ...existing].slice(0, 25)
          : existing.map((s, i) => (i === idx ? compactSession : s));
      return {
        ...prev,
        ucrsSessions: nextList,
      };
    });
  }, []);

  const deleteUcrsSession = useCallback((sessionId: string) => {
    setState((prev) => ({
      ...prev,
      ucrsSessions: (prev.ucrsSessions || []).filter((s) => s.id !== sessionId),
    }));
  }, []);

  const upsertUcrsLearningRule = useCallback((rule: UcrsLearningRule) => {
    setState((prev) => {
      const existing = prev.ucrsLearningRules || [];
      const idx = existing.findIndex(
        (r) =>
          r.wrongToken === rule.wrongToken &&
          r.correctedToken === rule.correctedToken
      );
      if (idx !== -1) {
        const next = existing.map((r, i) =>
          i === idx ? { ...r, usageCount: r.usageCount + 1, enabled: true } : r
        );
        return { ...prev, ucrsLearningRules: next };
      }
      return {
        ...prev,
        ucrsLearningRules: [rule, ...existing].slice(0, 80),
      };
    });
  }, []);

  const toggleUcrsLearningRule = useCallback((ruleId: string) => {
    setState((prev) => ({
      ...prev,
      ucrsLearningRules: (prev.ucrsLearningRules || []).map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    }));
  }, []);

  const deleteUcrsLearningRule = useCallback((ruleId: string) => {
    setState((prev) => ({
      ...prev,
      ucrsLearningRules: (prev.ucrsLearningRules || []).filter(
        (r) => r.id !== ruleId
      ),
    }));
  }, []);

  const applyAssistantAutoFixes = useCallback(
    (issueIds?: string[]) => {
      const outcome = applyDiagnosticAutoFixes(state, issueIds);
      if (outcome.fixedCount > 0) {
        commitDataMutation((prev) => applyDiagnosticAutoFixes(prev, issueIds).nextState);
      }
      return {
        fixedCount: outcome.fixedCount,
        summaryLines: outcome.summaryLines,
      };
    },
    [state, commitDataMutation]
  );

  return {
    state,
    activePeriod,
    monthlyArchives: state.monthlyArchives || [],
    ucrsSessions: state.ucrsSessions || [],
    ucrsLearningRules: state.ucrsLearningRules || [],
    themePrefs: activeThemePrefs,
    expertTableConfig: {
      ...DEFAULT_EXPERT_TABLE_CONFIG,
      ...(state.expertTableConfig || {}),
    },
    quickExtractPrefs: {
      ...DEFAULT_QUICK_EXTRACT_PREFS,
      ...(state.quickExtractPrefs || {}),
    },
    relationsPrefs: {
      ...DEFAULT_RELATIONS_PREFS,
      ...(state.relationsPrefs || {}),
    },
    generalPrefs: {
      ...DEFAULT_GENERAL_PREFS,
      ...(state.generalPrefs || {}),
    },
    securityPrefs: {
      ...DEFAULT_SECURITY_PREFS,
      ...(state.securityPrefs || {}),
    },
    recycleBin: state.recycleBin || [],
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    setModeTier,
    setEditorEnabled,
    setDarkTheme,
    setThemePrefs,
    resetThemePrefs,
    saveAppearanceProfile,
    applyAppearanceProfile,
    deleteAppearanceProfile,
    setRequireLoginOnStart,
    setCalculationSettings,
    setTopBarConfig,
    setExpertTableConfig,
    resetExpertTableConfig,
    addExpertCustomColumn,
    removeExpertCustomColumn,
    setQuickExtractPrefs,
    saveQuickExtractTemplate,
    deleteQuickExtractTemplate,
    setRelationsPrefs,
    setGeneralPrefs,
    setSecurityPrefs,
    restoreRecycleBinItem,
    purgeRecycleBinItem,
    clearRecycleBin,
    importWorkspaceJson,
    updateTableHeaderMeta,
    updateActivePeriod,
    archiveCurrentPeriod,
    startNextMonthRollover,
    markArchiveCloudSynced,
    deleteMonthlyArchive,
    upsertUcrsSession,
    deleteUcrsSession,
    upsertUcrsLearningRule,
    toggleUcrsLearningRule,
    deleteUcrsLearningRule,
    addPersonDirect,
    updatePersonConfirmed,
    bulkUpdatePersonsCategory,
    deletePersonConfirmed,
    commitQuickExtractRows,
    commitQuickExtractPlan,
    addExpense,
    deleteExpenseConfirmed,
    createReadyList,
    updateReadyListMetaConfirmed,
    deleteReadyListConfirmed,
    addReadyListItemDirect,
    updateReadyListItemConfirmed,
    removeReadyListItemConfirmed,
    addPersonsToReadyList,
    moveReadyListItemOrder,
    movePersonsToAgencyConfirmed,
    upsertRelationEntry,
    removeRelationEntryConfirmed,
    addAgencyDirect,
    updateAgencyDetails,
    applyAssistantAutoFixes,
    syncWorkspaceToServer,
    restoreWorkspaceFromServer,
  };
}

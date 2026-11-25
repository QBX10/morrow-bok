import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Cpu,
  FileSpreadsheet,
  Globe2,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { Agency, AppView, Person, SettingsSectionId } from '../types/agency.ts';
import type { AssistantBrainMode, MorrowCenterTab } from '../types/assistant.ts';
import { normalizeArabic } from '../utils/agencyLogic.ts';
import {
  type CosmosNode,
  searchCosmosNodes,
} from '../utils/cosmosRegistry.ts';
import {
  type HierarchyNode,
  type HierarchyTarget,
  searchHierarchyNodes,
} from '../utils/hierarchyRegistry.ts';
import { SectionLogo } from './settings/sectionLogos';
import { FullScreenPushPage } from './ui/FullScreenPushPage';

interface CommandPaletteModalProps {
  open: boolean;
  darkTheme: boolean;
  brainMode: AssistantBrainMode;
  agencies: Agency[];
  persons: Person[];
  pendingDraftsCount: number;
  hierarchyTree?: HierarchyNode;
  onNavigateHierarchyTarget?: (target: HierarchyTarget, nodeId: string) => void;
  cosmosTree?: CosmosNode;
  onSelectCosmosNode?: (node: CosmosNode) => void;
  onOpenWorldSwitcher?: () => void;
  onClose: () => void;
  onChangeBrainMode: (mode: AssistantBrainMode) => void;
  onNavigateView: (view: AppView, section?: SettingsSectionId) => void;
  onOpenCommandCenterTab: (tab: MorrowCenterTab) => void;
  onSelectAgency: (agencyId: number) => void;
  onSelectPerson: (person: Person) => void;
  onSendAssistantPrompt: (prompt: string) => void;
}

type PaletteEntry = {
  id: string;
  group: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  quickActionLabel?: string;
  onRun: () => void;
};

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  open,
  darkTheme,
  brainMode,
  agencies,
  persons,
  pendingDraftsCount,
  hierarchyTree,
  onNavigateHierarchyTarget,
  cosmosTree,
  onSelectCosmosNode,
  onOpenWorldSwitcher,
  onClose,
  onChangeBrainMode,
  onNavigateView,
  onOpenCommandCenterTab,
  onSelectAgency,
  onSelectPerson,
  onSendAssistantPrompt,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const agencyMap = useMemo(
    () => new Map(agencies.map((a) => [a.id, a.name])),
    [agencies]
  );

  const quickCommands = useMemo<PaletteEntry[]>(
    () => [
      {
        id: 'cmd_smart_models',
        group: 'النماذج الذكية',
        label: 'فتح واجهة النماذج الذكية (تحليل، تدقيق، تنبؤ)',
        sublabel: 'نواة تحليل تفاعلية ذكية لمقارنة الوكالات وكشف الأخطاء وتوليد الخطط',
        icon: <Cpu className="h-4 w-4" />,
        onRun: () => {
          onNavigateView('smart_models');
          onClose();
        },
      },
      {
        id: 'cmd_morrow_center',
        group: 'مركز Morrow',
        label: 'فتح مركز Morrow (المحادثة، الموافقات، الذاكرة، الملاحظات)',
        sublabel:
          pendingDraftsCount > 0
            ? `يوجد ${pendingDraftsCount} مسودة بانتظار موافقتك`
            : 'غرفة التحكم المركزية للمساعد الشخصي',
        icon: <Bot className="h-4 w-4" />,
        onRun: () => {
          onOpenCommandCenterTab(pendingDraftsCount > 0 ? 'approvals' : 'chat');
          onClose();
        },
      },
      {
        id: 'cmd_stealth_blocked',
        group: 'تنفيذ صامت فوري',
        label: 'اعرض المحجوبين فقط',
        sublabel: 'فلترة الجدول صامتاً لإظهار السجلات المحجوبة',
        icon: <Users className="h-4 w-4" />,
        onRun: () => {
          onSendAssistantPrompt('اعرض المحجوبين');
          onClose();
        },
      },
      {
        id: 'cmd_semantic_anomaly',
        group: 'تحليل دلالي ذكي',
        label: 'الرقم غريب — فحص الشذوذ والانحرافات',
        sublabel: 'يكتشف أرقام الأفراد المرتفعة أو الأخطاء الحسابية فوراً',
        icon: <ShieldAlert className="h-4 w-4" />,
        onRun: () => {
          onSendAssistantPrompt('الرقم غريب');
          onClose();
        },
      },
      {
        id: 'cmd_settings_appearance',
        group: 'الإعدادات الهرمية',
        label: 'استوديو الجداول والهندسة البصرية (السبج والذهب)',
        sublabel: 'تصاميم الجداول الـ 8، الخطوط العربية، والهندسة الزجاجية',
        icon: <Sparkles className="h-4 w-4" />,
        onRun: () => {
          onNavigateView('settings', 'appearance');
          onClose();
        },
      },
      ...(onOpenWorldSwitcher
        ? [
            {
              id: 'cmd_world_switcher',
              group: 'التنقل والأقسام',
              label: 'دليل أقسام النظام والخريطة التفاعلية',
              sublabel: 'الانتقال السريع بين كل أقسام التطبيق وإدارة ظهورها',
              icon: <Globe2 className="h-4 w-4" />,
              onRun: () => {
                onClose();
                onOpenWorldSwitcher();
              },
            },
          ]
        : []),
      {
        id: 'cmd_export_excel',
        group: 'تصدير بالخلفية',
        label: 'تصدير كشف Excel (وفق قواعد الذاكرة)',
        sublabel: 'يعمل بالخلفية مع احترام إخفاء الأعمدة وRTL',
        icon: <FileSpreadsheet className="h-4 w-4" />,
        onRun: () => {
          onSendAssistantPrompt('صدر تقرير اكسل');
          onClose();
        },
      },
      {
        id: 'cmd_quick_notes',
        group: 'مركز Morrow',
        label: 'تسجيل ملاحظة سريعة (كتابة أو إملاء صوتي)',
        sublabel: 'ربط تلقائي ذكي بالمستفيدين داخل الوكالات',
        icon: <UserCheck className="h-4 w-4" />,
        onRun: () => {
          onOpenCommandCenterTab('quick_notes');
          onClose();
        },
      },
      {
        id: 'cmd_settings_hub',
        group: 'الإعدادات',
        label: 'فتح مركز الإعدادات الشامل (ملء الشاشة)',
        sublabel: 'استوديو المظهر، الخطوط، الحاسبة (250 د.ع)، السحب الذكي، والأمان',
        icon: <Zap className="h-4 w-4" />,
        onRun: () => {
          onNavigateView('settings');
          onClose();
        },
      },
      {
        id: 'cmd_account_security',
        group: 'الحساب والأمان',
        label: 'الحساب والبيانات والأمان (التصدير المنظم، النسخ الذكي، والملاحظات)',
        sublabel: 'إدارة الحسابات، السحابة، تصدير بياناتك، قفل الخصوصية وسلة الاسترجاع',
        icon: <UserCheck className="h-4 w-4" />,
        onRun: () => {
          onNavigateView('account_security');
          onClose();
        },
      },
      {
        id: 'cmd_settings_calc',
        group: 'الإعدادات',
        label: 'ضبط حاسبة الجدول (رسم الفرد: 250 د.ع)',
        sublabel: 'الانتقال مباشرة إلى قسم الحاسبة ومعادلات الحصص',
        icon: <ArrowLeft className="h-4 w-4" />,
        onRun: () => {
          onNavigateView('settings', 'calculator');
          onClose();
        },
      },
    ],
    [
      darkTheme,
      pendingDraftsCount,
      onClose,
      onNavigateView,
      onOpenCommandCenterTab,
      onOpenWorldSwitcher,
      onSendAssistantPrompt,
    ]
  );

  const entries = useMemo<PaletteEntry[]>(() => {
    const qRaw = query.trim();
    const qNorm = normalizeArabic(qRaw);
    if (!qNorm) return quickCommands;

    const results: PaletteEntry[] = [];

    for (const cmd of quickCommands) {
      if (
        normalizeArabic(cmd.label).includes(qNorm) ||
        normalizeArabic(cmd.sublabel).includes(qNorm)
      ) {
        results.push(cmd);
      }
    }

    for (const ag of agencies) {
      if (normalizeArabic(ag.name).includes(qNorm)) {
        results.push({
          id: `ag_${ag.id}`,
          group: 'الوكالات',
          label: `${ag.icon} ${ag.name}`,
          sublabel: 'الانتقال مباشرة إلى جدول الوكالة',
          icon: <ArrowLeft className="h-4 w-4" />,
          onRun: () => {
            onSelectAgency(ag.id);
            onNavigateView('agency_roster');
            onClose();
          },
        });
      }
    }

    const seenTitles = new Set<string>(results.map((r) => normalizeArabic(r.label)));

    if (cosmosTree && onSelectCosmosNode) {
      const cosmosHits = searchCosmosNodes(cosmosTree, qRaw);
      for (const hit of cosmosHits.slice(0, 10)) {
        const labelNorm = normalizeArabic(hit.node.title);
        seenTitles.add(labelNorm);
        results.push({
          id: `cosmos_${hit.node.id}`,
          group: `الأقسام والأدوات · ${hit.matchedReason}`,
          label: hit.node.title,
          sublabel: hit.path.map((n) => n.title).join(' ◂ '),
          icon: (
            <SectionLogo
              icon={hit.node.icon}
              tone={hit.node.accentTone}
              size="xs"
            />
          ),
          onRun: () => {
            onSelectCosmosNode(hit.node);
            onClose();
          },
        });
      }
    }

    if (hierarchyTree && onNavigateHierarchyTarget) {
      const hHits = searchHierarchyNodes(hierarchyTree, qRaw);
      for (const hit of hHits.slice(0, 10)) {
        const labelNorm = normalizeArabic(hit.node.title);
        if (seenTitles.has(labelNorm)) continue;
        seenTitles.add(labelNorm);
        results.push({
          id: `hierarchy_${hit.node.id}`,
          group: `الأقسام الهرمية · مستوى ${hit.node.level}`,
          label: hit.node.title,
          sublabel: hit.path.map((n) => n.title).join(' ◂ '),
          icon: (
            <SectionLogo
              icon={hit.node.logo || hit.node.icon}
              tone={hit.node.accentTone}
              size="xs"
            />
          ),
          onRun: () => {
            onNavigateHierarchyTarget(hit.node.target, hit.node.id);
            onClose();
          },
        });
      }
    }

    for (const p of persons) {
      if (
        normalizeArabic(p.name).includes(qNorm) ||
        p.nationalId.includes(qRaw)
      ) {
        results.push({
          id: `person_${p.id}`,
          group: 'المستفيدون',
          label: p.name,
          sublabel: `${agencyMap.get(p.agencyId) || 'الوكالة'} · ${p.individuals ?? 0} أفراد · ${p.status || 'نشط'}`,
          icon: <Users className="h-4 w-4" />,
          onRun: () => {
            onSelectPerson(p);
            onClose();
          },
        });
        if (results.length >= 18) break;
      }
    }

    // Always allow running free-form text as a Morrow 3-Brain command
    results.push({
      id: 'run_assistant_free_prompt',
      group: 'أمر ذكي للمساعد',
      label: `تنفيذ أو سؤال Morrow: «${qRaw}»`,
      sublabel: 'يبدأ محلياً ويصعّد إلى Gemini 2.5 Flash / Pro عند الحاجة',
      icon: <Sparkles className="h-4 w-4" />,
      onRun: () => {
        onSendAssistantPrompt(qRaw);
        onClose();
      },
    });

    return results;
  }, [
    query,
    quickCommands,
    agencies,
    cosmosTree,
    onSelectCosmosNode,
    hierarchyTree,
    onNavigateHierarchyTarget,
    persons,
    agencyMap,
    onSelectAgency,
    onNavigateView,
    onSelectPerson,
    onSendAssistantPrompt,
    onClose,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (entries.length ? (i + 1) % entries.length : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) =>
        entries.length ? (i - 1 + entries.length) % entries.length : 0
      );
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = entries[activeIndex] || entries[0];
      if (chosen) chosen.onRun();
    }
  };

  return (
    <FullScreenPushPage
      open={open}
      onBack={onClose}
      title="لوحة الأوامر السريعة — Morrow"
      subtitle="تنفيذ الأوامر الذكية، البحث الفوري، والتبديل بين الأدمغة"
      icon={<Search className="h-4 w-4" />}
      ariaLabel="لوحة الأوامر السريعة — Morrow"
      maxWidthClass="max-w-3xl"
      zIndexClass="z-[80]"
    >
      <div
        data-testid="command-palette-modal"
        className="nexus-squircle overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Top Command Input */}
        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="اكتب أمراً ذكياً أو ابحث عن مستفيد أو شاشة (مثال: اعرض المحجوبين، الرقم غريب)..."
            aria-label="حقل الأوامر السريعة"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
          />
        </div>

        {/* 3-Brain Mode Selector Strip */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 text-[11px]"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <span className="font-bold" style={{ color: 'var(--text-muted)' }}>
            توجيه الدماغ الذكي:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'auto', label: 'تلقائي ذكي', icon: <Bot className="h-3 w-3" /> },
                { id: 'local', label: 'Morrow محلي', icon: <Cpu className="h-3 w-3" /> },
                { id: 'gemini_3_8_flash', label: '3.8 Flash', icon: <Sparkles className="h-3 w-3" /> },
                { id: 'gemini_3_5_flash', label: '3.5 Flash', icon: <Zap className="h-3 w-3" /> },
                { id: 'gemini_3_5_flash_lite', label: '3.5 Lite', icon: <Zap className="h-3 w-3" /> },
                { id: 'nemotron_free', label: 'Nemotron', icon: <Sparkles className="h-3 w-3" /> },
                { id: 'openrouter_free', label: 'OR Free', icon: <Bot className="h-3 w-3" /> },
              ] as const
            ).map((opt) => {
              const active = brainMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeBrainMode(opt.id)}
                  className="nexus-pill-btn inline-flex items-center gap-1 border px-3 py-1 font-bold whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: active ? 'var(--accent-ai, #12E5AD)' : 'var(--bg-surface)',
                    borderColor: active ? 'var(--accent-ai, #12E5AD)' : 'var(--border-color)',
                    color: active ? '#FFFFFF' : 'var(--text-primary)',
                  }}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results & Actions List */}
        <div className="p-2.5 space-y-1.5">
          {entries.map((item, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={item.onRun}
                className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-right transition-colors"
                style={{
                  backgroundColor: isSelected ? 'var(--bg-nav-active)' : 'transparent',
                  borderColor: isSelected ? 'var(--accent)' : 'transparent',
                }}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--accent)',
                    }}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">
                      {item.label}
                    </span>
                    <span
                      className="block truncate text-[11px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {item.sublabel}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {item.quickActionLabel && (
                    <span
                      className="rounded-lg border px-2 py-0.5 text-[10px] font-extrabold"
                      style={{
                        backgroundColor: 'var(--bg-nav-active)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                      }}
                    >
                      {item.quickActionLabel}
                    </span>
                  )}
                  <span
                    className="shrink-0 text-[10px] font-semibold whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {item.group}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Clean Keyboard Hint Footer */}
        <div
          className="flex items-center justify-between border-t px-4 py-2 text-[11px]"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <span>استخدم الأسهم للتنقل و Enter للتنفيذ الفوري</span>
          <span dir="ltr" className="font-mono tabular-nums">
            Ctrl + K · Esc
          </span>
        </div>
      </div>
    </FullScreenPushPage>
  );
};

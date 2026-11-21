import React, { useMemo, useState } from 'react';
import { Search, Volume2, ArrowUpLeft, Globe, FileText } from 'lucide-react';
import type { UcrsSession } from '../../types/agency';
import { runSemanticSearch, type UcrsSemanticHit } from '../../utils/ucrsEngine';

interface UcrsSemanticSearchPanelProps {
  activeSession: UcrsSession | null;
  allSessions: UcrsSession[];
  onJumpToRow: (rowId: string) => void;
  onSpeakText: (text: string) => void;
}

const MATCH_KIND_LABELS: Record<UcrsSemanticHit['matchKind'], string> = {
  exact: 'مطابقة مباشرة',
  fuzzy: 'بحث ضبابي قريب',
  semantic: 'بحث بالمعنى',
  numeric: 'شرط رقمي',
  date: 'تاريخ / شهر',
};

const QUICK_QUERIES = [
  'محمد',
  'حجب',
  'إضافة',
  '> 5',
  'بين 3 و 7',
  'شهر 11',
];

export const UcrsSemanticSearchPanel: React.FC<UcrsSemanticSearchPanelProps> = ({
  activeSession,
  allSessions,
  onJumpToRow,
  onSpeakText,
}) => {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'current' | 'archive'>('current');

  const targetSessions = useMemo(() => {
    if (scope === 'archive') return allSessions;
    return activeSession ? [activeSession] : [];
  }, [scope, activeSession, allSessions]);

  const hits = useMemo(
    () => runSemanticSearch({ query, sessions: targetSessions }),
    [query, targetSessions]
  );

  return (
    <section
      aria-label="محرك البحث الدلالي والضبابي"
      className="space-y-3 rounded-xl border p-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <div>
            <h2 className="text-sm font-bold">
              البحث الدلالي والضبابي (بالاسم، المعنى، الرقم، أو التاريخ)
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              يجد الأسماء المتشابهة إملائيًا (مثل محمد / محمذ)، المعاني (حجب ← موقوف/ممنوع)، والأرقام (&gt; 5، بين 5 و 10).
            </p>
          </div>
        </div>

        <div
          className="inline-flex rounded-lg border p-0.5 text-xs"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => setScope('current')}
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-semibold whitespace-nowrap"
            style={{
              backgroundColor:
                scope === 'current' ? 'var(--accent)' : 'transparent',
              color:
                scope === 'current'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>المحتوى الحالي</span>
          </button>
          <button
            type="button"
            onClick={() => setScope('archive')}
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-semibold whitespace-nowrap"
            style={{
              backgroundColor:
                scope === 'archive' ? 'var(--accent)' : 'transparent',
              color:
                scope === 'archive'
                  ? 'var(--accent-fg)'
                  : 'var(--text-primary)',
            }}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>كل الجلسات المؤرشفة ({allSessions.length})</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          aria-label="استعلام البحث الدلالي"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن اسم (محمد)، معنى (حجب)، رقم (> 5 أو بين 5 و 10)، أو تاريخ (شهر 11)..."
          className="min-w-[240px] flex-1 rounded-lg border px-3 py-2 text-xs"
          style={{
            backgroundColor: 'var(--bg-main)',
            borderColor: 'var(--border-color)',
          }}
        />
        {hits.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onSpeakText(
                `وُجدت ${hits.length} نتيجة للبحث عن ${query}. أبرزها: ${hits
                  .slice(0, 3)
                  .map((h) => h.matchedText)
                  .join('، ')}`
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold whitespace-nowrap"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>قراءة النتائج صوتيًا</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span style={{ color: 'var(--text-muted)' }}>أمثلة سريعة:</span>
        {QUICK_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuery(q)}
            className="rounded-md border px-2 py-1 text-xs font-semibold hover:opacity-85"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {query.trim() && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
            وُجد {hits.length} مطابقة لاستعلام «{query}»
          </div>

          {hits.length === 0 ? (
            <div
              className="rounded-lg border p-4 text-center text-xs"
              style={{
                backgroundColor: 'var(--bg-main)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-muted)',
              }}
            >
              لم يتم العثور على نتائج مطابقة في النطاق المحدد.
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {hits.slice(0, 30).map((hit) => (
                <div
                  key={hit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-bold">{hit.matchedText}</div>
                    <div
                      className="flex flex-wrap items-center gap-1.5 text-[11px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>{MATCH_KIND_LABELS[hit.matchKind]}</span>
                      <span aria-hidden="true">·</span>
                      <span>صفحة {hit.pageNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span>سطر/صف {hit.rowOrLineIndex}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        ثقة {Math.round(hit.confidence * 100)}%
                      </span>
                      {scope === 'archive' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>جلسة: {hit.sessionTitle}</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {hit.context}
                    </div>
                  </div>

                  {hit.rowId && hit.sessionId === activeSession?.id && (
                    <button
                      type="button"
                      onClick={() => onJumpToRow(hit.rowId!)}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap"
                      style={{
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                      }}
                    >
                      <span>الانتقال للصف</span>
                      <ArrowUpLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

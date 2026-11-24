import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  Edit3,
  ExternalLink,
  ListPlus,
  LogOut,
  RefreshCw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { signInWithFirebaseGoogle } from '../lib/authClient';
import { getAccessToken, initWorkspaceAuth, logoutFirebase } from '../lib/firebase';
import {
  createCalendarEvent,
  createTask,
  deleteCalendarEvent,
  deleteTask,
  listCalendarEvents,
  listCalendars,
  listTaskLists,
  listTasks,
  updateCalendarEvent,
  updateTask,
  WorkspaceAuthRequiredError,
  type GoogleCalendarEvent,
  type GoogleCalendarSummary,
  type GoogleTaskItem,
  type GoogleTaskList,
} from '../lib/googleWorkspace';
import type { AuthUser, PeriodQuotaMeta, RelationEntry } from '../types/agency';
import { AnimatePresence, motion } from 'motion/react';
import {
  TABRIX_POPOVER_VARIANTS,
  useTabrixDirection,
  useTabrixOrderedDirection,
} from '../utils/tabrixMotion';
import { FullScreenPushPage } from './ui/FullScreenPushPage';
import { NexusDuotoneIcon } from './ui/NexusDuotoneIcon';
import {
  TabrixPillIndicator,
  TabrixSubViewTransition,
} from './ui/TabrixMotionPrimitives';

interface GoogleWorkspaceViewProps {
  activePeriod: PeriodQuotaMeta;
  relations: RelationEntry[];
  onAuthenticatedUser?: (user: AuthUser) => void;
}

type PendingWorkspaceConfirm =
  | {
      kind: 'delete_event';
      calendarId: string;
      eventId: string;
      title: string;
    }
  | {
      kind: 'update_event';
      calendarId: string;
      eventId: string;
      summary: string;
      description: string;
      date: string;
    }
  | {
      kind: 'toggle_task';
      taskListId: string;
      taskId: string;
      title: string;
      nextStatus: 'needsAction' | 'completed';
    }
  | {
      kind: 'delete_task';
      taskListId: string;
      taskId: string;
      title: string;
    };

const GoogleGsiSvg: React.FC = () => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="gsi-material-button-icon"
    aria-hidden="true"
  >
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export const GoogleWorkspaceView: React.FC<GoogleWorkspaceViewProps> = ({
  activePeriod,
  relations,
  onAuthenticatedUser,
}) => {
  const [workspaceTab, setWorkspaceTab] = useState<'calendar' | 'tasks'>(
    'calendar'
  );
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Calendar state
  const [calendars, setCalendars] = useState<GoogleCalendarSummary[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(
    () => activePeriod.fullDate || new Date().toISOString().slice(0, 10)
  );
  const [newEventNotes, setNewEventNotes] = useState('');

  // Inline event edit state (triggers confirmation modal before PATCH)
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventSummary, setEditEventSummary] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editEventDesc, setEditEventDesc] = useState('');

  // Tasks state
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedTaskListId, setSelectedTaskListId] = useState('@default');
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');

  // Mandatory explicit user confirmation before any update/delete API call
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingWorkspaceConfirm | null>(null);

  const loadWorkspaceData = useCallback(
    async (calId = selectedCalendarId, tListId = selectedTaskListId) => {
      try {
        setLoading(true);
        setError('');
        const [calList, evList, tLists, tItems] = await Promise.all([
          listCalendars(),
          listCalendarEvents({ calendarId: calId }),
          listTaskLists(),
          listTasks(tListId),
        ]);
        setCalendars(calList);
        setEvents(evList);
        setTaskLists(tLists);
        setTasks(tItems);
        setNeedsAuth(false);
      } catch (err) {
        if (err instanceof WorkspaceAuthRequiredError) {
          setNeedsAuth(true);
          setError(err.message);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'تعذر تحميل بيانات تقويم ومهام Google.'
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedCalendarId, selectedTaskListId]
  );

  useEffect(() => {
    const unsub = initWorkspaceAuth(
      (user) => {
        setConnectedEmail(user.email || user.displayName || 'Google');
        setNeedsAuth(false);
        void loadWorkspaceData();
      },
      () => {
        setNeedsAuth(true);
      }
    );

    void getAccessToken().then((token) => {
      if (token) {
        setNeedsAuth(false);
        void loadWorkspaceData();
      }
    });

    return () => {
      unsub();
    };
  }, [loadWorkspaceData]);

  const handleConnectGoogle = async () => {
    try {
      setAuthLoading(true);
      setError('');
      const session = await signInWithFirebaseGoogle();
      setConnectedEmail(session.user.email || session.user.displayName);
      setNeedsAuth(false);
      onAuthenticatedUser?.(session.user);
      setStatusMessage('تم ربط حساب Google والتقويم والمهام بنجاح.');
      await loadWorkspaceData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر إتمام المصادقة مع Google Workspace.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await logoutFirebase();
    setConnectedEmail(null);
    setNeedsAuth(true);
    setEvents([]);
    setTasks([]);
    setStatusMessage('تم فصل جلسة Google Workspace الحالية.');
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate) return;
    try {
      setLoading(true);
      setError('');
      await createCalendarEvent({
        calendarId: selectedCalendarId,
        summary: newEventTitle.trim(),
        description: newEventNotes.trim(),
        date: newEventDate,
      });
      setNewEventTitle('');
      setNewEventNotes('');
      setStatusMessage('تمت إضافة الموعد إلى تقويم Google بنجاح.');
      await loadWorkspaceData(selectedCalendarId, selectedTaskListId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الموعد.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      setLoading(true);
      setError('');
      await createTask({
        taskListId: selectedTaskListId,
        title: newTaskTitle.trim(),
        notes: newTaskNotes.trim(),
        due: newTaskDue || undefined,
      });
      setNewTaskTitle('');
      setNewTaskNotes('');
      setNewTaskDue('');
      setStatusMessage('تمت إضافة المهمة إلى مهام Google بنجاح.');
      await loadWorkspaceData(selectedCalendarId, selectedTaskListId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء المهمة.');
    } finally {
      setLoading(false);
    }
  };

  const executeConfirmedWorkspaceAction = async () => {
    if (!pendingConfirm) return;
    const action = pendingConfirm;
    setPendingConfirm(null);
    try {
      setLoading(true);
      setError('');
      if (action.kind === 'delete_event') {
        await deleteCalendarEvent({
          calendarId: action.calendarId,
          eventId: action.eventId,
        });
        setStatusMessage(`تم حذف الموعد «${action.title}» من تقويم Google.`);
      } else if (action.kind === 'update_event') {
        await updateCalendarEvent({
          calendarId: action.calendarId,
          eventId: action.eventId,
          summary: action.summary,
          description: action.description,
          date: action.date,
        });
        setEditingEventId(null);
        setStatusMessage(`تم تحديث الموعد «${action.summary}» بنجاح.`);
      } else if (action.kind === 'toggle_task') {
        await updateTask({
          taskListId: action.taskListId,
          taskId: action.taskId,
          status: action.nextStatus,
        });
        setStatusMessage(
          action.nextStatus === 'completed'
            ? `تم إكمال المهمة «${action.title}».`
            : `تمت إعادة فتح المهمة «${action.title}».`
        );
      } else if (action.kind === 'delete_task') {
        await deleteTask({
          taskListId: action.taskListId,
          taskId: action.taskId,
        });
        setStatusMessage(`تم حذف المهمة «${action.title}» من Google Tasks.`);
      }
      await loadWorkspaceData(selectedCalendarId, selectedTaskListId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء المطلوب.'
      );
    } finally {
      setLoading(false);
    }
  };

  const reminderRelations = relations
    .filter((r) => r.category === 'reminder')
    .slice(0, 4);

  const authDir = useTabrixDirection(needsAuth, (_prev, next) => (next ? -1 : 1));
  const workspaceTabDir = useTabrixOrderedDirection(workspaceTab, {
    calendar: 0,
    tasks: 1,
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 pb-24 sm:p-6 sm:pb-20">
      {/* Header */}
      <div
        data-assistant-target="google-workspace-root"
        className="nexus-squircle flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5"
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <NexusDuotoneIcon icon={Calendar} size="lg" className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold sm:text-xl">
              تقويم ومهام Google — جدولة الحصص والمتابعة
            </h1>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
              مزامنة مباشرة مع Google Calendar و Google Tasks لجدولة مواعيد الحصص الغذائية ومهام التوصيل
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!needsAuth && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadWorkspaceData()}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-bold disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--bg-main)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                />
                <span>تحديث</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDisconnectGoogle()}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-bold"
                style={{
                  borderColor: 'var(--danger)',
                  color: 'var(--danger)',
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>فصل الجلسة</span>
              </button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {statusMessage && (
          <motion.div
            key="ws-status"
            variants={TABRIX_POPOVER_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            role="status"
            className="flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold"
            style={{
              backgroundColor: 'var(--success-bg)',
              borderColor: 'var(--success)',
              color: 'var(--success)',
            }}
          >
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={() => setStatusMessage('')}
              aria-label="إخفاء الإشعار"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}

        {error && (
          <motion.div
            key="ws-error"
            variants={TABRIX_POPOVER_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            role="alert"
            className="rounded-xl border px-4 py-2.5 text-xs font-bold"
            style={{
              backgroundColor: 'var(--danger-bg)',
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <TabrixSubViewTransition
        viewKey={needsAuth ? 'google-auth-gate' : 'google-workspace-connected'}
        direction={authDir}
      >
      {needsAuth ? (
        <section
          aria-label="تسجيل الدخول إلى Google Workspace"
          className="capsule-glass-card mx-auto max-w-xl border p-6 text-center space-y-4"
          style={{
            borderColor: 'var(--border-color)',
          }}
        >
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-nav-active)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <Calendar className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold">
              ربط حساب Google للتقويم والمهام
            </h2>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              سجّل الدخول بحسابك في Google لمنح صلاحية الوصول الآمن إلى تقويمك وقوائم المهام في الجلسة الحالية فقط دون تخزين أي مفاتيح دائمة.
            </p>
          </div>

          <div className="flex justify-center pt-1">
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void handleConnectGoogle()}
              className="gsi-material-button"
            >
              <span className="gsi-material-button-content-wrapper">
                <GoogleGsiSvg />
                <span>
                  {authLoading
                    ? 'جارٍ فتح نافذة Google...'
                    : 'تسجيل الدخول بحساب Google'}
                </span>
              </span>
            </button>
          </div>

          <div
            className="rounded-lg border p-3 text-right text-xs space-y-1"
            style={{
              backgroundColor: 'var(--bg-main)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-muted)',
            }}
          >
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
              ما يمكنك فعله فور الربط:
            </div>
            <div>• جدولة مواعيد «{activePeriod.quotaName}» في تقويم Google بنقرة.</div>
            <div>• تحويل تذكيرات قسم العلاقات إلى مهام مؤرخة في Google Tasks.</div>
            <div>• تعديل المواعيد أو شطب المهام المنجزة مع تأكيد صريح قبل كل تغيير.</div>
          </div>
        </section>
      ) : (
        <>
          {/* Connected Account Summary & Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="أقسام Google Workspace"
              className="inline-flex rounded-xl border p-1"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-color)',
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={workspaceTab === 'calendar'}
                onClick={() => setWorkspaceTab('calendar')}
                className="relative inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold"
                style={{
                  color:
                    workspaceTab === 'calendar'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                }}
              >
                {workspaceTab === 'calendar' && (
                  <TabrixPillIndicator
                    layoutId="google-workspace-tab-pill"
                    className="rounded-lg"
                  />
                )}
                <Calendar className="relative z-10 h-4 w-4" />
                <span className="relative z-10">تقويم Google ({events.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={workspaceTab === 'tasks'}
                onClick={() => setWorkspaceTab('tasks')}
                className="relative inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold"
                style={{
                  color:
                    workspaceTab === 'tasks'
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                }}
              >
                {workspaceTab === 'tasks' && (
                  <TabrixPillIndicator
                    layoutId="google-workspace-tab-pill"
                    className="rounded-lg"
                  />
                )}
                <CheckSquare className="relative z-10 h-4 w-4" />
                <span className="relative z-10">مهام Google ({tasks.length})</span>
              </button>
            </div>

            {connectedEmail && (
              <div
                className="text-xs font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                متصل بالحساب: <span dir="ltr">{connectedEmail}</span>
              </div>
            )}
          </div>

          <TabrixSubViewTransition
            viewKey={`google-tab-${workspaceTab}`}
            direction={workspaceTabDir}
            className="mt-4"
          >
          {/* CALENDAR TAB */}
          {workspaceTab === 'calendar' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <form
                onSubmit={handleCreateEvent}
                className="capsule-glass-card space-y-3 border p-4 text-xs lg:col-span-5"
                style={{
                  borderColor: 'var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CalendarPlus
                      className="h-4 w-4"
                      style={{ color: 'var(--accent)' }}
                    />
                    <span>إضافة موعد جديد للتقويم</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewEventTitle(
                        `توزيع ${activePeriod.quotaName} — ${activePeriod.monthName}`
                      );
                      setNewEventDate(activePeriod.fullDate);
                      setNewEventNotes(
                        `الحصة رقم ${activePeriod.quotaNumber} (${activePeriod.monthNumber}/${activePeriod.year})`
                      );
                    }}
                    className="rounded-md border px-2 py-1 text-[11px] font-bold"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    تعبئة من الحصة الحالية
                  </button>
                </div>

                {calendars.length > 0 && (
                  <div>
                    <label className="mb-1 block font-bold">التقويم</label>
                    <select
                      value={selectedCalendarId}
                      onChange={(e) => {
                        setSelectedCalendarId(e.target.value);
                        void loadWorkspaceData(
                          e.target.value,
                          selectedTaskListId
                        );
                      }}
                      className="w-full rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.summary} {c.primary ? '(الأساسي)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block font-bold">عنوان الموعد</label>
                  <input
                    type="text"
                    required
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="مثال: موعد تجهيز وتوزيع حصة الطحين"
                    className="w-full rounded-lg border px-3 py-2"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold">التاريخ</label>
                  <input
                    type="date"
                    required
                    dir="ltr"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 tabular-nums"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold">ملاحظات</label>
                  <textarea
                    rows={3}
                    value={newEventNotes}
                    onChange={(e) => setNewEventNotes(e.target.value)}
                    placeholder="تفاصيل الوكالة أو كمية الأكياس المطلوبة..."
                    className="w-full rounded-lg border px-3 py-2"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 font-bold disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <CalendarPlus className="h-4 w-4" />
                  <span>حفظ الموعد في Google Calendar</span>
                </button>
              </form>

              <div
                className="capsule-glass-card space-y-3 border p-4 lg:col-span-7"
                style={{
                  borderColor: 'var(--border-color)',
                }}
              >
                <h2 className="text-sm font-bold">المواعيد القادمة والأحداث</h2>

                {events.length === 0 ? (
                  <div
                    className="rounded-lg border p-6 text-center text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    لا توجد مواعيد مسجلة في هذا النطاق الزمني.
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    {events.map((ev) => {
                      const eventDateStr = (
                        ev.start.date ||
                        ev.start.dateTime ||
                        ''
                      ).slice(0, 10);
                      const isEditing = editingEventId === ev.id;
                      return (
                        <div
                          key={ev.id}
                          className="rounded-xl border p-3 space-y-2"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editEventSummary}
                                onChange={(e) =>
                                  setEditEventSummary(e.target.value)
                                }
                                className="w-full rounded-lg border px-2.5 py-1.5 font-bold"
                                style={{
                                  backgroundColor: 'var(--bg-surface)',
                                  borderColor: 'var(--border-color)',
                                }}
                              />
                              <input
                                type="date"
                                dir="ltr"
                                value={editEventDate}
                                onChange={(e) => setEditEventDate(e.target.value)}
                                className="w-full rounded-lg border px-2.5 py-1.5 tabular-nums"
                                style={{
                                  backgroundColor: 'var(--bg-surface)',
                                  borderColor: 'var(--border-color)',
                                }}
                              />
                              <textarea
                                rows={2}
                                value={editEventDesc}
                                onChange={(e) => setEditEventDesc(e.target.value)}
                                className="w-full rounded-lg border px-2.5 py-1.5"
                                style={{
                                  backgroundColor: 'var(--bg-surface)',
                                  borderColor: 'var(--border-color)',
                                }}
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingConfirm({
                                      kind: 'update_event',
                                      calendarId: selectedCalendarId,
                                      eventId: ev.id,
                                      summary: editEventSummary,
                                      description: editEventDesc,
                                      date: editEventDate,
                                    })
                                  }
                                  className="rounded-lg px-3 py-1.5 font-bold"
                                  style={{
                                    backgroundColor: 'var(--accent)',
                                    color: 'var(--accent-fg)',
                                  }}
                                >
                                  مراجعة وتأكيد التعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingEventId(null)}
                                  className="rounded-lg border px-3 py-1.5 font-semibold"
                                  style={{ borderColor: 'var(--border-color)' }}
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="font-bold text-sm">
                                  {ev.summary || '(بدون عنوان)'}
                                </div>
                                <div
                                  className="tabular-nums font-semibold"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  {eventDateStr || '—'}
                                </div>
                                {ev.description && (
                                  <p style={{ color: 'var(--text-muted)' }}>
                                    {ev.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {ev.htmlLink && (
                                  <a
                                    href={ev.htmlLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="فتح في تقويم Google"
                                    className="rounded-lg border p-1.5 hover:opacity-80"
                                    style={{ borderColor: 'var(--border-color)' }}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  aria-label={`تعديل موعد ${ev.summary}`}
                                  onClick={() => {
                                    setEditingEventId(ev.id);
                                    setEditEventSummary(ev.summary || '');
                                    setEditEventDate(
                                      eventDateStr || newEventDate
                                    );
                                    setEditEventDesc(ev.description || '');
                                  }}
                                  className="rounded-lg border p-1.5 hover:opacity-80"
                                  style={{ borderColor: 'var(--border-color)' }}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`حذف موعد ${ev.summary}`}
                                  onClick={() =>
                                    setPendingConfirm({
                                      kind: 'delete_event',
                                      calendarId: selectedCalendarId,
                                      eventId: ev.id,
                                      title: ev.summary || 'موعد',
                                    })
                                  }
                                  className="rounded-lg border p-1.5 hover:opacity-80"
                                  style={{
                                    borderColor: 'var(--danger)',
                                    color: 'var(--danger)',
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TASKS TAB */}
          {workspaceTab === 'tasks' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-5">
                <form
                  onSubmit={handleCreateTask}
                  className="capsule-glass-card space-y-3 border p-4 text-xs"
                  style={{
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <ListPlus
                      className="h-4 w-4"
                      style={{ color: 'var(--accent)' }}
                    />
                    <span>إضافة مهمة متابعة جديدة</span>
                  </div>

                  {taskLists.length > 0 && (
                    <div>
                      <label className="mb-1 block font-bold">قائمة المهام</label>
                      <select
                        value={selectedTaskListId}
                        onChange={(e) => {
                          setSelectedTaskListId(e.target.value);
                          void loadWorkspaceData(
                            selectedCalendarId,
                            e.target.value
                          );
                        }}
                        className="w-full rounded-lg border px-3 py-2"
                        style={{
                          backgroundColor: 'var(--bg-main)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        {taskLists.map((tl) => (
                          <option key={tl.id} value={tl.id}>
                            {tl.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block font-bold">عنوان المهمة</label>
                    <input
                      type="text"
                      required
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="مثال: مراجعة بطاقة العائلة أو تحصيل الأجور"
                      className="w-full rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-bold">تاريخ الاستحقاق</label>
                    <input
                      type="date"
                      dir="ltr"
                      value={newTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 tabular-nums"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-bold">ملاحظات</label>
                    <textarea
                      rows={2}
                      value={newTaskNotes}
                      onChange={(e) => setNewTaskNotes(e.target.value)}
                      placeholder="ملاحظات إضافية للمتابعة..."
                      className="w-full rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        borderColor: 'var(--border-color)',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 font-bold disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    <ListPlus className="h-4 w-4" />
                    <span>إضافة إلى Google Tasks</span>
                  </button>
                </form>

                {reminderRelations.length > 0 && (
                  <div
                    className="capsule-glass-card space-y-2 border p-4 text-xs"
                    style={{
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div className="font-bold">تعبئة سريعة من تذكيرات العلاقات:</div>
                    <div className="space-y-1.5">
                      {reminderRelations.map((rel) => (
                        <button
                          key={rel.id}
                          type="button"
                          onClick={() => {
                            setNewTaskTitle(`متابعة: ${rel.personName}`);
                            setNewTaskDue(rel.reminderDate || '');
                            setNewTaskNotes(rel.note || '');
                          }}
                          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-right hover:opacity-85"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          <span className="font-semibold">{rel.personName}</span>
                          <span
                            className="tabular-nums"
                            style={{ color: 'var(--accent)' }}
                          >
                            {rel.reminderDate || 'تعبئة'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                className="capsule-glass-card space-y-3 border p-4 lg:col-span-7"
                style={{
                  borderColor: 'var(--border-color)',
                }}
              >
                <h2 className="text-sm font-bold">قائمة المهام الحالية</h2>

                {tasks.length === 0 ? (
                  <div
                    className="rounded-lg border p-6 text-center text-xs"
                    style={{
                      backgroundColor: 'var(--bg-main)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    لا توجد مهام مسجلة حالياً في هذه القائمة.
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {tasks.map((task) => {
                      const done = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          className="flex items-start justify-between gap-3 rounded-xl border p-3"
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            borderColor: 'var(--border-color)',
                            opacity: done ? 0.72 : 1,
                          }}
                        >
                          <div className="flex items-start gap-2.5">
                            <button
                              type="button"
                              aria-label={
                                done
                                  ? `إعادة فتح ${task.title}`
                                  : `إكمال ${task.title}`
                              }
                              onClick={() =>
                                setPendingConfirm({
                                  kind: 'toggle_task',
                                  taskListId: selectedTaskListId,
                                  taskId: task.id,
                                  title: task.title,
                                  nextStatus: done
                                    ? 'needsAction'
                                    : 'completed',
                                })
                              }
                              className="mt-0.5 shrink-0"
                              style={{
                                color: done
                                  ? 'var(--success)'
                                  : 'var(--accent)',
                              }}
                            >
                              {done ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                            <div className="space-y-0.5">
                              <div
                                className={`font-bold ${
                                  done ? 'line-through' : ''
                                }`}
                              >
                                {task.title}
                              </div>
                              {task.due && (
                                <div
                                  className="tabular-nums"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  الاستحقاق: {task.due.slice(0, 10)}
                                </div>
                              )}
                              {task.notes && (
                                <p style={{ color: 'var(--text-muted)' }}>
                                  {task.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            aria-label={`حذف مهمة ${task.title}`}
                            onClick={() =>
                              setPendingConfirm({
                                kind: 'delete_task',
                                taskListId: selectedTaskListId,
                                taskId: task.id,
                                title: task.title,
                              })
                            }
                            className="rounded-lg border p-1.5 hover:opacity-80"
                            style={{
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          </TabrixSubViewTransition>
        </>
      )}
      </TabrixSubViewTransition>

      {/* Mandatory Custom React Confirmation Full-Screen Push Page before any mutation/deletion */}
      <FullScreenPushPage
        open={Boolean(pendingConfirm)}
        onClose={() => setPendingConfirm(null)}
        title="تأكيد تنفيذ العملية في Google Workspace"
        subtitle="مراجعة صريحة قبل تعديل أو حذف بيانات تقويم أو مهام Google"
        icon={
          <AlertTriangle
            className="h-4 w-4"
            style={{
              color:
                pendingConfirm?.kind === 'delete_event' ||
                pendingConfirm?.kind === 'delete_task'
                  ? 'var(--danger)'
                  : 'var(--warning)',
            }}
          />
        }
        maxWidthClass="max-w-lg"
      >
        {pendingConfirm && (
          <div className="nexus-squircle p-6 space-y-5">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle
                className="h-5 w-5 shrink-0"
                style={{
                  color:
                    pendingConfirm.kind === 'delete_event' ||
                    pendingConfirm.kind === 'delete_task'
                      ? 'var(--danger)'
                      : 'var(--warning)',
                }}
              />
              <span>تأكيد تعديل أو حذف عنصر في حساب Google</span>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {pendingConfirm.kind === 'delete_event' &&
                `هل تؤكد حذف الموعد «${pendingConfirm.title}» نهائياً من تقويم Google؟`}
              {pendingConfirm.kind === 'update_event' &&
                `هل تؤكد حفظ التعديلات على الموعد «${pendingConfirm.summary}» بتاريخ ${pendingConfirm.date}؟`}
              {pendingConfirm.kind === 'toggle_task' &&
                `هل تؤكد تغيير حالة المهمة «${pendingConfirm.title}» إلى «${
                  pendingConfirm.nextStatus === 'completed'
                    ? 'مكتملة'
                    : 'قيد التنفيذ'
                }»؟`}
              {pendingConfirm.kind === 'delete_task' &&
                `هل تؤكد حذف المهمة «${pendingConfirm.title}» نهائياً من Google Tasks؟`}
            </p>

            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="nexus-pill-btn border px-4 py-2 font-bold"
                style={{ borderColor: 'var(--border-color)' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void executeConfirmedWorkspaceAction()}
                className="nexus-pill-btn px-5 py-2 font-bold"
                style={{
                  backgroundColor:
                    pendingConfirm.kind === 'delete_event' ||
                    pendingConfirm.kind === 'delete_task'
                      ? 'var(--danger)'
                      : 'var(--accent)',
                  color:
                    pendingConfirm.kind === 'delete_event' ||
                    pendingConfirm.kind === 'delete_task'
                      ? 'var(--danger-fg)'
                      : 'var(--accent-fg)',
                }}
              >
                تأكيد التنفيذ
              </button>
            </div>
          </div>
        )}
      </FullScreenPushPage>
    </main>
  );
};

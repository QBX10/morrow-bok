import { getAccessToken } from './firebase';

export class WorkspaceAuthRequiredError extends Error {
  constructor(message = 'يرجى ربط حساب Google للمزامنة مع التقويم والمهام.') {
    super(message);
    this.name = 'WorkspaceAuthRequiredError';
  }
}

export interface GoogleCalendarSummary {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}

export interface GoogleTaskList {
  id: string;
  title: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated?: string;
}

async function workspaceFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new WorkspaceAuthRequiredError();
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new WorkspaceAuthRequiredError(
      'انتهت صلاحية الجلسة أو لم يتم منح إذن التقويم والمهام. يرجى تسجيل الدخول بحساب Google.'
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error?.message || 'تعذر تنفيذ العملية مع Google Workspace.'
    );
  }
  return data as T;
}

export async function listCalendars(): Promise<GoogleCalendarSummary[]> {
  const data = await workspaceFetch<{ items?: GoogleCalendarSummary[] }>(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=25'
  );
  return data.items || [];
}

export async function listCalendarEvents(params?: {
  calendarId?: string;
  maxResults?: number;
  timeMin?: string;
}): Promise<GoogleCalendarEvent[]> {
  const calId = encodeURIComponent(params?.calendarId || 'primary');
  const search = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(params?.maxResults || 30),
  });
  if (params?.timeMin) {
    search.set('timeMin', params.timeMin);
  } else {
    const startOfMonth = new Date();
    startOfMonth.setDate(startOfMonth.getDate() - 14);
    search.set('timeMin', startOfMonth.toISOString());
  }
  const data = await workspaceFetch<{ items?: GoogleCalendarEvent[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?${search.toString()}`
  );
  return data.items || [];
}

export async function createCalendarEvent(params: {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  date: string; // YYYY-MM-DD
}): Promise<GoogleCalendarEvent> {
  const calId = encodeURIComponent(params.calendarId || 'primary');
  return workspaceFetch<GoogleCalendarEvent>(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
    {
      method: 'POST',
      body: JSON.stringify({
        summary: params.summary.trim(),
        description: params.description?.trim() || '',
        location: params.location?.trim() || '',
        start: { date: params.date },
        end: { date: params.date },
      }),
    }
  );
}

export async function updateCalendarEvent(params: {
  calendarId?: string;
  eventId: string;
  summary: string;
  description?: string;
  date: string;
}): Promise<GoogleCalendarEvent> {
  const calId = encodeURIComponent(params.calendarId || 'primary');
  const eventId = encodeURIComponent(params.eventId);
  return workspaceFetch<GoogleCalendarEvent>(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        summary: params.summary.trim(),
        description: params.description?.trim() || '',
        start: { date: params.date },
        end: { date: params.date },
      }),
    }
  );
}

export async function deleteCalendarEvent(params: {
  calendarId?: string;
  eventId: string;
}): Promise<void> {
  const calId = encodeURIComponent(params.calendarId || 'primary');
  const eventId = encodeURIComponent(params.eventId);
  await workspaceFetch<void>(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
    { method: 'DELETE' }
  );
}

export async function listTaskLists(): Promise<GoogleTaskList[]> {
  const data = await workspaceFetch<{ items?: GoogleTaskList[] }>(
    'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=25'
  );
  return data.items || [];
}

export async function listTasks(taskListId = '@default'): Promise<GoogleTaskItem[]> {
  const id = encodeURIComponent(taskListId);
  const data = await workspaceFetch<{ items?: GoogleTaskItem[] }>(
    `https://tasks.googleapis.com/tasks/v1/lists/${id}/tasks?showCompleted=true&showHidden=false&maxResults=50`
  );
  return data.items || [];
}

export async function createTask(params: {
  taskListId?: string;
  title: string;
  notes?: string;
  due?: string; // YYYY-MM-DD or RFC3339
}): Promise<GoogleTaskItem> {
  const id = encodeURIComponent(params.taskListId || '@default');
  const dueIso = params.due
    ? params.due.includes('T')
      ? params.due
      : `${params.due}T09:00:00.000Z`
    : undefined;
  return workspaceFetch<GoogleTaskItem>(
    `https://tasks.googleapis.com/tasks/v1/lists/${id}/tasks`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: params.title.trim(),
        notes: params.notes?.trim() || '',
        ...(dueIso ? { due: dueIso } : {}),
      }),
    }
  );
}

export async function updateTask(params: {
  taskListId?: string;
  taskId: string;
  title?: string;
  notes?: string;
  status?: 'needsAction' | 'completed';
  due?: string;
}): Promise<GoogleTaskItem> {
  const listId = encodeURIComponent(params.taskListId || '@default');
  const taskId = encodeURIComponent(params.taskId);
  const dueIso = params.due
    ? params.due.includes('T')
      ? params.due
      : `${params.due}T09:00:00.000Z`
    : undefined;
  return workspaceFetch<GoogleTaskItem>(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...(params.title !== undefined ? { title: params.title.trim() } : {}),
        ...(params.notes !== undefined ? { notes: params.notes.trim() } : {}),
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...(dueIso ? { due: dueIso } : {}),
      }),
    }
  );
}

export async function deleteTask(params: {
  taskListId?: string;
  taskId: string;
}): Promise<void> {
  const listId = encodeURIComponent(params.taskListId || '@default');
  const taskId = encodeURIComponent(params.taskId);
  await workspaceFetch<void>(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    { method: 'DELETE' }
  );
}

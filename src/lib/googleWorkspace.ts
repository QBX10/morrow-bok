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

// --- Google Drive Backup API (drive.file scope) ---

export interface GoogleDriveBackupFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  description?: string;
}

function escapeDriveQueryValue(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function ensureDriveBackupFolder(
  folderName = 'Morrow_Drive_Backups'
): Promise<string> {
  const safeName = folderName.trim() || 'Morrow_Drive_Backups';
  const query = `name = '${escapeDriveQueryValue(safeName)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const search = new URLSearchParams({
    q: query,
    fields: 'files(id,name)',
    pageSize: '1',
  });
  const existing = await workspaceFetch<{ files?: Array<{ id: string; name: string }> }>(
    `https://www.googleapis.com/drive/v3/files?${search.toString()}`
  );
  if (existing.files && existing.files.length > 0) {
    return existing.files[0].id;
  }

  const created = await workspaceFetch<{ id: string }>(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      body: JSON.stringify({
        name: safeName,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'مجلد النسخ الاحتياطي المنظّم لتطبيق Morrow',
      }),
    }
  );
  return created.id;
}

export async function listDriveBackupFiles(
  folderName = 'Morrow_Drive_Backups'
): Promise<GoogleDriveBackupFile[]> {
  const safeName = folderName.trim() || 'Morrow_Drive_Backups';
  const folderQuery = `name = '${escapeDriveQueryValue(safeName)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const folderRes = await workspaceFetch<{ files?: Array<{ id: string }> }>(
    `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
      q: folderQuery,
      fields: 'files(id)',
      pageSize: '1',
    }).toString()}`
  );
  const folderId = folderRes.files?.[0]?.id;
  const filesQuery = folderId
    ? `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false`
    : `mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await workspaceFetch<{ files?: GoogleDriveBackupFile[] }>(
    `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
      q: filesQuery,
      orderBy: 'modifiedTime desc',
      pageSize: '20',
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,description)',
    }).toString()}`
  );
  return res.files || [];
}

export async function uploadDriveBackupFile(params: {
  blob: Blob;
  fileName: string;
  folderName?: string;
  description?: string;
  existingFileId?: string;
}): Promise<GoogleDriveBackupFile> {
  const token = await getAccessToken();
  if (!token) {
    throw new WorkspaceAuthRequiredError(
      'يرجى تسجيل الدخول بحساب Google Drive أولاً لرفع النسخة الاحتياطية.'
    );
  }

  const folderId = params.existingFileId
    ? undefined
    : await ensureDriveBackupFolder(params.folderName || 'Morrow_Drive_Backups');

  const metadata: Record<string, unknown> = {
    name: params.fileName,
    mimeType: params.blob.type || 'application/zip',
    ...(params.description ? { description: params.description } : {}),
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', params.blob, params.fileName);

  const url = params.existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        params.existingFileId
      )}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,description`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,description';

  const res = await fetch(url, {
    method: params.existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (res.status === 401 || res.status === 403) {
    throw new WorkspaceAuthRequiredError(
      'انتهت صلاحية إذن Google Drive؛ يرجى إعادة ربط حساب Google.'
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'تعذر رفع النسخة إلى Google Drive.');
  }
  return data as GoogleDriveBackupFile;
}

export async function downloadDriveBackupFile(fileId: string): Promise<Blob> {
  const token = await getAccessToken();
  if (!token) {
    throw new WorkspaceAuthRequiredError(
      'يرجى تسجيل الدخول بحساب Google Drive لتنزيل الملف.'
    );
  }
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (res.status === 401 || res.status === 403) {
    throw new WorkspaceAuthRequiredError(
      'انتهت صلاحية إذن Google Drive؛ يرجى إعادة ربط الحساب.'
    );
  }
  if (!res.ok) {
    throw new Error('تعذر تنزيل الملف من Google Drive.');
  }
  return await res.blob();
}

export async function deleteDriveBackupFile(fileId: string): Promise<void> {
  await workspaceFetch<void>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE' }
  );
}

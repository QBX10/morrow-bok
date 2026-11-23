import {
  GoogleGenAI,
  Modality,
  Type,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type LiveServerMessage,
} from '@google/genai';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  createUserRecord,
  findUserByEmail,
  findUserByPhone,
  findUserByUid,
  findUserByUsername,
  getWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  upsertLocalProfile,
} from './src/db/localStore.ts';
import {
  deleteAppearanceProfileByUid,
  getSqlUserByUid,
  getWorkspaceByUid,
  isSqlDatabaseConfigured,
  listAppearanceProfilesByUid,
  saveAppearanceProfileByUid,
  saveWorkspaceByUid,
  updateSqlUserProfile,
} from './src/db/users.ts';
import {
  requireAuth,
  signSessionToken,
  type AuthRequest,
} from './src/middleware/auth.ts';
import type {
  InferredDocumentMetadata,
  QuickExtractRawRow,
} from './src/types/agency.ts';
import type { AssistantBrainMode, AssistantToolCall } from './src/types/assistant.ts';
import { normalizePhoneNumber } from './src/utils/agencyLogic.ts';
import { enforceSafeArabicTerminology } from './src/utils/assistantPrivacy.ts';
import {
  PRIMARY_FREE_GEMINI_MODEL,
  SECONDARY_FREE_GEMINI_MODEL,
  sanitizeAssistantModelId,
} from './src/utils/assistantQuota.ts';
import {
  ASSISTANT_TOOL_DECLARATIONS,
  validateToolCall,
} from './src/utils/assistantTools.ts';
import { buildSafeQuickExtractResult } from './src/utils/quickExtractEngine.ts';
import {
  buildProactiveHeaderGreeting,
  buildSemanticColumnMappings,
  inferMetadataFromText,
} from './src/utils/zeroTrustExtract.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const GEMINI_MODEL = 'gemini-4-hydrogen';
const LITE_FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

const pendingPhoneOtps = new Map<
  string,
  { code: string; expiresAt: number; attempts: number }
>();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(keyHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientCloudError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err || '').toLowerCase();
  const status =
    typeof (err as { status?: unknown })?.status === 'number'
      ? Number((err as { status: number }).status)
      : 0;
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  );
}

async function generateWithSilentResilience(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    config?: Record<string, unknown>;
    primaryModel?: string;
    fallbackModel?: string;
  }
): Promise<{
  response: GenerateContentResponse;
  modelUsed: string;
  fallbackUsed: 'primary' | 'flash-lite';
}> {
  const chain = Array.from(
    new Set([
      params.primaryModel || GEMINI_MODEL,
      params.fallbackModel || LITE_FALLBACK_GEMINI_MODEL,
    ])
  );

  let lastError: unknown = null;
  for (let mIdx = 0; mIdx < chain.length; mIdx++) {
    const modelName = chain[mIdx];
    const maxAttempts = mIdx === 0 ? 2 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('cloud_model_timeout')), 28000);
        });
        const callPromise = ai.models.generateContent({
          model: modelName,
          contents: params.contents as Parameters<typeof ai.models.generateContent>[0]['contents'],
          config: params.config as Parameters<typeof ai.models.generateContent>[0]['config'],
        });
        const response = await Promise.race([callPromise, timeoutPromise]);
        return {
          response,
          modelUsed: modelName,
          fallbackUsed: mIdx === 0 ? 'primary' : 'flash-lite',
        };
      } catch (err) {
        lastError = err;
        if (!isTransientCloudError(err)) {
          throw err;
        }
        const waitMs = 350 * (attempt + 1) + Math.floor(Math.random() * 140);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }
  throw lastError;
}

function runLocalCopilotFallback(
  message: string,
  draftRows: Array<{
    rowIndex: number;
    resolvedName: string;
    resolvedIndividuals: number | null;
    resolvedEligibleIndividuals?: number | null;
    resolvedDecreaseCount: number | null;
    nameConfidence?: number;
    numbersConfidence?: number;
    zeroTrustConfirmed?: boolean;
    mathIssuesCount?: number;
  }>,
  inferredMetadata?: Partial<InferredDocumentMetadata> | null
): { reply: string; operations: Array<Record<string, unknown>> } {
  const norm = message.trim();
  const operations: Array<Record<string, unknown>> = [];

  if (/اخفاء.*اعمد|إخفاء.*أعمد|الاعمدة الفارغة|الأعمدة الفارغة/i.test(norm)) {
    operations.push({ type: 'hide_empty_columns' });
    return {
      reply: 'تم إخفاء الأعمدة الفارغة في مسودة الجدول فوراً لتسهيل المراجعة.',
      operations,
    };
  }
  if (/اظهار.*كل.*اعمد|إظهار.*كل.*أعمد|جميع الأعمدة/i.test(norm)) {
    operations.push({ type: 'show_all_columns' });
    return {
      reply: 'تم إظهار كافة الأعمدة في الجدول.',
      operations,
    };
  }
  if (/محجوب|نزول|حجب/i.test(norm) && !/كم/.test(norm)) {
    const blockedCount = draftRows.filter((r) => (r.resolvedDecreaseCount ?? 0) > 0).length;
    operations.push({ type: 'filter_blocked' });
    return {
      reply: `تمت تصفية المسودة لعرض العائلات التي لديها أفراد محجوبين/نزول فقط (${blockedCount} صف).`,
      operations,
    };
  }
  if (/عائلات كبيرة|الكبيرة|اكبر|أكبر/i.test(norm)) {
    const bigCount = draftRows.filter((r) => (r.resolvedIndividuals ?? 0) >= 5).length;
    operations.push({ type: 'filter_large_families' });
    return {
      reply: `تمت تصفية المسودة لإظهار العائلات الكبيرة (5 أفراد فأكثر): ${bigCount} عائلة.`,
      operations,
    };
  }
  if (/مشكوك|شك|تعارض|مراجعة|أخطاء/i.test(norm)) {
    const doubtful = draftRows.filter(
      (r) =>
        !r.zeroTrustConfirmed ||
        (r.nameConfidence ?? 1) < 0.99 ||
        (r.numbersConfidence ?? 1) < 0.99 ||
        (r.mathIssuesCount ?? 0) > 0
    );
    if (!/كم/.test(norm)) {
      operations.push({ type: 'filter_doubtful' });
    }
    return {
      reply:
        doubtful.length === 0
          ? 'جميع الصفوف الحالية مؤكدة بنسبة 99% فأعلى ولا يوجد أي شك أو تعارض رياضي.'
          : `يوجد حالياً (${doubtful.length}) صفاً يحتاج مراجعة من أصل (${draftRows.length}) صف (صفوف: ${doubtful
              .slice(0, 8)
              .map((r) => r.rowIndex)
              .join('، ')}).`,
      operations,
    };
  }
  if (/الكل|الغاء التصفية|إلغاء التصفية|اعرض الجميع/i.test(norm)) {
    operations.push({ type: 'filter_clear' });
    return {
      reply: `تم إلغاء التصفية وعرض جميع الصفوف (${draftRows.length} صف).`,
      operations,
    };
  }
  const rowNumMatch = norm.match(/(?:صف|سطر|رقم)\s*(\d+)/);
  if (rowNumMatch) {
    const num = Number(rowNumMatch[1]);
    const found = draftRows.find((r) => r.rowIndex === num);
    if (found) {
      operations.push({ type: 'highlight_row', rowIndex: num });
      return {
        reply: `السطر رقم ${num}: «${found.resolvedName || 'غير مسمى'}» — الأفراد: ${found.resolvedIndividuals ?? '—'}، المحجوب: ${found.resolvedDecreaseCount ?? 0}. تم تمييزه على الصورة والجدول.`,
        operations,
      };
    }
  }
  if (/تاريخ|شهر|وكالة|هوية/i.test(norm)) {
    return {
      reply: `بيانات الترويسة المستنتجة: الوكالة «${inferredMetadata?.agencyName || 'غير محددة'}»، الشهر/التاريخ «${inferredMetadata?.tableDateLabel || 'غير محدد'}».`,
      operations,
    };
  }
  return {
    reply: `المسودة تضم حالياً ${draftRows.length} صفاً. يمكنك طلب: «كم عدد الصفوف المشكوك فيها؟» أو «اخفِ الأعمدة الفارغة» أو «فلتر المحجوبين».`,
    operations,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, model: GEMINI_MODEL });
  });

  // --- Multi-Auth Endpoints: Gmail/Google, Username, Phone (OTP & Password) ---

  app.post('/api/auth/register', (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        mode?: 'google' | 'username' | 'phone';
        displayName?: string;
        email?: string;
        username?: string;
        phone?: string;
        password?: string;
      };

      const mode =
        body.mode === 'phone' || body.mode === 'google' ? body.mode : 'username';
      const displayName = String(body.displayName || '').trim();
      const password = String(body.password || '');

      if (password.length < 4) {
        res
          .status(400)
          .json({ error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل.' });
        return;
      }

      if (mode === 'google') {
        const email = String(body.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.status(400).json({ error: 'يرجى إدخال بريد Gmail / إلكتروني صالح.' });
          return;
        }
        if (findUserByEmail(email)) {
          res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل مسبقًا.' });
          return;
        }
        const created = createUserRecord({
          uid: `gml_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
          authProvider: 'google',
          displayName: displayName || email.split('@')[0],
          email,
          passwordHash: hashPassword(password),
        });
        const user = {
          uid: created.uid,
          provider: 'google' as const,
          displayName: created.displayName,
          email,
          role: 'manager' as const,
        };
        res.status(201).json({ token: signSessionToken(user), user });
        return;
      }

      if (mode === 'username') {
        const username = String(body.username || '').trim().toLowerCase();
        if (!/^[a-zA-Z0-9_.\-]{3,32}$/.test(username)) {
          res.status(400).json({
            error:
              'اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا إنجليزيًا أو أرقامًا.',
          });
          return;
        }
        if (findUserByUsername(username)) {
          res.status(409).json({ error: 'اسم المستخدم مسجل مسبقًا.' });
          return;
        }
        const created = createUserRecord({
          uid: `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
          authProvider: 'username',
          displayName: displayName || username,
          username,
          passwordHash: hashPassword(password),
        });
        const user = {
          uid: created.uid,
          provider: 'username' as const,
          displayName: created.displayName,
          username,
          role: 'manager' as const,
        };
        res.status(201).json({ token: signSessionToken(user), user });
        return;
      }

      const phone = normalizePhoneNumber(body.phone || '');
      if (!/^\+\d{8,15}$/.test(phone)) {
        res
          .status(400)
          .json({ error: 'أدخل رقم هاتف صالحًا (مثال: 07701234567).' });
        return;
      }
      if (findUserByPhone(phone)) {
        res.status(409).json({ error: 'رقم الهاتف مسجل مسبقًا.' });
        return;
      }
      const created = createUserRecord({
        uid: `phn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        authProvider: 'phone',
        displayName: displayName || phone,
        phone,
        passwordHash: hashPassword(password),
      });
      const user = {
        uid: created.uid,
        provider: 'phone' as const,
        displayName: created.displayName,
        phone,
        role: 'manager' as const,
      };
      res.status(201).json({ token: signSessionToken(user), user });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'تعذر إنشاء الحساب.',
      });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        mode?: 'google' | 'username' | 'phone';
        identifier?: string;
        password?: string;
      };
      const mode: 'google' | 'username' | 'phone' =
        body.mode === 'phone' || body.mode === 'google' ? body.mode : 'username';
      const password = String(body.password || '');

      const found =
        mode === 'google'
          ? findUserByEmail(String(body.identifier || ''))
          : mode === 'phone'
          ? findUserByPhone(normalizePhoneNumber(body.identifier || ''))
          : findUserByUsername(String(body.identifier || ''));

      if (!found || !verifyPassword(password, found.passwordHash)) {
        res.status(401).json({
          error:
            mode === 'google'
              ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
              : mode === 'phone'
              ? 'رقم الهاتف أو كلمة المرور غير صحيحة.'
              : 'اسم المستخدم أو كلمة المرور غير صحيحة.',
        });
        return;
      }

      const user = {
        uid: found.uid,
        provider: mode,
        displayName: found.displayName,
        email: found.email || undefined,
        username: found.username || undefined,
        phone: found.phone || undefined,
        role: found.role,
      };
      res.json({ token: signSessionToken(user), user });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'تعذر تسجيل الدخول.',
      });
    }
  });

  app.post('/api/auth/google-quick', (req: Request, res: Response) => {
    const body = (req.body || {}) as { email?: string; displayName?: string };
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'أدخل بريد Gmail صحيحًا للمتابعة.' });
      return;
    }

    let found = findUserByEmail(email);
    if (!found) {
      found = createUserRecord({
        uid: `gml_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        authProvider: 'google',
        displayName: String(body.displayName || '').trim() || email.split('@')[0],
        email,
        passwordHash: null,
      });
    }

    const user = {
      uid: found.uid,
      provider: 'google' as const,
      displayName: found.displayName,
      email: found.email || email,
      role: found.role,
    };
    res.json({ token: signSessionToken(user), user });
  });

  app.post('/api/auth/phone/request-otp', (req: Request, res: Response) => {
    const body = (req.body || {}) as { phone?: string };
    const phone = normalizePhoneNumber(body.phone || '');
    if (!/^\+\d{8,15}$/.test(phone)) {
      res
        .status(400)
        .json({ error: 'أدخل رقم هاتف صحيحًا (مثال: 07701234567).' });
      return;
    }
    const code = String(crypto.randomInt(100000, 999999));
    pendingPhoneOtps.set(phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    });
    res.json({
      ok: true,
      phone,
      demoCode: process.env.SMS_PROVIDER_API_KEY ? undefined : code,
    });
  });

  app.post('/api/auth/phone/verify-otp', (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      phone?: string;
      code?: string;
      displayName?: string;
    };
    const phone = normalizePhoneNumber(body.phone || '');
    const code = String(body.code || '').trim();
    const pending = pendingPhoneOtps.get(phone);

    if (!pending || Date.now() > pending.expiresAt) {
      res
        .status(400)
        .json({ error: 'انتهت صلاحية رمز التحقق، اطلب رمزًا جديدًا.' });
      return;
    }
    if (pending.attempts >= 5) {
      pendingPhoneOtps.delete(phone);
      res.status(429).json({ error: 'تم تجاوز عدد المحاولات المسموح.' });
      return;
    }
    if (pending.code !== code) {
      pending.attempts += 1;
      res.status(401).json({ error: 'رمز التحقق غير صحيح.' });
      return;
    }

    pendingPhoneOtps.delete(phone);
    let userRec = findUserByPhone(phone);
    if (!userRec) {
      userRec = createUserRecord({
        uid: `phn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        authProvider: 'phone',
        displayName: String(body.displayName || '').trim() || phone,
        phone,
        passwordHash: null,
      });
    }

    const user = {
      uid: userRec.uid,
      provider: 'phone' as const,
      displayName: userRec.displayName,
      phone,
      role: userRec.role,
    };
    res.json({ token: signSessionToken(user), user });
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      if (isSqlDatabaseConfigured()) {
        const sqlUser = await getSqlUserByUid(principal.uid);
        res.json({
          user: {
            uid: principal.uid,
            provider: (sqlUser?.authProvider as 'google' | 'username' | 'phone') || principal.provider,
            displayName: sqlUser?.displayName || principal.displayName,
            email: sqlUser?.email || principal.email,
            username: principal.username,
            phone: principal.phone,
            avatarUrl: sqlUser?.avatarUrl || principal.avatarUrl,
            role: (sqlUser?.role as 'manager' | 'viewer') || 'manager',
          },
        });
        return;
      }
      const dbUser = findUserByUid(principal.uid);
      res.json({
        user: {
          uid: principal.uid,
          provider: principal.provider,
          displayName: dbUser?.displayName || principal.displayName,
          email: dbUser?.email || principal.email,
          username: dbUser?.username || principal.username,
          phone: dbUser?.phone || principal.phone,
          avatarUrl: dbUser?.avatarUrl || principal.avatarUrl,
          role: dbUser?.role || 'manager',
        },
      });
    } catch (err) {
      console.error('Failed to load profile:', err);
      res.status(500).json({ error: 'تعذر جلب بيانات الحساب.' });
    }
  });

  app.put('/api/user/profile', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      const body = (req.body || {}) as {
        displayName?: string;
        avatarUrl?: string | null;
      };
      const displayName =
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim().slice(0, 80)
          : principal.displayName;
      const avatarUrl =
        body.avatarUrl === null
          ? null
          : typeof body.avatarUrl === 'string' &&
            body.avatarUrl.length <= 450000 &&
            (body.avatarUrl.startsWith('data:image/') ||
              body.avatarUrl.startsWith('https://'))
          ? body.avatarUrl
          : undefined;

      if (isSqlDatabaseConfigured()) {
        const updated = await updateSqlUserProfile({
          uid: principal.uid,
          email: principal.email || `${principal.uid}@tabrex.local`,
          displayName,
          avatarUrl,
        });
        res.json({
          user: {
            uid: updated.uid,
            provider: (updated.authProvider as 'google' | 'username' | 'phone') || principal.provider,
            displayName: updated.displayName,
            email: updated.email,
            username: principal.username,
            phone: principal.phone,
            avatarUrl: updated.avatarUrl || undefined,
            role: (updated.role as 'manager' | 'viewer') || 'manager',
          },
        });
        return;
      }

      const localUpdated = upsertLocalProfile({
        uid: principal.uid,
        authProvider: principal.provider,
        displayName,
        email: principal.email ?? null,
        avatarUrl,
      });
      res.json({
        user: {
          uid: localUpdated.uid,
          provider: localUpdated.authProvider,
          displayName: localUpdated.displayName,
          email: localUpdated.email || undefined,
          username: localUpdated.username || undefined,
          phone: localUpdated.phone || undefined,
          avatarUrl: localUpdated.avatarUrl || undefined,
          role: localUpdated.role,
        },
      });
    } catch (err) {
      console.error('Failed to update user profile:', err);
      res.status(500).json({ error: 'تعذر تحديث الملف الشخصي.' });
    }
  });

  // --- Per-User Workspace Sync (Cloud SQL with local fallback) ---

  app.get('/api/workspace', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      if (isSqlDatabaseConfigured()) {
        const snap = await getWorkspaceByUid(principal.uid);
        if (!snap) {
          res.json({ exists: false, snapshot: null });
          return;
        }
        res.json({
          exists: true,
          snapshot: JSON.parse(snap.snapshotJson),
          updatedAt: snap.updatedAt,
        });
        return;
      }

      const userRec = findUserByUid(principal.uid);
      if (!userRec) {
        res.json({ exists: false, snapshot: null });
        return;
      }
      const snap = getWorkspaceSnapshot(userRec.id);
      if (!snap) {
        res.json({ exists: false, snapshot: null });
        return;
      }
      res.json({
        exists: true,
        snapshot: JSON.parse(snap.snapshotJson),
        updatedAt: snap.updatedAt,
      });
    } catch (err) {
      console.error('Failed to fetch workspace snapshot:', err);
      res.status(500).json({ error: 'تعذر استرجاع نسخة مساحة العمل.' });
    }
  });

  app.put('/api/workspace', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      const body = (req.body || {}) as {
        snapshot?: { agencies?: unknown[]; persons?: unknown[] };
      };
      if (
        !body.snapshot ||
        !Array.isArray(body.snapshot.agencies) ||
        !Array.isArray(body.snapshot.persons)
      ) {
        res.status(400).json({ error: 'بيانات مساحة العمل غير صالحة.' });
        return;
      }

      if (isSqlDatabaseConfigured()) {
        const saved = await saveWorkspaceByUid({
          uid: principal.uid,
          email: principal.email || `${principal.uid}@tabrex.local`,
          displayName: principal.displayName,
          authProvider: principal.provider,
          snapshotJson: JSON.stringify(body.snapshot),
          recordCount: body.snapshot.persons.length,
          agencyCount: body.snapshot.agencies.length,
        });
        res.json({ ok: true, updatedAt: saved.updatedAt });
        return;
      }

      let userRec = findUserByUid(principal.uid);
      if (!userRec) {
        userRec = upsertLocalProfile({
          uid: principal.uid,
          authProvider: principal.provider,
          displayName: principal.displayName,
          email: principal.email ?? null,
          avatarUrl: principal.avatarUrl ?? null,
        });
      }
      const saved = saveWorkspaceSnapshot({
        userId: userRec.id,
        snapshotJson: JSON.stringify(body.snapshot),
        recordCount: body.snapshot.persons.length,
        agencyCount: body.snapshot.agencies.length,
      });
      res.json({ ok: true, updatedAt: saved.updatedAt });
    } catch (err) {
      console.error('Failed to save workspace snapshot:', err);
      res.status(500).json({ error: 'تعذر حفظ نسخة مساحة العمل.' });
    }
  });

  app.get('/api/appearance-profiles', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      if (!isSqlDatabaseConfigured()) {
        res.json({ profiles: [] });
        return;
      }
      const profiles = await listAppearanceProfilesByUid(principal.uid);
      res.json({ profiles });
    } catch (err) {
      console.error('Failed to list appearance profiles:', err);
      res.status(500).json({ error: 'تعذر جلب ملفات المظهر.' });
    }
  });

  app.put('/api/appearance-profiles', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      const body = (req.body || {}) as {
        profileKey?: string;
        name?: string;
        configJson?: string;
      };
      const profileKey = String(body.profileKey || '').trim().slice(0, 64);
      const name = String(body.name || '').trim().slice(0, 80);
      const configJson = String(body.configJson || '').trim().slice(0, 32000);
      if (!profileKey || !name || !configJson) {
        res.status(400).json({ error: 'بيانات ملف المظهر ناقصة.' });
        return;
      }
      if (!isSqlDatabaseConfigured()) {
        res.json({ ok: true });
        return;
      }
      const saved = await saveAppearanceProfileByUid({
        uid: principal.uid,
        email: principal.email || `${principal.uid}@tabrex.local`,
        displayName: principal.displayName,
        profileKey,
        name,
        configJson,
      });
      res.json({ ok: true, profile: saved });
    } catch (err) {
      console.error('Failed to save appearance profile:', err);
      res.status(500).json({ error: 'تعذر حفظ ملف المظهر.' });
    }
  });

  app.delete('/api/appearance-profiles/:profileKey', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      const profileKey = String(req.params.profileKey || '').trim();
      if (!profileKey) {
        res.status(400).json({ error: 'معرّف ملف المظهر غير صالح.' });
        return;
      }
      if (isSqlDatabaseConfigured()) {
        await deleteAppearanceProfileByUid(principal.uid, profileKey);
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete appearance profile:', err);
      res.status(500).json({ error: 'تعذر حذف ملف المظهر.' });
    }
  });

  // --- Quick Extract Header Metadata Inference (Vision AI) ---

  app.post('/api/quick-extract/metadata-inference', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        filename?: string;
        mimeType?: string;
        base64Pdf?: string;
        imageDataUrl?: string;
        frames?: Array<{ mimeType?: string; data?: string; label?: string }>;
        rawText?: string;
      };

      const filename = String(body.filename || '').trim().slice(0, 180);
      const rawText = String(body.rawText || '').trim().slice(0, 6000);
      const localFallback = inferMetadataFromText(rawText, [], filename);

      const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

      if (body.base64Pdf) {
        const cleanPdf = String(body.base64Pdf)
          .replace(/^data:application\/pdf;base64,/, '')
          .trim();
        if (cleanPdf) {
          parts.push({ inlineData: { mimeType: 'application/pdf', data: cleanPdf } });
        }
      } else if (Array.isArray(body.frames) && body.frames.length > 0) {
        const firstFrame = body.frames[0];
        const cleanImg = String(firstFrame?.data || '')
          .replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
          .trim();
        if (cleanImg) {
          const mimeType =
            firstFrame.mimeType === 'image/png' || firstFrame.mimeType === 'image/webp'
              ? firstFrame.mimeType
              : 'image/jpeg';
          parts.push({ inlineData: { mimeType, data: cleanImg } });
        }
      } else if (body.imageDataUrl) {
        const mimeMatch = String(body.imageDataUrl).match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const cleanImg = String(body.imageDataUrl)
          .replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
          .trim();
        if (cleanImg) {
          parts.push({
            inlineData: {
              mimeType: mimeMatch?.[1] || 'image/jpeg',
              data: cleanImg,
            },
          });
        }
      }

      if (parts.length === 0 && !rawText) {
        res.json({ ok: true, metadata: localFallback });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.json({ ok: true, metadata: localFallback });
        return;
      }

      parts.push({
        text: `اقرأ ترويسة الجدول فقط من المصدر المرفق (${filename || 'document'})${
          rawText ? `\nعينة النص:\n${rawText.slice(0, 1800)}` : ''
        } واستخرج: اسم الوكالة، الشهر، السنة، رقم المركز/الوكالة إن وجد، وعناوين الأعمدة الظاهرة.`,
      });

      const metadataSchema = {
        type: Type.OBJECT,
        properties: {
          agencyName: { type: Type.STRING, nullable: true },
          agencyNameConfidence: { type: Type.NUMBER },
          monthLabel: { type: Type.STRING, nullable: true },
          yearLabel: { type: Type.STRING, nullable: true },
          tableDateLabel: { type: Type.STRING, nullable: true },
          tableDateConfidence: { type: Type.NUMBER },
          centerOrAgencyNumber: { type: Type.STRING, nullable: true },
          centerNumberConfidence: { type: Type.NUMBER },
          headerSnippet: { type: Type.STRING },
          detectedColumns: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      };

      const { response, fallbackUsed } = await generateWithSilentResilience(ai, {
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction:
            'أنت محلل ترويسات جداول وكالات الكمية الغذائية بدقة عالية. استخرج اسم الوكالة والشهر والسنة وعناوين الأعمدة كما هي في الترويسة فقط بصيغة JSON دون تخمين غير موجود.',
          responseMimeType: 'application/json',
          responseSchema: metadataSchema,
          temperature: 0.1,
        },
      });

      const parsed = JSON.parse(String(response.text || '{}')) as {
        agencyName?: string | null;
        agencyNameConfidence?: number;
        monthLabel?: string | null;
        yearLabel?: string | null;
        tableDateLabel?: string | null;
        tableDateConfidence?: number;
        centerOrAgencyNumber?: string | null;
        centerNumberConfidence?: number;
        headerSnippet?: string;
        detectedColumns?: string[];
      };

      const combinedDate =
        String(parsed.tableDateLabel || '').trim() ||
        [parsed.monthLabel, parsed.yearLabel]
          .map((x) => String(x || '').trim())
          .filter(Boolean)
          .join(' ') ||
        localFallback?.tableDateLabel ||
        null;

      const detectedColumns = Array.isArray(parsed.detectedColumns)
        ? parsed.detectedColumns.map((c) => String(c || '').trim()).filter(Boolean)
        : localFallback?.detectedColumns || [];
      const semanticMapping = buildSemanticColumnMappings(detectedColumns);
      const resolvedAgencyName =
        String(parsed.agencyName || '').trim() || localFallback?.agencyName || null;

      if (
        !resolvedAgencyName &&
        !combinedDate &&
        !parsed.centerOrAgencyNumber &&
        detectedColumns.length === 0
      ) {
        res.json({ ok: true, metadata: localFallback });
        return;
      }

      const metadata: InferredDocumentMetadata = {
        agencyName: resolvedAgencyName,
        agencyNameConfidence:
          typeof parsed.agencyNameConfidence === 'number'
            ? parsed.agencyNameConfidence
            : resolvedAgencyName
              ? 0.94
              : 0,
        matchedAgencyId: null,
        tableDateLabel: combinedDate,
        tableDateConfidence:
          typeof parsed.tableDateConfidence === 'number'
            ? parsed.tableDateConfidence
            : combinedDate
              ? 0.94
              : 0,
        centerOrAgencyNumber:
          String(parsed.centerOrAgencyNumber || '').trim() ||
          localFallback?.centerOrAgencyNumber ||
          null,
        centerNumberConfidence:
          typeof parsed.centerNumberConfidence === 'number'
            ? parsed.centerNumberConfidence
            : parsed.centerOrAgencyNumber
              ? 0.92
              : 0,
        headerSnippet:
          String(parsed.headerSnippet || '').trim() || localFallback?.headerSnippet,
        detectedColumns,
        semanticMapping,
        proactivePrompt: buildProactiveHeaderGreeting({
          agencyName: resolvedAgencyName,
          tableDateLabel: combinedDate,
          detectedColumns,
          semanticMapping,
        }),
        fallbackUsed,
        confirmedByUser: false,
      };

      res.json({ ok: true, metadata, fallbackUsed });
    } catch {
      const body = (req.body || {}) as { filename?: string; rawText?: string };
      res.json({
        ok: true,
        metadata: inferMetadataFromText(String(body.rawText || ''), [], body.filename),
        fallbackUsed: 'flash-lite',
      });
    }
  });

  // --- Quick Extract ("السحب السريع") PDF & Camera Burst Extraction Endpoint ---

  app.post('/api/quick-extract', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        mode?: 'pdf' | 'camera_burst';
        scanMode?: 'fast' | 'audit';
        focusedFields?: Array<'name' | 'individuals' | 'decreaseCount' | 'addOrDelete'>;
        clarityThreshold?: number;
        referenceTemplate?: {
          name?: string;
          imageBase64?: string;
          mimeType?: string;
          notes?: string;
          regions?: Array<{
            field: string;
            label: string;
            box: { ymin: number; xmin: number; ymax: number; xmax: number };
          }>;
        };
        filename?: string;
        base64Pdf?: string;
        frames?: Array<{ mimeType?: string; data?: string; label?: string }>;
        enhancementReport?: string;
      };

      const mode = body.mode === 'camera_burst' ? 'camera_burst' : 'pdf';
      const scanMode = body.scanMode === 'fast' ? 'fast' : 'audit';
      const focusedFields =
        Array.isArray(body.focusedFields) && body.focusedFields.length > 0
          ? body.focusedFields
          : (['name', 'individuals', 'decreaseCount', 'addOrDelete'] as const);
      const focusSet = new Set(focusedFields);

      const contentParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [];

      // Attach optional Reference Template image + spatial column coordinates before target capture
      if (body.referenceTemplate?.imageBase64) {
        const refCleanB64 = String(body.referenceTemplate.imageBase64)
          .replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
          .trim();
        const refMime =
          body.referenceTemplate.mimeType === 'image/png' ||
          body.referenceTemplate.mimeType === 'image/webp'
            ? body.referenceTemplate.mimeType
            : 'image/jpeg';
        if (refCleanB64) {
          contentParts.push({
            inlineData: { mimeType: refMime, data: refCleanB64 },
          });
          const regionsText = Array.isArray(body.referenceTemplate.regions)
            ? body.referenceTemplate.regions
                .map(
                  (r) =>
                    `- ${r.label} (${r.field}): ymin=${r.box.ymin}, xmin=${r.box.xmin}, ymax=${r.box.ymax}, xmax=${r.box.xmax} (على مقياس 0 إلى 1000)`
                )
                .join('\n')
            : '';
          contentParts.push({
            text: `الصورة الأولى هي «النموذج المرجعي المعتمد» (${
              body.referenceTemplate.name || 'نموذج الدفتر'
            }). استخدم تخطيط الأعمدة ومناطقها لتوجيه قراءة الصفحات التالية بدقة:\n${regionsText}${
              body.referenceTemplate.notes
                ? `\nملاحظات النموذج: ${body.referenceTemplate.notes}`
                : ''
            }`,
          });
        }
      }

      if (mode === 'pdf') {
        const rawBase64 = String(body.base64Pdf || '')
          .replace(/^data:application\/pdf;base64,/, '')
          .trim();

        if (!rawBase64) {
          res.status(400).json({ error: 'لم يتم استلام بيانات ملف PDF.' });
          return;
        }

        const pdfBuffer = Buffer.from(rawBase64, 'base64');
        if (pdfBuffer.length < 100 || pdfBuffer.length > 20 * 1024 * 1024) {
          res.status(400).json({
            error: 'حجم الملف غير صالح (الحد الأقصى 20 ميجابايت).',
          });
          return;
        }

        const headerMagic = pdfBuffer.subarray(0, 5).toString('ascii');
        if (headerMagic !== '%PDF-') {
          res.status(200).json({
            status: 'rejected',
            sourceMode: 'pdf',
            scanMode,
            clarityScore: 0,
            pageCount: 0,
            rejectionReasons: [
              'الملف المرفوع ليس ملف PDF سليمًا أو أن ترويسته تالفة (%PDF- غير موجود).',
            ],
            documentSummary: '',
            rows: [],
          });
          return;
        }

        contentParts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: rawBase64,
          },
        });
        contentParts.push({
          text: `حلّل ملف PDF المرفق (${body.filename || 'document.pdf'}) واستخرج الحقول المطلوبة فقط (${focusedFields.join('، ')}) بصيغة JSON وفق وضع التحليل (${scanMode === 'fast' ? 'الوضع السريع' : 'الوضع المدقق'}).`,
        });
      } else {
        const rawFrames = Array.isArray(body.frames) ? body.frames : [];
        if (rawFrames.length === 0 || rawFrames.length > 5) {
          res.status(400).json({
            error: 'يرجى إرسال من إطار واحد إلى 5 إطارات واضحة للدفتر اليدوي.',
          });
          return;
        }

        let totalBytes = 0;
        let frameCountAttached = 0;
        for (let i = 0; i < rawFrames.length; i++) {
          const frame = rawFrames[i];
          const mimeType =
            frame.mimeType === 'image/png' || frame.mimeType === 'image/webp'
              ? frame.mimeType
              : 'image/jpeg';
          const cleanB64 = String(frame.data || '')
            .replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
            .trim();
          if (!cleanB64) continue;
          const buf = Buffer.from(cleanB64, 'base64');
          totalBytes += buf.length;
          if (buf.length < 120) {
            res.status(200).json({
              status: 'rejected',
              sourceMode: 'camera_burst',
              scanMode,
              clarityScore: 0,
              pageCount: 1,
              rejectionReasons: [
                `الإطار رقم ${i + 1} فارغ أو تالف ولا يصلح للقراءة الآمنة.`,
              ],
              documentSummary: '',
              rows: [],
            });
            return;
          }
          contentParts.push({
            inlineData: { mimeType, data: cleanB64 },
          });
          frameCountAttached += 1;
        }

        if (frameCountAttached === 0 || totalBytes > 24 * 1024 * 1024) {
          res.status(400).json({
            error: 'بيانات صور الدفتر اليدوي غير صالحة أو تتجاوز الحد المسموح (24 ميجابايت).',
          });
          return;
        }

        contentParts.push({
          text: `هذه لقطات متتالية (Burst Fusion: ${frameCountAttached} إطارات لنفس صفحة الدفتر اليدوي). ${body.enhancementReport || ''} ادمج المعلومات البصرية عبر جميع الزوايا واستخرج الحقول المحددة فقط (${focusedFields.join('، ')})، مع تحديد إحداثيات مربع القص suspectBox (من 0 إلى 1000) لأي اسم أو صف يحتاج مراجعة.`,
        });
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'مفتاح Gemini API غير مهيأ على الخادم لتشغيل محرك السحب السريع. يرجى إضافته في إعدادات الأسرار (GEMINI_API_KEY).',
        });
        return;
      }

      const extractionSchema = {
        type: Type.OBJECT,
        properties: {
          legibilityStatus: {
            type: Type.STRING,
            enum: ['clear', 'needs_review', 'rejected'],
          },
          clarityScore: { type: Type.INTEGER },
          pageCount: { type: Type.INTEGER },
          rejectionReasons: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          documentSummary: { type: Type.STRING },
          inferredMetadata: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              agencyName: { type: Type.STRING, nullable: true },
              agencyNameConfidence: { type: Type.NUMBER },
              tableDateLabel: { type: Type.STRING, nullable: true },
              tableDateConfidence: { type: Type.NUMBER },
              centerOrAgencyNumber: { type: Type.STRING, nullable: true },
              centerNumberConfidence: { type: Type.NUMBER },
              headerSnippet: { type: Type.STRING },
              detectedColumns: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
          rows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rowIndex: { type: Type.INTEGER },
                pageNumber: { type: Type.INTEGER },
                name: { type: Type.STRING, nullable: true },
                individuals: { type: Type.INTEGER, nullable: true },
                eligibleIndividuals: { type: Type.INTEGER, nullable: true },
                decreaseCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteAction: {
                  type: Type.STRING,
                  enum: ['إضافة', 'حذف', 'لا يوجد', 'غير محدد'],
                },
                rowDate: { type: Type.STRING, nullable: true },
                nameConfidence: { type: Type.NUMBER },
                numbersConfidence: { type: Type.NUMBER },
                dateConfidence: { type: Type.NUMBER },
                modelDoubtFlag: { type: Type.BOOLEAN },
                modelDoubtReason: { type: Type.STRING },
                rawSnippet: { type: Type.STRING },
                notes: { type: Type.STRING },
                suspectSpans: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      reason: { type: Type.STRING },
                    },
                    required: ['word', 'reason'],
                  },
                },
                suspectBox: {
                  type: Type.OBJECT,
                  nullable: true,
                  properties: {
                    ymin: { type: Type.INTEGER },
                    xmin: { type: Type.INTEGER },
                    ymax: { type: Type.INTEGER },
                    xmax: { type: Type.INTEGER },
                  },
                  required: ['ymin', 'xmin', 'ymax', 'xmax'],
                },
                rowBox: {
                  type: Type.OBJECT,
                  nullable: true,
                  properties: {
                    ymin: { type: Type.INTEGER },
                    xmin: { type: Type.INTEGER },
                    ymax: { type: Type.INTEGER },
                    xmax: { type: Type.INTEGER },
                  },
                  required: ['ymin', 'xmin', 'ymax', 'xmax'],
                },
              },
              required: [
                'rowIndex',
                'pageNumber',
                'name',
                'individuals',
                'decreaseCount',
                'addOrDeleteCount',
                'addOrDeleteAction',
                'nameConfidence',
                'numbersConfidence',
                'modelDoubtFlag',
                'modelDoubtReason',
                'rawSnippet',
              ],
            },
          },
        },
        required: [
          'legibilityStatus',
          'clarityScore',
          'pageCount',
          'rejectionReasons',
          'documentSummary',
          'rows',
        ],
      };

      const fieldFocusPrompt = [
        focusSet.has('name')
          ? '- name: اسم المستفيد الكامل بالعربية (أو null إذا كان غير مقروء/ناقصًا).'
          : '- name: الحقل غير مطلوب حاليًا؛ ضع string فارغ "" أو تجاهل التوسع فيه.',
        focusSet.has('individuals')
          ? '- individuals: إجمالي الأفراد الكلية (عدد صحيح >= 0، أو null إذا كان مفقودًا)، وإذا وُجد عمود منفصل للأفراد المستحقة/الصافية فاملأ eligibleIndividuals.'
          : '- individuals: الحقل خارج نطاق التركيز؛ أعد 0.',
        focusSet.has('decreaseCount')
          ? '- decreaseCount: عدد المحجوبين أو النزول/النقصان (عدد صحيح >= 0، أو null إذا كان غامضًا).'
          : '- decreaseCount: الحقل خارج نطاق التركيز؛ أعد 0.',
        focusSet.has('addOrDelete')
          ? '- addOrDeleteCount & addOrDeleteAction: عدد الإضافة أو الحذف ونوعه ("إضافة" | "حذف" | "لا يوجد" | "غير محدد").'
          : '- addOrDeleteCount & addOrDeleteAction: خارج نطاق التركيز؛ أعد 0 و"لا يوجد".',
      ].join('\n   ');

      const systemPrompt = `أنت محرك معالجة مستندات ذكي (Intelligent Document Processing) ورؤية حاسوبية متخصص في استخراج الجداول العربية المكتوبة رقميًا أو بخط اليد (الدفاتر الورقية).
تعمل وفق القواعد الصارمة التالية — "الأمان المطلق ومبدأ الشك 1% — لا تخمّن أبدًا":
1. استنتاج الهوية والسياق التلقائي والربط الدلالي للأعمدة (Metadata Inference & Semantic Mapping):
   - اقرأ ترويسة الصورة أو أعلى الملف بعناية لاستنتاج:
     * agencyName: اسم الوكالة أو الوكيل (مثلاً: وكالة منذر الحلو).
     * tableDateLabel: تاريخ أو شهر الجدول (مثلاً: تشرين الأول 2026).
     * centerOrAgencyNumber: رقم المركز أو رقم الوكالة إن وُجد.
     * headerSnippet: نص الترويسة المستخرج كما ظهر في الأعلى.
     * detectedColumns: قائمة بأسماء الأعمدة الظاهرة في ترويسة الجدول كما كُتبت (مثلاً: ["الاسم", "الأفراد الكلية", "المستحقة", "المحجوبين"]).
   - اربط الأعمدة دلالياً: (الأفراد الكلية -> individuals)، (المستحقة/الصافية -> eligibleIndividuals)، (المحجوبين/النزول -> decreaseCount).
2. فحص الجودة ومبدأ الشك بنسبة 1% (أقل من 99%):
   - عالج تداخل الأسطر وضيق الجداول، وإذا توفرت عدة لقطات (Burst Frames) لنفس الدفتر فطابقها معًا للتأكد من كل نقطة وحرف ورقم.
   - إذا كانت الصورة/الصفحة مهزوزة، مطموسة، مغطاة بظل/لمعان، أو غير مقروءة بحيث يستحيل قراءة الصفوف بأمان: اضبط legibilityStatus="rejected" واكتب الأسباب الدقيقة بالعربية في rejectionReasons واترك rows فارغًا.
   - كن صادقًا للغاية في درجات الثقة (nameConfidence, numbersConfidence, dateConfidence من 0.0 إلى 1.0): لا تعطِ 0.99 أو 1.0 إلا إذا كان الخط والرقم واضحين بنسبة مطلقة! أي تردد أو بهتان أو تداخل ولو بنسبة 1% يجب أن تكون درجته أقل من 0.99 (مثلاً 0.95 أو 0.88) مع توضيح السبب في modelDoubtReason وsuspectSpans.
3. القص البصري الشامل للسطر (Contextual Row Snippet):
   - لكل صف، أرجع rowBox (ymin, xmin, ymax, xmax من 0 إلى 1000) يغطي **السطر كاملاً أفقيًا** من بدايته إلى نهايته (جميع الأعمدة المتجاورة: الاسم والأرقام والملاحظات)، بالإضافة إلى suspectBox للجزء الأشد شكًا.
4. التركيز المخصص على الحقول (التزم بدقة بالحقول المحددة فقط وتجاهل غير المطلوب):
   ${fieldFocusPrompt}
5. وضع التشغيل الحالي (${scanMode === 'fast' ? 'الوضع السريع Fast Mode' : 'الوضع المدقق Audit Mode'}):
   - ${
     scanMode === 'fast'
       ? 'اقرأ الصفوف الواضحة بسرعة ودقة مباشرة، وخفّض الثقة لأقل من 0.99 فقط عند وجود طمس أو تداخل.'
       : 'دقق في كل نقطة وهمزة ورقم وتاريخ، وأرجع rowBox للسطر كاملاً وsuspectBox لموقع الشك كي يعاين المستخدم القص المرئي مباشرة.'
   }
   - عند الشك في أي حرف عربي: اضبط modelDoubtFlag=true، خفّض nameConfidence لأقل من 0.90، واذكر المقاطع في suspectSpans.`;

      const { response, fallbackUsed } = await generateWithSilentResilience(ai, {
        contents: [
          {
            role: 'user',
            parts: contentParts,
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: extractionSchema,
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        legibilityStatus?: 'clear' | 'needs_review' | 'rejected';
        clarityScore?: number;
        pageCount?: number;
        rejectionReasons?: string[];
        documentSummary?: string;
        inferredMetadata?: Partial<InferredDocumentMetadata> | null;
        rows?: QuickExtractRawRow[];
      };

      const detectedColumns = Array.isArray(parsed.inferredMetadata?.detectedColumns)
        ? parsed.inferredMetadata!.detectedColumns.map((c) => String(c || '').trim()).filter(Boolean)
        : [];
      const semanticMapping = buildSemanticColumnMappings(detectedColumns);
      const inferredMetaObj: InferredDocumentMetadata | null = parsed.inferredMetadata
        ? {
            agencyName: parsed.inferredMetadata.agencyName ?? null,
            agencyNameConfidence:
              typeof parsed.inferredMetadata.agencyNameConfidence === 'number'
                ? parsed.inferredMetadata.agencyNameConfidence
                : 0.9,
            tableDateLabel: parsed.inferredMetadata.tableDateLabel ?? null,
            tableDateConfidence:
              typeof parsed.inferredMetadata.tableDateConfidence === 'number'
                ? parsed.inferredMetadata.tableDateConfidence
                : 0.9,
            centerOrAgencyNumber:
              parsed.inferredMetadata.centerOrAgencyNumber ?? null,
            centerNumberConfidence:
              typeof parsed.inferredMetadata.centerNumberConfidence === 'number'
                ? parsed.inferredMetadata.centerNumberConfidence
                : 0.9,
            headerSnippet: parsed.inferredMetadata.headerSnippet || undefined,
            detectedColumns,
            semanticMapping,
            proactivePrompt: buildProactiveHeaderGreeting({
              agencyName: parsed.inferredMetadata.agencyName ?? null,
              tableDateLabel: parsed.inferredMetadata.tableDateLabel ?? null,
              detectedColumns,
              semanticMapping,
            }),
            fallbackUsed,
            confirmedByUser: false,
          }
        : null;

      const safeResult = buildSafeQuickExtractResult({
        sourceMode: mode,
        scanMode,
        focusedFields: [...focusedFields],
        clarityThreshold:
          typeof body.clarityThreshold === 'number'
            ? body.clarityThreshold
            : undefined,
        clarityScore: parsed.clarityScore ?? 0,
        legibilityStatus: parsed.legibilityStatus ?? 'rejected',
        pageCount: parsed.pageCount ?? 1,
        rejectionReasons: Array.isArray(parsed.rejectionReasons)
          ? parsed.rejectionReasons
          : [],
        documentSummary: parsed.documentSummary || '',
        rawRows: Array.isArray(parsed.rows) ? parsed.rows : [],
        inferredMetadata: inferredMetaObj,
      });

      res.json({
        ...safeResult,
        fallbackUsed,
        resilienceNotice:
          fallbackUsed === 'flash-lite'
            ? 'تمت المعالجة عبر المسار السريع البديل (Flash Lite) لضمان الاستمرارية بدون انقطاع.'
            : undefined,
      });
    } catch (err) {
      const transient = isTransientCloudError(err);
      res.status(transient ? 503 : 500).json({
        temporaryBusy: transient,
        friendlyNotice: transient
          ? 'خوادم القراءة تشهد ضغطاً مؤقتاً — جاري إعادة المحاولة عبر المسار البديل...'
          : 'تعذر إتمام قراءة هذا المستند حالياً.',
        error: transient
          ? 'خوادم القراءة مشغولة مؤقتاً — جاري المعالجة عبر مسار بديل...'
          : err instanceof Error
            ? `تعذر تحليل المستند: ${err.message}`
            : 'تعذر تحليل المستند.',
      });
    }
  });

  // --- UCRS: Universal Cognitive Reading & Progressive Comprehension Endpoints ---

  app.post('/api/ucrs/analyze', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        phase?: 'classify_only' | 'progressive_extract' | 'fusion_complete';
        sourceKind?: string;
        intent?: string;
        customCommand?: string;
        searchQuery?: string;
        scanMode?: 'fast' | 'audit';
        focusedFields?: Array<'name' | 'individuals' | 'decreaseCount' | 'addOrDelete'>;
        clarityThreshold?: number;
        filename?: string;
        base64Pdf?: string;
        frames?: Array<{ mimeType?: string; data?: string; label?: string }>;
        rawText?: string;
        enhancementReport?: string;
        referenceTemplate?: {
          name?: string;
          imageBase64?: string;
          mimeType?: string;
          notes?: string;
          regions?: Array<{
            field: string;
            label: string;
            box: { ymin: number; xmin: number; ymax: number; xmax: number };
          }>;
        };
        learningRules?: Array<{ wrongToken: string; correctedToken: string }>;
        existingSummary?: {
          extractedNames: string[];
          doubtfulCount: number;
          unreadableCount: number;
          missingHint: string;
        };
      };

      const phase =
        body.phase === 'classify_only' || body.phase === 'fusion_complete'
          ? body.phase
          : 'progressive_extract';
      const scanMode = body.scanMode === 'fast' ? 'fast' : 'audit';
      const intent = String(body.intent || 'extract_all').slice(0, 40);
      const customCommand = String(body.customCommand || '').trim().slice(0, 500);
      const searchQuery = String(body.searchQuery || '').trim().slice(0, 200);
      const focusedFields =
        Array.isArray(body.focusedFields) && body.focusedFields.length > 0
          ? body.focusedFields
          : (['name', 'individuals', 'decreaseCount', 'addOrDelete'] as const);
      const focusSet = new Set(focusedFields);

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'مفتاح Gemini API غير مهيأ على الخادم لتشغيل منظومة القراءة الكونية. يرجى إضافته في إعدادات الأسرار (GEMINI_API_KEY).',
        });
        return;
      }

      const contentParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [];

      if (body.referenceTemplate?.imageBase64) {
        const refCleanB64 = String(body.referenceTemplate.imageBase64)
          .replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
          .trim();
        const refMime =
          body.referenceTemplate.mimeType === 'image/png' ||
          body.referenceTemplate.mimeType === 'image/webp'
            ? body.referenceTemplate.mimeType
            : 'image/jpeg';
        if (refCleanB64) {
          contentParts.push({ inlineData: { mimeType: refMime, data: refCleanB64 } });
          const regionsText = Array.isArray(body.referenceTemplate.regions)
            ? body.referenceTemplate.regions
                .map(
                  (r) =>
                    `- ${r.label} (${r.field}): ymin=${r.box.ymin}, xmin=${r.box.xmin}, ymax=${r.box.ymax}, xmax=${r.box.xmax}`
                )
                .join('\n')
            : '';
          contentParts.push({
            text: `الصورة الأولى هي النموذج المرجعي (${body.referenceTemplate.name || 'دفتر الوكالة'}):\n${regionsText}`,
          });
        }
      }

      let attachedInput = false;

      if (body.base64Pdf) {
        const rawBase64 = String(body.base64Pdf)
          .replace(/^data:application\/pdf;base64,/, '')
          .trim();
        const pdfBuffer = Buffer.from(rawBase64, 'base64');
        if (pdfBuffer.length < 100 || pdfBuffer.length > 20 * 1024 * 1024) {
          res.status(400).json({
            error: 'حجم ملف PDF غير صالح (الحد الأقصى 20 ميجابايت).',
          });
          return;
        }
        if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
          res.status(200).json({
            legibilityStatus: 'rejected',
            clarityScore: 0,
            pageCount: 0,
            rejectionReasons: ['الملف المرفوع ليس ملف PDF سليمًا (%PDF- غير موجود).'],
            documentSummary: '',
            rows: [],
            entities: [],
            coverageRegions: [],
          });
          return;
        }
        contentParts.push({
          inlineData: { mimeType: 'application/pdf', data: rawBase64 },
        });
        attachedInput = true;
      }

      if (Array.isArray(body.frames) && body.frames.length > 0) {
        const frames = body.frames.slice(0, 8);
        let totalBytes = 0;
        for (const frame of frames) {
          const mimeType =
            frame.mimeType === 'image/png' || frame.mimeType === 'image/webp'
              ? frame.mimeType
              : 'image/jpeg';
          const cleanB64 = String(frame.data || '')
            .replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
            .trim();
          if (!cleanB64) continue;
          const buf = Buffer.from(cleanB64, 'base64');
          totalBytes += buf.length;
          if (buf.length < 100) continue;
          contentParts.push({ inlineData: { mimeType, data: cleanB64 } });
          attachedInput = true;
        }
        if (totalBytes > 24 * 1024 * 1024) {
          res.status(400).json({
            error: 'إجمالي حجم الصور يتجاوز الحد المسموح (24 ميجابايت).',
          });
          return;
        }
      }

      if (body.rawText && String(body.rawText).trim()) {
        contentParts.push({
          text: `النص / البيانات المستلمة من الملف (${body.filename || 'document'}):\n${String(
            body.rawText
          ).slice(0, 120000)}`,
        });
        attachedInput = true;
      }

      if (!attachedInput) {
        res.status(400).json({
          error: 'يرجى إرفاق ملف PDF أو صور أو محتوى نصي للتحليل.',
        });
        return;
      }

      const rulesHint =
        Array.isArray(body.learningRules) && body.learningRules.length > 0
          ? `قواعد التعلم الذاتي المكتسبة من تصحيحات المستخدم السابقة (طبّقها عند القراءة):\n${body.learningRules
              .slice(0, 30)
              .map((r) => `- "${r.wrongToken}" -> "${r.correctedToken}"`)
              .join('\n')}`
          : '';

      const fusionHint =
        phase === 'fusion_complete' && body.existingSummary
          ? `هذه عملية إكمال ودمج مصادر (Fusion Completion) لجلسة قائمة.
العناصر المستخرجة مسبقًا (${body.existingSummary.extractedNames.length}): ${body.existingSummary.extractedNames
              .slice(0, 40)
              .join('، ')}
المناطق/العناصر الناقصة المطلوب التركيز عليها: ${body.existingSummary.missingHint || 'اقرأ الأجزاء غير الواضحة أو المشكوكة واستخرج ما بقي بدون اختراع.'}`
          : '';

      const intentPrompt = [
        `المرحلة المطلوبة: ${phase}`,
        `نوع النية: ${intent}`,
        customCommand ? `أمر المستخدم: ${customCommand}` : '',
        searchQuery ? `استعلام البحث الدلالي المطلوب: ${searchQuery}` : '',
        `الحقول المستهدفة للجدول: ${Array.from(focusSet).join('، ')}`,
        body.enhancementReport ? `تقرير المعالجة البصرية: ${body.enhancementReport}` : '',
        rulesHint,
        fusionHint,
      ]
        .filter(Boolean)
        .join('\n');

      contentParts.push({ text: intentPrompt });

      const ucrsSchema = {
        type: Type.OBJECT,
        properties: {
          legibilityStatus: {
            type: Type.STRING,
            enum: ['clear', 'needs_review', 'rejected'],
          },
          clarityScore: { type: Type.INTEGER },
          pageCount: { type: Type.INTEGER },
          rejectionReasons: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          documentSummary: { type: Type.STRING },
          identity: {
            type: Type.OBJECT,
            properties: {
              contentType: {
                type: Type.STRING,
                enum: [
                  'جدول مستفيدين',
                  'قائمة أسماء',
                  'دفتر يدوي',
                  'كتاب / مقال',
                  'فاتورة',
                  'وثيقة رسمية',
                  'صفحة ويب / لقطة شاشة',
                  'بيانات عامة',
                ],
              },
              topic: { type: Type.STRING },
              qualityLabel: {
                type: Type.STRING,
                enum: ['واضح', 'متوسط', 'صعب', 'غير مقروء'],
              },
              qualityScore: { type: Type.INTEGER },
              relevanceLevel: {
                type: Type.STRING,
                enum: ['important', 'useful', 'neutral', 'irrelevant'],
              },
              relevanceReasons: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              languageSummary: { type: Type.STRING },
              estimatedTotalRows: { type: Type.INTEGER },
              estimatedColumns: { type: Type.INTEGER },
              estimatedConfidentCount: { type: Type.INTEGER },
              estimatedDoubtfulCount: { type: Type.INTEGER },
              estimatedUnreadableCount: { type: Type.INTEGER },
              wordCount: { type: Type.INTEGER },
              detectedNamesCount: { type: Type.INTEGER },
              detectedDates: { type: Type.ARRAY, items: { type: Type.STRING } },
              detectedLocations: { type: Type.ARRAY, items: { type: Type.STRING } },
              opinionAndRecommendation: { type: Type.STRING },
              willExtract: { type: Type.ARRAY, items: { type: Type.STRING } },
              willIgnore: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'contentType',
              'topic',
              'qualityLabel',
              'qualityScore',
              'relevanceLevel',
              'relevanceReasons',
              'estimatedTotalRows',
              'estimatedConfidentCount',
              'estimatedDoubtfulCount',
              'estimatedUnreadableCount',
              'opinionAndRecommendation',
            ],
          },
          missingHint: { type: Type.STRING },
          inferredMetadata: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              agencyName: { type: Type.STRING, nullable: true },
              agencyNameConfidence: { type: Type.NUMBER },
              tableDateLabel: { type: Type.STRING, nullable: true },
              tableDateConfidence: { type: Type.NUMBER },
              centerOrAgencyNumber: { type: Type.STRING, nullable: true },
              centerNumberConfidence: { type: Type.NUMBER },
              headerSnippet: { type: Type.STRING },
              detectedColumns: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
          rows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rowIndex: { type: Type.INTEGER },
                pageNumber: { type: Type.INTEGER },
                name: { type: Type.STRING, nullable: true },
                individuals: { type: Type.INTEGER, nullable: true },
                eligibleIndividuals: { type: Type.INTEGER, nullable: true },
                decreaseCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteAction: {
                  type: Type.STRING,
                  enum: ['إضافة', 'حذف', 'لا يوجد', 'غير محدد'],
                },
                rowDate: { type: Type.STRING, nullable: true },
                nameConfidence: { type: Type.NUMBER },
                numbersConfidence: { type: Type.NUMBER },
                dateConfidence: { type: Type.NUMBER },
                modelDoubtFlag: { type: Type.BOOLEAN },
                modelDoubtReason: { type: Type.STRING },
                rawSnippet: { type: Type.STRING },
                notes: { type: Type.STRING },
                suspectSpans: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      reason: { type: Type.STRING },
                    },
                    required: ['word', 'reason'],
                  },
                },
                suspectBox: {
                  type: Type.OBJECT,
                  nullable: true,
                  properties: {
                    ymin: { type: Type.INTEGER },
                    xmin: { type: Type.INTEGER },
                    ymax: { type: Type.INTEGER },
                    xmax: { type: Type.INTEGER },
                  },
                  required: ['ymin', 'xmin', 'ymax', 'xmax'],
                },
                rowBox: {
                  type: Type.OBJECT,
                  nullable: true,
                  properties: {
                    ymin: { type: Type.INTEGER },
                    xmin: { type: Type.INTEGER },
                    ymax: { type: Type.INTEGER },
                    xmax: { type: Type.INTEGER },
                  },
                  required: ['ymin', 'xmin', 'ymax', 'xmax'],
                },
              },
              required: [
                'rowIndex',
                'pageNumber',
                'name',
                'individuals',
                'decreaseCount',
                'addOrDeleteCount',
                'addOrDeleteAction',
                'nameConfidence',
                'numbersConfidence',
                'modelDoubtFlag',
                'modelDoubtReason',
                'rawSnippet',
              ],
            },
          },
          entities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kind: {
                  type: Type.STRING,
                  enum: ['name', 'number', 'date', 'location', 'note', 'paragraph'],
                },
                text: { type: Type.STRING },
                context: { type: Type.STRING },
                pageNumber: { type: Type.INTEGER },
                rowOrLineIndex: { type: Type.INTEGER },
                confidence: { type: Type.NUMBER },
                relevance: {
                  type: Type.STRING,
                  enum: ['important', 'useful', 'neutral', 'irrelevant'],
                },
                relevanceReason: { type: Type.STRING },
              },
              required: ['kind', 'text', 'context', 'pageNumber', 'confidence', 'relevance'],
            },
          },
          unreadableRegions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                label: { type: Type.STRING },
                reason: { type: Type.STRING },
                box: {
                  type: Type.OBJECT,
                  properties: {
                    ymin: { type: Type.INTEGER },
                    xmin: { type: Type.INTEGER },
                    ymax: { type: Type.INTEGER },
                    xmax: { type: Type.INTEGER },
                  },
                  required: ['ymin', 'xmin', 'ymax', 'xmax'],
                },
              },
              required: ['pageNumber', 'label', 'reason', 'box'],
            },
          },
        },
        required: [
          'legibilityStatus',
          'clarityScore',
          'pageCount',
          'rejectionReasons',
          'documentSummary',
          'identity',
          'rows',
          'entities',
        ],
      };

      const systemInstruction = `أنت "منظومة القراءة الكونية والإدراك التدريجي" (UCRS) داخل تطبيق Morrow لإدارة وكالات الكمية الغذائية، وتعمل تحت مبدأ الأمان المطلق والشك 1% (Zero-Trust).
مبادئك الصارمة:
1. استنتاج الهوية والترويسة والربط الدلالي للأعمدة تلقائياً: اقرأ أعلى الصورة أو المستند لاستنتاج اسم الوكالة (agencyName)، وتاريخ/شهر الجدول (tableDateLabel مثل: تشرين الأول 2026)، ورقم المركز أو الوكالة (centerOrAgencyNumber)، ونص الترويسة (headerSnippet)، وأسماء الأعمدة المكتشفة (detectedColumns مثل: ["الاسم", "الأفراد الكلية", "المستحقة", "المحجوبين"]) واملأ inferredMetadata. واربط الأعمدة دلالياً: الكلي -> individuals، المستحقة -> eligibleIndividuals، المحجوبين/النزول -> decreaseCount.
2. الفهم قبل الاستخراج: حدد أولاً نوع المحتوى وموضوعه وجودته وهل يخص جداول المستفيدين/الوكالات (important | useful | neutral | irrelevant) مع ذكر السبب، ورأيك الصريح.
3. التدرج ومبدأ الشك 1% (Zero Silent Errors): إذا وجدت أي غموض أو بهتان ولو بنسبة 1% في اسم أو رقم أو تاريخ، اضبط درجة ثقته أقل من 0.99 (مثل 0.94 أو 0.84) ولا تعطه 0.99+ إلا عند الوضوح التام. وإذا رأيت 10 أسماء واستطعت قراءة 4 بثقة و3 بشك و3 غير مقروءة، استخرج ما أمكن بأمانة وضع إحداثيات غير المقروءة في unreadableRegions واكتب missingHint. لا تخمّن أي حرف أو رقم أبدًا!
4. القص البصري الشامل للسطر: أرجع لكل صف rowBox (ymin, xmin, ymax, xmax من 0 إلى 1000) يمتد أفقياً عبر **السطر كاملاً** من أول عمود إلى آخر عمود، بالإضافة إلى suspectBox لبقعة الشك.
5. في وضع الاكتشاف أو الكتب/المستندات أو البحث الدلالي: املأ entities بالأسماء، التواريخ، الأماكن، الملاحظات، والفقرات المهمة.
6. التزم بوضع التشغيل: ${scanMode === 'fast' ? 'الوضع السريع' : 'الوضع المدقق'}.`;

      const { response, fallbackUsed } = await generateWithSilentResilience(ai, {
        contents: [{ role: 'user', parts: contentParts }],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: ucrsSchema,
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        legibilityStatus?: 'clear' | 'needs_review' | 'rejected';
        clarityScore?: number;
        pageCount?: number;
        rejectionReasons?: string[];
        documentSummary?: string;
        identity?: Record<string, unknown>;
        inferredMetadata?: Partial<InferredDocumentMetadata> | null;
        missingHint?: string;
        rows?: QuickExtractRawRow[];
        entities?: Array<Record<string, unknown>>;
        unreadableRegions?: Array<{
          pageNumber: number;
          label: string;
          reason: string;
          box: { ymin: number; xmin: number; ymax: number; xmax: number };
        }>;
      };

      const detectedColumns = Array.isArray(parsed.inferredMetadata?.detectedColumns)
        ? parsed.inferredMetadata!.detectedColumns.map((c) => String(c || '').trim()).filter(Boolean)
        : [];
      const semanticMapping = buildSemanticColumnMappings(detectedColumns);

      const normalizedMeta: InferredDocumentMetadata | null = parsed.inferredMetadata
        ? {
            agencyName: parsed.inferredMetadata.agencyName ?? null,
            agencyNameConfidence:
              typeof parsed.inferredMetadata.agencyNameConfidence === 'number'
                ? parsed.inferredMetadata.agencyNameConfidence
                : 0.9,
            tableDateLabel: parsed.inferredMetadata.tableDateLabel ?? null,
            tableDateConfidence:
              typeof parsed.inferredMetadata.tableDateConfidence === 'number'
                ? parsed.inferredMetadata.tableDateConfidence
                : 0.9,
            centerOrAgencyNumber:
              parsed.inferredMetadata.centerOrAgencyNumber ?? null,
            centerNumberConfidence:
              typeof parsed.inferredMetadata.centerNumberConfidence === 'number'
                ? parsed.inferredMetadata.centerNumberConfidence
                : 0.9,
            headerSnippet: parsed.inferredMetadata.headerSnippet || undefined,
            detectedColumns,
            semanticMapping,
            proactivePrompt: buildProactiveHeaderGreeting({
              agencyName: parsed.inferredMetadata.agencyName ?? null,
              tableDateLabel: parsed.inferredMetadata.tableDateLabel ?? null,
              detectedColumns,
              semanticMapping,
            }),
            fallbackUsed,
            confirmedByUser: false,
          }
        : null;

      const safeRowsResult = buildSafeQuickExtractResult({
        sourceMode: body.sourceKind === 'camera_burst' ? 'camera_burst' : 'pdf',
        scanMode,
        focusedFields: [...focusedFields],
        clarityThreshold:
          typeof body.clarityThreshold === 'number'
            ? body.clarityThreshold
            : 25, // UCRS allows progressive partial extraction instead of throwing everything away!
        clarityScore: parsed.clarityScore ?? 0,
        legibilityStatus: parsed.legibilityStatus ?? 'needs_review',
        pageCount: parsed.pageCount ?? 1,
        rejectionReasons: Array.isArray(parsed.rejectionReasons)
          ? parsed.rejectionReasons
          : [],
        documentSummary: parsed.documentSummary || '',
        rawRows: Array.isArray(parsed.rows) ? parsed.rows : [],
        inferredMetadata: normalizedMeta,
      });

      res.json({
        ...safeRowsResult,
        identity: parsed.identity || null,
        inferredMetadata: normalizedMeta,
        missingHint: parsed.missingHint || '',
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        unreadableRegions: Array.isArray(parsed.unreadableRegions)
          ? parsed.unreadableRegions
          : [],
        fallbackUsed,
        resilienceNotice:
          fallbackUsed === 'flash-lite'
            ? 'تمت القراءة عبر المسار السريع البديل (Flash Lite) تلقائياً بسبب ضغط الخادم.'
            : undefined,
      });
    } catch (err) {
      const transient = isTransientCloudError(err);
      res.status(transient ? 503 : 500).json({
        temporaryBusy: transient,
        friendlyNotice: transient
          ? 'خوادم القراءة مشغولة حالياً — جاري المعالجة عبر المسار البديل...'
          : 'تعذر إتمام القراءة حالياً.',
        error: transient
          ? 'خوادم القراءة مشغولة مؤقتاً — جاري المعالجة عبر مسار بديل...'
          : err instanceof Error
            ? `تعذر تشغيل منظومة القراءة الكونية: ${err.message}`
            : 'تعذر تشغيل منظومة القراءة الكونية.',
      });
    }
  });

  app.post('/api/ucrs/tts', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as { text?: string };
      const text = String(body.text || '').trim().slice(0, 2000);
      if (!text) {
        res.status(400).json({ error: 'النص المطلوب قراءته صوتيًا فارغ.' });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'مفتاح Gemini API غير مهيأ للصوت السحابي.',
        });
        return;
      }

      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: 'Clear, calm, articulate Arabic reader',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const audioBase64 =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        res.status(502).json({ error: 'لم يرجع محرك الصوت بيانات مسموعة.' });
        return;
      }

      res.json({
        audioBase64,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'تعذر توليد القراءة الصوتية.',
      });
    }
  });

  // --- Quick Extract Live Draft Assistant Copilot ---
  app.post('/api/quick-extract/copilot', async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      message?: string;
      documentSummary?: string;
      inferredMetadata?: Partial<InferredDocumentMetadata> | null;
      sourceImageBase64?: string;
      sourceMimeType?: string;
      draftRows?: Array<{
        id?: string;
        rowIndex: number;
        resolvedName: string;
        resolvedIndividuals: number | null;
        resolvedEligibleIndividuals?: number | null;
        resolvedDecreaseCount: number | null;
        resolvedAddOrDeleteCount: number | null;
        resolvedAddOrDeleteAction: string;
        resolvedRowDate?: string;
        notes?: string;
        nameConfidence?: number;
        numbersConfidence?: number;
        zeroTrustConfirmed?: boolean;
        mathIssuesCount?: number;
      }>;
      history?: Array<{ role: 'user' | 'model'; text: string }>;
    };

    const message = String(body.message || '').trim().slice(0, 1200);
    if (!message) {
      res.status(400).json({ error: 'رسالة المساعد فارغة.' });
      return;
    }

    const compactRows = (Array.isArray(body.draftRows) ? body.draftRows : [])
      .slice(0, 180)
      .map((r) => {
        const nameConf =
          typeof r.nameConfidence === 'number' ? r.nameConfidence : 1;
        const numConf =
          typeof r.numbersConfidence === 'number' ? r.numbersConfidence : 1;
        const mathCount = Number(r.mathIssuesCount || 0);
        const confirmed = Boolean(r.zeroTrustConfirmed);
        const isDoubtful =
          !confirmed &&
          (nameConf < 0.99 || numConf < 0.99 || mathCount > 0);
        return {
          rowIndex: r.rowIndex,
          name: r.resolvedName,
          individuals: r.resolvedIndividuals,
          eligibleIndividuals: r.resolvedEligibleIndividuals ?? null,
          decreaseCount: r.resolvedDecreaseCount,
          addOrDeleteCount: r.resolvedAddOrDeleteCount,
          addOrDeleteAction: r.resolvedAddOrDeleteAction,
          rowDate: r.resolvedRowDate || '',
          notes: r.notes || '',
          nameConfidence: nameConf,
          numbersConfidence: numConf,
          confirmed,
          mathIssuesCount: mathCount,
          isDoubtful,
        };
      });

    const copilotStats = {
      totalRows: compactRows.length,
      doubtfulCount: compactRows.filter((r) => r.isDoubtful).length,
      doubtfulRowIndexes: compactRows
        .filter((r) => r.isDoubtful)
        .map((r) => r.rowIndex),
      mathConflictCount: compactRows.filter(
        (r) => r.mathIssuesCount > 0 && !r.confirmed
      ).length,
      blockedCount: compactRows.filter((r) => (r.decreaseCount ?? 0) > 0).length,
      largeFamiliesCount: compactRows.filter((r) => (r.individuals ?? 0) >= 5).length,
    };

    try {
      const ai = createGeminiClient();
      if (!ai) {
        const local = runLocalCopilotFallback(
          message,
          Array.isArray(body.draftRows) ? body.draftRows : [],
          body.inferredMetadata
        );
        res.json({
          ...local,
          fallbackUsed: 'local',
        });
        return;
      }

      const contentParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = [];

      if (body.sourceImageBase64) {
        const cleanB64 = String(body.sourceImageBase64)
          .replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
          .trim();
        const mimeType =
          body.sourceMimeType === 'image/png' || body.sourceMimeType === 'image/webp'
            ? body.sourceMimeType
            : 'image/jpeg';
        if (cleanB64.length > 100 && cleanB64.length < 18 * 1024 * 1024) {
          contentParts.push({ inlineData: { mimeType, data: cleanB64 } });
        }
      }

      const historyText = Array.isArray(body.history)
        ? body.history
            .slice(-8)
            .map((h) => `${h.role === 'user' ? 'المستخدم' : 'المساعد'}: ${h.text}`)
            .join('\n')
        : '';

      contentParts.push({
        text: [
          `ملخص المستند: ${body.documentSummary || 'غير محدد'}`,
          `الهوية المستنتجة من الترويسة: ${JSON.stringify(body.inferredMetadata || null)}`,
          `إحصاءات دقيقة محسوبة لقاعدة الشك 1% والتعارضات: ${JSON.stringify(copilotStats)}`,
          `صفوف مسودة السحب الحالية (${compactRows.length} صف):\n${JSON.stringify(compactRows)}`,
          historyText ? `سياق المحادثة:\n${historyText}` : '',
          `طلب المستخدم الحالي:\n${message}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      });

      const copilotSchema = {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          operations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  enum: [
                    'filter_blocked',
                    'filter_large_families',
                    'filter_doubtful',
                    'filter_clear',
                    'highlight_row',
                    'delete_row',
                    'update_row',
                    'hide_empty_columns',
                    'show_all_columns',
                    'update_metadata',
                  ],
                },
                rowIndex: { type: Type.INTEGER, nullable: true },
                name: { type: Type.STRING, nullable: true },
                individuals: { type: Type.INTEGER, nullable: true },
                decreaseCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteAction: {
                  type: Type.STRING,
                  enum: ['إضافة', 'حذف', 'لا يوجد'],
                  nullable: true,
                },
                notes: { type: Type.STRING, nullable: true },
                rowDate: { type: Type.STRING, nullable: true },
                agencyName: { type: Type.STRING, nullable: true },
                tableDateLabel: { type: Type.STRING, nullable: true },
                centerOrAgencyNumber: { type: Type.STRING, nullable: true },
              },
              required: ['type'],
            },
          },
        },
        required: ['reply', 'operations'],
      };

      const copilotInstruction = `أنت المساعد الحي (Live Draft Copilot) وزميل العمل داخل مختبر السحب الذكي.
أنت متصل بصرياً بالصورة الأصلية المرفقة (إن وُجدت) وبالترويسة المستنتجة وبجدول مسودة السحب.
قواعدك:
1. أجب باللغة العربية باحترافية ووضوح واختصار عملي. التزم بكلمة «الأفراد» حصراً.
2. عند السؤال عن معلومة في الجدول أو الصورة (مثل: "كم عدد الصفوف المشكوك فيها؟" أو "ما هو تاريخ هذا الجدول؟" أو "من هو الشخص رقم 54؟")، استخرج الإجابة بدقة واذكر رقم السطر. استخدم "highlight_row" مع rowIndex إن سأل عن شخص محدد لإبرازه على الصورة والجدول.
3. عندما يطلب المستخدم تعديلاً أو تصفية على المسودة، أضف العمليات المناسبة في operations:
   - "قم بتصفية الأسماء التي لديها أفراد محجوبين فقط" / "أظهر النزول فقط" => filter_blocked
   - "اسحب العائلات الكبيرة فقط" / "أظهر العائلات الكبيرة" => filter_large_families
   - "أظهر الصفوف المشكوك فيها" => filter_doubtful
   - "أظهر الكل" / "ألغ التصفية" => filter_clear
   - "قم بإخفاء الأعمدة الفارغة" => hide_empty_columns
   - "أظهر كل الأعمدة" => show_all_columns
   - "احذف السطر 54" => delete_row مع rowIndex: 54
   - "عدّل اسم السطر 5 إلى ..." أو تعديل عدد الأفراد/الملاحظات => update_row مع rowIndex والحقول المعدلة
   - تعديل اسم الوكالة أو التاريخ => update_metadata
4. لا تقم أبداً بحفظ أو ترحيل البيانات نهائياً بدون ضغطة المستخدم.`;

      const { response, fallbackUsed } = await generateWithSilentResilience(ai, {
        contents: [{ role: 'user', parts: contentParts }],
        config: {
          systemInstruction: copilotInstruction,
          responseMimeType: 'application/json',
          responseSchema: copilotSchema,
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        reply?: string;
        operations?: Array<Record<string, unknown>>;
      };

      res.json({
        reply: parsed.reply || 'تمت مراجعة المسودة.',
        operations: Array.isArray(parsed.operations) ? parsed.operations : [],
        fallbackUsed,
      });
    } catch {
      const local = runLocalCopilotFallback(
        message,
        Array.isArray(body.draftRows) ? body.draftRows : [],
        body.inferredMetadata
      );
      res.json({
        ...local,
        fallbackUsed: 'local',
      });
    }
  });

  // --- Strictly Restricted 3-Brain Assistant Router (Morrow Local <-> gemini-2.5-flash <-> gemini-2.5-pro + H2 resilience) ---
  app.get('/api/assistant/status', (_req: Request, res: Response) => {
    const ai = createGeminiClient();
    res.json({
      cloudConfigured: Boolean(ai),
      defaultModel: PRIMARY_FREE_GEMINI_MODEL,
      fallbackModel: SECONDARY_FREE_GEMINI_MODEL,
      liveModel: 'gemini-3.8-live',
      multimodalModel: GEMINI_MODEL,
      models: {
        flash: PRIMARY_FREE_GEMINI_MODEL,
        pro: SECONDARY_FREE_GEMINI_MODEL,
        live: 'gemini-3.8-live',
        multimodal: GEMINI_MODEL,
      },
    });
  });

  const buildLiveWorkspaceSummaryText = (cloudContext?: Record<string, unknown>): string => {
    if (!cloudContext || typeof cloudContext !== 'object') return '';
    const lw = cloudContext.liveWorkspace as Record<string, unknown> | undefined;
    if (!lw || typeof lw !== 'object') return '';
    const rawAgencies = Array.isArray(lw.agenciesBreakdown)
      ? (lw.agenciesBreakdown as Array<Record<string, unknown>>)
      : [];
    const agenciesList = rawAgencies
      .slice(0, 12)
      .map(
        (ag) =>
          `- ${String(ag.name || '')} (ID:${ag.id}): ${Number(ag.activeHouseholds || 0)} عائلة نشطة، ${Number(ag.activeIndividuals || 0)} أفراد، محجوب ${Number(ag.blockedCount || 0)}، ${Number(ag.fullBags || 0)} كيس (${Number(ag.remainderKg || 0)} كغم متبقي)، إيراد ${Number(ag.revenueIqd || 0)} د.ع، مصروفات ${Number(ag.expensesIqd || 0)} د.ع، صافي ${Number(ag.profitIqd || 0)} د.ع`
      )
      .join('\n');
    const topByIndividuals = [...rawAgencies].sort(
      (a, b) => Number(b.activeIndividuals || 0) - Number(a.activeIndividuals || 0)
    )[0];
    const readyListsArr = Array.isArray(cloudContext.readyLists)
      ? (cloudContext.readyLists as Array<Record<string, unknown>>)
      : [];
    const readyListsLine =
      readyListsArr.length > 0
        ? `القوائم الجاهزة (${readyListsArr.length}): ${readyListsArr
            .slice(0, 8)
            .map((l) => `${String(l.name || '')} (#${l.id})`)
            .join('، ')}`
        : '';

    return [
      `الحصة الحالية: ${String(lw.periodName || 'الحصة الحالية')}`,
      `الإعدادات: رسم الفرد ${Number(lw.feePerIndividualIqd || 0)} د.ع | رسم البطاقة الثابت ${Number(lw.fixedCardFeeIqd || 0)} د.ع | كغم/فرد ${Number(lw.kgPerIndividual || 0)} | وزن الكيس ${Number(lw.kgPerBag || 50)} كغم | خصم ${Number(lw.discountPercent || 0)}%`,
      `الإجمالي الكلي: ${Number(lw.totalActiveHouseholds || 0)} عائلة نشطة (من أصل ${Number(lw.totalRegisteredHouseholds || 0)}) | ${Number(lw.totalActiveIndividuals || 0)} أفراد نشطين | محجوب ${Number(lw.totalBlockedCount || 0)} | ${Number(lw.totalFullBags || 0)} كيس | إيراد ${Number(lw.totalRevenueIqd || 0)} د.ع | مصروفات ${Number(lw.totalExpensesIqd || 0)} د.ع | صافي الربح ${Number(lw.totalProfitIqd || 0)} د.ع`,
      topByIndividuals
        ? `أكبر وكالة بالأفراد حالياً: ${String(topByIndividuals.name || '')} (${Number(topByIndividuals.activeIndividuals || 0)} أفراد · صافي ${Number(topByIndividuals.profitIqd || 0)} د.ع)`
        : '',
      `الأرشيفات: ${Number(lw.archivesCount || 0)}${lw.latestArchiveName ? ` (آخر أرشيف: ${String(lw.latestArchiveName)})` : ''} | ملاحظات سريعة: ${Number(lw.quickNotesCount || 0)} | مسودات معلقة: ${Number(lw.pendingDraftsCount || 0)}`,
      readyListsLine,
      agenciesList ? `تفصيل الوكالات:\n${agenciesList}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  app.post('/api/assistant/chat', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const body = (req.body || {}) as {
        prompt?: string;
        brainMode?: AssistantBrainMode;
        preferredModel?: string;
        fallbackModel?: string;
        cloudContext?: Record<string, unknown>;
        cloudHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
      };

      const prompt = enforceSafeArabicTerminology(String(body.prompt || '').trim()).slice(0, 2000);
      if (!prompt) {
        res.status(400).json({ error: 'النص المطلوب للمساعد فارغ.' });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(200).json({
          ok: false,
          fallbackToOffline: true,
          statusCategory: 'offline',
          reason: 'مفتاح السحابة غير مهيأ على الخادم، تم التشغيل تلقائياً بمحرك Morrow المحلي.',
        });
        return;
      }

      const mode: AssistantBrainMode =
        body.brainMode === 'gemini_2_5_flash' ||
        body.brainMode === 'gemini_2_5_pro' ||
        body.brainMode === 'local'
          ? body.brainMode
          : 'auto';

      const requestedPreferred = String(body.preferredModel || '').trim().toLowerCase();
      const primaryModel =
        requestedPreferred === LITE_FALLBACK_GEMINI_MODEL
          ? LITE_FALLBACK_GEMINI_MODEL
          : sanitizeAssistantModelId(body.preferredModel || PRIMARY_FREE_GEMINI_MODEL);
      const secondaryModel = sanitizeAssistantModelId(
        body.fallbackModel ||
          (primaryModel === SECONDARY_FREE_GEMINI_MODEL
            ? PRIMARY_FREE_GEMINI_MODEL
            : SECONDARY_FREE_GEMINI_MODEL)
      );

      const liveSummaryBlock = buildLiveWorkspaceSummaryText(body.cloudContext);
      const contextText = JSON.stringify(body.cloudContext || {}, null, 0).slice(0, 7500);
      const historyLines = Array.isArray(body.cloudHistory)
        ? body.cloudHistory
            .slice(-4)
            .map((h) => `${h.role === 'user' ? 'المستخدم' : 'المساعد'}: ${String(h.text || '').slice(0, 320)}`)
            .join('\n')
        : '';

      const systemInstruction = `أنت المساعد الذكي الشخصي «Morrow» المرتبط ارتباطاً جذرياً ومباشراً ببيانات وإجراءات تطبيق إدارة وكالات الكمية الغذائية (توزيع الطحين).
قواعدك الصارمة:
1. تحدث باللهجة العراقية المهنية المختصرة والواضحة وقدم تحليل عملي وذكي.
2. التزم تماماً بكلمة «الأفراد» و«أفراد» و«فرد» حصرياً في جميع الردود والتقارير عند الإشارة لعدد الأشخاص.
3. لا تكتب أوامر SQL أو كود برمجي نهائياً — اختر الأداة المناسبة من Function Calling بالوسائط الدقيقة فور طلب المستخدم:
   - للمقارنة أو ترتيب الوكالات: compare_agencies
   - لحفظ ملاحظة سريعة وربطها بالعائلة: add_quick_note
   - لفك الحظر عن مستفيد: update_person مع blockType='none'
   - لنقل مستفيد بين الوكالات: update_person مع agencyId الجديد
   - لإنشاء قائمة جاهزة أو إضافة اسم لها: manage_ready_list
   - للبحث، التصفية، الإحصائيات، المصاريف، التصدير أو فحص التطبيق: استخدم أدواتها المخصصة مباشرة.
4. أي عملية تعديل أو إضافة أو أرشفة أو مصروف أو إعدادات يجب أن تُجهَّز كمسودة للموافقة فقط عبر الأداة دون تخمين بيانات ناقصة.
5. لا تقترح حذفاً نهائياً أبداً (استخدم archive_person فقط للأرشفة الآمنة).
6. استند حصرياً إلى الأرقام الحية من «ملخص البيانات الحي» المرفق أدناه ولا تخترع أي رقم.
${liveSummaryBlock ? `\nملخص البيانات الحي للتطبيق الآن:\n${liveSummaryBlock}\n` : ''}
سياق التطبيق الكامل (${String(body.cloudContext?.privacyMode || 'masked_no_beneficiaries')}):
${contextText}`;

      const userContent = historyLines
        ? `سجل الحوار القريب:\n${historyLines}\n\nالطلب الحالي:\n${prompt}`
        : prompt;

      const classifyCloudError = (err: unknown): { isQuota: boolean; isTransient: boolean } => {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err || '').toLowerCase();
        const status =
          typeof (err as { status?: unknown })?.status === 'number'
            ? Number((err as { status: number }).status)
            : 0;
        const isQuota =
          status === 429 ||
          msg.includes('429') ||
          msg.includes('resource_exhausted') ||
          msg.includes('quota');
        const isTransient =
          status === 503 ||
          status === 500 ||
          msg.includes('503') ||
          msg.includes('unavailable') ||
          msg.includes('timeout') ||
          msg.includes('overloaded');
        return { isQuota, isTransient };
      };

      const runSingleModelWithRetry = async (
        modelName: string
      ): Promise<{
        text: string;
        toolCalls: AssistantToolCall[];
        model: string;
      }> => {
        const maxAttempts = 2;
        let lastErr: unknown = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('assistant_cloud_timeout')), 9500);
            });

            const callPromise = ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: [{ text: userContent }],
                },
              ],
              config: {
                systemInstruction,
                tools: [{ functionDeclarations: ASSISTANT_TOOL_DECLARATIONS }],
              },
            });

            const response = await Promise.race([callPromise, timeoutPromise]);
            const validCalls: AssistantToolCall[] = [];
            for (const fc of response.functionCalls || []) {
              const checked = validateToolCall({ name: fc.name, args: fc.args });
              if (checked.valid && checked.sanitized) {
                validCalls.push(checked.sanitized);
              }
            }
            return {
              text: enforceSafeArabicTerminology(String(response.text || '').trim()),
              toolCalls: validCalls,
              model: modelName,
            };
          } catch (err) {
            lastErr = err;
            const { isQuota, isTransient } = classifyCloudError(err);
            if (isQuota || !isTransient || attempt === maxAttempts - 1) {
              throw err;
            }
            const backoffMs = 350 * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, backoffMs));
          }
        }
        throw lastErr;
      };

      // 3-Brain escalation chain + GEMINI_MODEL & Flash-Lite resilience fallback -> morrow_local
      const orderedModels =
        mode === 'gemini_2_5_pro'
          ? [
              SECONDARY_FREE_GEMINI_MODEL,
              PRIMARY_FREE_GEMINI_MODEL,
              GEMINI_MODEL,
              LITE_FALLBACK_GEMINI_MODEL,
            ]
          : [
              primaryModel,
              secondaryModel,
              GEMINI_MODEL,
              LITE_FALLBACK_GEMINI_MODEL,
            ];
      const uniqueChain = Array.from(new Set(orderedModels));

      let hitQuota = false;
      let hit503 = false;
      for (let i = 0; i < uniqueChain.length; i++) {
        const candidateModel = uniqueChain[i];
        try {
          const result = await runSingleModelWithRetry(candidateModel);
          const isFallbackUsed = i > 0;
          const isPro = result.model === SECONDARY_FREE_GEMINI_MODEL;
          const isHydrogen = result.model === GEMINI_MODEL;
          const isFlashLite = result.model === LITE_FALLBACK_GEMINI_MODEL;
          res.json({
            ok: true,
            engineUsed: isPro ? 'gemini_2_5_pro' : 'gemini_2_5_flash',
            modelId: result.model,
            fallbackUsed: isFallbackUsed,
            switchedToFlashLite: isFlashLite,
            had503Retry: hit503,
            engineLabel: isFlashLite
              ? 'Gemini Flash Lite · استجابة احتياطية سريعة'
              : isHydrogen
                ? 'Gemini 4 Hydrogen · سحابي متقدم'
                : isPro
                  ? 'Gemini 2.5 Pro · تحليل عميق'
                  : 'Gemini 2.5 Flash · لغوي سريع',
            text:
              result.text ||
              (result.toolCalls.length > 0
                ? 'تم فهم الطلب وتجهيز الإجراء المناسب.'
                : 'تفضل، كيف أقدر أساعدك أكثر؟'),
            toolCalls: result.toolCalls,
            latencyMs: Date.now() - startedAt,
          });
          return;
        } catch (err) {
          const { isQuota, isTransient } = classifyCloudError(err);
          if (isQuota) hitQuota = true;
          if (isTransient) hit503 = true;
          // Escalate smoothly across cloud models without exposing raw SDK errors
        }
      }

      res.status(200).json({
        ok: false,
        fallbackToOffline: true,
        quotaExhausted: hitQuota,
        statusCategory: hitQuota ? 'quota_exhausted' : 'offline',
        reason: hitQuota
          ? 'انتهت حصة السحابة مؤقتاً — تم التحويل تلقائياً إلى محرك Morrow المحلي.'
          : 'تعذر الوصول للنماذج السحابية حالياً — تم التحويل تلقائياً إلى محرك Morrow المحلي.',
      });
    } catch {
      res.status(200).json({
        ok: false,
        fallbackToOffline: true,
        statusCategory: 'offline',
        reason: 'تعذر الاتصال بالسحابة مؤقتاً، تم التحويل لمحرك Morrow المحلي.',
      });
    }
  });

  // --- Morrow Smart Text Analyzer (WhatsApp / unstructured Arabic notes -> structured entries) ---

  app.post('/api/morrow/analyze-text', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        rawText?: string;
        agencies?: Array<{ id: number; name: string }>;
      };
      const rawText = String(body.rawText || '').trim().slice(0, 6000);
      if (!rawText) {
        res.status(400).json({ ok: false, error: 'يرجى لصق النص أولاً لتحليله.' });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(200).json({
          ok: false,
          fallbackToLocal: true,
          reason: 'مفتاح الذكاء السحابي غير مهيأ — يمكنك الاعتماد على المحلل المحلي الفوري.',
        });
        return;
      }

      const agenciesHint = Array.isArray(body.agencies)
        ? body.agencies.map((a) => `${a.id}:${a.name}`).join('، ')
        : '';

      const schema = {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rawLine: { type: Type.STRING },
                detectedName: { type: Type.STRING },
                action: {
                  type: Type.STRING,
                  enum: ['update_individuals', 'block_full', 'add_person', 'note'],
                },
                individualsCount: { type: Type.INTEGER, nullable: true },
                agencyNameHint: { type: Type.STRING, nullable: true },
                noteText: { type: Type.STRING, nullable: true },
                confidence: { type: Type.NUMBER },
              },
              required: ['rawLine', 'detectedName', 'action', 'confidence'],
            },
          },
        },
        required: ['summary', 'items'],
      };

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `الوكالات المتاحة: ${agenciesHint || 'غير محددة'}\n\nالنص المراد تحليله:\n${rawText}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'أنت محلل نصوص عربية ومذكرات واتساب لنظام وكالات الكمية الغذائية. استخرج كل سطر إلى عملية مهيكلة (تحديث عدد الأفراد update_individuals، حجب كامل block_full، إضافة عائلة add_person، أو ملاحظة note) مع الالتزام الصارم بكلمة «الأفراد» وأعد JSON فقط.',
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        summary?: string;
        items?: Array<{
          rawLine?: string;
          detectedName?: string;
          action?: 'update_individuals' | 'block_full' | 'add_person' | 'note';
          individualsCount?: number | null;
          agencyNameHint?: string | null;
          noteText?: string | null;
          confidence?: number;
        }>;
      };

      res.json({
        ok: true,
        modelId: GEMINI_MODEL,
        summary: enforceSafeArabicTerminology(parsed.summary || 'تم تحليل النص بالذكاء السحابي بنجاح.'),
        items: Array.isArray(parsed.items) ? parsed.items : [],
      });
    } catch {
      res.status(200).json({
        ok: false,
        fallbackToLocal: true,
        reason: 'تعذر التحليل السحابي مؤقتاً — تم الإبقاء على التحليل المحلي.',
      });
    }
  });

  // --- Morrow Voice Message Transcription (gemini-3.5-transcribe) ---
  app.post('/api/morrow/transcribe', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        audioBase64?: string;
        mimeType?: string;
        targetMode?: 'instruction' | 'quick_note' | 'draft_text';
        agencies?: Array<{ id: number; name: string }>;
      };
      const cleanBase64 = String(body.audioBase64 || '')
        .replace(/^data:[^;]+;base64,/, '')
        .trim();
      const mimeType = String(body.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
      const targetMode =
        body.targetMode === 'quick_note' || body.targetMode === 'draft_text'
          ? body.targetMode
          : 'instruction';

      if (!cleanBase64) {
        res.status(400).json({ ok: false, error: 'الملف الصوتي فارغ.' });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          ok: false,
          requiresApiKey: true,
          error: 'مفتاح السحابة GEMINI_API_KEY غير مهيأ لتفريغ الرسائل الصوتية.',
        });
        return;
      }

      const agenciesHint = Array.isArray(body.agencies)
        ? body.agencies
            .slice(0, 12)
            .map((a) => String(a.name || '').trim())
            .filter(Boolean)
            .join('، ')
        : '';

      const modeHint =
        targetMode === 'quick_note'
          ? 'الغرض: تسجيل ملاحظة سريعة متعلقة بعائلة أو وكالة.'
          : targetMode === 'draft_text'
            ? 'الغرض: تحويل الكلام إلى نص قابل للتحرير في مربع الكتابة.'
            : 'الغرض: تعليمة أو أمر عمل لمساعد إدارة الوكالات.';

      const transcribePrompt = [
        'فرّغ هذا التسجيل الصوتي باللغة العربية أو اللهجة العراقية بدقة كاملة وأعد النص المفرّغ فقط بدون مقدمات أو شرح إضافي.',
        'مصطلحات النظام الشائعة: الوكالات، الأفراد، كيس طحين، حجب، حظر، القوائم الجاهزة، الأرشيف، رسم الفرد، مصروف.',
        agenciesHint ? `أسماء الوكالات المحتملة: ${agenciesHint}.` : '',
        modeHint,
      ]
        .filter(Boolean)
        .join(' ');

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: transcribePrompt,
              },
            ],
          },
        ],
      });

      const transcript = enforceSafeArabicTerminology(String(response.text || '').trim());
      if (!transcript) {
        res.status(422).json({
          ok: false,
          error: 'لم يتم التقاط كلام واضح في التسجيل الصوتي.',
        });
        return;
      }

      const looksLikeQuickNote = /^(?:ملاحظ[هة]|مذكر[هة]|تنبيه|لا تنسى|سجل ملاحظ[هة]|اكتب ملاحظ[هة])/i.test(
        transcript
      );

      res.json({
        ok: true,
        modelId: 'gemini-3.5-transcribe',
        transcript,
        targetMode,
        detectedTargetMode: looksLikeQuickNote ? 'quick_note' : targetMode,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error:
          err instanceof Error
            ? `تعذر تفريغ الرسالة الصوتية: ${err.message}`
            : 'تعذر تفريغ الرسالة الصوتية حالياً.',
      });
    }
  });

  // --- Morrow Multimodal File / Camera Analysis (gemini-4-hydrogen) ---
  app.post('/api/morrow/multimodal', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        fileName?: string;
        mimeType?: string;
        dataBase64?: string;
        prompt?: string;
        agencies?: Array<{ id: number; name: string }>;
        liveWorkspace?: Record<string, unknown>;
      };

      const cleanBase64 = String(body.dataBase64 || '')
        .replace(/^data:[^;]+;base64,/, '')
        .trim();
      const mimeType = String(body.mimeType || '').trim();
      const fileName = String(body.fileName || 'مستند مرفق').trim().slice(0, 180);
      const userPrompt = String(body.prompt || '').trim().slice(0, 1500);

      if (!cleanBase64 || !mimeType) {
        res.status(400).json({ ok: false, error: 'يرجى إرفاق صورة أو ملف PDF صالح أولاً.' });
        return;
      }

      if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
        res.status(400).json({
          ok: false,
          error: 'نوع الملف غير مدعوم للمعاينة الذكية (يدعم الصور وملفات PDF).',
        });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          ok: false,
          requiresApiKey: true,
          error: 'مفتاح السحابة GEMINI_API_KEY غير مهيأ لتحليل الملفات والصور.',
        });
        return;
      }

      const agenciesHint = Array.isArray(body.agencies)
        ? body.agencies.map((a) => `${a.id}:${a.name}`).join('، ')
        : '';
      const lw = body.liveWorkspace;
      const liveHint =
        lw && typeof lw === 'object'
          ? `الحصة الحالية: ${String(lw.periodName || '')} | رسم الفرد: ${Number(lw.feePerIndividualIqd || 0)} د.ع | إجمالي الأفراد النشطين: ${Number(lw.totalActiveIndividuals || 0)}`
          : '';

      const schema = {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          looksLikeRosterTable: { type: Type.BOOLEAN },
          detectedAgencyName: { type: Type.STRING, nullable: true },
          suggestedRowsCount: { type: Type.INTEGER, nullable: true },
          suggestedTools: {
            type: Type.ARRAY,
            nullable: true,
            items: {
              type: Type.OBJECT,
              properties: {
                toolName: {
                  type: Type.STRING,
                  enum: ['add_person', 'manage_expense', 'update_settings'],
                },
                agencyId: { type: Type.INTEGER, nullable: true },
                name: { type: Type.STRING, nullable: true },
                individuals: { type: Type.INTEGER, nullable: true },
                notes: { type: Type.STRING, nullable: true },
                description: { type: Type.STRING, nullable: true },
                amountIqd: { type: Type.INTEGER, nullable: true },
                feePerIndividualIqd: { type: Type.INTEGER, nullable: true },
              },
              required: ['toolName'],
            },
          },
        },
        required: ['reply', 'looksLikeRosterTable'],
      };

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: `اسم الملف: ${fileName}
الوكالات المسجلة بالتطبيق: ${agenciesHint || 'غير محددة'}
${liveHint ? `حالة التطبيق الحالية: ${liveHint}\n` : ''}طلب المستخدم: ${userPrompt || 'اقرأ هذا المستند أو الصورة ولخّص محتواها. إذا كانت إيصال مصروف فاقترح manage_expense، وإذا كانت أسماء جديدة قليلة فاقترح add_person، وإذا كانت جدول مستفيدين/وكالات فاذكر التفاصيل وأوصِ بالسحب الذكي.'}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'أنت مساعد Morrow الذكي لقراءة الملفات والصور داخل تطبيق إدارة وكالات توزيع الطحين. التزم دائماً بكلمة «الأفراد» وأجب باللهجة العراقية المهنية الواضحة. حدد بدقة ما إذا كان المرفق جدول مستفيدين أو دفتر توزيع (looksLikeRosterTable)، وإن تضمن إيصالاً مالياً أو إضافة واضحة أضفها في suggestedTools ليراجعها المستخدم كمسودة موافقة. أعد JSON فقط.',
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        reply?: string;
        looksLikeRosterTable?: boolean;
        detectedAgencyName?: string | null;
        suggestedRowsCount?: number | null;
        suggestedTools?: Array<Record<string, unknown>> | null;
      };

      const validatedTools: AssistantToolCall[] = [];
      if (Array.isArray(parsed.suggestedTools)) {
        for (const item of parsed.suggestedTools.slice(0, 6)) {
          if (!item || typeof item !== 'object') continue;
          const tName = String(item.toolName || '');
          const args: Record<string, unknown> = {};
          if (item.agencyId !== undefined && item.agencyId !== null) args.agencyId = Number(item.agencyId);
          if (typeof item.name === 'string' && item.name.trim()) args.name = item.name.trim();
          if (item.individuals !== undefined && item.individuals !== null) args.individuals = Number(item.individuals);
          if (typeof item.notes === 'string' && item.notes.trim()) args.notes = item.notes.trim();
          if (typeof item.description === 'string' && item.description.trim()) args.description = item.description.trim();
          if (item.amountIqd !== undefined && item.amountIqd !== null) args.amountIqd = Number(item.amountIqd);
          if (item.feePerIndividualIqd !== undefined && item.feePerIndividualIqd !== null) {
            args.feePerIndividualIqd = Number(item.feePerIndividualIqd);
          }
          const check = validateToolCall({ name: tName, args });
          if (check.valid && check.sanitized) {
            validatedTools.push(check.sanitized);
          }
        }
      }

      res.json({
        ok: true,
        modelId: GEMINI_MODEL,
        reply: enforceSafeArabicTerminology(
          parsed.reply || 'تمت قراءة المرفق بنجاح.'
        ),
        looksLikeRosterTable: Boolean(parsed.looksLikeRosterTable),
        detectedAgencyName: parsed.detectedAgencyName || null,
        suggestedRowsCount:
          typeof parsed.suggestedRowsCount === 'number' ? parsed.suggestedRowsCount : null,
        suggestedTools: validatedTools,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error:
          err instanceof Error
            ? `تعذر تحليل المرفق: ${err.message}`
            : 'تعذر تحليل المرفق حالياً.',
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const httpServer = http.createServer(app);
  const morrowLiveWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/api/morrow/live') {
        morrowLiveWss.handleUpgrade(request, socket, head, (ws) => {
          morrowLiveWss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  morrowLiveWss.on('connection', async (clientWs: WebSocket) => {
    const ai = createGeminiClient();
    if (!ai) {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            requiresApiKey: true,
            message: 'مفتاح السحابة GEMINI_API_KEY غير مهيأ على الخادم لتشغيل المحادثة المباشرة لايف.',
          })
        );
        clientWs.close();
      }
      return;
    }

    let closed = false;
    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let sessionCloudContext: Record<string, unknown> | undefined;

    type LiveIncomingMsg = {
      type?: 'init' | 'audio' | 'video' | 'text';
      data?: string;
      mimeType?: string;
      text?: string;
      cloudContext?: Record<string, unknown>;
    };

    const earlyMessages: LiveIncomingMsg[] = [];
    let resolveInit: (() => void) | null = null;
    const initWaitPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
      setTimeout(() => resolve(), 650);
    });

    const initialListener = (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as LiveIncomingMsg;
        if (msg.type === 'init' && msg.cloudContext && typeof msg.cloudContext === 'object') {
          sessionCloudContext = msg.cloudContext;
          resolveInit?.();
          return;
        }
        earlyMessages.push(msg);
      } catch {
        // ignore malformed frame
      }
    };

    clientWs.on('message', initialListener);
    clientWs.once('close', () => {
      closed = true;
      resolveInit?.();
    });

    await initWaitPromise;
    clientWs.off('message', initialListener);
    if (closed) return;

    const liveWorkspaceSummary = buildLiveWorkspaceSummaryText(sessionCloudContext);
    const liveDirectory = Array.isArray(sessionCloudContext?.beneficiaryDirectory)
      ? (sessionCloudContext?.beneficiaryDirectory as Array<Record<string, unknown>>)
      : [];

    const LIVE_TOOL_DECLARATIONS: FunctionDeclaration[] = [
      {
        name: 'get_live_workspace_stats',
        description: 'إرجاع إحصائيات الحصة الحالية والأفراد والأكياس وصافي الربح للجميع أو لوكالة محددة.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            agencyId: { type: Type.INTEGER, nullable: true },
            agencyName: { type: Type.STRING, nullable: true },
          },
        },
      },
      {
        name: 'navigate_app_screen',
        description: 'نقل شاشة المستخدم وإبراز قسم محدد داخل التطبيق.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            targetView: {
              type: Type.STRING,
              enum: [
                'hub',
                'master_roster',
                'agency_roster',
                'finance',
                'quick_extract',
                'ready_lists',
                'relationships',
                'data_archives',
                'settings',
              ],
            },
            agencyId: { type: Type.INTEGER, nullable: true },
          },
          required: ['targetView'],
        },
      },
      {
        name: 'search_live_beneficiary',
        description: 'البحث عن مستفيد داخل السجلات الحية للمستخدم.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING },
          },
          required: ['query'],
        },
      },
      {
        name: 'stage_zero_trust_draft',
        description:
          'تجهيز مسودة تعديل أو إضافة أو مصروف آمنة للمراجعة والموافقة من المستخدم داخل التطبيق.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            toolName: {
              type: Type.STRING,
              enum: ['add_person', 'manage_expense', 'update_settings'],
            },
            agencyId: { type: Type.INTEGER, nullable: true },
            name: { type: Type.STRING, nullable: true },
            individuals: { type: Type.INTEGER, nullable: true },
            description: { type: Type.STRING, nullable: true },
            amountIqd: { type: Type.INTEGER, nullable: true },
            feePerIndividualIqd: { type: Type.INTEGER, nullable: true },
          },
          required: ['toolName'],
        },
      },
    ];

    const liveSystemInstruction = `أنت المساعد الذكي الشخصي Morrow في جلسة صوتية ومشاهدة مباشرة مرتبطة جذرياً بتطبيق إدارة وكالات توزيع الطحين والمستفيدين.
تحدث باللهجة العراقية المهنية الهادئة والواضحة وباختصار مفيد، والتزم دائماً بمصطلح «الأفراد» وأبداً لا تستخدم «الأنفار».
إذا سألك المستخدم عن أرقام حية أو إحصائيات أو أرباح أو أراد فتح صفحة أو تجهيز مسودة تعديل/مصروف، استخدم الأدوات المباشرة (Function Calling) فوراً.
${liveWorkspaceSummary ? `\nبيانات التطبيق الحية المرتبطة بالجلسة:\n${liveWorkspaceSummary}` : ''}`;

    const sessionPromise = ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Zephyr',
            },
          },
        },
        tools: [{ functionDeclarations: LIVE_TOOL_DECLARATIONS }],
        systemInstruction: liveSystemInstruction,
      },
      callbacks: {
        onopen: () => {
          if (!closed && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'ready',
                model: 'gemini-3.8-live',
                boundToWorkspace: Boolean(liveWorkspaceSummary),
              })
            );
          }
        },
        onmessage: async (message: LiveServerMessage) => {
          if (closed || clientWs.readyState !== clientWs.OPEN) return;
          const content = message.serverContent;

          if (content?.inputTranscription?.text) {
            clientWs.send(
              JSON.stringify({
                type: 'input_transcript',
                text: content.inputTranscription.text,
              })
            );
          }

          if (content?.outputTranscription?.text) {
            clientWs.send(
              JSON.stringify({
                type: 'output_transcript',
                text: enforceSafeArabicTerminology(content.outputTranscription.text),
              })
            );
          }

          for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              clientWs.send(
                JSON.stringify({
                  type: 'audio',
                  data: part.inlineData.data,
                })
              );
            }
          }

          // Handle Live Function Calling and forward validated UI actions
          const fCalls = message.toolCall?.functionCalls;
          if (Array.isArray(fCalls) && fCalls.length > 0) {
            const functionResponses: Array<{
              id?: string;
              name?: string;
              response: Record<string, unknown>;
            }> = [];

            const lw = (sessionCloudContext?.liveWorkspace || {}) as Record<string, unknown>;
            const agenciesList = Array.isArray(lw.agenciesBreakdown)
              ? (lw.agenciesBreakdown as Array<Record<string, unknown>>)
              : [];

            for (const fc of fCalls) {
              const args = (fc.args || {}) as Record<string, unknown>;
              let responseObj: Record<string, unknown> = { ok: true };
              let uiToolCall: AssistantToolCall | null = null;

              if (fc.name === 'get_live_workspace_stats') {
                const targetAg =
                  args.agencyId !== undefined
                    ? agenciesList.find((a) => Number(a.id) === Number(args.agencyId))
                    : typeof args.agencyName === 'string' && args.agencyName.trim()
                      ? agenciesList.find((a) =>
                          String(a.name || '').includes(String(args.agencyName).trim())
                        )
                      : undefined;
                responseObj = targetAg
                  ? { ok: true, agency: targetAg, periodName: lw.periodName }
                  : {
                      ok: true,
                      periodName: lw.periodName,
                      totalActiveHouseholds: lw.totalActiveHouseholds,
                      totalActiveIndividuals: lw.totalActiveIndividuals,
                      totalFullBags: lw.totalFullBags,
                      totalRevenueIqd: lw.totalRevenueIqd,
                      totalProfitIqd: lw.totalProfitIqd,
                      agenciesCount: agenciesList.length,
                    };
                const checked = validateToolCall({
                  name: 'get_stats_profit',
                  args: targetAg ? { agencyId: Number(targetAg.id) } : {},
                });
                if (checked.valid && checked.sanitized) uiToolCall = checked.sanitized;
              } else if (fc.name === 'navigate_app_screen') {
                const checked = validateToolCall({
                  name: 'navigate_focus',
                  args: {
                    view: String(args.targetView || 'hub'),
                    ...(args.agencyId !== undefined ? { agencyId: Number(args.agencyId) } : {}),
                  },
                });
                if (checked.valid && checked.sanitized) {
                  uiToolCall = checked.sanitized;
                  responseObj = { ok: true, navigatedTo: checked.sanitized.args.view };
                }
              } else if (fc.name === 'search_live_beneficiary') {
                const q = String(args.query || '').trim();
                const matches = q
                  ? liveDirectory
                      .filter((p) => String(p.name || '').includes(q))
                      .slice(0, 6)
                  : [];
                const checked = validateToolCall({ name: 'search_person', args: { query: q } });
                if (checked.valid && checked.sanitized) uiToolCall = checked.sanitized;
                responseObj = {
                  ok: true,
                  matchesCount: matches.length,
                  matches,
                  note:
                    liveDirectory.length === 0
                      ? 'تم تشغيل البحث داخل التطبيق مباشرة مع حماية خصوصية الأسماء عن السحابة.'
                      : undefined,
                };
              } else if (fc.name === 'stage_zero_trust_draft') {
                const targetTool = String(args.toolName || '');
                const toolArgs: Record<string, unknown> = { ...args };
                delete toolArgs.toolName;
                const checked = validateToolCall({ name: targetTool, args: toolArgs });
                if (checked.valid && checked.sanitized) {
                  uiToolCall = checked.sanitized;
                  responseObj = {
                    ok: true,
                    stagedForUserApproval: true,
                    message: 'تم تجهيز مسودة الموافقة الآمنة على شاشة المستخدم.',
                  };
                } else {
                  responseObj = { ok: false, reason: checked.error || 'وسائط غير مكتملة' };
                }
              }

              if (uiToolCall && clientWs.readyState === clientWs.OPEN) {
                clientWs.send(JSON.stringify({ type: 'tool_call', toolCall: uiToolCall }));
              }

              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: responseObj,
              });
            }

            try {
              const s = liveSession || (await sessionPromise);
              await s.sendToolResponse({ functionResponses });
            } catch {
              // ignore tool response send failure during teardown
            }
          }

          if (content?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }
          if (content?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'turn_complete' }));
          }
        },
        onerror: (err) => {
          if (!closed && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                message:
                  err instanceof Error
                    ? `انقطاع الاتصال المباشر: ${err.message}`
                    : 'حدث خطأ في اتصال Gemini Live المباشر.',
              })
            );
          }
        },
        onclose: () => {
          if (!closed && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ type: 'closed' }));
            clientWs.close();
          }
        },
      },
    });

    const dispatchLiveClientMsg = (
      session: Awaited<ReturnType<typeof ai.live.connect>>,
      msg: LiveIncomingMsg
    ) => {
      if (msg.type === 'audio' && msg.data) {
        session.sendRealtimeInput({
          audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
        });
      } else if (msg.type === 'video' && msg.data) {
        session.sendRealtimeInput({
          video: { data: msg.data, mimeType: msg.mimeType || 'image/jpeg' },
        });
      } else if (msg.type === 'text' && msg.text) {
        session.sendRealtimeInput({ text: msg.text });
      }
    };

    sessionPromise
      .then((s) => {
        liveSession = s;
        if (closed) {
          try {
            s.close();
          } catch {
            // ignore
          }
          return;
        }
        while (earlyMessages.length > 0) {
          const buffered = earlyMessages.shift();
          if (buffered) dispatchLiveClientMsg(s, buffered);
        }
      })
      .catch((err) => {
        if (!closed && clientWs.readyState === clientWs.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'error',
              message:
                err instanceof Error
                  ? `تعذر فتح جلسة لايف: ${err.message}`
                  : 'تعذر الاتصال بخدمة لايف المباشرة.',
            })
          );
          clientWs.close();
        }
      });

    clientWs.on('message', async (raw) => {
      if (closed) return;
      try {
        const msg = JSON.parse(raw.toString()) as LiveIncomingMsg;
        if (msg.type === 'init') return;
        const session = await sessionPromise;
        if (closed) return;
        dispatchLiveClientMsg(session, msg);
      } catch {
        // Ignore malformed frame or closed session during teardown
      }
    });

    clientWs.on('close', () => {
      closed = true;
      try {
        liveSession?.close();
      } catch {
        // ignore
      }
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

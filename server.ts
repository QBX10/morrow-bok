import {
  type GenerateContentResponse,
  type LiveServerMessage,
  Modality,
  Type,
  type FunctionDeclaration,
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
  AI_FREE_MODELS,
  AI_ROUTING_PIPELINES,
  AI_TASK_PROFILES,
  resolveOrderedTaskChain,
  sanitizeAiModelId,
  type AiPipelineKind,
  type AiTaskKey,
  type AiTaskRouteConfigItem,
  type ApprovedCloudModelId,
} from './src/aiConfig.ts';
import {
  appendLocalAuditEvents,
  createUserRecord,
  findUserByEmail,
  findUserByUid,
  findUserByUsername,
  getLocalUserPreferences,
  getSoundSettings,
  getWorkspaceSnapshot,
  linkLocalUsername,
  listLocalAuditEvents,
  resolveOrCreateLocalCanonicalUser,
  saveLocalUserPreferences,
  saveSoundSettings,
  saveWorkspaceSnapshot,
  syncLocalWorkspaceWithLww,
  updateUserPasswordHash,
  upsertLocalProfile,
} from './src/db/localStore.ts';
import {
  appendSqlAuditEvents,
  createSqlPasswordUser,
  deleteAppearanceProfileByUid,
  findSqlUserByEmail,
  findSqlUserByUsername,
  getSqlUserByUid,
  getSqlUserPreferences,
  getWorkspaceByUid,
  isSqlDatabaseConfigured,
  linkSqlUsernameToUid,
  listAppearanceProfilesByUid,
  listSqlAuditEvents,
  pingSqlDatabase,
  saveAppearanceProfileByUid,
  saveSqlUserPreferences,
  saveWorkspaceByUid,
  syncSqlWorkspaceWithLww,
  updateSqlUserPasswordHash,
  updateSqlUserProfile,
} from './src/db/users.ts';
import {
  clearSessionCookie,
  parseCookieHeader,
  requireAuth,
  resolveCanonicalPrincipal,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  signSessionToken,
  verifyAuthToken,
  type AuthRequest,
} from './src/middleware/auth.ts';
import {
  createGoogleAiClient,
  executeAudioTranscriptionWithFallback,
  executeCollaborativeOrchestration,
  executeWithFallback,
  getOrchestrationStatusSnapshot,
  liveTestAiModelOrTask,
  type OrchestratorAttachmentPart,
} from './src/server/aiOrchestrator.ts';
import type {
  AuthProviderType,
  InferredDocumentMetadata,
  QuickExtractRawRow,
} from './src/types/agency.ts';
import type {
  AiCollaborationMode,
  AssistantBrainMode,
  AssistantResponseStyle,
  AssistantToolCall,
} from './src/types/assistant.ts';
import { enforceSafeArabicTerminology } from './src/utils/assistantPrivacy.ts';
import {
  ASSISTANT_TOOL_DECLARATIONS,
  validateToolCall,
} from './src/utils/assistantTools.ts';
import { mapModelIdToEngineSource } from './src/utils/morrowRouter.ts';
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

const pendingPasswordResets = new Map<
  string,
  { uid: string; code: string; expiresAt: number; attempts: number }
>();

const GITHUB_OAUTH_STATE_FALLBACK = crypto.randomBytes(32).toString('hex');

function getGithubOAuthSecret(): string {
  return process.env.AUTH_SESSION_SECRET?.trim() || GITHUB_OAUTH_STATE_FALLBACK;
}

function signGithubOAuthState(rememberMe: boolean): string {
  const payload = Buffer.from(
    JSON.stringify({
      nonce: crypto.randomBytes(12).toString('hex'),
      exp: Date.now() + 10 * 60 * 1000,
      rememberMe,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getGithubOAuthSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyGithubOAuthState(
  state: string
): { valid: boolean; rememberMe: boolean } {
  if (!state || !state.includes('.')) return { valid: false, rememberMe: true };
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return { valid: false, rememberMe: true };
  const expectedSig = crypto
    .createHmac('sha256', getGithubOAuthSecret())
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, rememberMe: true };
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: number;
      rememberMe?: boolean;
    };
    if (!parsed.exp || Date.now() > parsed.exp) {
      return { valid: false, rememberMe: true };
    }
    return { valid: true, rememberMe: parsed.rememberMe !== false };
  } catch {
    return { valid: false, rememberMe: true };
  }
}

function getGithubCallbackUrl(req?: Request): string {
  const configuredAppUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (configuredAppUrl) {
    return `${configuredAppUrl}/auth/callback`;
  }
  if (req) {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
      .split(',')[0]
      .trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000')
      .split(',')[0]
      .trim();
    return `${proto}://${host}/auth/callback`;
  }
  return `http://localhost:${PORT}/auth/callback`;
}

function renderGithubCallbackHtml(params: {
  ok: boolean;
  message: {
    type: 'GITHUB_AUTH_SUCCESS' | 'GITHUB_AUTH_ERROR';
    payload?: { token: string; user: Record<string, unknown> };
    error?: string;
  };
  title: string;
  subtitle: string;
}): string {
  const safeJson = JSON.stringify(params.message).replace(/</g, '\\u003c');
  const safeTitle = params.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeSubtitle = params.subtitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Morrow — المصادقة عبر GitHub</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0e;color:#f5f2eb;font-family:system-ui,-apple-system,sans-serif;padding:24px}
    .card{max-width:420px;width:100%;background:#15151a;border:1px solid ${
      params.ok ? 'rgba(212,175,55,0.45)' : 'rgba(239,68,68,0.45)'
    };border-radius:18px;padding:24px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.65)}
    h1{margin:0 0 8px;font-size:18px;color:${params.ok ? '#f3d06b' : '#f87171'}}
    p{margin:0 0 18px;font-size:13px;line-height:1.6;color:#c2c0b8}
    button{background:#d4af37;color:#111;border:0;border-radius:10px;padding:10px 18px;font-weight:700;font-size:13px;cursor:pointer}
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p>${safeSubtitle}</p>
    <button type="button" onclick="window.close()">إغلاق النافذة</button>
  </div>
  <script>
    (function(){
      var data = ${safeJson};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(data, '*');
        }
      } catch (e) {}
      setTimeout(function(){ try { window.close(); } catch(e) {} }, 180);
    })();
  </script>
</body>
</html>`;
}

const authRateBuckets = new Map<string, { count: number; resetAt: number }>();

function pruneAuthTransientMaps() {
  const now = Date.now();
  for (const [key, val] of pendingPasswordResets.entries()) {
    if (now > val.expiresAt) pendingPasswordResets.delete(key);
  }
  for (const [key, val] of authRateBuckets.entries()) {
    if (now > val.resetAt) authRateBuckets.delete(key);
  }
}

function getClientRateKey(req: Request, bucket: string, scope = ''): string {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = xff || req.socket.remoteAddress || 'unknown';
  return `${bucket}:${ip}:${scope}`;
}

function consumeAuthRateLimit(
  req: Request,
  bucket: string,
  maxAttempts = 15,
  windowMs = 5 * 60 * 1000,
  scope = ''
): boolean {
  pruneAuthTransientMaps();
  const key = getClientRateKey(req, bucket, scope);
  const now = Date.now();
  const cur = authRateBuckets.get(key);
  if (!cur || now > cur.resetAt) {
    authRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= maxAttempts) {
    return false;
  }
  cur.count += 1;
  return true;
}

async function resolveAutoIdentifierLookup(
  mode: string | undefined,
  rawIdentifier: string
) {
  const clean = rawIdentifier.trim();
  const explicit =
    mode === 'google' || mode === 'username' ? mode : 'auto';
  const useSql = isSqlDatabaseConfigured();

  if (explicit === 'google' || (explicit === 'auto' && clean.includes('@'))) {
    const email = clean.toLowerCase();
    return {
      resolvedMode: 'google' as const,
      user: useSql ? await findSqlUserByEmail(email) : findUserByEmail(email),
    };
  }
  const uname = clean.toLowerCase();
  return {
    resolvedMode: 'username' as const,
    user: useSql ? await findSqlUserByUsername(uname) : findUserByUsername(uname),
  };
}

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
    const status = getOrchestrationStatusSnapshot();
    res.json({
      ok: true,
      model: AI_FREE_MODELS.GEMINI_4_HYDROGEN,
      providers: status.providers,
      modelsCount: status.models.length,
    });
  });

  app.get('/api/system/storage-status', async (_req: Request, res: Response) => {
    const cloudSqlConfigured = isSqlDatabaseConfigured();
    const cloudSqlReachable = cloudSqlConfigured ? await pingSqlDatabase() : false;
    const firebaseAuthConfigured = true;
    res.json({
      cloudSqlConfigured,
      cloudSqlReachable,
      firebaseAuthConfigured,
      storageMode: cloudSqlConfigured && cloudSqlReachable ? 'cloud_sql' : 'local_fallback',
    });
  });

  // --- Multi-Auth Endpoints: Google, GitHub, Email & Username ---

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      if (!consumeAuthRateLimit(req, 'register', 12)) {
        res.status(429).json({ error: 'تم إرسال طلبات كثيرة، يرجى الانتظار قليلاً.' });
        return;
      }
      const body = (req.body || {}) as {
        mode?: 'google' | 'username';
        displayName?: string;
        email?: string;
        username?: string;
        password?: string;
        rememberMe?: boolean;
      };

      const mode = body.mode === 'google' ? 'google' : 'username';
      const displayName = String(body.displayName || '').trim().slice(0, 80);
      const password = String(body.password || '');
      const rememberMe = body.rememberMe !== false;
      const useSql = isSqlDatabaseConfigured();

      if (password.length < 6) {
        res
          .status(400)
          .json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });
        return;
      }

      if (mode === 'google') {
        const email = String(body.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صالح.' });
          return;
        }
        const existing = useSql ? await findSqlUserByEmail(email) : findUserByEmail(email);
        if (existing) {
          res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل مسبقًا.' });
          return;
        }
        const uid = `gml_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const created = useSql
          ? await createSqlPasswordUser({
              uid,
              authProvider: 'google',
              displayName: displayName || email.split('@')[0],
              email,
              passwordHash: hashPassword(password),
            })
          : createUserRecord({
              uid,
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
        const token = signSessionToken(user);
        setSessionCookie(req, res, token, rememberMe);
        res.status(201).json({ token, user });
        return;
      }

      const username = String(body.username || '').trim().toLowerCase();
      if (!/^[a-zA-Z0-9_.\-]{3,32}$/.test(username)) {
        res.status(400).json({
          error:
            'اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا إنجليزيًا أو أرقامًا.',
        });
        return;
      }
      const existing = useSql
        ? await findSqlUserByUsername(username)
        : findUserByUsername(username);
      if (existing) {
        res.status(409).json({ error: 'اسم المستخدم مسجل مسبقًا.' });
        return;
      }
      const uid = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const created = useSql
        ? await createSqlPasswordUser({
            uid,
            authProvider: 'username',
            displayName: displayName || username,
            username,
            passwordHash: hashPassword(password),
          })
        : createUserRecord({
            uid,
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
      const token = signSessionToken(user);
      setSessionCookie(req, res, token, rememberMe);
      res.status(201).json({ token, user });
    } catch {
      res.status(500).json({ error: 'تعذر إنشاء الحساب حالياً.' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        mode?: 'auto' | 'google' | 'username';
        identifier?: string;
        password?: string;
        rememberMe?: boolean;
      };
      const identifier = String(body.identifier || '').trim();
      if (!consumeAuthRateLimit(req, 'login', 18, 5 * 60 * 1000, identifier.toLowerCase())) {
        res.status(429).json({
          error: 'تم تجاوز الحد المسموح من محاولات الدخول. يرجى الانتظار دقائق.',
        });
        return;
      }

      const password = String(body.password || '');
      const rememberMe = body.rememberMe !== false;
      const { resolvedMode, user: found } = await resolveAutoIdentifierLookup(
        body.mode,
        identifier
      );

      if (!found || !verifyPassword(password, found.passwordHash ?? null)) {
        res.status(401).json({
          error:
            resolvedMode === 'google'
              ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
              : 'بيانات الدخول أو كلمة المرور غير صحيحة.',
        });
        return;
      }

      const cleanEmail =
        found.email && !found.email.endsWith('.local') ? found.email : undefined;
      const safeProvider: AuthProviderType =
        found.authProvider === 'google' || found.authProvider === 'github'
          ? found.authProvider
          : 'username';
      const user = {
        uid: found.uid,
        provider: safeProvider,
        displayName: found.displayName,
        email: cleanEmail,
        username: found.username || undefined,
        githubId: 'githubId' in found && found.githubId ? found.githubId : undefined,
        avatarUrl: found.avatarUrl || undefined,
        role: (found.role as 'manager' | 'viewer') || 'manager',
      };
      const token = signSessionToken(user);
      setSessionCookie(req, res, token, rememberMe);
      res.json({ token, user });
    } catch {
      res.status(500).json({ error: 'تعذر تسجيل الدخول حالياً.' });
    }
  });

  app.post('/api/auth/firebase-session', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const body = (req.body || {}) as { idToken?: string; rememberMe?: boolean };
      const rawToken =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : String(body.idToken || '').trim();
      if (!rawToken || rawToken.startsWith('sess.')) {
        res.status(401).json({ error: 'رمز تحقق Google غير صالح.' });
        return;
      }
      const verified = await verifyAuthToken(rawToken);
      if (!verified || !verified.decodedFirebaseToken) {
        res.status(401).json({ error: 'تعذر التحقق من جلسة المصادقة.' });
        return;
      }
      const canonical = await resolveCanonicalPrincipal(verified.principal);
      const user = {
        uid: canonical.uid,
        provider: canonical.provider,
        displayName: canonical.displayName,
        email: canonical.email,
        username: canonical.username,
        avatarUrl: canonical.avatarUrl,
        role: 'manager' as const,
      };
      const sessionToken = signSessionToken(user);
      setSessionCookie(req, res, sessionToken, body.rememberMe !== false);
      res.json({ token: sessionToken, user });
    } catch {
      res.status(401).json({ error: 'تعذر تثبيت الجلسة السحابية.' });
    }
  });

  app.post('/api/auth/link-username', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      const body = (req.body || {}) as { username?: string; password?: string };
      const username = String(body.username || '').trim().toLowerCase();
      if (!/^[a-zA-Z0-9_.\-]{3,32}$/.test(username)) {
        res.status(400).json({
          error: 'اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا إنجليزيًا أو أرقامًا.',
        });
        return;
      }
      const passwordHash =
        typeof body.password === 'string' && body.password.length >= 6
          ? hashPassword(body.password)
          : undefined;

      if (isSqlDatabaseConfigured()) {
        const result = await linkSqlUsernameToUid({
          uid: principal.uid,
          username,
          passwordHash,
        });
        if (!result.ok) {
          res.status(result.status).json({ error: result.error });
          return;
        }
        const safeProvider: AuthProviderType =
          result.user.authProvider === 'google' ||
          result.user.authProvider === 'github' ||
          result.user.authProvider === 'username'
            ? result.user.authProvider
            : principal.provider;
        const updatedUser = {
          uid: result.user.uid,
          provider: safeProvider,
          displayName: result.user.displayName,
          email: result.user.email && !result.user.email.endsWith('.local') ? result.user.email : undefined,
          username: result.user.username || undefined,
          githubId: result.user.githubId || principal.githubId,
          avatarUrl: result.user.avatarUrl || undefined,
          role: (result.user.role as 'manager' | 'viewer') || 'manager',
        };
        const token = signSessionToken(updatedUser);
        setSessionCookie(req, res, token, true);
        res.json({ token, user: updatedUser });
        return;
      }

      const localResult = linkLocalUsername({
        uid: principal.uid,
        username,
        passwordHash,
      });
      if (!localResult.ok) {
        res.status(localResult.status).json({ error: localResult.error });
        return;
      }
      const updatedUser = {
        uid: localResult.user.uid,
        provider: localResult.user.authProvider,
        displayName: localResult.user.displayName,
        email: localResult.user.email || undefined,
        username: localResult.user.username || undefined,
        avatarUrl: localResult.user.avatarUrl || undefined,
        role: localResult.user.role,
      };
      const token = signSessionToken(updatedUser);
      setSessionCookie(req, res, token, true);
      res.json({ token, user: updatedUser });
    } catch {
      res.status(500).json({ error: 'تعذر ربط اسم المستخدم حالياً.' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/google-quick', (_req: Request, res: Response) => {
    res.status(403).json({
      error:
        'تم إيقاف الدخول السريع غير المتحقق حفاظاً على أمان الحسابات. يرجى المتابعة عبر Google أو إدخال البريد وكلمة المرور.',
    });
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        mode?: 'auto' | 'google' | 'username';
        identifier?: string;
      };
      const rawIdentifier = String(body.identifier || '').trim();
      if (!consumeAuthRateLimit(req, 'forgot', 8, 10 * 60 * 1000, rawIdentifier.toLowerCase())) {
        res.status(429).json({ error: 'تم إرسال طلبات استعادة كثيرة، انتظر قليلاً.' });
        return;
      }
      if (!rawIdentifier) {
        res.status(400).json({ error: 'يرجى إدخال معرف الحساب أولاً.' });
        return;
      }

      const { user: found } = await resolveAutoIdentifierLookup(body.mode, rawIdentifier);

      if (!found) {
        res.status(404).json({ error: 'لم يتم العثور على حساب مطابق لهذه البيانات.' });
        return;
      }

      const code = String(crypto.randomInt(100000, 999999));
      pendingPasswordResets.set(found.uid, {
        uid: found.uid,
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        attempts: 0,
      });

      const cleanEmail =
        found.email && !found.email.endsWith('.local') ? found.email : null;
      const maskedTarget =
        cleanEmail || found.username || found.displayName;

      res.json({
        ok: true,
        maskedTarget,
        demoCode: !isProduction ? code : undefined,
      });
    } catch {
      res.status(500).json({ error: 'تعذر إرسال رمز الاستعادة حالياً.' });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        mode?: 'auto' | 'google' | 'username';
        identifier?: string;
        code?: string;
        newPassword?: string;
        rememberMe?: boolean;
      };
      const rawIdentifier = String(body.identifier || '').trim();
      if (!consumeAuthRateLimit(req, 'reset', 10, 10 * 60 * 1000, rawIdentifier.toLowerCase())) {
        res.status(429).json({ error: 'تم تجاوز عدد محاولات إعادة التعيين المسموح.' });
        return;
      }
      const code = String(body.code || '').trim();
      const newPassword = String(body.newPassword || '');

      if (newPassword.length < 6) {
        res
          .status(400)
          .json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.' });
        return;
      }

      const { user: found } = await resolveAutoIdentifierLookup(body.mode, rawIdentifier);

      if (!found) {
        res.status(404).json({ error: 'لم يتم العثور على الحساب المطلوب.' });
        return;
      }

      const pending = pendingPasswordResets.get(found.uid);
      if (!pending || Date.now() > pending.expiresAt) {
        pendingPasswordResets.delete(found.uid);
        res
          .status(400)
          .json({ error: 'انتهت صلاحية رمز الاستعادة، اطلب رمزاً جديداً.' });
        return;
      }
      if (pending.attempts >= 5) {
        pendingPasswordResets.delete(found.uid);
        res.status(429).json({ error: 'تم تجاوز عدد المحاولات المسموح.' });
        return;
      }
      if (pending.code !== code) {
        pending.attempts += 1;
        res.status(401).json({ error: 'رمز التحقق غير صحيح.' });
        return;
      }

      pendingPasswordResets.delete(found.uid);
      const nextHash = hashPassword(newPassword);
      const updated = isSqlDatabaseConfigured()
        ? await updateSqlUserPasswordHash(found.uid, nextHash)
        : updateUserPasswordHash(found.uid, nextHash);
      if (!updated) {
        res.status(500).json({ error: 'تعذر تحديث كلمة المرور.' });
        return;
      }

      const cleanEmail =
        updated.email && !updated.email.endsWith('.local') ? updated.email : undefined;
      const safeProvider: AuthProviderType =
        updated.authProvider === 'google' || updated.authProvider === 'github'
          ? updated.authProvider
          : 'username';
      const user = {
        uid: updated.uid,
        provider: safeProvider,
        displayName: updated.displayName,
        email: cleanEmail,
        username: updated.username || undefined,
        githubId: 'githubId' in updated && updated.githubId ? updated.githubId : undefined,
        avatarUrl: updated.avatarUrl || undefined,
        role: (updated.role as 'manager' | 'viewer') || 'manager',
      };
      const token = signSessionToken(user);
      setSessionCookie(req, res, token, body.rememberMe !== false);
      res.json({ token, user });
    } catch {
      res.status(500).json({ error: 'تعذر إعادة تعيين كلمة المرور حالياً.' });
    }
  });

  app.get('/api/auth/github/url', (req: Request, res: Response) => {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    const callbackUrl = getGithubCallbackUrl(req);
    const rememberMe = req.query.rememberMe !== '0' && req.query.rememberMe !== 'false';

    if (!clientId || !clientSecret) {
      res.status(503).json({
        configured: false,
        callbackUrl,
        error:
          'تسجيل الدخول عبر GitHub غير مفعّل بعد؛ يرجى إضافة GITHUB_CLIENT_ID و GITHUB_CLIENT_SECRET في إعدادات البيئة.',
      });
      return;
    }

    const state = signGithubOAuthState(rememberMe);
    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
    authorizeUrl.searchParams.set('scope', 'read:user user:email');
    authorizeUrl.searchParams.set('state', state);

    res.json({
      configured: true,
      url: authorizeUrl.toString(),
      callbackUrl,
    });
  });

  app.get(['/auth/callback', '/auth/callback/'], async (req: Request, res: Response) => {
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
    const oauthErrorDesc =
      typeof req.query.error_description === 'string' ? req.query.error_description : '';
    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';

    if (oauthError) {
      const msg = oauthErrorDesc || 'تم إلغاء تسجيل الدخول عبر GitHub أو رفض الصلاحية.';
      res.status(400).send(
        renderGithubCallbackHtml({
          ok: false,
          title: 'تعذر تسجيل الدخول عبر GitHub',
          subtitle: msg,
          message: { type: 'GITHUB_AUTH_ERROR', error: msg },
        })
      );
      return;
    }

    const stateCheck = verifyGithubOAuthState(state);
    if (!code || !stateCheck.valid) {
      const msg = 'انتهت صلاحية جلسة التحقق أو أن رمز المصادقة غير صالح.';
      res.status(400).send(
        renderGithubCallbackHtml({
          ok: false,
          title: 'رمز تحقق غير صالح',
          subtitle: msg,
          message: { type: 'GITHUB_AUTH_ERROR', error: msg },
        })
      );
      return;
    }

    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      const msg = 'إعدادات GitHub OAuth غير مكتملة على الخادم.';
      res.status(503).send(
        renderGithubCallbackHtml({
          ok: false,
          title: 'GitHub OAuth غير مفعّل',
          subtitle: msg,
          message: { type: 'GITHUB_AUTH_ERROR', error: msg },
        })
      );
      return;
    }

    try {
      const callbackUrl = getGithubCallbackUrl(req);
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Morrow-App',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(
          tokenData.error_description || tokenData.error || 'تعذر الحصول على رمز الوصول من GitHub.'
        );
      }

      const ghHeaders = {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Morrow-App',
      };

      const userRes = await fetch('https://api.github.com/user', {
        headers: ghHeaders,
        signal: AbortSignal.timeout(10000),
      });
      if (!userRes.ok) {
        throw new Error('تعذر جلب بيانات حساب GitHub.');
      }
      const ghUser = (await userRes.json()) as {
        id: number;
        login?: string;
        name?: string | null;
        email?: string | null;
        avatar_url?: string | null;
      };

      let verifiedEmail: string | undefined =
        ghUser.email && ghUser.email.includes('@') ? ghUser.email.toLowerCase() : undefined;
      try {
        const emailsRes = await fetch('https://api.github.com/user/emails', {
          headers: ghHeaders,
          signal: AbortSignal.timeout(8000),
        });
        if (emailsRes.ok) {
          const emailRows = (await emailsRes.json()) as Array<{
            email?: string;
            primary?: boolean;
            verified?: boolean;
          }>;
          const primaryVerified = emailRows.find((e) => e.primary && e.verified && e.email);
          const anyVerified = emailRows.find((e) => e.verified && e.email);
          const chosen = primaryVerified?.email || anyVerified?.email;
          if (chosen) verifiedEmail = chosen.toLowerCase();
        }
      } catch {
        // user:email endpoint fallback keeps ghUser.email if available
      }

      const githubId = String(ghUser.id);
      const loginName = ghUser.login ? String(ghUser.login).trim().toLowerCase() : undefined;
      const displayName = String(ghUser.name || ghUser.login || 'مستخدم GitHub')
        .trim()
        .slice(0, 80);

      const canonical = await resolveCanonicalPrincipal({
        uid: `gh_${githubId}`,
        provider: 'github',
        githubId,
        displayName,
        email: verifiedEmail,
        username: loginName,
        avatarUrl: typeof ghUser.avatar_url === 'string' ? ghUser.avatar_url : undefined,
      });

      const user = {
        uid: canonical.uid,
        provider: canonical.provider,
        displayName: canonical.displayName,
        email: canonical.email,
        username: canonical.username,
        githubId: canonical.githubId || githubId,
        avatarUrl: canonical.avatarUrl,
        role: 'manager' as const,
      };
      const sessionToken = signSessionToken(user);
      setSessionCookie(req, res, sessionToken, stateCheck.rememberMe);

      res.status(200).send(
        renderGithubCallbackHtml({
          ok: true,
          title: `مرحباً ${user.displayName}`,
          subtitle: 'تم تسجيل الدخول عبر GitHub بنجاح، جارٍ إعادتك إلى Morrow...',
          message: {
            type: 'GITHUB_AUTH_SUCCESS',
            payload: { token: sessionToken, user },
          },
        })
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'تعذر إكمال المصادقة عبر GitHub حالياً.';
      res.status(500).send(
        renderGithubCallbackHtml({
          ok: false,
          title: 'فشلت المصادقة عبر GitHub',
          subtitle: msg,
          message: { type: 'GITHUB_AUTH_ERROR', error: msg },
        })
      );
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      if (isSqlDatabaseConfigured()) {
        const sqlUser = await getSqlUserByUid(principal.uid);
        const cleanEmail =
          sqlUser?.email && !sqlUser.email.endsWith('.local')
            ? sqlUser.email
            : principal.email;
        const safeProvider: AuthProviderType =
          sqlUser?.authProvider === 'google' ||
          sqlUser?.authProvider === 'github' ||
          sqlUser?.authProvider === 'username'
            ? sqlUser.authProvider
            : principal.provider;
        res.json({
          user: {
            uid: principal.uid,
            provider: safeProvider,
            displayName: sqlUser?.displayName || principal.displayName,
            email: cleanEmail,
            username: sqlUser?.username || principal.username,
            githubId: sqlUser?.githubId || principal.githubId,
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
          githubId: dbUser?.githubId || principal.githubId,
          avatarUrl: dbUser?.avatarUrl || principal.avatarUrl,
          role: dbUser?.role || 'manager',
        },
      });
    } catch (err) {
      console.error('Failed to load profile:', err);
      res.status(500).json({ error: 'تعذر جلب بيانات الحساب.' });
    }
  });

  function getIntelligentAmbience(hourValue?: number) {
    const hour =
      typeof hourValue === 'number' && Number.isFinite(hourValue)
        ? Math.max(0, Math.min(23, Math.floor(hourValue)))
        : new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return {
        period: 'morning' as const,
        greeting: 'صباح الإشراق والتركيز',
        sub: 'سجّل الدخول للمتابعة إلى مساحتك الخاصة',
        glow_primary: '#f5d061',
        glow_secondary: 'rgba(245, 208, 97, 0.28)',
        chord: [261.63, 329.63, 392.0, 493.88],
      };
    }
    if (hour >= 12 && hour < 18) {
      return {
        period: 'afternoon' as const,
        greeting: 'أهلاً بك في مساحتك',
        sub: 'سجّل الدخول للمتابعة إلى حسابك',
        glow_primary: '#e5b842',
        glow_secondary: 'rgba(229, 184, 66, 0.25)',
        chord: [293.66, 349.23, 440.0, 523.25],
      };
    }
    return {
      period: 'night' as const,
      greeting: 'مساء الهدوء والإنجاز',
      sub: 'اسحب الخيط لإنارة مساحتك والمتابعة',
      glow_primary: '#d4af37',
      glow_secondary: 'rgba(212, 175, 55, 0.32)',
      chord: [220.0, 261.63, 329.63, 392.0],
    };
  }

  app.get('/api/context', (req: Request, res: Response) => {
    const sound = getSoundSettings();
    const rawHour = req.query.hour;
    const parsedHour =
      typeof rawHour === 'string' && rawHour.trim() !== ''
        ? Number(rawHour)
        : undefined;
    res.json({
      sound_enabled: sound.soundEnabled,
      volume: sound.volume,
      ambience: getIntelligentAmbience(parsedHour),
    });
  });

  app.post('/api/settings/sound', requireAuth, (req: AuthRequest, res: Response) => {
    const body = (req.body || {}) as {
      sound_enabled?: unknown;
      volume?: unknown;
    };
    if (typeof body.sound_enabled !== 'boolean') {
      res.status(400).json({
        error: 'قيمة إعداد الصوت غير صالحة.',
      });
      return;
    }
    const nextVolume =
      typeof body.volume === 'number' && Number.isFinite(body.volume)
        ? Math.max(0, Math.min(1, body.volume))
        : undefined;
    const saved = saveSoundSettings({
      soundEnabled: body.sound_enabled,
      volume: nextVolume,
    });
    res.json({
      status: 'ok',
      sound_enabled: saved.soundEnabled,
      volume: saved.volume,
    });
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
        const safeProvider: AuthProviderType =
          updated.authProvider === 'google' ||
          updated.authProvider === 'github' ||
          updated.authProvider === 'username'
            ? updated.authProvider
            : principal.provider;
        res.json({
          user: {
            uid: updated.uid,
            provider: safeProvider,
            displayName: updated.displayName,
            email: updated.email,
            username: principal.username,
            githubId: updated.githubId || principal.githubId,
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
        const prefsRow = await getSqlUserPreferences(principal.uid);
        if (!snap) {
          res.json({ exists: false, snapshot: null, storageMode: 'cloud_sql' });
          return;
        }
        const parsedSnap = JSON.parse(snap.snapshotJson);
        if (prefsRow?.preferencesJson) {
          try {
            parsedSnap.smartPreferences = {
              ...(parsedSnap.smartPreferences || {}),
              ...JSON.parse(prefsRow.preferencesJson),
            };
          } catch {
            // ignore malformed stored prefs
          }
        }
        res.json({
          exists: true,
          snapshot: parsedSnap,
          updatedAt: snap.clientUpdatedAt || snap.updatedAt,
          version: snap.version || 1,
          storageMode: 'cloud_sql',
        });
        return;
      }

      const userRec = findUserByUid(principal.uid);
      if (!userRec) {
        res.json({ exists: false, snapshot: null, storageMode: 'local_fallback' });
        return;
      }
      const snap = getWorkspaceSnapshot(userRec.id);
      const prefsRow = getLocalUserPreferences(userRec.id);
      if (!snap) {
        res.json({ exists: false, snapshot: null, storageMode: 'local_fallback' });
        return;
      }
      const parsedSnap = JSON.parse(snap.snapshotJson);
      if (prefsRow?.preferencesJson) {
        try {
          parsedSnap.smartPreferences = {
            ...(parsedSnap.smartPreferences || {}),
            ...JSON.parse(prefsRow.preferencesJson),
          };
        } catch {
          // ignore malformed stored prefs
        }
      }
      res.json({
        exists: true,
        snapshot: parsedSnap,
        updatedAt: snap.clientUpdatedAt || snap.updatedAt,
        version: snap.version || 1,
        storageMode: 'local_fallback',
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
        snapshot?: {
          agencies?: unknown[];
          persons?: unknown[];
          updatedAt?: string;
          deviceId?: string;
          smartPreferences?: unknown;
        };
        clientUpdatedAt?: string;
        deviceId?: string;
        force?: boolean;
      };
      if (
        !body.snapshot ||
        !Array.isArray(body.snapshot.agencies) ||
        !Array.isArray(body.snapshot.persons)
      ) {
        res.status(400).json({ error: 'بيانات مساحة العمل غير صالحة.' });
        return;
      }

      const clientUpdatedAt =
        String(body.clientUpdatedAt || body.snapshot.updatedAt || '').trim() ||
        new Date().toISOString();
      const deviceId = String(body.deviceId || body.snapshot.deviceId || 'web').slice(0, 64);
      const snapshotJson = JSON.stringify(body.snapshot);

      if (isSqlDatabaseConfigured()) {
        const outcome = await syncSqlWorkspaceWithLww({
          uid: principal.uid,
          email: principal.email || `${principal.uid}@tabrex.local`,
          displayName: principal.displayName,
          authProvider: principal.provider,
          snapshotJson,
          recordCount: body.snapshot.persons.length,
          agencyCount: body.snapshot.agencies.length,
          clientUpdatedAt,
          deviceId,
          force: Boolean(body.force),
        });
        if (body.snapshot.smartPreferences && !outcome.conflictResolved) {
          await saveSqlUserPreferences(
            principal.uid,
            principal.email || `${principal.uid}@tabrex.local`,
            JSON.stringify(body.snapshot.smartPreferences)
          );
        }
        res.json({
          ok: true,
          conflictResolved: outcome.conflictResolved,
          winner: outcome.winner,
          snapshot:
            outcome.conflictResolved && outcome.winner === 'server'
              ? JSON.parse(outcome.snapshot.snapshotJson)
              : undefined,
          updatedAt: outcome.snapshot.clientUpdatedAt || outcome.snapshot.updatedAt,
          version: outcome.snapshot.version,
          storageMode: 'cloud_sql',
        });
        return;
      }

      let userRec = findUserByUid(principal.uid);
      if (!userRec) {
        userRec = resolveOrCreateLocalCanonicalUser({
          uid: principal.uid,
          authProvider: principal.provider,
          displayName: principal.displayName,
          email: principal.email ?? null,
          username: principal.username ?? null,
          avatarUrl: principal.avatarUrl ?? null,
        });
      }
      const outcome = syncLocalWorkspaceWithLww({
        userId: userRec.id,
        snapshotJson,
        recordCount: body.snapshot.persons.length,
        agencyCount: body.snapshot.agencies.length,
        clientUpdatedAt,
        deviceId,
        force: Boolean(body.force),
      });
      if (body.snapshot.smartPreferences && !outcome.conflictResolved) {
        saveLocalUserPreferences(
          userRec.id,
          JSON.stringify(body.snapshot.smartPreferences)
        );
      }
      res.json({
        ok: true,
        conflictResolved: outcome.conflictResolved,
        winner: outcome.winner,
        snapshot:
          outcome.conflictResolved && outcome.winner === 'server'
            ? JSON.parse(outcome.snapshot.snapshotJson)
            : undefined,
        updatedAt: outcome.snapshot.clientUpdatedAt || outcome.snapshot.updatedAt,
        version: outcome.snapshot.version,
        storageMode: 'local_fallback',
      });
    } catch (err) {
      console.error('Failed to save workspace snapshot:', err);
      res.status(500).json({ error: 'تعذر حفظ نسخة مساحة العمل.' });
    }
  });

  app.post('/api/workspace/sync-ops', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      const body = (req.body || {}) as {
        operations?: Array<{
          id?: string;
          type?: string;
          entity?: string;
          summary?: string;
          updatedAt?: string;
          deviceId?: string;
        }>;
        auditEvents?: Array<{
          id?: string;
          actionType?: string;
          title?: string;
          summary?: string;
          deviceId?: string;
          timestamp?: string;
        }>;
      };
      const ops = Array.isArray(body.operations) ? body.operations.slice(0, 60) : [];
      const audits = Array.isArray(body.auditEvents) ? body.auditEvents.slice(0, 60) : [];
      const mergedEvents = [
        ...audits.map((ev) => ({
          eventId: String(ev.id || crypto.randomUUID()),
          actionType: String(ev.actionType || 'data_mutation'),
          title: String(ev.title || 'تحديث سجل'),
          summary: String(ev.summary || ''),
          deviceId: String(ev.deviceId || 'web'),
          createdAt: ev.timestamp,
        })),
        ...ops.map((op) => ({
          eventId: `op_${String(op.id || crypto.randomUUID())}`,
          actionType: String(op.type || 'sync_op'),
          title: String(op.entity || 'مزامنة'),
          summary: String(op.summary || ''),
          deviceId: String(op.deviceId || 'web'),
          createdAt: op.updatedAt,
        })),
      ];

      if (isSqlDatabaseConfigured()) {
        await appendSqlAuditEvents(
          principal.uid,
          principal.email || `${principal.uid}@tabrex.local`,
          mergedEvents
        );
      } else {
        const userRec =
          findUserByUid(principal.uid) ||
          resolveOrCreateLocalCanonicalUser({
            uid: principal.uid,
            authProvider: principal.provider,
            displayName: principal.displayName,
            email: principal.email ?? null,
          });
        appendLocalAuditEvents(userRec.id, mergedEvents);
      }

      res.json({
        ok: true,
        syncedIds: ops.map((o) => o.id).filter(Boolean),
        syncedAt: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: 'تعذر معالجة قائمة انتظار المزامنة.' });
    }
  });

  app.get('/api/workspace/audit-log', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const principal = req.principal!;
      if (isSqlDatabaseConfigured()) {
        const events = await listSqlAuditEvents(principal.uid, 60);
        res.json({ events });
        return;
      }
      const userRec = findUserByUid(principal.uid);
      if (!userRec) {
        res.json({ events: [] });
        return;
      }
      res.json({ events: listLocalAuditEvents(userRec.id, 60) });
    } catch {
      res.status(500).json({ error: 'تعذر جلب سجل التدقيق.' });
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

  const resolvePreferredChainFromRequest = (
    taskKey: AiTaskKey,
    body?: { preferredChain?: unknown; taskRouting?: unknown }
  ): ApprovedCloudModelId[] | undefined => {
    if (Array.isArray(body?.preferredChain) && body.preferredChain.length > 0) {
      const cleaned = body.preferredChain
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((m) => sanitizeAiModelId(m));
      if (cleaned.length > 0) {
        return Array.from(new Set(cleaned));
      }
    }
    if (body?.taskRouting && typeof body.taskRouting === 'object') {
      return resolveOrderedTaskChain(
        taskKey,
        body.taskRouting as Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>>
      ).cloudChain;
    }
    return undefined;
  };

  // --- Quick Extract Header Metadata Inference (Vision AI) ---

  app.post('/api/quick-extract/metadata-inference', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const body = (req.body || {}) as {
        filename?: string;
        mimeType?: string;
        base64Pdf?: string;
        imageDataUrl?: string;
        frames?: Array<{ mimeType?: string; data?: string; label?: string }>;
        rawText?: string;
        preferredChain?: string[];
        taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>>;
      };

      const filename = String(body.filename || '').trim().slice(0, 180);
      const rawText = String(body.rawText || '').trim().slice(0, 6000);
      const localFallback = inferMetadataFromText(rawText, [], filename);

      const attachments: OrchestratorAttachmentPart[] = [];

      if (body.base64Pdf) {
        const cleanPdf = String(body.base64Pdf)
          .replace(/^data:application\/pdf;base64,/, '')
          .trim();
        if (cleanPdf) {
          attachments.push({ kind: 'pdf', mimeType: 'application/pdf', data: cleanPdf, filename });
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
          attachments.push({ kind: 'image', mimeType, data: cleanImg });
        }
      } else if (body.imageDataUrl) {
        const mimeMatch = String(body.imageDataUrl).match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const cleanImg = String(body.imageDataUrl)
          .replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
          .trim();
        if (cleanImg) {
          attachments.push({
            kind: 'image',
            mimeType: mimeMatch?.[1] || 'image/jpeg',
            data: cleanImg,
          });
        }
      }

      if (attachments.length === 0 && !rawText) {
        res.json({ ok: true, metadata: localFallback });
        return;
      }

      const statusSnap = getOrchestrationStatusSnapshot();
      if (!statusSnap.providers.google && !statusSnap.providers.openrouter) {
        res.json({
          ok: true,
          metadata: localFallback
            ? { ...localFallback, executedModelId: 'morrow-local', executedProvider: 'local' }
            : null,
        });
        return;
      }

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

      const hasVisualSource = attachments.some(
        (a) => a.kind === 'pdf' || a.kind === 'image'
      );
      const orch = await executeWithFallback({
        pipeline: hasVisualSource ? 'heavy_extraction' : 'fast_assistant',
        preferredChain: resolvePreferredChainFromRequest(
          hasVisualSource ? 'heavy_pdf_vision' : 'fast_copilot_actions',
          body
        ),
        attachments,
        promptText: `اقرأ ترويسة الجدول فقط من المصدر المرفق (${filename || 'document'})${
          rawText ? `\nعينة النص:\n${rawText.slice(0, 1800)}` : ''
        } واستخرج: اسم الوكالة، الشهر، السنة، رقم المركز/الوكالة إن وجد، وعناوين الأعمدة الظاهرة.`,
        systemInstruction:
          'أنت محلل ترويسات جداول وكالات الكمية الغذائية بدقة عالية. استخرج اسم الوكالة والشهر والسنة وعناوين الأعمدة كما هي في الترويسة فقط بصيغة JSON دون تخمين غير موجود.',
        responseMimeType: 'application/json',
        responseSchema: metadataSchema,
        temperature: 0.1,
      });

      if (!orch.ok) {
        res.json({
          ok: true,
          metadata: localFallback
            ? {
                ...localFallback,
                fallbackUsed: true,
                executedModelId: 'morrow-local',
                executedProvider: 'local',
                executedModelLabel: 'Morrow المحلي (استنتاج احتياطي)',
              }
            : null,
          fallbackUsed: true,
          modelId: 'morrow-local',
        });
        return;
      }

      const parsed = JSON.parse(String(orch.text || '{}')) as {
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
        fallbackUsed: orch.fallbackUsed,
        executedModelId: orch.modelId,
        executedProvider: orch.provider,
        executedModelLabel: orch.modelLabel,
        confirmedByUser: false,
      };

      res.json({
        ok: true,
        metadata,
        fallbackUsed: orch.fallbackUsed,
        modelId: orch.modelId,
        provider: orch.provider,
        modelLabel: orch.modelLabel,
      });
    } catch {
      const body = (req.body || {}) as { filename?: string; rawText?: string };
      res.json({
        ok: true,
        metadata: inferMetadataFromText(String(body.rawText || ''), [], body.filename),
        fallbackUsed: true,
        modelId: 'morrow-local',
      });
    }
  });

  // --- Quick Extract ("السحب السريع") PDF & Camera Burst Extraction Endpoint ---

  app.post('/api/quick-extract', requireAuth, async (req: AuthRequest, res: Response) => {
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
        preferredChain?: string[];
        taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>>;
      };

      const mode = body.mode === 'camera_burst' ? 'camera_burst' : 'pdf';
      const scanMode = body.scanMode === 'fast' ? 'fast' : 'audit';
      const focusedFields =
        Array.isArray(body.focusedFields) && body.focusedFields.length > 0
          ? body.focusedFields
          : (['name', 'individuals', 'decreaseCount', 'addOrDelete'] as const);
      const focusSet = new Set(focusedFields);

      const contentParts: OrchestratorAttachmentPart[] = [];

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
            kind: 'image',
            mimeType: refMime,
            data: refCleanB64,
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
            kind: 'text',
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
          kind: 'pdf',
          mimeType: 'application/pdf',
          data: rawBase64,
          filename: body.filename || 'document.pdf',
        });
        contentParts.push({
          kind: 'text',
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
            kind: 'image',
            mimeType,
            data: cleanB64,
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
          kind: 'text',
          text: `هذه لقطات متتالية (Burst Fusion: ${frameCountAttached} إطارات لنفس صفحة الدفتر اليدوي). ${body.enhancementReport || ''} ادمج المعلومات البصرية عبر جميع الزوايا واستخرج الحقول المحددة فقط (${focusedFields.join('، ')})، مع تحديد إحداثيات مربع القص suspectBox (من 0 إلى 1000) لأي اسم أو صف يحتاج مراجعة.`,
        });
      }

      const orchSnap = getOrchestrationStatusSnapshot();
      if (!orchSnap.providers.google && !orchSnap.providers.openrouter) {
        res.status(503).json({
          error:
            'مفاتيح الذكاء السحابي (GEMINI_API_KEY / OPENROUTER_API_KEY) غير مهيأة على الخادم لتشغيل محرك السحب السريع.',
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

      const orch = await executeWithFallback({
        pipeline: 'heavy_extraction',
        preferredChain: resolvePreferredChainFromRequest('heavy_pdf_vision', body),
        attachments: contentParts,
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: extractionSchema,
        timeoutMs: 28000,
      });

      if (!orch.ok) {
        const transient = orch.hadRateLimitOrTimeout;
        res.status(transient ? 503 : 500).json({
          temporaryBusy: transient,
          friendlyNotice: transient
            ? 'خوادم القراءة تشهد ضغطاً مؤقتاً — جاري إعادة المحاولة عبر المسار البديل...'
            : orch.errorSummary || 'تعذر إتمام قراءة هذا المستند حالياً.',
          error: orch.errorSummary || 'تعذر تحليل المستند.',
          attempts: orch.attempts,
        });
        return;
      }

      const parsed = JSON.parse(orch.text || '{}') as {
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
            fallbackUsed: orch.fallbackUsed,
            executedModelId: orch.modelId,
            executedProvider: orch.provider,
            executedModelLabel: orch.modelLabel,
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
        fallbackUsed: orch.fallbackUsed,
        executedModelId: orch.modelId,
        executedProvider: orch.provider,
        executedModelLabel: orch.modelLabel,
        modelId: orch.modelId,
        provider: orch.provider,
        modelLabel: orch.modelLabel,
        attempts: orch.attempts,
        resilienceNotice: orch.fallbackUsed
          ? `تمت المعالجة بنجاح عبر المسار الاحتياطي (${orch.modelId}) لضمان الاستمرارية.`
          : `تمت القراءة عبر النموذج الأساسي (${orch.modelId}).`,
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

  app.post('/api/ucrs/analyze', requireAuth, async (req: AuthRequest, res: Response) => {
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
        preferredChain?: string[];
        taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>>;
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

      const orchSnap = getOrchestrationStatusSnapshot();
      if (!orchSnap.providers.google && !orchSnap.providers.openrouter) {
        res.status(503).json({
          error:
            'مفاتيح الذكاء السحابي (GEMINI_API_KEY / OPENROUTER_API_KEY) غير مهيأة على الخادم لتشغيل منظومة القراءة الكونية.',
        });
        return;
      }

      const contentParts: OrchestratorAttachmentPart[] = [];

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
          contentParts.push({ kind: 'image', mimeType: refMime, data: refCleanB64 });
          const regionsText = Array.isArray(body.referenceTemplate.regions)
            ? body.referenceTemplate.regions
                .map(
                  (r) =>
                    `- ${r.label} (${r.field}): ymin=${r.box.ymin}, xmin=${r.box.xmin}, ymax=${r.box.ymax}, xmax=${r.box.xmax}`
                )
                .join('\n')
            : '';
          contentParts.push({
            kind: 'text',
            text: `الصورة الأولى هي النموذج المرجعي (${body.referenceTemplate.name || 'دفتر الوكالة'}):\n${regionsText}`,
          });
        }
      }

      let attachedInput = false;
      let hasBinaryVisionOrPdf = false;

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
          kind: 'pdf',
          mimeType: 'application/pdf',
          data: rawBase64,
          filename: body.filename || 'document.pdf',
        });
        attachedInput = true;
        hasBinaryVisionOrPdf = true;
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
          contentParts.push({ kind: 'image', mimeType, data: cleanB64 });
          attachedInput = true;
          hasBinaryVisionOrPdf = true;
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
          kind: 'text',
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

      contentParts.push({ kind: 'text', text: intentPrompt });

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

      const ucrsPipeline: AiPipelineKind =
        !hasBinaryVisionOrPdf &&
        (body.sourceKind === 'excel' ||
          body.sourceKind === 'csv' ||
          body.sourceKind === 'word' ||
          body.sourceKind === 'text')
          ? 'data_processing'
          : 'heavy_extraction';

      const orch = await executeWithFallback({
        pipeline: ucrsPipeline,
        preferredChain: resolvePreferredChainFromRequest(
          ucrsPipeline === 'data_processing'
            ? 'structured_excel_csv'
            : 'heavy_pdf_vision',
          body
        ),
        attachments: contentParts,
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: ucrsSchema,
        timeoutMs: 28000,
      });

      if (!orch.ok) {
        const transient = orch.hadRateLimitOrTimeout;
        res.status(transient ? 503 : 500).json({
          temporaryBusy: transient,
          friendlyNotice: transient
            ? 'خوادم القراءة مشغولة حالياً — جاري المعالجة عبر المسار البديل...'
            : orch.errorSummary || 'تعذر إتمام القراءة حالياً.',
          error: orch.errorSummary || 'تعذر تشغيل منظومة القراءة الكونية.',
          attempts: orch.attempts,
        });
        return;
      }

      const parsed = JSON.parse(orch.text || '{}') as {
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
            fallbackUsed: orch.fallbackUsed,
            executedModelId: orch.modelId,
            executedProvider: orch.provider,
            executedModelLabel: orch.modelLabel,
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
            : 25,
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
        fallbackUsed: orch.fallbackUsed,
        executedModelId: orch.modelId,
        executedProvider: orch.provider,
        executedModelLabel: orch.modelLabel,
        modelId: orch.modelId,
        provider: orch.provider,
        modelLabel: orch.modelLabel,
        attempts: orch.attempts,
        resilienceNotice: orch.fallbackUsed
          ? `تمت القراءة عبر المسار الاحتياطي (${orch.modelId}) تلقائياً لضمان الاستمرارية.`
          : `تمت القراءة عبر النموذج المختص (${orch.modelId}).`,
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

  app.post('/api/ucrs/tts', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const body = (req.body || {}) as { text?: string };
      const text = String(body.text || '').trim().slice(0, 2000);
      if (!text) {
        res.status(400).json({ error: 'النص المطلوب قراءته صوتيًا فارغ.' });
        return;
      }

      const ai = createGoogleAiClient();
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
  app.post('/api/quick-extract/copilot', requireAuth, async (req: AuthRequest, res: Response) => {
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
      preferredChain?: string[];
      taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>>;
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
      const orchSnap = getOrchestrationStatusSnapshot();
      if (!orchSnap.providers.google && !orchSnap.providers.openrouter) {
        const local = runLocalCopilotFallback(
          message,
          Array.isArray(body.draftRows) ? body.draftRows : [],
          body.inferredMetadata
        );
        res.json({
          ...local,
          fallbackUsed: 'local',
          modelId: 'morrow-local',
          provider: 'local',
        });
        return;
      }

      const contentParts: OrchestratorAttachmentPart[] = [];
      let hasImage = false;

      if (body.sourceImageBase64) {
        const cleanB64 = String(body.sourceImageBase64)
          .replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
          .trim();
        const mimeType =
          body.sourceMimeType === 'image/png' || body.sourceMimeType === 'image/webp'
            ? body.sourceMimeType
            : 'image/jpeg';
        if (cleanB64.length > 100 && cleanB64.length < 18 * 1024 * 1024) {
          contentParts.push({ kind: 'image', mimeType, data: cleanB64 });
          hasImage = true;
        }
      }

      const historyText = Array.isArray(body.history)
        ? body.history
            .slice(-8)
            .map((h) => `${h.role === 'user' ? 'المستخدم' : 'المساعد'}: ${h.text}`)
            .join('\n')
        : '';

      contentParts.push({
        kind: 'text',
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

      const orch = await executeWithFallback({
        pipeline: hasImage ? 'heavy_extraction' : 'fast_assistant',
        preferredChain: resolvePreferredChainFromRequest(
          hasImage ? 'heavy_pdf_vision' : 'fast_copilot_actions',
          body
        ),
        attachments: contentParts,
        systemInstruction: copilotInstruction,
        responseMimeType: 'application/json',
        responseSchema: copilotSchema,
        timeoutMs: hasImage ? 18000 : 10500,
        detectComprehensionFailure: true,
      });

      if (!orch.ok) {
        const local = runLocalCopilotFallback(
          message,
          Array.isArray(body.draftRows) ? body.draftRows : [],
          body.inferredMetadata
        );
        res.json({
          ...local,
          fallbackUsed: 'local',
          modelId: 'morrow-local',
          provider: 'local',
        });
        return;
      }

      const parsed = JSON.parse(orch.text || '{}') as {
        reply?: string;
        operations?: Array<Record<string, unknown>>;
      };

      res.json({
        reply: parsed.reply || 'تمت مراجعة المسودة.',
        operations: Array.isArray(parsed.operations) ? parsed.operations : [],
        fallbackUsed: orch.fallbackUsed,
        modelId: orch.modelId,
        provider: orch.provider,
        modelLabel: orch.modelLabel,
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
        modelId: 'morrow-local',
        provider: 'local',
      });
    }
  });

  // --- Free Models + Gemini 3.8 Live + Morrow Local AI Orchestration Status & Live Probe ---
  app.get('/api/assistant/status', (_req: Request, res: Response) => {
    res.json(getOrchestrationStatusSnapshot());
  });

  app.post('/api/assistant/test-model', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const body = (req.body || {}) as {
        modelId?: string;
        backupModelId?: string;
        taskKey?: string;
        prompt?: string;
      };
      const taskKey =
        body.taskKey && body.taskKey in AI_TASK_PROFILES
          ? (body.taskKey as AiTaskKey)
          : null;
      const result = await liveTestAiModelOrTask({
        modelId: body.modelId || null,
        backupModelId: body.backupModelId || null,
        taskKey,
        prompt: body.prompt || null,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({
        ok: false,
        finalFallback: 'morrow-local',
        errorSummary:
          err instanceof Error ? err.message : 'تعذر إجراء الفحص الحي للنموذج.',
      });
    }
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

    const prefsArr = Array.isArray(cloudContext.preferences)
      ? (cloudContext.preferences as Array<Record<string, unknown>>)
      : [];
    const prefsLine =
      prefsArr.length > 0
        ? `قواعد الذاكرة الدائمة (${prefsArr.length}): ${prefsArr
            .slice(0, 15)
            .map((p) => String(p.label || p.key || ''))
            .filter(Boolean)
            .join(' | ')}`
        : '';

    const selectedAgencyInfo =
      cloudContext.selectedAgencyName
        ? `الوكالة المفتوحة حالياً: ${String(cloudContext.selectedAgencyName)} (ID:${String(cloudContext.selectedAgencyId || '')})`
        : '';
    const focusedRowInfo = cloudContext.focusedRowRef
      ? `السجل المحدد على الشاشة: ${String(cloudContext.focusedRowRef)}`
      : '';

    return [
      `الشاشة الحالية للمستخدم: ${String(cloudContext.activeView || 'hub')} | النمط: ${String(cloudContext.modeTier || 'expert')}`,
      [selectedAgencyInfo, focusedRowInfo].filter(Boolean).join(' | '),
      `الحصة الحالية: ${String(lw.periodName || 'الحصة الحالية')}`,
      `الإعدادات: رسم الفرد ${Number(lw.feePerIndividualIqd || 0)} د.ع | رسم البطاقة الثابت ${Number(lw.fixedCardFeeIqd || 0)} د.ع | كغم/فرد ${Number(lw.kgPerIndividual || 0)} | وزن الكيس ${Number(lw.kgPerBag || 50)} كغم | خصم ${Number(lw.discountPercent || 0)}%`,
      `الإجمالي الكلي: ${Number(lw.totalActiveHouseholds || 0)} عائلة نشطة (من أصل ${Number(lw.totalRegisteredHouseholds || 0)}) | ${Number(lw.totalActiveIndividuals || 0)} أفراد نشطين | محجوب ${Number(lw.totalBlockedCount || 0)} | ${Number(lw.totalFullBags || 0)} كيس | إيراد ${Number(lw.totalRevenueIqd || 0)} د.ع | مصروفات ${Number(lw.totalExpensesIqd || 0)} د.ع (${Number(lw.totalExpensesCount || 0)} قيود) | صافي الربح ${Number(lw.totalProfitIqd || 0)} د.ع`,
      topByIndividuals
        ? `أكبر وكالة بالأفراد حالياً: ${String(topByIndividuals.name || '')} (${Number(topByIndividuals.activeIndividuals || 0)} أفراد · صافي ${Number(topByIndividuals.profitIqd || 0)} د.ع)`
        : '',
      `بيانات مساندة: علاقات ${Number(lw.relationsCount || 0)} | قوائم جاهزة ${Number(lw.readyListsCount || 0)} | ملاحظات مساحة العمل ${Number(lw.workspaceNotesCount || 0)} | سلة المحذوفات ${Number(lw.recycleBinCount || 0)} | جلسات السحب ${Number(lw.ucrsSessionsCount || 0)} (قواعد تعلم: ${Number(lw.ucrsLearningRulesCount || 0)})`,
      `الأرشيفات: ${Number(lw.archivesCount || 0)}${lw.latestArchiveName ? ` (آخر أرشيف: ${String(lw.latestArchiveName)})` : ''} | ملاحظات سريعة: ${Number(lw.quickNotesCount || 0)} | مسودات معلقة: ${Number(lw.pendingDraftsCount || 0)}`,
      prefsLine,
      readyListsLine,
      agenciesList ? `تفصيل الوكالات:\n${agenciesList}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  app.post('/api/assistant/chat', requireAuth, async (req: AuthRequest, res: Response) => {
    const startedAt = Date.now();
    try {
      const body = (req.body || {}) as {
        prompt?: string;
        brainMode?: AssistantBrainMode;
        collaborationMode?: AiCollaborationMode;
        responseStyle?: AssistantResponseStyle;
        taskKey?: AiTaskKey;
        pipeline?: AiPipelineKind;
        preferredModel?: string;
        preferredChain?: string[];
        cloudContext?: Record<string, unknown>;
        cloudHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
      };

      const prompt = enforceSafeArabicTerminology(String(body.prompt || '').trim()).slice(0, 2000);
      if (!prompt) {
        res.status(400).json({ error: 'النص المطلوب للمساعد فارغ.' });
        return;
      }

      const orchStatus = getOrchestrationStatusSnapshot();
      if (!orchStatus.providers.google && !orchStatus.providers.openrouter) {
        res.status(200).json({
          ok: false,
          fallbackToOffline: true,
          statusCategory: 'offline',
          modelId: 'morrow-local',
          provider: 'local',
          reason:
            'مفاتيح السحابة (GEMINI_API_KEY / OPENROUTER_API_KEY) غير مهيأة على الخادم، تم التشغيل تلقائياً بمحرك Morrow المحلي.',
        });
        return;
      }

      const mode: AssistantBrainMode =
        body.brainMode === 'gemini_3_8_flash' ||
        body.brainMode === 'gemini_3_5_flash' ||
        body.brainMode === 'gemini_3_5_flash_lite' ||
        body.brainMode === 'nemotron_free' ||
        body.brainMode === 'openrouter_free' ||
        body.brainMode === 'local'
          ? body.brainMode
          : 'auto';

      const collaborationMode: AiCollaborationMode =
        body.collaborationMode === 'single' || body.collaborationMode === 'multi_step_agent'
          ? body.collaborationMode
          : 'council_review';

      const responseStyle: AssistantResponseStyle =
        body.responseStyle === 'concise' ||
        body.responseStyle === 'financial_auditor' ||
        body.responseStyle === 'deep_advisor'
          ? body.responseStyle
          : 'balanced';

      const styleDirective =
        responseStyle === 'concise'
          ? 'أسلوب الإجابة المطلوب: مختصر وفوري — أعطِ الخلاصة والأرقام الأساسية بنقاط قصيرة جداً دون إطالة.'
          : responseStyle === 'financial_auditor'
            ? 'أسلوب الإجابة المطلوب: مدقق مالي دقيق — ركّز على تطابق الأكياس والدينار، صافي الأرباح، المصاريف، والفروقات العددية بدقة محاسبية.'
            : responseStyle === 'deep_advisor'
              ? 'أسلوب الإجابة المطلوب: مستشار استراتيجي معمّق — قدّم تحليلاً متعدد الأبعاد، تقييماً للمخاطر، وتوصيات عملية مدعومة بسيناريوهات بديلة.'
              : 'أسلوب الإجابة المطلوب: متوازن ومهني — اجمع بين الوضوح السريع والتفاصيل العملية المفيدة.';

      const liveSummaryBlock = buildLiveWorkspaceSummaryText(body.cloudContext);
      const contextText = JSON.stringify(body.cloudContext || {}, null, 0).slice(0, 7500);
      const historyLines = Array.isArray(body.cloudHistory)
        ? body.cloudHistory
            .slice(-4)
            .map((h) => `${h.role === 'user' ? 'المستخدم' : 'المساعد'}: ${String(h.text || '').slice(0, 320)}`)
            .join('\n')
        : '';

      const systemInstruction = `أنت المساعد الذكي الشخصي «Morrow» المرتبط ارتباطاً جذرياً ومباشراً ببيانات وإجراءات تطبيق إدارة وكالات الكمية الغذائية (توزيع الطحين).
${styleDirective}
قواعدك الصارمة:
1. تحدث باللهجة العراقية المهنية الواضحة ونسّق الرد بعناوين واضحة (**نص عريض** ونقاط مرتبة) عند وجود تفصيل.
2. التزم تماماً بكلمة «الأفراد» و«أفراد» و«فرد» حصرياً في جميع الردود والتقارير عند الإشارة لعدد الأشخاص.
3. لا تكتب أوامر SQL أو كود برمجي نهائياً — اختر الأداة المناسبة من Function Calling بالوسائط الدقيقة فور طلب المستخدم:
   - لمحاكاة سيناريوهات «ماذا لو» المالية أو تغيير الرسم أو زيادة الأفراد: simulate_what_if
   - للإيجاز التنفيذي اليومي وملخص الوضع الشامل: executive_briefing
   - لحصر المحجوبين أو الحجب الجزئي أو المؤرشفين: query_status_breakdown
   - للمقارنة أو ترتيب الوكالات: compare_agencies
   - لتوقعات الحصة القادمة والمخاطر: analyze_period_forecast
   - لتشغيل ماكرو (إغلاق الشهر / جرد الصباح / كشف التوزيع): run_morrow_macro
   - لفتح اللوحة التفاعلية مباشرة على الرسوم/الجدول/التقرير/التوقعات/تحليل النصوص/الماكرو: summon_workspace_canvas
   - لحفظ ملاحظة سريعة وربطها بالعائلة: add_quick_note
   - لفك الحظر عن مستفيد: update_person مع blockType='none'
   - لنقل مستفيد بين الوكالات: update_person مع agencyId الجديد
   - لإنشاء قائمة جاهزة أو إضافة اسم لها: manage_ready_list
   - للبحث، التصفية، الإحصائيات، المصاريف، التصدير أو فحص التطبيق: استخدم أدواتها المخصصة مباشرة.
4. أي عملية تعديل أو إضافة أو أرشفة أو مصروف أو إعدادات يجب أن تُجهَّز كمسودة للموافقة فقط عبر الأداة دون تخمين بيانات ناقصة.
5. لا تقترح حذفاً نهائياً أبداً (استخدم archive_person فقط للأرشفة الآمنة).
6. استند حصرياً إلى الأرقام الحية من «ملخص البيانات الحي» المرفق أدناه ولا تخترع أي رقم أو بيانات تجريبية.
7. أقسام التطبيق الفعلية التي تعرفها وتديرها: الشاشة الرئيسية (hub)، جدول الوكالة (agency_roster)، السجل الشامل (master_roster)، القوائم الجاهزة (ready_lists)، العلاقات (relationships)، الحسابات والمالية (finance)، السحب السريع UCRS (quick_extract)، الأرشفة الشهرية (data_archives)، Google Workspace (google_workspace)، النماذج الذكية (smart_models)، مركز Morrow والذاكرة والملاحظات السريعة (morrow_center)، الحساب والبيانات والأمان (account_security)، والإعدادات والتخصيص (settings). جميع تغييرات المستخدم وإعداداته وتخصيصاته وذاكرته محفوظة تلقائياً على جهازه أولاً بأول.
${liveSummaryBlock ? `\nملخص البيانات الحي للتطبيق الآن:\n${liveSummaryBlock}\n` : ''}
سياق التطبيق الكامل (${String(body.cloudContext?.privacyMode || 'masked_no_beneficiaries')}):
${contextText}`;

      const userContent = historyLines
        ? `سجل الحوار القريب:\n${historyLines}\n\nالطلب الحالي:\n${prompt}`
        : prompt;

      const requestedPipeline: AiPipelineKind =
        body.pipeline && body.pipeline in AI_ROUTING_PIPELINES
          ? body.pipeline
          : mode === 'gemini_3_5_flash_lite' || mode === 'openrouter_free'
            ? 'fast_assistant'
            : mode === 'gemini_3_5_flash'
              ? 'data_processing'
              : 'deep_assistant';

      let preferredChain: ApprovedCloudModelId[] | undefined =
        resolvePreferredChainFromRequest('command_orchestration', body as {
          preferredChain?: unknown;
          taskRouting?: unknown;
        });
      if (!preferredChain && body.preferredModel) {
        const sanitized = sanitizeAiModelId(body.preferredModel);
        preferredChain = [sanitized, ...AI_ROUTING_PIPELINES[requestedPipeline]];
      } else if (!preferredChain && mode === 'nemotron_free') {
        preferredChain = [
          AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
          AI_FREE_MODELS.GEMINI_4_HYDROGEN,
          AI_FREE_MODELS.GEMINI_3_1_FLASH_LITE,
          AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
        ];
      } else if (!preferredChain && mode === 'openrouter_free') {
        preferredChain = [
          AI_FREE_MODELS.OPENROUTER_FREE_AUTO,
          AI_FREE_MODELS.GEMINI_4_HYDROGEN,
          AI_FREE_MODELS.OPENROUTER_NEMOTRON_VL,
          AI_FREE_MODELS.GEMINI_3_1_FLASH_LITE,
        ];
      }

      const orch = await executeCollaborativeOrchestration({
        pipeline: requestedPipeline,
        preferredChain,
        systemInstruction,
        promptText: userContent,
        tools: ASSISTANT_TOOL_DECLARATIONS,
        timeoutMs: 11500,
        detectComprehensionFailure: true,
        collaborationMode,
        taskKey:
          body.taskKey && body.taskKey in AI_TASK_PROFILES
            ? body.taskKey
            : 'command_orchestration',
        workspaceSummary: liveSummaryBlock,
        originalUserPrompt: prompt,
      });

      if (orch.ok) {
        const sanitizedToolCalls: AssistantToolCall[] = [];
        for (const tc of orch.toolCalls) {
          const checked = validateToolCall(tc);
          if (checked.valid && checked.sanitized) {
            sanitizedToolCalls.push(checked.sanitized);
          }
        }
        res.json({
          ok: true,
          engineUsed: mapModelIdToEngineSource(orch.modelId),
          modelId: orch.modelId,
          provider: orch.provider,
          fallbackUsed: orch.fallbackUsed,
          hadRateLimitOrTimeout: orch.hadRateLimitOrTimeout,
          attempts: orch.attempts,
          engineLabel: orch.modelLabel,
          text:
            orch.text ||
            (sanitizedToolCalls.length > 0
              ? 'تم فهم الطلب وتجهيز الإجراء المناسب.'
              : 'تفضل، كيف أقدر أساعدك أكثر؟'),
          toolCalls: sanitizedToolCalls,
          collaborationMode: orch.collaborationMode,
          collaborationTrace: orch.collaborationTrace,
          suggestedFollowUps: orch.suggestedFollowUps,
          recommendedCanvasMode: orch.recommendedCanvasMode,
          latencyMs: Date.now() - startedAt,
        });
        return;
      }

      res.status(200).json({
        ok: false,
        fallbackToOffline: true,
        quotaExhausted: orch.hadRateLimitOrTimeout,
        statusCategory: orch.hadRateLimitOrTimeout ? 'quota_exhausted' : 'offline',
        modelId: 'morrow-local',
        provider: 'local',
        attempts: orch.attempts,
        reason: orch.hadRateLimitOrTimeout
          ? 'وصلت النماذج السحابية للحد المؤقت — تم التحويل تلقائياً إلى محرك Morrow المحلي.'
          : 'تعذر الوصول للنماذج السحابية حالياً — تم التحويل تلقائياً إلى محرك Morrow المحلي.',
      });
    } catch {
      res.status(200).json({
        ok: false,
        fallbackToOffline: true,
        statusCategory: 'offline',
        modelId: 'morrow-local',
        provider: 'local',
        reason: 'تعذر الاتصال بالسحابة مؤقتاً، تم التحويل لمحرك Morrow المحلي.',
      });
    }
  });

  // --- Morrow Smart Text / Data Analyzer (data_processing: gemini-4-hydrogen -> gemini-3.1-flash-lite -> nemotron -> openrouter/free) ---

  app.post('/api/morrow/analyze-text', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const body = (req.body || {}) as {
        rawText?: string;
        agencies?: Array<{ id: number; name: string }>;
        preferredChain?: string[];
        taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>>;
      };
      const rawText = String(body.rawText || '').trim().slice(0, 6000);
      if (!rawText) {
        res.status(400).json({ ok: false, error: 'يرجى لصق النص أولاً لتحليله.' });
        return;
      }

      const orchSnap = getOrchestrationStatusSnapshot();
      if (!orchSnap.providers.google && !orchSnap.providers.openrouter) {
        res.status(200).json({
          ok: false,
          fallbackToLocal: true,
          modelId: 'morrow-local',
          reason: 'مفاتيح الذكاء السحابي غير مهيأة — يمكنك الاعتماد على المحلل المحلي الفوري.',
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

      const orch = await executeWithFallback({
        pipeline: 'data_processing',
        preferredChain: resolvePreferredChainFromRequest('structured_excel_csv', body),
        promptText: `الوكالات المتاحة: ${agenciesHint || 'غير محددة'}\n\nالنص / البيانات المراد تحليلها:\n${rawText}`,
        systemInstruction:
          'أنت محلل نصوص عربية ومذكرات واتساب وجداول Excel/CSV لنظام وكالات الكمية الغذائية. استخرج كل سطر إلى عملية مهيكلة (تحديث عدد الأفراد update_individuals، حجب كامل block_full، إضافة عائلة add_person، أو ملاحظة note) مع الالتزام الصارم بكلمة «الأفراد» وأعد JSON فقط.',
        responseMimeType: 'application/json',
        responseSchema: schema,
        timeoutMs: 13000,
        detectComprehensionFailure: true,
      });

      if (!orch.ok) {
        res.status(200).json({
          ok: false,
          fallbackToLocal: true,
          modelId: 'morrow-local',
          reason: 'تعذر التحليل السحابي مؤقتاً — تم الإبقاء على التحليل المحلي.',
        });
        return;
      }

      const parsed = JSON.parse(orch.text || '{}') as {
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
        modelId: orch.modelId,
        provider: orch.provider,
        modelLabel: orch.modelLabel,
        fallbackUsed: orch.fallbackUsed,
        summary: enforceSafeArabicTerminology(parsed.summary || 'تم تحليل النص بالذكاء السحابي بنجاح.'),
        items: Array.isArray(parsed.items) ? parsed.items : [],
      });
    } catch {
      res.status(200).json({
        ok: false,
        fallbackToLocal: true,
        modelId: 'morrow-local',
        reason: 'تعذر التحليل السحابي مؤقتاً — تم الإبقاء على التحليل المحلي.',
      });
    }
  });

  // --- Morrow Voice Message Transcription (Audio Pipeline: whisper-large-v3-turbo via Groq -> Gemini fallback) ---
  app.post('/api/morrow/transcribe', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const body = (req.body || {}) as {
        audioBase64?: string;
        mimeType?: string;
        targetMode?: 'instruction' | 'quick_note' | 'draft_text';
        agencies?: Array<{ id: number; name: string }>;
        preferredChain?: string[];
        taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>>;
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

      const orchSnap = getOrchestrationStatusSnapshot();
      if (!orchSnap.providers.groq && !orchSnap.providers.google) {
        res.status(503).json({
          ok: false,
          requiresApiKey: true,
          error: 'مفتاح GROQ_API_KEY (أو GEMINI_API_KEY) غير مهيأ لتفريغ الرسائل الصوتية.',
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

      const audioResult = await executeAudioTranscriptionWithFallback({
        audioBase64: cleanBase64,
        mimeType,
        promptHint: transcribePrompt,
        language: 'ar',
        preferredChain: resolvePreferredChainFromRequest('audio_transcription', body),
      });

      if (!audioResult.ok || !audioResult.transcript) {
        res.status(422).json({
          ok: false,
          error: audioResult.errorSummary || 'لم يتم التقاط كلام واضح في التسجيل الصوتي.',
          attempts: audioResult.attempts,
        });
        return;
      }

      const transcript = audioResult.transcript;
      const looksLikeQuickNote = /^(?:ملاحظ[هة]|مذكر[هة]|تنبيه|لا تنسى|سجل ملاحظ[هة]|اكتب ملاحظ[هة])/i.test(
        transcript
      );

      res.json({
        ok: true,
        modelId: audioResult.modelId,
        provider: audioResult.provider,
        modelLabel: audioResult.modelLabel,
        fallbackUsed: audioResult.fallbackUsed,
        attempts: audioResult.attempts,
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

  // --- Morrow Multimodal File / Camera Analysis (heavy_extraction: gemini-4-hydrogen -> nemotron -> gemini-3.1-flash-lite) ---
  app.post('/api/morrow/multimodal', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const body = (req.body || {}) as {
        fileName?: string;
        mimeType?: string;
        dataBase64?: string;
        prompt?: string;
        agencies?: Array<{ id: number; name: string }>;
        liveWorkspace?: Record<string, unknown>;
        preferredChain?: string[];
        taskRouting?: Partial<Record<AiTaskKey, Partial<AiTaskRouteConfigItem>>>;
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

      const orchSnap = getOrchestrationStatusSnapshot();
      if (!orchSnap.providers.google && !orchSnap.providers.openrouter) {
        res.status(503).json({
          ok: false,
          requiresApiKey: true,
          error: 'مفاتيح السحابة (GEMINI_API_KEY / OPENROUTER_API_KEY) غير مهيأة لتحليل الملفات والصور.',
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

      const orch = await executeWithFallback({
        pipeline: 'heavy_extraction',
        preferredChain: resolvePreferredChainFromRequest('heavy_pdf_vision', body),
        attachments: [
          {
            kind: mimeType === 'application/pdf' ? 'pdf' : 'image',
            mimeType,
            data: cleanBase64,
            filename: fileName,
          },
        ],
        promptText: `اسم الملف: ${fileName}
الوكالات المسجلة بالتطبيق: ${agenciesHint || 'غير محددة'}
${liveHint ? `حالة التطبيق الحالية: ${liveHint}\n` : ''}طلب المستخدم: ${userPrompt || 'اقرأ هذا المستند أو الصورة ولخّص محتواها. إذا كانت إيصال مصروف فاقترح manage_expense، وإذا كانت أسماء جديدة قليلة فاقترح add_person، وإذا كانت جدول مستفيدين/وكالات فاذكر التفاصيل وأوصِ بالسحب الذكي.'}`,
        systemInstruction:
          'أنت مساعد Morrow الذكي لقراءة الملفات والصور داخل تطبيق إدارة وكالات توزيع الطحين. التزم دائماً بكلمة «الأفراد» وأجب باللهجة العراقية المهنية الواضحة. حدد بدقة ما إذا كان المرفق جدول مستفيدين أو دفتر توزيع (looksLikeRosterTable)، وإن تضمن إيصالاً مالياً أو إضافة واضحة أضفها في suggestedTools ليراجعها المستخدم كمسودة موافقة. أعد JSON فقط.',
        responseMimeType: 'application/json',
        responseSchema: schema,
      });

      if (!orch.ok) {
        res.status(orch.hadRateLimitOrTimeout ? 503 : 500).json({
          ok: false,
          error: orch.errorSummary || 'تعذر تحليل المرفق حالياً.',
          attempts: orch.attempts,
        });
        return;
      }

      const parsed = JSON.parse(orch.text || '{}') as {
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
        modelId: orch.modelId,
        provider: orch.provider,
        modelLabel: orch.modelLabel,
        fallbackUsed: orch.fallbackUsed,
        attempts: orch.attempts,
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

  const resolveAmbientAudioPath = (): string | null => {
    const candidates = [
      path.resolve(__dirname, 'public/assets/aistudio/bg-music_85f08a71.mp3'),
      path.resolve(__dirname, 'dist/assets/aistudio/bg-music_85f08a71.mp3'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const dirs = [
      path.resolve(__dirname, 'public/assets/aistudio'),
      path.resolve(__dirname, 'dist/assets/aistudio'),
    ];
    for (const dir of dirs) {
      try {
        if (!fs.existsSync(dir)) continue;
        const mp3 = fs
          .readdirSync(dir)
          .find((file) => file.toLowerCase().endsWith('.mp3'));
        if (mp3) {
          return path.join(dir, mp3);
        }
      } catch {
        // ignore directory scan errors
      }
    }
    return null;
  };

  const serveAppAmbientAudio = (_req: Request, res: Response) => {
    const targetPath = resolveAmbientAudioPath();
    if (!targetPath || !fs.existsSync(targetPath)) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(targetPath);
  };

  app.get('/app-ambient.mp3', serveAppAmbientAudio);
  app.get('/bg-music.mp3', serveAppAmbientAudio);
  app.get('/assets/aistudio/RUMI-music_0cb9de04.mp3', serveAppAmbientAudio);

  const httpServer = http.createServer(app);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const hmrEnabled = process.env.DISABLE_HMR !== 'true';
    const vite = await createViteServer({
      plugins: !hmrEnabled
        ? [
            {
              name: 'morrow-disable-hmr-ws',
              transform(code: string, id: string) {
                if (
                  id.includes('vite/dist/client/client.mjs') ||
                  id.includes('vite/dist/client/bundledDevClient.mjs')
                ) {
                  return code
                    .replace(
                      'transport.connect(createHMRHandler(handleMessage));',
                      '/* HMR WebSocket disabled (DISABLE_HMR=true) */'
                    )
                    .replace(
                      'setupForwardConsoleHandler(transport, forwardConsole);',
                      '/* forwardConsole disabled (DISABLE_HMR=true) */'
                    )
                    .replace(
                      'else throw new SendBeforeConnectError("send was called before connect");',
                      'else return;'
                    )
                    .replace(
                      'else throw new SendBeforeConnectError("invoke was called before connect");',
                      'else return undefined;'
                    );
                }
                return null;
              },
            },
          ]
        : [],
      server: {
        middlewareMode: true,
        hmr: hmrEnabled ? { server: httpServer } : false,
        ws: hmrEnabled ? { server: httpServer } : false,
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

  const morrowLiveWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/api/morrow/live') {
        return;
      }
      const queryToken = url.searchParams.get('token') || '';
      const cookies = parseCookieHeader(request.headers.cookie);
      const token = queryToken || cookies[SESSION_COOKIE_NAME] || '';
      const verified = token ? await verifyAuthToken(token) : null;
      if (!verified) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      morrowLiveWss.handleUpgrade(request, socket, head, (ws) => {
        morrowLiveWss.emit('connection', ws, request);
      });
    } catch {
      socket.destroy();
    }
  });

  morrowLiveWss.on('connection', async (clientWs: WebSocket) => {
    const ai = createGoogleAiClient();
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
      {
        name: 'run_morrow_macro',
        description:
          'تشغيل ماكرو متكامل مثل إغلاق الشهر أو جرد الصباح أو تجهيز كشف التوزيع مع الحفاظ على مسودات الموافقة.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            triggerPhrase: { type: Type.STRING },
          },
        },
      },
      {
        name: 'analyze_period_forecast',
        description: 'تحليل توقعات الحصة القادمة والأكياس والأرباح ومقارنتها بالأرشيف.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            agencyId: { type: Type.INTEGER, nullable: true },
          },
        },
      },
      {
        name: 'summon_workspace_canvas',
        description:
          'فتح اللوحة التفاعلية في مركز Morrow على تبويب محدد (الرسوم، الجدول، التقرير التنفيذي، التوقعات، تحليل النصوص، أو الماكرو).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            canvasMode: {
              type: Type.STRING,
              enum: [
                'overview_charts',
                'editable_table',
                'executive_report',
                'forecast',
                'text_analysis',
                'macro_studio',
              ],
            },
            agencyId: { type: Type.INTEGER, nullable: true },
          },
          required: ['canvasMode'],
        },
      },
    ];

    const liveSystemInstruction = `أنت المساعد الذكي الشخصي Morrow في جلسة صوتية ومشاهدة مباشرة مرتبطة جذرياً بتطبيق إدارة وكالات توزيع الطحين والمستفيدين.
تحدث باللهجة العراقية المهنية الهادئة والواضحة وباختصار مفيد، والتزم دائماً بمصطلح «الأفراد» وأبداً لا تستخدم «الأنفار».
إذا سألك المستخدم عن أرقام حية أو إحصائيات أو أرباح أو أراد فتح صفحة أو تجهيز مسودة تعديل/مصروف، استخدم الأدوات المباشرة (Function Calling) فوراً.
${liveWorkspaceSummary ? `\nبيانات التطبيق الحية المرتبطة بالجلسة:\n${liveWorkspaceSummary}` : ''}`;

    const sessionPromise = ai.live.connect({
      model: AI_FREE_MODELS.GEMINI_3_8_LIVE,
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
                model: AI_FREE_MODELS.GEMINI_3_8_LIVE,
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
              } else if (
                fc.name === 'run_morrow_macro' ||
                fc.name === 'analyze_period_forecast' ||
                fc.name === 'summon_workspace_canvas'
              ) {
                const checked = validateToolCall({ name: fc.name, args });
                if (checked.valid && checked.sanitized) {
                  uiToolCall = checked.sanitized;
                  responseObj = {
                    ok: true,
                    executedOnClientWorkspace: true,
                    tool: checked.sanitized.name,
                  };
                } else {
                  responseObj = { ok: false, reason: checked.error || 'وسائط غير صالحة' };
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
          const ev = err as { message?: string; error?: { message?: string } };
          const detail =
            err instanceof Error
              ? err.message
              : ev?.error?.message || ev?.message || '';
          if (!closed && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                message: detail
                  ? `انقطاع الاتصال المباشر (${AI_FREE_MODELS.GEMINI_3_8_LIVE}): ${detail}`
                  : 'حدث خطأ في اتصال Gemini Live المباشر.',
              })
            );
          }
        },
        onclose: (closeEv?: unknown) => {
          const ce = closeEv as { code?: number; reason?: string } | undefined;
          if (!closed && clientWs.readyState === clientWs.OPEN) {
            if (ce?.reason) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: `إغلاق جلسة ${AI_FREE_MODELS.GEMINI_3_8_LIVE} (${ce.code ?? ''}): ${ce.reason}`,
                })
              );
            }
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

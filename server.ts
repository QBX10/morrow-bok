import { GoogleGenAI, Type, type GenerateContentResponse } from '@google/genai';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
import type { QuickExtractRawRow } from './src/types/agency.ts';
import type { AssistantBrainMode, AssistantToolCall } from './src/types/assistant.ts';
import { normalizePhoneNumber } from './src/utils/agencyLogic.ts';
import { enforceSafeArabicTerminology } from './src/utils/assistantPrivacy.ts';
import {
  ASSISTANT_TOOL_DECLARATIONS,
  validateToolCall,
} from './src/utils/assistantTools.ts';
import { buildSafeQuickExtractResult } from './src/utils/quickExtractEngine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const GEMINI_MODEL = 'gemini-4-hydrogen';

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
          rows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rowIndex: { type: Type.INTEGER },
                pageNumber: { type: Type.INTEGER },
                name: { type: Type.STRING, nullable: true },
                individuals: { type: Type.INTEGER, nullable: true },
                decreaseCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteAction: {
                  type: Type.STRING,
                  enum: ['إضافة', 'حذف', 'لا يوجد', 'غير محدد'],
                },
                nameConfidence: { type: Type.NUMBER },
                numbersConfidence: { type: Type.NUMBER },
                modelDoubtFlag: { type: Type.BOOLEAN },
                modelDoubtReason: { type: Type.STRING },
                rawSnippet: { type: Type.STRING },
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
          ? '- individuals: عدد الأفراد (عدد صحيح >= 0، أو null إذا كان مفقودًا).'
          : '- individuals: الحقل خارج نطاق التركيز؛ أعد 0.',
        focusSet.has('decreaseCount')
          ? '- decreaseCount: عدد النزول أو النقصان (عدد صحيح >= 0، أو null إذا كان غامضًا).'
          : '- decreaseCount: الحقل خارج نطاق التركيز؛ أعد 0.',
        focusSet.has('addOrDelete')
          ? '- addOrDeleteCount & addOrDeleteAction: عدد الإضافة أو الحذف ونوعه ("إضافة" | "حذف" | "لا يوجد" | "غير محدد").'
          : '- addOrDeleteCount & addOrDeleteAction: خارج نطاق التركيز؛ أعد 0 و"لا يوجد".',
      ].join('\n   ');

      const systemPrompt = `أنت محرك معالجة مستندات ذكي (Intelligent Document Processing) ورؤية حاسوبية متخصص في استخراج الجداول العربية المكتوبة رقميًا أو بخط اليد (الدفاتر الورقية).
تعمل وفق القواعد الصارمة التالية — "الشك والرفض الآمن — لا تخمّن أبدًا":
1. فحص الجودة والازدحام:
   - عالج تداخل الأسطر وضيق الجداول، وإذا توفرت عدة لقطات (Burst Frames) لنفس الدفتر فطابقها معًا للتأكد من كل نقطة وحرف ورقم.
   - إذا كانت الصورة/الصفحة مهزوزة، مطموسة، مغطاة بظل/لمعان، أو غير مقروءة بحيث يستحيل قراءة الصفوف بأمان: اضبط legibilityStatus="rejected" واكتب الأسباب الدقيقة بالعربية في rejectionReasons واترك rows فارغًا.
2. التركيز المخصص على الحقول (التزم بدقة بالحقول المحددة فقط وتجاهل غير المطلوب):
   ${fieldFocusPrompt}
3. وضع التشغيل الحالي (${scanMode === 'fast' ? 'الوضع السريع Fast Mode' : 'الوضع المدقق Audit Mode'}):
   - ${
     scanMode === 'fast'
       ? 'اقرأ الصفوف الواضحة بسرعة ودقة مباشرة، ولا تفعّل الشك إلا عند وجود طمس أو رمز غير مقروء فعليًا.'
       : 'دقق في كل نقطة وهمزة ورقم، وأرجع suspectBox بإحداثيات (ymin, xmin, ymax, xmax) من 0 إلى 1000 لموقع الاسم أو الصف في الصورة كي يعاين المستخدم القص المرئي مباشرة.'
   }
   - عند الشك في أي حرف عربي: اضبط modelDoubtFlag=true، خفّض nameConfidence لأقل من 0.90، واذكر المقاطع في suspectSpans، واكتب suspectBox (ymin, xmin, ymax, xmax من 0 إلى 1000).
   - لا تخترع أو تكمل أي اسم أو رقم بالتخمين!`;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
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
        rows?: QuickExtractRawRow[];
      };

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
      });

      res.json(safeResult);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
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
          rows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rowIndex: { type: Type.INTEGER },
                pageNumber: { type: Type.INTEGER },
                name: { type: Type.STRING, nullable: true },
                individuals: { type: Type.INTEGER, nullable: true },
                decreaseCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteCount: { type: Type.INTEGER, nullable: true },
                addOrDeleteAction: {
                  type: Type.STRING,
                  enum: ['إضافة', 'حذف', 'لا يوجد', 'غير محدد'],
                },
                nameConfidence: { type: Type.NUMBER },
                numbersConfidence: { type: Type.NUMBER },
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

      const systemInstruction = `أنت "منظومة القراءة الكونية والإدراك التدريجي" (UCRS) داخل تطبيق تابريكس لإدارة وكالات الكمية الغذائية.
مبادئك الصارمة:
1. الفهم قبل الاستخراج: حدد أولاً نوع المحتوى وموضوعه وجودته وهل يخص جداول المستفيدين/الوكالات (important | useful | neutral | irrelevant) مع ذكر السبب، ورأيك الصريح.
2. التدرج وعدم الاختراع (Zero Silent Errors): إذا رأيت 10 أسماء واستطعت قراءة 4 منها بثقة عالية و3 بشك و3 غير مقروءة، استخرج الأربعة الواضحة والمشكوكة بأمانة، وضع إحداثيات الأجزاء غير المقروءة في unreadableRegions واكتب في missingHint ما تحتاجه لإكمال الباقي (مثل: صورة أوضح للجزء العلوي الأيمن). لا تخمّن أي حرف أو رقم أبدًا!
3. حدد إحداثيات suspectBox (ymin, xmin, ymax, xmax من 0 إلى 1000) لكل صف أمكن رصده بصريًا لتعمل خريطة التغطية البصرية وقصاصات المراجعة.
4. في وضع الاكتشاف أو الكتب/المستندات أو البحث الدلالي: املأ entities بالأسماء، التواريخ، الأماكن، الملاحظات، والفقرات المهمة.
5. التزم بوضع التشغيل: ${scanMode === 'fast' ? 'الوضع السريع' : 'الوضع المدقق'}.`;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
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
      });

      res.json({
        ...safeRowsResult,
        identity: parsed.identity || null,
        missingHint: parsed.missingHint || '',
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        unreadableRegions: Array.isArray(parsed.unreadableRegions)
          ? parsed.unreadableRegions
          : [],
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
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

  // --- Embedded AI Assistant & Collaborative Gemini Routing ---
  app.get('/api/assistant/status', (_req: Request, res: Response) => {
    const ai = createGeminiClient();
    res.json({
      cloudConfigured: Boolean(ai),
      models: {
        hydrogen: 'gemini-4-hydrogen',
        lite: 'gemini-3.1-flash-lite',
      },
    });
  });

  app.post('/api/assistant/chat', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const body = (req.body || {}) as {
        prompt?: string;
        brainMode?: AssistantBrainMode;
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
          reason: 'مفتاح Gemini غير مهيأ على الخادم، تم التحويل للمحرك المحلي.',
        });
        return;
      }

      const mode: AssistantBrainMode =
        body.brainMode === 'gemini_lite' ||
        body.brainMode === 'gemini_hydrogen' ||
        body.brainMode === 'collaborative'
          ? body.brainMode
          : 'auto';

      const contextText = JSON.stringify(body.cloudContext || {}, null, 0).slice(0, 4000);
      const historyLines = Array.isArray(body.cloudHistory)
        ? body.cloudHistory
            .slice(-6)
            .map((h) => `${h.role === 'user' ? 'المستخدم' : 'المساعد'}: ${String(h.text || '').slice(0, 350)}`)
            .join('\n')
        : '';

      const systemInstruction = `أنت المساعد الذكي المدمج داخل تطبيق «تابريكس» لإدارة وكالات الكمية الغذائية.
قواعدك الصارمة:
1. تحدث باللهجة العراقية البسيطة والمهنية والمختصرة.
2. التزم تماماً بكلمة «الأفراد» و«أفراد» وامنع تماماً استخدام لفظ «الأنفار».
3. لا تكتب أوامر SQL أو كود برمجي نهائياً — اختر فقط الأداة المناسبة من Function Calling بالوسائط الدقيقة.
4. لا تفترض أو تخمّن بيانات غير موجودة: إن نقصت الوكالة أو عدد الأفراد في طلب إضافة/تعديل، اطلب من المستخدم التوضيح أو استدعِ الأداة بالقدر المتوفر ليقوم التطبيق بسؤاله بالأزرار.
5. لا تقترح حذفاً نهائياً أبداً (استخدم archive_person فقط للأرشفة الآمنة).
6. أجب في حدود المعقول وبوضوح، وإذا تعذّر جزء من الطلب اقترح تنفيذ الجزء الممكن أو التوضيح.
سياق التطبيق الحالي (محجوب الأسماء حفاظاً على الخصوصية ما لم يفعلها المدير):
${contextText}`;

      const userContent = historyLines
        ? `سجل الحوار القريب:\n${historyLines}\n\nالطلب الحالي:\n${prompt}`
        : prompt;

      const runSingleModel = async (
        modelName: string,
        extraHint?: string
      ): Promise<{
        text: string;
        toolCalls: AssistantToolCall[];
        model: string;
      }> => {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('assistant_cloud_timeout')), 8500);
        });

        const callPromise = ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: extraHint ? `${userContent}\n\n${extraHint}` : userContent,
                },
              ],
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
      };

      if (mode === 'collaborative') {
        const [hydrogenRes, liteRes] = await Promise.allSettled([
          runSingleModel(
            'gemini-4-hydrogen',
            'أنت العقل التحليلي العميق (Hydrogen): ركّز على دقة فهم السياق واختيار الأداة المثالية.'
          ),
          runSingleModel(
            'gemini-3.1-flash-lite',
            'أنت المدقق السريع (Lite): تحقق من الوسائط، النقص في البيانات، وصحة الصياغة العراقية المختصرة.'
          ),
        ]);

        const hVal = hydrogenRes.status === 'fulfilled' ? hydrogenRes.value : null;
        const lVal = liteRes.status === 'fulfilled' ? liteRes.value : null;

        if (!hVal && !lVal) {
          res.status(200).json({
            ok: false,
            fallbackToOffline: true,
            reason: 'تعذر الوصول للنماذج السحابية ضمن المهلة المحددة.',
          });
          return;
        }

        const primaryTool = hVal?.toolCalls[0] || lVal?.toolCalls[0] || null;
        const secondaryTool = lVal?.toolCalls[0] || null;
        const consensusMatched =
          Boolean(hVal?.toolCalls[0]) &&
          Boolean(secondaryTool) &&
          hVal!.toolCalls[0].name === secondaryTool!.name;

        const mergedTextParts = [
          hVal?.text || '',
          lVal?.text && lVal.text !== hVal?.text && !consensusMatched ? lVal.text : '',
        ].filter(Boolean);

        const finalText =
          mergedTextParts.join('\n\n') ||
          (primaryTool
            ? 'تم تحليل الطلب بالتعاون المشترك بين النموذجين وتجهيز الإجراء الأنسب.'
            : 'تمت معالجة الطلب، أخبرني إذا تحتاج تفاصيل إضافية.');

        res.json({
          ok: true,
          engineUsed: 'collaborative',
          engineLabel: consensusMatched
            ? 'تعاون مشترك (توافق Hydrogen + Lite)'
            : 'تعاون مشترك (Hydrogen + تدقيق Lite)',
          text: enforceSafeArabicTerminology(finalText),
          toolCalls: primaryTool ? [primaryTool] : [],
          collaborativeMeta: {
            consensusMatched,
            hydrogenTool: hVal?.toolCalls[0]?.name || null,
            liteTool: lVal?.toolCalls[0]?.name || null,
            latencyMs: Date.now() - startedAt,
          },
        });
        return;
      }

      const targetModel =
        mode === 'gemini_lite' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
      const result = await runSingleModel(targetModel);
      res.json({
        ok: true,
        engineUsed: mode === 'gemini_lite' ? 'gemini_lite' : 'gemini_hydrogen',
        engineLabel:
          mode === 'gemini_lite'
            ? 'Gemini 3.1 Flash Lite'
            : 'Gemini 4 Hydrogen',
        text:
          result.text ||
          (result.toolCalls.length > 0
            ? 'تم فهم الطلب وتجهيز الأداة المناسبة.'
            : 'تفضل، كيف أقدر أساعدك أكثر؟'),
        toolCalls: result.toolCalls,
        latencyMs: Date.now() - startedAt,
      });
    } catch (err) {
      res.status(200).json({
        ok: false,
        fallbackToOffline: true,
        reason:
          err instanceof Error && err.message === 'assistant_cloud_timeout'
            ? 'انتهت مهلة السحابة السريعة؛ تم التحويل للمحرك المحلي.'
            : err instanceof Error
            ? err.message
            : 'تعذر الاتصال بالسحابة، تم التحويل للمحرك المحلي.',
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

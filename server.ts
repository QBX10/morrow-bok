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
} from './src/db/localStore.ts';
import {
  requireAuth,
  signSessionToken,
  type AuthRequest,
} from './src/middleware/auth.ts';
import type { QuickExtractRawRow } from './src/types/agency.ts';
import { normalizePhoneNumber } from './src/utils/agencyLogic.ts';
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

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
    const principal = req.principal!;
    const dbUser = findUserByUid(principal.uid);
    res.json({
      user: {
        uid: principal.uid,
        provider: principal.provider,
        displayName: dbUser?.displayName || principal.displayName,
        email: dbUser?.email || principal.email,
        username: dbUser?.username || principal.username,
        phone: dbUser?.phone || principal.phone,
        role: dbUser?.role || 'manager',
      },
    });
  });

  // --- Per-User Workspace Sync ---

  app.get('/api/workspace', requireAuth, (req: AuthRequest, res: Response) => {
    const principal = req.principal!;
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
  });

  app.put('/api/workspace', requireAuth, (req: AuthRequest, res: Response) => {
    const principal = req.principal!;
    const userRec = findUserByUid(principal.uid);
    if (!userRec) {
      res.status(404).json({ error: 'الحساب غير موجود.' });
      return;
    }
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
    const saved = saveWorkspaceSnapshot({
      userId: userRec.id,
      snapshotJson: JSON.stringify(body.snapshot),
      recordCount: body.snapshot.persons.length,
      agencyCount: body.snapshot.agencies.length,
    });
    res.json({ ok: true, updatedAt: saved.updatedAt });
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
          ? '- individuals: عدد الأفراد / الأنفار (عدد صحيح >= 0، أو null إذا كان مفقودًا).'
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

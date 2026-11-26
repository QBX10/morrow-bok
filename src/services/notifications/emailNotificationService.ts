import crypto from 'crypto';
import nodemailer from 'nodemailer';

export interface ParsedClientDeviceInfo {
  browserName: string;
  browserVersion: string;
  osName: string;
  deviceLabel: string;
  browserLabel: string;
  fingerprintHash: string;
  userAgent: string;
}

export interface EmailProviderStatus {
  configured: boolean;
  provider: 'smtp' | 'resend' | 'none';
  fromConfigured: boolean;
  fromValid?: boolean;
  fromAddressPreview?: string;
}

export interface DispatchSecurityLoginEmailParams {
  uid: string;
  recipientEmail?: string | null;
  displayName: string;
  loginMethod: 'password' | 'passkey' | 'google' | 'github' | 'qr' | 'recovery_code';
  outcome: 'succeeded' | 'failed';
  deviceInfo: ParsedClientDeviceInfo;
  ipMasked: string;
  timestampIso?: string;
  isTest?: boolean;
  bypassCooldown?: boolean;
}

export interface EmailDeliveryResult {
  status: 'sent' | 'failed' | 'skipped_no_email' | 'not_configured' | 'throttled';
  provider: 'smtp' | 'resend' | 'none';
  subject: string;
  messageId?: string;
  error?: string;
}

const failedAttemptEmailCooldowns = new Map<string, number>();
const FAILED_ATTEMPT_COOLDOWN_MS = 5 * 60 * 1000;

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function maskEmailForConfigPreview(email: string): string {
  const angleMatch = email.match(/<([^<>@\s]+@[^<>@\s]+)>/);
  const target = (angleMatch ? angleMatch[1] : email).trim();
  const [local, domain] = target.split('@');
  if (!local || !domain) return '***';
  const visible = local.length <= 2 ? local[0] || '*' : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function parseClientDeviceAndBrowser(
  userAgentHeader: unknown,
  secChUaHeader?: unknown
): ParsedClientDeviceInfo {
  const ua = String(userAgentHeader || '').trim().slice(0, 280);
  const ch = String(secChUaHeader || '').trim().slice(0, 180);

  let osName = 'جهاز غير معروف';
  if (/Windows NT/i.test(ua) || /Windows/i.test(ua)) osName = 'Windows';
  else if (/iPhone/i.test(ua)) osName = 'iPhone (iOS)';
  else if (/iPad/i.test(ua)) osName = 'iPad (iPadOS)';
  else if (/Android/i.test(ua)) osName = 'Android';
  else if (/Mac OS X|Macintosh/i.test(ua)) osName = 'macOS';
  else if (/Linux/i.test(ua)) osName = 'Linux';
  else if (ua) osName = 'عميل برمجي / مخصص';

  let browserName = 'متصفح غير معروف';
  let browserVersion = '';

  const matchVersion = (re: RegExp) => {
    const m = ua.match(re);
    return m && m[1] ? m[1].split('.')[0] : '';
  };

  if (/EdgA?\/([\d.]+)/i.test(ua)) {
    browserName = 'Microsoft Edge';
    browserVersion = matchVersion(/EdgA?\/([\d.]+)/i);
  } else if (/OPR\/([\d.]+)/i.test(ua) || /Opera/i.test(ua)) {
    browserName = 'Opera';
    browserVersion = matchVersion(/OPR\/([\d.]+)/i);
  } else if (/Firefox\/([\d.]+)/i.test(ua) || /FxiOS\/([\d.]+)/i.test(ua)) {
    browserName = 'Firefox';
    browserVersion = matchVersion(/(?:Firefox|FxiOS)\/([\d.]+)/i);
  } else if (/SamsungBrowser\/([\d.]+)/i.test(ua)) {
    browserName = 'Samsung Internet';
    browserVersion = matchVersion(/SamsungBrowser\/([\d.]+)/i);
  } else if (/Brave/i.test(ch) || /Brave/i.test(ua)) {
    browserName = 'Brave';
    browserVersion = matchVersion(/Chrome\/([\d.]+)/i);
  } else if (/Chrome\/([\d.]+)/i.test(ua) || /CriOS\/([\d.]+)/i.test(ua)) {
    browserName = 'Chrome';
    browserVersion = matchVersion(/(?:Chrome|CriOS)\/([\d.]+)/i);
  } else if (/Safari\/([\d.]+)/i.test(ua) && /Version\/([\d.]+)/i.test(ua)) {
    browserName = 'Safari';
    browserVersion = matchVersion(/Version\/([\d.]+)/i);
  } else if (ua) {
    browserName = ua.split('/')[0].slice(0, 28) || 'عميل غير معروف';
  }

  const browserLabel = browserVersion
    ? `${browserName} ${browserVersion}`
    : browserName;
  const deviceLabel = `${browserLabel} · ${osName}`;
  const fingerprintSource = `${browserName.toLowerCase()}|${osName.toLowerCase()}|${ua.toLowerCase()}`;
  const fingerprintHash = crypto
    .createHash('sha256')
    .update(fingerprintSource)
    .digest('hex')
    .slice(0, 20);

  return {
    browserName,
    browserVersion,
    osName,
    deviceLabel,
    browserLabel,
    fingerprintHash,
    userAgent: ua,
  };
}

function isValidEmailAddressSpec(value: string): boolean {
  return /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/.test(value.trim());
}

function resolveFormattedFromAddress(): {
  emailFrom: string;
  fromValid: boolean;
} {
  const rawFrom = process.env.EMAIL_FROM?.trim() || '';
  const smtpUser = process.env.SMTP_USER?.trim() || '';
  if (rawFrom) {
    if (isValidEmailAddressSpec(rawFrom)) {
      return { emailFrom: rawFrom, fromValid: true };
    }
    if (isValidEmailAddressSpec(smtpUser)) {
      const display = rawFrom.replace(/[<>"]/g, '').trim();
      const combined = display ? `${display} <${smtpUser}>` : smtpUser;
      return { emailFrom: combined, fromValid: true };
    }
    return { emailFrom: rawFrom, fromValid: false };
  }
  if (smtpUser) {
    return { emailFrom: smtpUser, fromValid: isValidEmailAddressSpec(smtpUser) };
  }
  return { emailFrom: '', fromValid: false };
}

export function getEmailProviderStatus(): EmailProviderStatus {
  const smtpHost = process.env.SMTP_HOST?.trim() || '';
  const smtpUser = process.env.SMTP_USER?.trim() || '';
  const smtpPass = process.env.SMTP_PASS?.trim() || '';
  const resendKey = process.env.RESEND_API_KEY?.trim() || '';
  const { emailFrom, fromValid } = resolveFormattedFromAddress();

  if (smtpHost && smtpUser && smtpPass) {
    return {
      configured: true,
      provider: 'smtp',
      fromConfigured: Boolean(emailFrom),
      fromValid,
      fromAddressPreview: emailFrom ? maskEmailForConfigPreview(emailFrom) : undefined,
    };
  }
  if (resendKey && emailFrom) {
    return {
      configured: true,
      provider: 'resend',
      fromConfigured: true,
      fromValid,
      fromAddressPreview: maskEmailForConfigPreview(emailFrom),
    };
  }
  return {
    configured: false,
    provider: 'none',
    fromConfigured: Boolean(emailFrom),
    fromValid,
    fromAddressPreview: emailFrom ? maskEmailForConfigPreview(emailFrom) : undefined,
  };
}

export async function verifyEmailTransport(): Promise<{
  ok: boolean;
  provider: 'smtp' | 'resend' | 'none';
  fromValid: boolean;
  error?: string;
}> {
  const status = getEmailProviderStatus();
  if (!status.configured) {
    return {
      ok: false,
      provider: 'none',
      fromValid: Boolean(status.fromValid),
      error: 'لم يتم ضبط SMTP أو RESEND_API_KEY في متغيرات الخادم.',
    };
  }

  if (status.provider === 'smtp') {
    const smtpHost = process.env.SMTP_HOST?.trim() || '';
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpSecureEnv = (process.env.SMTP_SECURE || '').trim().toLowerCase();
    const smtpSecure = smtpSecureEnv ? smtpSecureEnv === 'true' : smtpPort === 465;
    const smtpUser = process.env.SMTP_USER?.trim() || '';
    const smtpPass = process.env.SMTP_PASS?.trim() || '';
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number.isFinite(smtpPort) ? smtpPort : 587,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 6000,
        greetingTimeout: 6000,
        socketTimeout: 8000,
      });
      await transporter.verify();
      return {
        ok: Boolean(status.fromValid),
        provider: 'smtp',
        fromValid: Boolean(status.fromValid),
        ...(status.fromValid
          ? {}
          : {
              error:
                'اتصال SMTP نجح ولكن EMAIL_FROM غير مضبوط كبريد إلكتروني صحيح (يجب أن يحتوي على @).',
            }),
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'smtp',
        fromValid: Boolean(status.fromValid),
        error: err instanceof Error ? err.message : 'فشل التحقق من اتصال SMTP.',
      };
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim() || '';
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${resendKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return {
        ok: false,
        provider: 'resend',
        fromValid: Boolean(status.fromValid),
        error: `Resend HTTP ${res.status}`,
      };
    }
    return {
      ok: Boolean(status.fromValid),
      provider: 'resend',
      fromValid: Boolean(status.fromValid),
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'resend',
      fromValid: Boolean(status.fromValid),
      error: err instanceof Error ? err.message : 'تعذر الاتصال بخدمة Resend.',
    };
  }
}

function getLoginMethodArabicLabel(
  method: DispatchSecurityLoginEmailParams['loginMethod']
): string {
  switch (method) {
    case 'passkey':
      return 'مفتاح المرور (Passkey)';
    case 'google':
      return 'حساب Google';
    case 'github':
      return 'حساب GitHub';
    case 'qr':
      return 'الاقتران برمز QR';
    case 'recovery_code':
      return 'رمز استرجاع أحادي الاستخدام';
    default:
      return 'كلمة المرور';
  }
}

export function buildSecurityAlertEmailContent(
  params: DispatchSecurityLoginEmailParams
): { subject: string; html: string; text: string } {
  const timeIso = params.timestampIso || new Date().toISOString();
  const formattedTime = new Date(timeIso).toLocaleString('ar-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const methodLabel = getLoginMethodArabicLabel(params.loginMethod);
  const appUrl = (process.env.APP_URL?.trim() || '').replace(/\/+$/, '');
  const securityHubUrl = appUrl ? `${appUrl}/?tab=security` : '';

  const isFailed = params.outcome === 'failed';
  const subject = params.isTest
    ? 'Morrow · رسالة اختبار لتنبيهات الأمان عبر البريد الإلكتروني'
    : isFailed
      ? `تنبيه أمني عاجل: محاولة تسجيل دخول غير مصرح بها من ${params.deviceInfo.browserLabel}`
      : `تنبيه أمان: تسجيل دخول جديد من ${params.deviceInfo.deviceLabel}`;

  const heading = params.isTest
    ? 'تم تفعيل خدمة تنبيهات الأمان بنجاح'
    : isFailed
      ? 'رصدنا محاولة تسجيل دخول فاشلة من جهاز أو متصفح غير معروف'
      : 'تم تسجيل الدخول إلى حسابك من جهاز أو متصفح جديد';

  const lead = params.isTest
    ? 'هذه رسالة اختبارية تؤكد أن إشعارات البريد الإلكتروني الفورية لمحاولات الدخول المشبوهة تعمل بشكل سليم.'
    : isFailed
      ? 'حاول شخص ما تسجيل الدخول إلى حسابك من متصفح أو جهاز لم نعرفه مسبقاً وفشلت المحاولة.'
      : 'سجّلنا دخولاً ناجحاً إلى حسابك من جهاز أو متصفح غير معروف مسبقاً.';

  const badgeColor = isFailed ? '#dc2626' : '#0f766e';
  const badgeText = params.isTest
    ? 'رسالة اختبار'
    : isFailed
      ? 'محاولة مرفوضة / غير معروفة'
      : 'دخول جديد ناجح';

  const text = [
    `مرحباً ${params.displayName}،`,
    '',
    heading,
    lead,
    '',
    `الحالة: ${badgeText}`,
    `المتصفح: ${params.deviceInfo.browserLabel}`,
    `النظام / الجهاز: ${params.deviceInfo.osName}`,
    `طريقة الدخول: ${methodLabel}`,
    `العنوان الشبكي التقريبي: ${params.ipMasked}`,
    `التوقيت: ${formattedTime}`,
    '',
    'إذا لم تكن أنت من قام بهذه المحاولة، يرجى تسجيل الدخول فوراً لإنهاء الجلسات غير المعروفة وتغيير كلمة المرور.',
    securityHubUrl ? `مركز الأمان: ${securityHubUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const safeDisplayName = escapeHtml(params.displayName);
  const safeHeading = escapeHtml(heading);
  const safeLead = escapeHtml(lead);
  const safeBadgeText = escapeHtml(badgeText);
  const safeBrowser = escapeHtml(params.deviceInfo.browserLabel);
  const safeOs = escapeHtml(params.deviceInfo.osName);
  const safeMethod = escapeHtml(methodLabel);
  const safeIp = escapeHtml(params.ipMasked);
  const safeTime = escapeHtml(formattedTime);
  const safeUrl = securityHubUrl ? escapeHtml(securityHubUrl) : '';

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<body style="margin:0;padding:24px;background:#0b1220;font-family:Tahoma,Arial,sans-serif;color:#e5e7eb;direction:rtl;">
  <div style="max-width:560px;margin:0 auto;background:#111a2e;border:1px solid #24324d;border-radius:16px;padding:24px;">
    <div style="display:inline-block;padding:4px 12px;border-radius:8px;background:${badgeColor};color:#ffffff;font-size:12px;font-weight:bold;margin-bottom:14px;">
      ${safeBadgeText}
    </div>
    <h1 style="margin:0 0 10px 0;font-size:19px;color:#ffffff;">${safeHeading}</h1>
    <p style="margin:0 0 18px 0;font-size:14px;line-height:1.7;color:#cbd5e1;">
      مرحباً <strong>${safeDisplayName}</strong>،<br/>
      ${safeLead}
    </p>
    <table style="width:100%;border-collapse:collapse;background:#0c1424;border-radius:12px;overflow:hidden;font-size:13px;">
      <tr><td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid #1e293b;">المتصفح المكتشف</td><td style="padding:10px 14px;color:#f8fafc;font-weight:bold;border-bottom:1px solid #1e293b;">${safeBrowser}</td></tr>
      <tr><td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid #1e293b;">الجهاز والنظام</td><td style="padding:10px 14px;color:#f8fafc;font-weight:bold;border-bottom:1px solid #1e293b;">${safeOs}</td></tr>
      <tr><td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid #1e293b;">وسيلة التحقق</td><td style="padding:10px 14px;color:#f8fafc;border-bottom:1px solid #1e293b;">${safeMethod}</td></tr>
      <tr><td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid #1e293b;">العنوان الشبكي</td><td style="padding:10px 14px;color:#f8fafc;border-bottom:1px solid #1e293b;" dir="ltr">${safeIp}</td></tr>
      <tr><td style="padding:10px 14px;color:#94a3b8;">الوقت</td><td style="padding:10px 14px;color:#f8fafc;">${safeTime}</td></tr>
    </table>
    <p style="margin:18px 0 0 0;font-size:13px;line-height:1.7;color:#fda4af;">
      إذا لم تتعرّف على هذا النشاط، ادخل إلى مركز الأمان فوراً لإنهاء الجلسات عن بُعد وتحديث كلمة المرور.
    </p>
    ${
      safeUrl
        ? `<div style="margin-top:16px;"><a href="${safeUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:13px;">مراجعة مركز الأمان</a></div>`
        : ''
    }
  </div>
</body>
</html>`;

  return { subject, html, text };
}

export async function dispatchSecurityLoginEmail(
  params: DispatchSecurityLoginEmailParams
): Promise<EmailDeliveryResult> {
  const { subject, html, text } = buildSecurityAlertEmailContent(params);
  const recipient = (params.recipientEmail || '').trim().toLowerCase();

  if (!recipient || recipient.endsWith('.local') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return {
      status: 'skipped_no_email',
      provider: 'none',
      subject,
      error: 'لا يوجد بريد إلكتروني حقيقي مرتبط بهذا الحساب.',
    };
  }

  if (params.outcome === 'failed' && !params.isTest && !params.bypassCooldown) {
    const cooldownKey = `${params.uid}:${params.deviceInfo.fingerprintHash}`;
    const lastSentAt = failedAttemptEmailCooldowns.get(cooldownKey) || 0;
    const now = Date.now();
    if (now - lastSentAt < FAILED_ATTEMPT_COOLDOWN_MS) {
      return {
        status: 'throttled',
        provider: 'none',
        subject,
        error: 'تم إرسال تنبيه حديث لهذه المحاولة من نفس المتصفح خلال الدقائق الأخيرة.',
      };
    }
    failedAttemptEmailCooldowns.set(cooldownKey, now);
  }

  const smtpHost = process.env.SMTP_HOST?.trim() || '';
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecureEnv = (process.env.SMTP_SECURE || '').trim().toLowerCase();
  const smtpSecure = smtpSecureEnv ? smtpSecureEnv === 'true' : smtpPort === 465;
  const smtpUser = process.env.SMTP_USER?.trim() || '';
  const smtpPass = process.env.SMTP_PASS?.trim() || '';
  const { emailFrom } = resolveFormattedFromAddress();

  let smtpError: string | undefined;
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number.isFinite(smtpPort) ? smtpPort : 587,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 6000,
        greetingTimeout: 6000,
        socketTimeout: 8000,
      });

      const info = await transporter.sendMail({
        from: emailFrom || smtpUser,
        to: recipient,
        subject,
        text,
        html,
      });

      return {
        status: 'sent',
        provider: 'smtp',
        subject,
        messageId: info.messageId,
      };
    } catch (err) {
      smtpError = err instanceof Error ? err.message : 'فشل الإرسال عبر خادم SMTP.';
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim() || '';
  if (resendKey && emailFrom) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [recipient],
          subject,
          text,
          html,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        return {
          status: 'failed',
          provider: 'resend',
          subject,
          error: `Resend HTTP ${res.status}: ${errBody.slice(0, 140)}`,
        };
      }
      const data = (await res.json()) as { id?: string };
      return {
        status: 'sent',
        provider: 'resend',
        subject,
        messageId: data.id,
      };
    } catch (err) {
      return {
        status: 'failed',
        provider: 'resend',
        subject,
        error: err instanceof Error ? err.message : 'فشل الاتصال بخدمة Resend.',
      };
    }
  }

  if (smtpError) {
    return {
      status: 'failed',
      provider: 'smtp',
      subject,
      error: smtpError,
    };
  }

  return {
    status: 'not_configured',
    provider: 'none',
    subject,
    error: 'لم تُضبط بيانات SMTP أو RESEND_API_KEY في إعدادات الخادم السرية بعد.',
  };
}

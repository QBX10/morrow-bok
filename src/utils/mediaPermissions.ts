export type MediaPermissionKind = 'camera' | 'microphone';

export type MediaPermissionStateValue =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported';

export interface MediaPermissionSnapshot {
  kind: MediaPermissionKind;
  state: MediaPermissionStateValue;
  browserSupported: boolean;
}

export interface MediaPermissionGuide {
  kind: MediaPermissionKind;
  title: string;
  reason: string;
  steps: string[];
  fallbackHint: string;
}

export async function queryMediaPermission(
  kind: MediaPermissionKind
): Promise<MediaPermissionSnapshot> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { kind, state: 'unsupported', browserSupported: false };
  }

  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({
        name: kind as PermissionName,
      });
      const val = status.state;
      if (val === 'granted' || val === 'denied' || val === 'prompt') {
        return { kind, state: val, browserSupported: true };
      }
    }
  } catch {
    // Some browsers (e.g., Safari/Firefox) do not expose camera/microphone in navigator.permissions.query
  }

  return { kind, state: 'prompt', browserSupported: true };
}

export function buildPermissionRecoveryGuide(
  kind: MediaPermissionKind,
  errorReason?: string
): MediaPermissionGuide {
  if (kind === 'camera') {
    return {
      kind: 'camera',
      title: 'مطلوب إذن الوصول إلى الكاميرا',
      reason:
        errorReason ||
        'المتصفح منع تشغيل الكاميرا المباشرة أو لا يوجد جهاز كاميرا نشط حالياً.',
      steps: [
        'انقر على أيقونة القفل أو الإعدادات بجانب عنوان الموقع في أعلى المتصفح.',
        'فعّل خيار «الكاميرا / Camera» واضبطه على «السماح / Allow».',
        'اضغط «إعادة فحص الإذن» أدناه، أو استخدم خيار رفع صورة الدفتر مباشرة بدون كاميرا.',
      ],
      fallbackHint:
        'يمكنك الاستمرار فوراً برفع صور الدفتر أو ملفات PDF من جهازك مع بقاء التحقق البصري فعّالاً.',
    };
  }

  return {
    kind: 'microphone',
    title: 'مطلوب إذن الوصول إلى الميكروفون للإملاء الصوتي',
    reason:
      errorReason ||
      'تعذر التقاط الصوت لأن صلاحية الميكروفون مرفوضة أو غير مفعّلة في المتصفح.',
    steps: [
      'انقر على أيقونة القفل أو أذونات الموقع بجانب شريط العنوان في المتصفح.',
      'بدّل إذن «الميكروفون / Microphone» إلى «السماح / Allow».',
      'أغلق أي تطبيق آخر يحتجز الميكروفون ثم اضغط «إعادة فحص الإذن».',
    ],
    fallbackHint:
      'يمكنك كتابة الأوامر أو لصق رسائل الواتساب نصياً مباشرة في مساحة العمل أو المحادثة.',
  };
}

export async function requestMicrophonePermission(): Promise<{
  ok: boolean;
  state: MediaPermissionStateValue;
  guide?: MediaPermissionGuide;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      state: 'unsupported',
      guide: buildPermissionRecoveryGuide(
        'microphone',
        'هذا المتصفح أو البيئة لا تدعم واجهة الميكروفون المباشرة.'
      ),
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return { ok: true, state: 'granted' };
  } catch (err) {
    const errName = err instanceof Error ? err.name : '';
    const denied =
      errName === 'NotAllowedError' ||
      errName === 'PermissionDeniedError' ||
      errName === 'SecurityError';
    const missingDevice = errName === 'NotFoundError' || errName === 'DevicesNotFoundError';

    return {
      ok: false,
      state: denied ? 'denied' : 'prompt',
      guide: buildPermissionRecoveryGuide(
        'microphone',
        missingDevice
          ? 'لم يتم العثور على ميكروفون متصل بهذا الجهاز.'
          : denied
          ? 'تم رفض صلاحية الميكروفون من المتصفح أو النظام.'
          : undefined
      ),
    };
  }
}

export async function requestCameraStreamSafe(
  constraints: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  }
): Promise<{
  ok: boolean;
  stream: MediaStream | null;
  state: MediaPermissionStateValue;
  guide?: MediaPermissionGuide;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      stream: null,
      state: 'unsupported',
      guide: buildPermissionRecoveryGuide(
        'camera',
        'المتصفح الحالي لا يدعم تشغيل الكاميرا المباشرة داخل الصفحة.'
      ),
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { ok: true, stream, state: 'granted' };
  } catch (err) {
    const errName = err instanceof Error ? err.name : '';
    const denied =
      errName === 'NotAllowedError' ||
      errName === 'PermissionDeniedError' ||
      errName === 'SecurityError';
    const missingDevice = errName === 'NotFoundError' || errName === 'DevicesNotFoundError';

    return {
      ok: false,
      stream: null,
      state: denied ? 'denied' : 'prompt',
      guide: buildPermissionRecoveryGuide(
        'camera',
        missingDevice
          ? 'لم يتم العثور على كاميرا متصلة أو متاحة.'
          : denied
          ? 'تم رفض صلاحية الكاميرا. فعّل الإذن من إعدادات الموقع في المتصفح.'
          : 'تعذر فتح الكاميرا — قد تكون قيد الاستخدام في تطبيق آخر.'
      ),
    };
  }
}

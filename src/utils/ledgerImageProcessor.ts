export interface FrameQualityMetrics {
  width: number;
  height: number;
  sharpnessScore: number; // 0 - 100
  contrastScore: number; // 0 - 100
  glareRatio: number; // 0 - 1
  darkShadowRatio: number; // 0 - 1
  overallQualityScore: number; // 0 - 100
  isAcceptable: boolean;
  issues: string[];
}

export interface ProcessedLedgerFrame {
  id: string;
  label: string;
  rawPreviewUrl: string;
  enhancedPreviewUrl: string;
  enhancedBase64: string;
  mimeType: 'image/jpeg';
  skewAngleDeg: number;
  metrics: FrameQualityMetrics;
}

export interface BurstFusionSummary {
  frames: ProcessedLedgerFrame[];
  acceptedFrames: ProcessedLedgerFrame[];
  averageQualityScore: number;
  maxSharpnessScore: number;
  rejected: boolean;
  rejectionReasons: string[];
  enhancementReport: string;
}

export const MIN_CAMERA_FRAME_QUALITY = 42;
export const MIN_CAMERA_SHARPNESS = 16;

/**
 * Pure deterministic evaluator for grayscale luma buffer metrics.
 * Decoupled from DOM/Canvas so unit tests can verify blur/glare/contrast gates.
 */
export function evaluateBurstFrameMetrics(params: {
  width: number;
  height: number;
  lumaSamples: Uint8Array | Uint8ClampedArray;
}): FrameQualityMetrics {
  const { width, height, lumaSamples } = params;
  const total = Math.max(1, width * height);

  if (width < 40 || height < 40 || lumaSamples.length < total) {
    return {
      width,
      height,
      sharpnessScore: 0,
      contrastScore: 0,
      glareRatio: 0,
      darkShadowRatio: 0,
      overallQualityScore: 0,
      isAcceptable: false,
      issues: ['أبعاد الصورة أصغر من الحد الأدنى المطلوب لقراءة الدفتر.'],
    };
  }

  let sum = 0;
  let sumSq = 0;
  let glareCount = 0;
  let darkCount = 0;

  for (let i = 0; i < total; i++) {
    const v = lumaSamples[i];
    sum += v;
    sumSq += v * v;
    if (v >= 248) glareCount += 1;
    if (v <= 28) darkCount += 1;
  }

  const mean = sum / total;
  const variance = Math.max(0, sumSq / total - mean * mean);
  const stdDev = Math.sqrt(variance);

  // Discrete gradient / edge Laplacian energy estimate
  let edgeEnergySum = 0;
  let edgeSamples = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 220));
  for (let y = 1; y < height - 1; y += step) {
    const rowOff = y * width;
    for (let x = 1; x < width - 1; x += step) {
      const idx = rowOff + x;
      const center = lumaSamples[idx];
      const lap =
        Math.abs(
          lumaSamples[idx - 1] +
            lumaSamples[idx + 1] +
            lumaSamples[idx - width] +
            lumaSamples[idx + width] -
            4 * center
        );
      edgeEnergySum += lap;
      edgeSamples += 1;
    }
  }

  const meanLap = edgeSamples > 0 ? edgeEnergySum / edgeSamples : 0;
  const sharpnessScore = Math.max(0, Math.min(100, Math.round((meanLap / 26) * 100)));
  const contrastScore = Math.max(0, Math.min(100, Math.round((stdDev / 58) * 100)));
  const glareRatio = glareCount / total;
  const darkShadowRatio = darkCount / total;

  const issues: string[] = [];
  if (sharpnessScore < MIN_CAMERA_SHARPNESS) {
    issues.push(
      `اهتزاز أو تغبيش شديد في الحروف المكتوبة باليد (حدة الحواف: ${sharpnessScore}%)`
    );
  }
  if (contrastScore < 20) {
    issues.push(
      `تباين الحبر مع الورق ضعيف جدًا أو إضاءة باهتة (التباين: ${contrastScore}%)`
    );
  }
  if (glareRatio > 0.36) {
    issues.push(
      `انعكاس إضاءة/فلاش مرتفع يحجب النص (${Math.round(glareRatio * 100)}%)`
    );
  }
  if (darkShadowRatio > 0.58) {
    issues.push(
      `ظل داكن أو إضاءة منخفضة جدًا تحجب تفاصيل السطور (${Math.round(darkShadowRatio * 100)}%)`
    );
  }

  const glarePenalty = Math.max(0, (glareRatio - 0.18) * 90);
  const darkPenalty = Math.max(0, (darkShadowRatio - 0.35) * 70);
  const rawOverall =
    sharpnessScore * 0.52 + contrastScore * 0.48 - glarePenalty - darkPenalty;
  const overallQualityScore = Math.max(0, Math.min(100, Math.round(rawOverall)));

  const isAcceptable =
    issues.length === 0 && overallQualityScore >= MIN_CAMERA_FRAME_QUALITY;

  if (!isAcceptable && issues.length === 0) {
    issues.push(
      `جودة اللقطة الكلية (${overallQualityScore}%) أقل من الحد الآمن المطلوب (${MIN_CAMERA_FRAME_QUALITY}%).`
    );
  }

  return {
    width,
    height,
    sharpnessScore,
    contrastScore,
    glareRatio,
    darkShadowRatio,
    overallQualityScore,
    isAcceptable,
    issues,
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر تحميل إطار الصورة للمعالجة.'));
    img.src = src;
  });
}

function readSourceAsDataUrl(source: File | string): Promise<string> {
  if (typeof source === 'string') return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.readAsDataURL(source);
  });
}

function extractLumaArray(imageData: ImageData): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const luma = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
    luma[i] = Math.round(
      0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    );
  }
  return luma;
}

/**
 * Estimates gentle page tilt angle (-4 to +4 deg) using horizontal line dark-pixel variance.
 */
function estimateSkewAngleDeg(
  luma: Uint8ClampedArray,
  width: number,
  height: number
): number {
  let bestAngle = 0;
  let bestVar = -1;
  const cx = width / 2;
  const cy = height / 2;
  const step = Math.max(2, Math.floor(width / 180));

  for (let deg = -4; deg <= 4; deg += 1) {
    const rad = (deg * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const rowSums = new Float64Array(height);

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const dx = x - cx;
        const dy = y - cy;
        const ry = Math.round(dy * cos - dx * sin + cy);
        if (ry >= 0 && ry < height) {
          rowSums[ry] += 255 - luma[y * width + x];
        }
      }
    }

    let sum = 0;
    let count = 0;
    for (let y = 0; y < height; y += step) {
      sum += rowSums[y];
      count += 1;
    }
    const mean = count > 0 ? sum / count : 0;
    let v = 0;
    for (let y = 0; y < height; y += step) {
      const diff = rowSums[y] - mean;
      v += diff * diff;
    }
    if (v > bestVar) {
      bestVar = v;
      bestAngle = deg;
    }
  }
  return bestAngle;
}

/**
 * Performs paper background normalization, shadow mitigation & ink contrast sharpening
 * on an offscreen canvas so handwritten digits and Arabic letters stand out crisply.
 */
function applyAdaptivePaperCleanup(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const { data } = imgData;
  const total = width * height;
  const luma = new Uint8ClampedArray(total);
  const hist = new Uint32Array(256);

  for (let i = 0, p = 0; i < total; i++, p += 4) {
    const l = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
    luma[i] = l;
    hist[l] += 1;
  }

  // Compute 4th percentile (ink floor) and 88th percentile (paper ceiling)
  let cum = 0;
  let lowP = 20;
  let highP = 230;
  const lowTarget = total * 0.04;
  const highTarget = total * 0.88;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum <= lowTarget) lowP = v;
    if (cum <= highTarget) highP = v;
  }
  const span = Math.max(35, highP - lowP);

  // Subtle unsharp + contrast stretch blending original chroma with clean paper look
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const p = idx * 4;
      const cur = luma[idx];
      const neighborAvg =
        y > 0 && y < height - 1 && x > 0 && x < width - 1
          ? (luma[idx - 1] + luma[idx + 1] + luma[idx - width] + luma[idx + width]) * 0.25
          : cur;
      const sharpened = cur + (cur - neighborAvg) * 0.45;
      const normalized = Math.max(0, Math.min(255, ((sharpened - lowP) / span) * 255));
      // Mild S-curve to lift faded ink while keeping gray nuances visible to VLM
      const norm01 = normalized / 255;
      const contrastVal =
        norm01 < 0.72
          ? Math.max(0, Math.min(255, Math.round(Math.pow(norm01 / 0.72, 1.15) * 195)))
          : Math.min(255, Math.round(195 + ((norm01 - 0.72) / 0.28) * 60));

      const scale = cur > 4 ? contrastVal / cur : 1;
      // Blend 70% enhanced neutral grayscale + 30% scaled color so blue/red pen ink differences help
      const gray = contrastVal;
      data[p] = Math.max(0, Math.min(255, Math.round(gray * 0.65 + data[p] * scale * 0.35)));
      data[p + 1] = Math.max(
        0,
        Math.min(255, Math.round(gray * 0.65 + data[p + 1] * scale * 0.35))
      );
      data[p + 2] = Math.max(
        0,
        Math.min(255, Math.round(gray * 0.65 + data[p + 2] * scale * 0.35))
      );
      data[p + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export async function preprocessLedgerBurstFrames(
  sources: Array<File | string>
): Promise<BurstFusionSummary> {
  if (!sources.length) {
    return {
      frames: [],
      acceptedFrames: [],
      averageQualityScore: 0,
      maxSharpnessScore: 0,
      rejected: true,
      rejectionReasons: ['لم يتم التقاط أو رفع أي إطار من الدفتر اليدوي.'],
      enhancementReport: 'لا توجد إطارات',
    };
  }

  const processed: ProcessedLedgerFrame[] = [];
  const MAX_DIM = 1480;

  for (let i = 0; i < Math.min(sources.length, 5); i++) {
    const rawUrl = await readSourceAsDataUrl(sources[i]);
    const img = await loadImageElement(rawUrl);

    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const width = Math.max(64, Math.round(img.width * scale));
    const height = Math.max(64, Math.round(img.height * scale));

    const workCanvas = document.createElement('canvas');
    workCanvas.width = width;
    workCanvas.height = height;
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!workCtx) continue;

    workCtx.drawImage(img, 0, 0, width, height);
    const initialLuma = extractLumaArray(workCtx.getImageData(0, 0, width, height));
    const rawMetrics = evaluateBurstFrameMetrics({
      width,
      height,
      lumaSamples: initialLuma,
    });

    const skewAngleDeg = estimateSkewAngleDeg(initialLuma, width, height);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    if (!outCtx) continue;

    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, width, height);
    outCtx.save();
    outCtx.translate(width / 2, height / 2);
    outCtx.rotate((-skewAngleDeg * Math.PI) / 180);
    outCtx.drawImage(workCanvas, -width / 2, -height / 2);
    outCtx.restore();

    applyAdaptivePaperCleanup(outCtx, width, height);

    const enhancedUrl = outCanvas.toDataURL('image/jpeg', 0.9);
    const enhancedBase64 = enhancedUrl.replace(/^data:image\/jpeg;base64,/, '');

    // Keep raw sharpness/dark/glare honesty so blurry frames aren't masked by sharpening
    processed.push({
      id: `frame_${i + 1}_${Date.now()}`,
      label: `لقطة ${i + 1}`,
      rawPreviewUrl: rawUrl,
      enhancedPreviewUrl: enhancedUrl,
      enhancedBase64,
      mimeType: 'image/jpeg',
      skewAngleDeg,
      metrics: rawMetrics,
    });
  }

  const accepted = processed
    .filter((f) => f.metrics.isAcceptable)
    .sort((a, b) => b.metrics.overallQualityScore - a.metrics.overallQualityScore)
    .slice(0, 4);

  const avgQuality = processed.length
    ? Math.round(
        processed.reduce((acc, f) => acc + f.metrics.overallQualityScore, 0) /
          processed.length
      )
    : 0;
  const maxSharpness = processed.length
    ? Math.max(...processed.map((f) => f.metrics.sharpnessScore))
    : 0;

  if (accepted.length === 0) {
    const reasons = Array.from(
      new Set(processed.flatMap((f) => f.metrics.issues))
    );
    return {
      frames: processed,
      acceptedFrames: [],
      averageQualityScore: avgQuality,
      maxSharpnessScore: maxSharpness,
      rejected: true,
      rejectionReasons:
        reasons.length > 0
          ? reasons
          : ['جودة اللقطات غير كافية للقراءة الآمنة. يرجى تثبيت الكاميرا وتحسين الإضاءة.'],
      enhancementReport: `تم فحص ${processed.length} إطارات ورفضها قبل التحليل منعًا للأخطاء.`,
    };
  }

  const avgTilt =
    accepted.reduce((s, f) => s + Math.abs(f.skewAngleDeg), 0) / accepted.length;

  return {
    frames: processed,
    acceptedFrames: accepted,
    averageQualityScore: avgQuality,
    maxSharpnessScore: maxSharpness,
    rejected: false,
    rejectionReasons: [],
    enhancementReport: `تم دمج ${accepted.length} إطارات بعد تنقية الورق وإزالة الظلال (تصحيح ميلان ~${avgTilt.toFixed(1)}° · حدة قصوى ${maxSharpness}%).`,
  };
}

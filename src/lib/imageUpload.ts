export async function optimizeImageToWebP(
  file: File,
  options?: { maxDim?: number; maxChars?: number; quality?: number }
): Promise<string> {
  const maxDim = options?.maxDim ?? 480;
  const maxChars = options?.maxChars ?? 320000;
  const initialQuality = options?.quality ?? 0.75;

  if (!file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (PNG أو JPG أو WebP).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('تعذر معالجة أبعاد الصورة.'));
    el.src = rawDataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
  const targetW = Math.max(1, Math.round((img.width || maxDim) * scale));
  const targetH = Math.max(1, Math.round((img.height || maxDim) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر تهيئة أداة ضغط الصور.');
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let q = initialQuality;
  let result = canvas.toDataURL('image/webp', q);
  if (!result.startsWith('data:image/webp')) {
    result = canvas.toDataURL('image/jpeg', q);
  }
  while (result.length > maxChars && q > 0.35) {
    q = Number((q - 0.1).toFixed(2));
    result = canvas.toDataURL('image/webp', q);
    if (!result.startsWith('data:image/webp')) {
      result = canvas.toDataURL('image/jpeg', q);
    }
  }

  if (result.length > maxChars) {
    throw new Error('حجم الصورة كبير جداً حتى بعد التحويل إلى WebP، يرجى اختيار صورة أصغر.');
  }
  return result;
}

export async function compressImageFileToDataUrl(
  file: File,
  options?: { maxDim?: number; maxChars?: number; quality?: number }
): Promise<string> {
  return optimizeImageToWebP(file, {
    maxDim: options?.maxDim ?? 320,
    maxChars: options?.maxChars ?? 320000,
    quality: options?.quality ?? 0.75,
  });
}

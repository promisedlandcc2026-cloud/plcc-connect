/**
 * Client-side Community post image preparation (aligned with Vault feedImagePrepare).
 * Resizes large phone photos before upload — never send raw multi‑MB originals.
 * Preview uses a short-lived object URL managed by the composer (not this module).
 */

export const FEED_CLIENT_IMAGE_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const FEED_CLIENT_IMAGE_MAX_EDGE = 1800;
export const FEED_CLIENT_IMAGE_JPEG_QUALITY = 0.82;
/** Practical binary target after compression (under JSON/base64 body limits). */
export const FEED_CLIENT_IMAGE_MAX_OUTPUT_BYTES = Math.floor(2.5 * 1024 * 1024);
export const FEED_CLIENT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type PreparedCommunityPostImage = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileBase64: string;
  bytes: number;
  width: number;
  height: number;
};

function rejectType(): never {
  throw new Error('Please choose a JPG, PNG, or WebP image.');
}

function rejectHeic(): never {
  throw new Error(
    "This photo format isn't supported yet. Please choose a JPG, PNG, or WebP image."
  );
}

function rejectSize(): never {
  throw new Error('That photo is too large.');
}

function rejectStillTooLarge(): never {
  throw new Error('This photo is still too large. Please choose another photo.');
}

export function isHeicLikeFile(file: File): boolean {
  const t = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return (
    t === 'image/heic' ||
    t === 'image/heif' ||
    t.includes('heic') ||
    t.includes('heif') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

export function isAcceptedCommunityPostImageFile(file: File): boolean {
  if (!file) return false;
  if (isHeicLikeFile(file)) return false;
  const t = String(file.type || '').toLowerCase();
  if (t === 'image/svg+xml' || t.includes('svg')) return false;
  if (t === 'image/gif' || t.includes('gif')) return false;
  return (FEED_CLIENT_ACCEPTED_TYPES as readonly string[]).includes(t);
}

function scaleDimensions(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function canvasToPrepared(
  canvas: HTMLCanvasElement,
  preferPng: boolean
): Promise<PreparedCommunityPostImage> {
  let outMime: 'image/jpeg' | 'image/png' | 'image/webp' = preferPng
    ? 'image/png'
    : 'image/jpeg';
  let quality = FEED_CLIENT_IMAGE_JPEG_QUALITY;
  let base64 = '';
  let bytes = 0;

  const encode = (mime: 'image/jpeg' | 'image/png', q?: number) => {
    const outDataUrl =
      mime === 'image/png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', q ?? quality);
    base64 = outDataUrl.replace(/^data:[^;]+;base64,/, '');
    bytes = Math.ceil((base64.length * 3) / 4);
    outMime = mime;
  };

  if (preferPng) {
    encode('image/png');
    if (bytes > FEED_CLIENT_IMAGE_MAX_OUTPUT_BYTES) {
      encode('image/jpeg', quality);
      while (bytes > FEED_CLIENT_IMAGE_MAX_OUTPUT_BYTES && quality > 0.5) {
        quality = Math.max(0.5, quality - 0.08);
        encode('image/jpeg', quality);
      }
    }
  } else {
    encode('image/jpeg', quality);
    while (bytes > FEED_CLIENT_IMAGE_MAX_OUTPUT_BYTES && quality > 0.5) {
      quality = Math.max(0.5, quality - 0.08);
      encode('image/jpeg', quality);
    }
  }

  if (bytes > FEED_CLIENT_IMAGE_MAX_OUTPUT_BYTES) rejectStillTooLarge();
  if (bytes > FEED_CLIENT_IMAGE_MAX_SOURCE_BYTES) rejectSize();

  return {
    mimeType: outMime,
    fileBase64: base64,
    bytes,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Read + resize to max long edge, apply EXIF orientation when supported.
 * Does not create a preview URL — callers should use URL.createObjectURL(file).
 */
export async function prepareCommunityPostImageFile(
  file: File
): Promise<PreparedCommunityPostImage> {
  if (!file) rejectType();
  if (isHeicLikeFile(file)) rejectHeic();
  if (!isAcceptedCommunityPostImageFile(file)) rejectType();
  if (file.size > FEED_CLIENT_IMAGE_MAX_SOURCE_BYTES) rejectSize();

  const sourceIsPng = file.type === 'image/png';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image');

  const bitmapFactory = (globalThis as unknown as { createImageBitmap?: typeof createImageBitmap })
    .createImageBitmap;

  if (typeof bitmapFactory === 'function') {
    let bitmap: ImageBitmap;
    try {
      bitmap = await bitmapFactory(file, {
        imageOrientation: 'from-image',
      } as ImageBitmapOptions);
    } catch {
      bitmap = await bitmapFactory(file);
    }
    const scaled = scaleDimensions(bitmap.width, bitmap.height, FEED_CLIENT_IMAGE_MAX_EDGE);
    canvas.width = scaled.width;
    canvas.height = scaled.height;
    ctx.drawImage(bitmap, 0, 0, scaled.width, scaled.height);
    if (typeof bitmap.close === 'function') bitmap.close();
  } else {
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    const scaled = scaleDimensions(img.width, img.height, FEED_CLIENT_IMAGE_MAX_EDGE);
    canvas.width = scaled.width;
    canvas.height = scaled.height;
    ctx.drawImage(img, 0, 0, scaled.width, scaled.height);
  }

  return canvasToPrepared(canvas, sourceIsPng);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Invalid image'));
    img.src = src;
  });
}

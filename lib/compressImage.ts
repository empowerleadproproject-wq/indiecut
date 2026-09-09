export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  // Keep small images untouched. Anything larger is resized/re-encoded before
  // it ever reaches Supabase so the upload cannot hit the bucket object limit.
  const targetBytes = 900 * 1024;
  if (file.size <= targetBytes) return file;

  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.84;
  let blob: Blob | null = null;
  while (quality >= 0.36) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= targetBytes) break;
    quality -= 0.08;
  }

  if (!blob) return file;

  // If the first resize is still too large, progressively reduce dimensions.
  if (blob.size > targetBytes) {
    let current = canvas;
    while (blob.size > targetBytes && current.width > 900 && current.height > 900) {
      const next = document.createElement('canvas');
      next.width = Math.max(1, Math.round(current.width * 0.8));
      next.height = Math.max(1, Math.round(current.height * 0.8));
      const nextCtx = next.getContext('2d');
      if (!nextCtx) break;
      nextCtx.drawImage(current, 0, 0, next.width, next.height);
      const nextBlob = await new Promise<Blob | null>((resolve) => next.toBlob(resolve, 'image/jpeg', 0.68));
      if (!nextBlob) break;
      blob = nextBlob;
      current = next;
    }
  }

  const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-') || 'image';
  return new File([blob], `${base}-optimized.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

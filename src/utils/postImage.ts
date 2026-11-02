import { getStoredToken } from './authSession';

const MAX_SIDE = 1080; // what Facebook and Instagram show; larger only costs bytes

/** Draws an image (data URL or blob URL) onto a canvas and re-encodes it small: WebP, or JPEG where WebP can't be encoded. */
async function compress(src: string): Promise<Blob | null> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const encode = (type: string, quality: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  const webp = await encode('image/webp', 0.82);
  return webp?.type === 'image/webp' ? webp : encode('image/jpeg', 0.85);
}

/**
 * Turns a generated or dropped image into a stored file and returns its public URL, so posts
 * carry a short link instead of megabytes of base64. URLs that aren't data URLs pass through.
 * On any failure the original is returned, so a post never loses its image.
 */
export async function storePostImage(src: string): Promise<string> {
  if (!src.startsWith('data:')) return src;
  try {
    const blob = await compress(src);
    if (!blob) return src;
    const form = new FormData();
    form.append('image', blob, `post.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`);
    const token = getStoredToken();
    const res = await fetch('/api/images', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) return src;
    const { url } = await res.json();
    return typeof url === 'string' ? url : src;
  } catch {
    return src;
  }
}

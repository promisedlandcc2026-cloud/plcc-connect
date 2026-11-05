/** Church photo gallery — the same photos as sanctum-live-nine.vercel.app/gallery, via /api/gallery. */

export type GalleryItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail: string;
  title: string;
  category: string;
  description?: string;
  width?: number;
  height?: number;
  credit?: { name: string; url: string };
};

export type GalleryFeed = {
  leah: GalleryItem[];
  church: GalleryItem[];
  videos: GalleryItem[];
};

export const LEAH_GALLERY_URL = 'https://leah6583.pixieset.com/anointedworshipcenter/';

let pending: Promise<GalleryFeed> | null = null;

export function loadGallery(): Promise<GalleryFeed> {
  if (!pending) {
    pending = fetch('/api/gallery', { headers: { Accept: 'application/json' } })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as (Partial<GalleryFeed> & { ok?: boolean; message?: string }) | null;
        if (!r.ok || !body?.ok) throw new Error(body?.message || 'We couldn’t load the gallery. Please try again.');
        return {
          leah: Array.isArray(body.leah) ? body.leah : [],
          church: Array.isArray(body.church) ? body.church : [],
          videos: Array.isArray(body.videos) ? body.videos : [],
        };
      })
      .catch((err) => {
        pending = null; // let the next visit try again
        throw err;
      });
  }
  return pending;
}

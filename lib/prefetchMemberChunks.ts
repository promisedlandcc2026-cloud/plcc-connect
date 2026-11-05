/**
 * Safe code-chunk prefetch helpers for approved-member navigation.
 * Prefetches JS only — never private API data.
 */

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

function connectionLooksConstrained(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  const t = String(conn.effectiveType || '');
  return t === 'slow-2g' || t === '2g';
}

/** Prefetch a dynamic import when idle / connection is suitable. */
export function prefetchWhenReady(loader: () => Promise<unknown>): void {
  if (typeof window === 'undefined') return;
  if (connectionLooksConstrained()) return;

  const run = () => {
    void loader().catch(() => {
      /* ignore prefetch failures */
    });
  };

  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;

  if (typeof ric === 'function') {
    ric(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 400);
  }
}

export function prefetchCommunityChunks(): void {
  prefetchWhenReady(() => import('../pages/CommunityProvidersLayout'));
  prefetchWhenReady(() => import('../pages/CommunityFeed'));
}

export function prefetchCommunityChatChunks(): void {
  prefetchWhenReady(() => import('../pages/CommunityProvidersLayout'));
  prefetchWhenReady(() => import('../pages/CommunityChat'));
}

export function prefetchNotificationsChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberNotifications'));
}

export function prefetchAccountChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberAccount'));
}

export function prefetchProfileChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberProfile'));
}

export function prefetchDirectoryChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberDirectory'));
}

export function prefetchPrayerChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberPrayer'));
}

export function prefetchEventsChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberEvents'));
}

export function prefetchMoreChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberMore'));
  prefetchWhenReady(() => import('../pages/MemberAccount'));
  prefetchWhenReady(() => import('../pages/MemberNotifications'));
  prefetchWhenReady(() => import('../pages/MemberNotes'));
  prefetchWhenReady(() => import('../pages/MemberCard'));
  prefetchWhenReady(() => import('../pages/MemberFamily'));
  prefetchWhenReady(() => import('../pages/MemberKidsPlans'));
  prefetchWhenReady(() => import('../pages/MemberProfile'));
  prefetchWhenReady(() => import('../pages/MemberDirectory'));
}

export function prefetchServeChunks(): void {
  prefetchWhenReady(() => import('../pages/MemberServe'));
  prefetchWhenReady(() => import('../pages/MemberServeMy'));
  prefetchWhenReady(() => import('../pages/MemberServeDetail'));
}

export function prefetchSundayChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberSunday'));
}

export function prefetchBibleChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberBible'));
}

export function prefetchGalleryChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberGallery'));
}

export function prefetchNotesChunks(): void {
  prefetchWhenReady(() => import('../pages/MemberNotes'));
  prefetchWhenReady(() => import('../pages/MemberNoteEditor'));
}

export function prefetchCardChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberCard'));
}

export function prefetchFamilyChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberFamily'));
}

export function prefetchDependentCardChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberDependentCard'));
}

export function prefetchKidsPlansChunk(): void {
  prefetchWhenReady(() => import('../pages/MemberKidsPlans'));
}

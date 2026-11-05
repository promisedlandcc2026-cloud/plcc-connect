/**
 * Celebrations — pure helpers (no network) for birthdays & anniversaries:
 * what to call each one, when it is, and a friendly message to start from.
 */

export type AnniversaryKind = 'wedding' | 'other';
export type BlessingOccasion = 'birthday' | 'wedding' | 'other';

export type Celebration = {
  directoryId: string;
  partnerUserId: string;
  displayName: string;
  avatarUrl: string | null;
  occasion: 'birthday' | 'anniversary';
  anniversaryKind: AnniversaryKind | null;
  anniversaryLabel: string | null;
  monthDay: string;
  daysAway: number;
};

export const ANNIVERSARY_LABEL_MAX = 40;

/** Suggestions shown under "Other" on My Profile. */
export const OTHER_ANNIVERSARY_IDEAS = ['Salvation', 'Baptism', 'Joined PLCC', 'Ordination'];

/** "Wedding anniversary", "Salvation anniversary", or plain "Anniversary". */
export function anniversaryTitle(kind: AnniversaryKind | null | undefined, label?: string | null): string {
  if (kind === 'wedding') return 'Wedding anniversary';
  const name = (label || '').trim();
  if (kind === 'other' && name) {
    return /anniversary$/i.test(name) ? name : `${name} anniversary`;
  }
  return 'Anniversary';
}

/** What this celebration is, for cards and the blessing sheet. */
export function celebrationTitle(c: Pick<Celebration, 'occasion' | 'anniversaryKind' | 'anniversaryLabel'>): string {
  return c.occasion === 'birthday' ? 'Birthday' : anniversaryTitle(c.anniversaryKind, c.anniversaryLabel);
}

export function celebrationEmoji(c: Pick<Celebration, 'occasion' | 'anniversaryKind'>): string {
  if (c.occasion === 'birthday') return '🎂';
  return c.anniversaryKind === 'wedding' ? '💍' : '✨';
}

/** The occasion to pre-select in the blessing sheet. */
export function defaultOccasion(c: Pick<Celebration, 'occasion' | 'anniversaryKind'>): BlessingOccasion {
  if (c.occasion === 'birthday') return 'birthday';
  return c.anniversaryKind === 'other' ? 'other' : 'wedding';
}

/** "Today", "Tomorrow", or e.g. "Sat, Oct 31". */
export function whenLabel(daysAway: number, now: Date = new Date()): string {
  if (daysAway <= 0) return 'Today';
  if (daysAway === 1) return 'Tomorrow';
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAway);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** First name for a warm greeting ("Brother Sam" stays "Brother Sam"). */
export function greetingName(displayName: string): string {
  const name = displayName.trim();
  if (/^(brother|sister|pastor|minister|elder|deacon|deaconess|evangelist|prophet|apostle|bishop|mother|father)\s/i.test(name)) {
    return name.split(/\s+/).slice(0, 2).join(' ');
  }
  return name.split(/\s+/)[0] || name;
}

/** A starter message the sender can edit before sending. */
export function blessingTemplate(
  occasion: BlessingOccasion,
  displayName: string,
  opts?: { otherLabel?: string | null; daysAway?: number }
): string {
  const name = greetingName(displayName);
  const early = opts?.daysAway && opts.daysAway > 0 ? ' (a little early!)' : '';
  switch (occasion) {
    case 'birthday':
      return `Happy birthday, ${name}!${early} 🎂 Praying God's richest blessings over you this year. "The LORD bless thee, and keep thee." — Numbers 6:24`;
    case 'wedding':
      return `Happy anniversary, ${name}!${early} 💍 Thanking God for your marriage and praying He keeps you both close to Him and to each other.`;
    case 'other': {
      const what = (opts?.otherLabel || '').trim();
      const title = what ? anniversaryTitle('other', what).toLowerCase() : 'special day';
      return `Happy ${title}, ${name}!${early} ✨ Celebrating what God has done in your life. Praying blessings over you today.`;
    }
  }
}

export const asTrimmed = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
};
export const asAnniversaryKind = (v: unknown): AnniversaryKind | null => (v === 'wedding' || v === 'other' ? v : null);

export function sanitizeCelebration(raw: unknown): Celebration | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const directoryId = asTrimmed(o.directoryId);
  const partnerUserId = asTrimmed(o.partnerUserId);
  const displayName = asTrimmed(o.displayName);
  const monthDay = asTrimmed(o.monthDay);
  const occasion = o.occasion === 'birthday' || o.occasion === 'anniversary' ? o.occasion : null;
  const daysAway = Number(o.daysAway);
  if (!directoryId || !partnerUserId || !displayName || !occasion || !monthDay || !Number.isFinite(daysAway)) return null;
  return {
    directoryId,
    partnerUserId,
    displayName,
    avatarUrl: asTrimmed(o.avatarUrl),
    occasion,
    anniversaryKind: occasion === 'anniversary' ? asAnniversaryKind(o.anniversaryKind) : null,
    anniversaryLabel: occasion === 'anniversary' ? asTrimmed(o.anniversaryLabel) : null,
    monthDay,
    daysAway: Math.max(0, Math.round(daysAway)),
  };
}

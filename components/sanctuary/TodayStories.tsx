/**
 * "Today at PLCC" — story circles for today's verse, the featured holiday
 * sign-up, Vault News, the prayer wall and praise reports (Vault News
 * celebrations). A gold ring means something new since you last looked.
 * Circles without content hide themselves; each source loads on its own.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookMarked, BookOpenText, HandHeart, Newspaper, PartyPopper, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { getTodaysWord, churchDateKey } from '../../lib/todaysWord';
import { featuredHolidayRsvp } from '../../lib/holidayRsvps';
import { useRemovedHolidayIds } from '../../lib/holidayRsvpLive';
import { fetchVaultNews } from '../../lib/vaultNewsClient';
import { fetchMemberHomePrayers, type HomePrayerPreview } from '../../lib/memberHomeData';
import { formatVaultNewsWhen, VAULT_NEWS_KIND_LABEL, vaultNewsRoleLabel, type VaultNewsItem } from '../../lib/vaultNews';
import { goToHomeSection } from '../../lib/homeSectionNav';
import { prefetchBibleChunk } from '../../lib/prefetchMemberChunks';
import { isUnseen, markSeen, readSeen, splitVaultNews, stampFor, type StoryId } from '../../lib/todayStories';
import { StoryViewer, type StorySlide } from './StoryViewer';
import { holidayInviteSlides } from './HolidayInviteStory';

type Story = {
  id: StoryId;
  label: string;
  eyebrow: string;
  icon: LucideIcon;
  stamp: string;
  slides: StorySlide[];
};

const SlideBody: React.FC<{ kicker: string; children: React.ReactNode; footer?: React.ReactNode }> = ({
  kicker,
  children,
  footer,
}) => (
  <>
    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 pt-10">
      <p className="text-[13px] font-extrabold tracking-[0.16em] text-[#F2D98A]">{kicker}</p>
      {children}
    </div>
    {footer ? <div className="px-5 pb-2 pt-4">{footer}</div> : null}
  </>
);

const ctaClass =
  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-leaf text-base font-extrabold text-wine';

/** `visitor`: no Vault News (members only); prayer CTA scrolls to the public wall. */
export const TodayStories: React.FC<{ visitor?: boolean }> = ({ visitor = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [seen, setSeen] = useState<Record<string, string>>(readSeen);
  const [news, setNews] = useState<VaultNewsItem[]>([]);
  const [praise, setPraise] = useState<VaultNewsItem[]>([]);
  const [prayers, setPrayers] = useState<HomePrayerPreview[]>([]);
  const [openId, setOpenId] = useState<StoryId | null>(null);
  const removedHolidayIds = useRemovedHolidayIds();

  useEffect(() => {
    let alive = true;
    if (!visitor) {
      fetchVaultNews()
        .then((list) => {
          if (!alive) return;
          const split = splitVaultNews(list.news);
          setNews(split.news);
          setPraise(split.praise);
        })
        .catch(() => undefined);
    }
    fetchMemberHomePrayers({ limit: 4 })
      .then((list) => alive && setPrayers(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [visitor]);

  const stories = useMemo<Story[]>(() => {
    const out: Story[] = [];
    const word = getTodaysWord();
    out.push({
      id: 'verse',
      label: 'Verse',
      eyebrow: 'PLCC · Today’s word',
      icon: BookOpenText,
      stamp: `${churchDateKey()}:${word.id}`,
      slides: [
        {
          key: `verse-${word.id}`,
          content: (
            <SlideBody
              kicker={`TODAY’S WORD · ${word.word.toUpperCase()}`}
              footer={
                visitor ? undefined : (
                  <Link to={`/bible?q=${encodeURIComponent(word.reference)}`} className={ctaClass} onClick={() => setOpenId(null)}>
                    <BookMarked size={20} aria-hidden />
                    Read the chapter
                  </Link>
                )
              }
            >
              <blockquote className="mt-6">
                <p className="font-display text-[34px] leading-[1.15] font-bold">“{word.verse}”</p>
                <footer className="mt-4 text-base font-bold text-[#F2D98A]">{word.reference}</footer>
              </blockquote>
              <p className="mt-8 rounded-[18px] bg-black/25 p-4 text-[15px] leading-relaxed text-cream/90">
                <span className="font-bold text-cream">{word.word}:</span> {word.meaning}
              </p>
            </SlideBody>
          ),
        },
      ],
    });

    const rsvp = featuredHolidayRsvp(new Date(), { removedIds: removedHolidayIds });
    if (rsvp) {
      out.push({
        id: 'holiday',
        label: rsvp.title.replace(/ Dinner$/, ''),
        eyebrow: 'PLCC · Holiday sign-ups',
        icon: UtensilsCrossed,
        stamp: rsvp.eventId,
        slides: holidayInviteSlides(rsvp),
      });
    }

    const newsSlides = (items: VaultNewsItem[], idPrefix: string): StorySlide[] =>
      items.map((n) => ({
        key: `${idPrefix}-${n.id}`,
        content: (
          <SlideBody
            kicker={`VAULT NEWS · ${(VAULT_NEWS_KIND_LABEL[n.kind] || 'Church').toUpperCase()}`}
            footer={
              <button
                type="button"
                className={ctaClass}
                onClick={() => {
                  setOpenId(null);
                  goToHomeSection(location.pathname, navigate, 'vault-news');
                }}
              >
                Open Vault News
              </button>
            }
          >
            <h2 className="mt-4 font-display text-[32px] leading-[1.1] font-bold">{n.title}</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-cream/90">{n.body}</p>
            <p className="mt-5 text-sm font-semibold text-cream/80">
              {[n.author_name, n.author_role ? vaultNewsRoleLabel(n.author_role) : null, formatVaultNewsWhen(n.created_at)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </SlideBody>
        ),
      }));

    if (news.length) {
      out.push({ id: 'news', label: 'Vault News', eyebrow: 'PLCC · Vault News', icon: Newspaper, stamp: stampFor(news), slides: newsSlides(news, 'news') });
    }

    if (prayers.length) {
      out.push({
        id: 'prayer',
        label: 'Prayer',
        eyebrow: 'PLCC · Prayer wall',
        icon: HandHeart,
        stamp: stampFor(prayers),
        slides: prayers.map((p) => ({
          key: `prayer-${p.id}`,
          content: (
            <SlideBody
              kicker="PRAY WITH US"
              footer={
                visitor ? (
                  <button
                    type="button"
                    className={ctaClass}
                    onClick={() => {
                      setOpenId(null);
                      goToHomeSection(location.pathname, navigate, 'prayer-wall');
                    }}
                  >
                    Open the prayer wall
                  </button>
                ) : (
                  <Link to="/prayer" className={ctaClass} onClick={() => setOpenId(null)}>
                    Open the prayer wall
                  </Link>
                )
              }
            >
              <p className="mt-6 font-display text-[28px] leading-[1.2] font-bold">{p.content}</p>
              <p className="mt-5 text-base font-bold text-[#F2D98A]">— {p.memberName}</p>
            </SlideBody>
          ),
        })),
      });
    }

    if (praise.length) {
      out.push({ id: 'praise', label: 'Praise', eyebrow: 'PLCC · Praise reports', icon: PartyPopper, stamp: stampFor(praise), slides: newsSlides(praise, 'praise') });
    }
    return out;
  }, [news, praise, prayers, location.pathname, navigate, visitor, removedHolidayIds]);

  const openIndex = stories.findIndex((s) => s.id === openId);
  const open = openIndex >= 0 ? stories[openIndex] : null;

  const openStory = (s: Story) => {
    setSeen(markSeen(s.id, s.stamp));
    setOpenId(s.id);
  };

  /** Bible — opens the reader (members only; the reader needs sign-in). Sits right after Verse. */
  const bibleCircle = visitor ? null : (
    <li className="shrink-0">
      <Link
        to="/bible"
        onMouseEnter={prefetchBibleChunk}
        onTouchStart={prefetchBibleChunk}
        onFocus={prefetchBibleChunk}
        aria-label="Bible"
        className="flex min-w-[64px] flex-col items-center gap-1.5 text-cream"
      >
        {/* Always gold: it is a shortcut, not a story with a seen/unseen state. */}
        <span className="awc-story-ring flex h-16 w-16 items-center justify-center rounded-full p-[3px]" data-unseen="true">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-wine text-[#F2D98A]">
            <BookMarked size={24} strokeWidth={1.9} aria-hidden />
          </span>
        </span>
        <span className="whitespace-nowrap text-xs font-semibold">Bible</span>
      </Link>
    </li>
  );

  return (
    <section aria-labelledby="today-at-awc-title">
      <h2 id="today-at-awc-title" className="mx-6 mb-2.5 text-[15px] font-bold text-cream/90">
        Today at PLCC
      </h2>
      <ul className="no-scrollbar flex gap-3.5 overflow-x-auto px-5 pb-1">
        {stories.map((s) => {
          const Icon = s.icon;
          const unseen = isUnseen(seen, s.id, s.stamp);
          return (
            <React.Fragment key={s.id}>
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => openStory(s)}
                aria-label={`${s.label}${unseen ? ', new' : ''}`}
                className="flex min-w-[64px] flex-col items-center gap-1.5 text-cream"
              >
                <span className="awc-story-ring flex h-16 w-16 items-center justify-center rounded-full p-[3px]" data-unseen={unseen ? 'true' : 'false'}>
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-wine text-[#F2D98A]">
                    <Icon size={24} strokeWidth={1.9} aria-hidden />
                  </span>
                </span>
                <span className="whitespace-nowrap text-xs font-semibold">{s.label}</span>
              </button>
            </li>
            {s.id === 'verse' ? bibleCircle : null}
            </React.Fragment>
          );
        })}
      </ul>
      {open ? (
        <StoryViewer
          title={open.label}
          eyebrow={open.eyebrow}
          slides={open.slides}
          onClose={() => setOpenId(null)}
          onFinish={() => {
            const following = stories[openIndex + 1];
            if (following) openStory(following);
            else setOpenId(null);
          }}
        />
      ) : null}
    </section>
  );
};

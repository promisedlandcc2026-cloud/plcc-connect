/**
 * Phase 2.8B — Privacy-first Member Directory (opted-in browse + search).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { MemberHowToNote } from '../components/member/MemberHowToNote';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { cardInitials } from '../lib/memberCardUi';
import {
  DirectoryClientError,
  directoryErrorMessage,
  formatDirectoryMonthDay,
  listMemberDirectory,
  searchMemberDirectory,
  type DirectoryMember,
} from '../lib/memberDirectoryClient';
import { BlessingSheet } from '../components/member/BlessingSheet';
import { listAnniversaryKinds, listCelebrations } from '../lib/celebrationsClient';
import { anniversaryTitle, celebrationEmoji, celebrationTitle, whenLabel, type AnniversaryKind, type Celebration } from '../lib/blessings';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function DirectoryAvatar({ member }: { member: DirectoryMember }) {
  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt=""
        className="h-11 w-11 rounded-2xl object-cover border border-burgundy/15 shrink-0"
      />
    );
  }
  return (
    <div
      className="h-11 w-11 rounded-2xl bg-burgundy/5 text-burgundy border border-burgundy/10 flex items-center justify-center text-xs font-black shrink-0"
      aria-hidden
    >
      {cardInitials(member.displayName)}
    </div>
  );
}

function DirectoryRow({
  member,
  kind,
  celebrations,
  onBless,
}: {
  member: DirectoryMember;
  kind?: { kind: AnniversaryKind; label: string | null };
  celebrations: Celebration[];
  onBless: (c: Celebration) => void;
}) {
  const birthday = formatDirectoryMonthDay(member.birthdayMd);
  const anniversary = formatDirectoryMonthDay(member.anniversaryMd);
  const meta: string[] = [];
  if (member.householdName) meta.push(member.householdName);
  if (birthday) meta.push(`Birthday ${birthday}`);
  if (anniversary) meta.push(`${anniversaryTitle(kind?.kind, kind?.label)} ${anniversary}`);

  return (
    <article className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <DirectoryAvatar member={member} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-burgundy truncate">{member.displayName}</p>
          {meta.length > 0 ? (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{meta.join(' · ')}</p>
          ) : null}
          {member.phone ? (
            <p className="text-xs text-gray-600 mt-1">
              <a href={`tel:${member.phone}`} className="font-semibold text-burgundy">
                {member.phone}
              </a>
            </p>
          ) : null}
          {member.email ? (
            <p className="text-xs text-gray-600 mt-0.5 truncate">
              <a href={`mailto:${member.email}`} className="font-semibold text-burgundy">
                {member.email}
              </a>
            </p>
          ) : null}
          {member.ministries.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {member.ministries.slice(0, 4).map((m) => (
                <span
                  key={m}
                  className="inline-flex rounded-lg bg-gray-50 border border-gray-100 px-2 py-0.5 text-xs font-bold text-burgundy"
                >
                  {m}
                </span>
              ))}
            </div>
          ) : null}
          {celebrations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {celebrations.map((c) => (
                <button
                  key={c.occasion}
                  type="button"
                  onClick={() => onBless(c)}
                  className="inline-flex items-center gap-1 min-h-[40px] rounded-xl bg-burgundy px-3 text-xs font-bold text-white"
                >
                  <span aria-hidden>{celebrationEmoji(c)}</span>
                  {celebrationTitle(c)} {c.daysAway <= 1 ? whenLabel(c.daysAway).toLowerCase() : whenLabel(c.daysAway)} · 💌 Bless
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export const MemberDirectoryPage: React.FC = () => {
  const [letter, setLetter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kinds, setKinds] = useState<Map<string, { kind: AnniversaryKind; label: string | null }>>(new Map());
  const [celebrating, setCelebrating] = useState<Celebration[]>([]);
  const [blessing, setBlessing] = useState<Celebration | null>(null);

  useEffect(() => {
    void listAnniversaryKinds().then(setKinds).catch(() => undefined);
    void listCelebrations(7).then(setCelebrating).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const mode = debouncedQuery.length >= 2 ? 'search' : 'browse';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'search') {
        setItems(await searchMemberDirectory(debouncedQuery));
      } else {
        setItems(await listMemberDirectory({ letter, limit: 80 }));
      }
    } catch (err) {
      const code = err instanceof DirectoryClientError ? err.code : 'directory_unavailable';
      setError(err instanceof DirectoryClientError ? err.message : directoryErrorMessage(code));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mode, debouncedQuery, letter]);

  useEffect(() => {
    void load();
  }, [load]);

  const emptyHint = useMemo(() => {
    if (mode === 'search') {
      return 'Try another name, or ask members to opt in under My Profile → Privacy.';
    }
    return 'Members appear here only after they opt in under My Profile → Privacy & directory. Children are never listed automatically.';
  }, [mode]);

  return (
    <main className="flex-1 px-5 pt-10 pb-28 max-w-[500px] w-full mx-auto">
      <MemberPageHeader
        title="Directory"
        subtitle="Find church members who chose to appear here. You control your own visibility in My Profile."
        backTo="/me"
        backLabel="Me"
      />

      <div className="space-y-4">
        <MemberHowToNote focus="directory" />

        <label className="block relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="w-full min-h-[48px] rounded-2xl bg-white border border-gray-100 pl-10 pr-4 text-sm font-semibold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-gold/40 shadow-sm"
            aria-label="Search directory"
          />
        </label>

        {mode === 'browse' ? (
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Browse by letter"
          >
            <button
              type="button"
              onClick={() => setLetter(null)}
              className={`min-h-[40px] min-w-[40px] px-2.5 rounded-xl text-sm font-bold ${
                letter == null
                  ? 'bg-burgundy text-white'
                  : 'bg-white border border-gray-100 text-burgundy'
              }`}
            >
              All
            </button>
            {LETTERS.map((L) => (
              <button
                key={L}
                type="button"
                onClick={() => setLetter(L)}
                className={`min-h-[40px] min-w-[40px] rounded-xl text-sm font-bold ${
                  letter === L
                    ? 'bg-burgundy text-white'
                    : 'bg-white border border-gray-100 text-burgundy'
                }`}
              >
                {L}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Searching for “{debouncedQuery}” ·{' '}
            <button
              type="button"
              className="font-bold text-burgundy"
              onClick={() => setQuery('')}
            >
              Clear
            </button>
          </p>
        )}

        <p className="text-xs text-gray-500 leading-relaxed">
          Opt in or change what others see in{' '}
          <Link to="/profile" className="font-bold text-burgundy">
            My Profile
          </Link>
          .
        </p>

        {loading ? <LoadingState message="Loading directory…" /> : null}

        {!loading && error ? (
          <ErrorState message={error} onRetry={() => void load()} retryLabel="Retry" />
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-2 shadow-sm">
            <EmptyState
              message={mode === 'search' ? 'No matches' : 'No members to show yet'}
              hint={emptyHint}
            />
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <section aria-labelledby="directory-results-heading" className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <Users size={14} className="text-gold" aria-hidden />
              <h2 id="directory-results-heading" className="text-sm font-black text-[#1A1A1A]">
                {items.length} member{items.length === 1 ? '' : 's'}
              </h2>
            </div>
            <ul className="space-y-2">
              {items.map((m) => (
                <li key={m.directoryId}>
                  <DirectoryRow
                    member={m}
                    kind={kinds.get(m.directoryId)}
                    celebrations={celebrating.filter((c) => c.directoryId === m.directoryId)}
                    onBless={setBlessing}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <BlessingSheet celebration={blessing} onClose={() => setBlessing(null)} />
    </main>
  );
};

export default MemberDirectoryPage;

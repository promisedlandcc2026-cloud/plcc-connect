import React, { useCallback, useEffect, useState } from 'react';
import { Mail, MessageCircle, Share2, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ErrorState, LoadingState } from '../ui/States';
import { MemberHomeSection } from './MemberHomeSection';
import {
  canPostVaultNews,
  formatVaultNewsWhen,
  VAULT_NEWS_KIND_LABEL,
  vaultNewsRoleLabel,
  vaultNewsShareText,
  type VaultNewsItem,
  type VaultNewsKind,
} from '../../lib/vaultNews';
import {
  fetchDatabaseHealth,
  fetchVaultNews,
  postVaultNews,
  type DatabaseHealth,
} from '../../lib/vaultNewsClient';

function emailShareHref(item: VaultNewsItem): string {
  return `mailto:?subject=${encodeURIComponent(`Vault News: ${item.title}`)}&body=${encodeURIComponent(vaultNewsShareText(item))}`;
}

function whatsappShareHref(item: VaultNewsItem): string {
  return `https://wa.me/?text=${encodeURIComponent(vaultNewsShareText(item))}`;
}

function messagesShareHref(item: VaultNewsItem): string {
  return `sms:?&body=${encodeURIComponent(vaultNewsShareText(item))}`;
}

export const MemberHomeVaultNews: React.FC = () => {
  const { identity } = useAuth();
  const canPost = canPostVaultNews(identity?.role);
  const HEALTH_RECHECK_MS = 60_000;
  const [database, setDatabase] = useState<DatabaseHealth>('checking');
  const [news, setNews] = useState<VaultNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<VaultNewsKind>('church');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState('');
  const [shareOpenId, setShareOpenId] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [health, list] = await Promise.all([
      fetchDatabaseHealth(),
      fetchVaultNews().catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Vault News is temporarily unavailable. Please try again.';
        return { error: message as string };
      }),
    ]);
    setDatabase(health);
    if ('error' in list) {
      setNews([]);
      setError(list.error);
    } else {
      setNews(list.news);
      setNeedsSetup(list.needsSetup);
      if (list.database === 'unavailable') setDatabase('unavailable');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the database badge live while Home is open (members check it before
  // starting a huddle): every minute, and right away when the app comes back.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchDatabaseHealth().then(setDatabase);
    };
    const timer = window.setInterval(recheck, HEALTH_RECHECK_MS);
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('online', recheck);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('online', recheck);
    };
  }, []);

  const shareViaMessengers = async (item: VaultNewsItem) => {
    const text = vaultNewsShareText(item);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: item.title, text });
        setShareNote('');
        return;
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNote('Copied. Paste it into Messages or Messenger if the app did not open.');
    } catch {
      setShareNote('Open Messages and paste this news if the app did not open.');
    }
    window.location.href = messagesShareHref(item);
  };

  const onPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (posting) return;
    setFormError('');
    setPosting(true);
    try {
      const item = await postVaultNews({ title, body, kind });
      setTitle('');
      setBody('');
      setKind('church');
      setNews((prev) => [item, ...prev]);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Could not save that news item.');
    } finally {
      setPosting(false);
    }
  };

  const healthy = database === 'healthy';

  return (
    <MemberHomeSection
      id="vault-news"
      title="Vault News"
      aside={
        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${
            database === 'checking'
              ? 'bg-gray-100 text-gray-500'
              : healthy
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-900'
          }`}
        >
          <ShieldCheck size={12} aria-hidden />
          {database === 'checking'
            ? 'Checking'
            : healthy
              ? 'Database healthy'
              : 'Database unavailable'}
        </span>
      }
    >
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {database === 'unavailable' ? (
          <p className="px-4 py-3 border-b border-gray-100 bg-amber-50/60 text-sm text-amber-950 leading-relaxed">
            Live Huddles still open for anyone who joined one in the last 12 hours, and switch to the
            backup line if the main line is busy. We’ll update this as soon as the database is back.
          </p>
        ) : null}

        {canPost ? (
          <form onSubmit={(e) => void onPost(e)} className="px-4 py-4 border-b border-gray-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="sm:col-span-2 block">
                <span className="text-xs font-black uppercase tracking-widest text-gray-500">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  required
                  className="mt-1.5 w-full min-h-[44px] px-3 rounded-xl border border-gray-200 text-sm font-medium outline-none focus:border-burgundy"
                  placeholder="A short headline"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-gray-500">Kind</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as VaultNewsKind)}
                  className="mt-1.5 w-full min-h-[44px] px-3 rounded-xl border border-gray-200 text-sm font-medium outline-none focus:border-burgundy bg-white"
                >
                  <option value="church">Church</option>
                  <option value="database">Database</option>
                  <option value="celebration">Celebration</option>
                  <option value="sympathy">Sympathy</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-gray-500">Note</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                required
                rows={3}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium outline-none focus:border-burgundy resize-y"
                placeholder="An engagement, a sympathy note, or a database update"
              />
            </label>
            {formError ? <p className="text-xs font-bold text-rose-700">{formError}</p> : null}
            {needsSetup ? (
              <p className="text-xs font-medium text-amber-900">
                Vault News isn’t switched on yet. Post from PLCC Vault once setup is finished.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={posting}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gold text-burgundy text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post news'}
            </button>
          </form>
        ) : null}

        <div className="divide-y divide-gray-100">
          {loading ? <div className="p-4"><LoadingState message="Loading news…" /></div> : null}
          {!loading && error ? <div className="p-4"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
          {!loading && !error && news.length === 0 ? (
            <p className="px-4 py-4 text-sm font-medium text-gray-500">No news yet.</p>
          ) : null}
          {!loading && !error
            ? news.map((item) => (
                <article key={item.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-black uppercase tracking-wider text-burgundy/70">
                      {VAULT_NEWS_KIND_LABEL[item.kind] || 'Church'}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">
                      {formatVaultNewsWhen(item.created_at)}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-[#1A1A1A] tracking-tight">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">
                    {item.body}
                  </p>
                  <p className="mt-2 text-xs font-bold text-gray-500">
                    {item.author_name || 'Leader'}
                    {item.author_role ? ` · ${vaultNewsRoleLabel(item.author_role)}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShareNote('');
                        setShareOpenId((current) => (current === item.id ? null : item.id));
                      }}
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest text-[#1A1A1A]"
                      aria-expanded={shareOpenId === item.id}
                    >
                      <Share2 size={14} aria-hidden />
                      Share
                    </button>
                    {shareOpenId === item.id ? (
                      <>
                        <a
                          href={emailShareHref(item)}
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-burgundy text-white text-xs font-black uppercase tracking-widest"
                        >
                          <Mail size={14} aria-hidden />
                          Email
                        </a>
                        <a
                          href={whatsappShareHref(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-[#128C7E] text-white text-xs font-black uppercase tracking-widest"
                        >
                          <MessageCircle size={14} aria-hidden />
                          WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => void shareViaMessengers(item)}
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-gold text-burgundy text-xs font-black uppercase tracking-widest"
                        >
                          <Smartphone size={14} aria-hidden />
                          Messengers
                        </button>
                      </>
                    ) : null}
                  </div>
                  {shareOpenId === item.id && shareNote ? (
                    <p className="mt-2 text-xs font-medium text-gray-500">{shareNote}</p>
                  ) : null}
                </article>
              ))
            : null}
        </div>
      </div>
    </MemberHomeSection>
  );
};

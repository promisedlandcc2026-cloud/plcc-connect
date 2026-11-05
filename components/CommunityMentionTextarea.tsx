import React, { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { searchMentionCandidates } from '../lib/communityMentionClient';
import {
  buildFeedMentionToken,
  findActiveMentionQuery,
  isValidMentionCandidateId,
  MENTION_QUERY_MIN_CHARS,
  type MentionCandidate,
} from '../lib/communityMentionFormat';

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

/**
 * Plain-text textarea with Vault-compatible @mention autocomplete.
 * Inserts @[Name](mention:uuid). Never logs search terms.
 */
export const CommunityMentionTextarea: React.FC<Props> = ({
  id,
  value,
  onChange,
  maxLength,
  rows = 4,
  disabled,
  placeholder,
  className,
  'aria-label': ariaLabel,
}) => {
  const { user, memberAccessState, isAuthenticated } = useAuth();
  const authUserId = user?.id || null;
  const listboxId = useId();
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const blurTimerRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const [picker, setPicker] = useState<{
    start: number;
    query: string;
    items: MentionCandidate[];
    active: number;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const clearPicker = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setPicker(null);
  };

  useEffect(() => {
    clearPicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity boundary
  }, [authUserId, isAuthenticated, memberAccessState]);

  useEffect(() => {
    return () => {
      clearPicker();
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = (query: string, start: number) => {
    if (memberAccessState !== 'approved_member') {
      setPicker(null);
      return;
    }
    if (query.length < MENTION_QUERY_MIN_CHARS) {
      setPicker({
        start,
        query,
        items: [],
        active: 0,
        loading: false,
        error: null,
      });
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setPicker((prev) =>
        prev && prev.start === start && prev.query === query
          ? { ...prev, loading: true, error: null }
          : {
              start,
              query,
              items: [],
              active: 0,
              loading: true,
              error: null,
            }
      );

      try {
        const items = await searchMentionCandidates(query, {
          signal: controller.signal,
        });
        if (requestId !== requestIdRef.current) return;
        setPicker({
          start,
          query,
          items,
          active: 0,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (requestId !== requestIdRef.current) return;
        setPicker({
          start,
          query,
          items: [],
          active: 0,
          loading: false,
          error: 'Could not search members. You can still type without mentions.',
        });
      }
    }, 200);
  };

  const insertMention = (candidate: MentionCandidate) => {
    if (!picker) return;
    if (!isValidMentionCandidateId(candidate.id)) return;
    const token = buildFeedMentionToken(candidate.name, candidate.id);
    if (!token) return;

    const before = value.slice(0, picker.start);
    const caret = taRef.current?.selectionStart ?? value.length;
    const after = value.slice(caret);
    const next = `${before}${token} ${after}`;
    if (next.length > maxLength) {
      setPicker((p) =>
        p
          ? {
              ...p,
              error: 'That mention makes the text too long. Shorten it and try again.',
            }
          : p
      );
      return;
    }
    onChange(next);
    clearPicker();
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      const pos = (before + token + ' ').length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!picker) {
      if (e.key === 'Escape') clearPicker();
      return;
    }
    if (picker.items.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearPicker();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPicker((p) =>
        p ? { ...p, active: (p.active + 1) % p.items.length } : p
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPicker((p) =>
        p ? { ...p, active: (p.active - 1 + p.items.length) % p.items.length } : p
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(picker.items[picker.active] || picker.items[0]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearPicker();
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value.slice(0, maxLength);
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    const active = findActiveMentionQuery(next, caret);
    if (!active) {
      clearPicker();
      return;
    }
    runSearch(active.query, active.start);
  };

  const onBlur = () => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    blurTimerRef.current = window.setTimeout(() => {
      clearPicker();
    }, 180);
  };

  const onFocus = () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        id={id}
        value={value}
        onChange={onInput}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        aria-label={ariaLabel || 'Text'}
        aria-autocomplete="list"
        aria-expanded={Boolean(picker)}
        aria-controls={picker ? listboxId : undefined}
      />

      {picker && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Mention members"
          className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-lg"
        >
          {picker.loading && picker.items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500" role="status">
              Searching…
            </p>
          ) : picker.error ? (
            <p className="px-3 py-2 text-xs text-gray-500" role="status">
              {picker.error}
            </p>
          ) : picker.query.length < MENTION_QUERY_MIN_CHARS ? (
            <p className="px-3 py-2 text-xs text-gray-500" role="status">
              Keep typing a name…
            </p>
          ) : picker.items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500" role="status">
              No members found
            </p>
          ) : (
            picker.items.map((c, idx) => {
              const initial = (c.name || '?').charAt(0).toUpperCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={idx === picker.active}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm min-h-[44px] ${
                    idx === picker.active ? 'bg-burgundy/10' : 'hover:bg-gray-50'
                  }`}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    insertMention(c);
                  }}
                >
                  {c.avatarUrl ? (
                    <img
                      src={c.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-100"
                    />
                  ) : (
                    <span
                      className="w-8 h-8 rounded-full bg-burgundy/10 text-burgundy text-xs font-bold flex items-center justify-center shrink-0"
                      aria-hidden
                    >
                      {initial}
                    </span>
                  )}
                  <span className="font-semibold text-[#1A1A1A] truncate">{c.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

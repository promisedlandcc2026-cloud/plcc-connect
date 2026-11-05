/**
 * Phase 2.6D.3 — guardian child PLCC card (approved-member, view-only).
 * Authorization: fresh get_my_guardian_child_cards + exact cardRef match.
 * Route cardRef is a selector only — never sufficient alone.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { DependentDigitalCard } from '../components/family/DependentDigitalCard';
import { ErrorState, LoadingState } from '../components/ui/States';
import { isDependentCardRef } from '../lib/dependentCardRef';
import {
  fetchMyGuardianDependentCards,
} from '../lib/dependentCardClient';
import type { GuardianDependentCard } from '../lib/dependentCardTypes';
import {
  DEPENDENT_CARD_ACCESS_COPY,
  dependentCardPageLoadErrorMessage,
  dependentCardUnavailableMessage,
} from '../lib/dependentCardUi';

type PageState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; card: GuardianDependentCard };

export const MemberDependentCardPage: React.FC = () => {
  const { cardRef: routeRef } = useParams<{ cardRef: string }>();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!isDependentCardRef(routeRef)) {
      setState({ kind: 'unavailable' });
      return;
    }

    setState({ kind: 'loading' });
    try {
      const cards = await fetchMyGuardianDependentCards();
      const match = cards.find((c) => c.cardRef === routeRef) || null;
      if (!match) {
        setState({ kind: 'unavailable' });
        return;
      }
      setState({ kind: 'ready', card: match });
    } catch {
      setState({ kind: 'error', message: dependentCardPageLoadErrorMessage() });
    }
  }, [routeRef]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="flex-1 px-5 pt-10 pb-28 max-w-[500px] w-full mx-auto">
      <MemberPageHeader
        title="Child PLCC Card"
        eyebrow="Family"
        subtitle={DEPENDENT_CARD_ACCESS_COPY}
        backTo="/family"
        backLabel="Back to My Family"
      />

      {state.kind === 'loading' ? (
        <LoadingState message="Loading child card…" />
      ) : null}

      {state.kind === 'error' ? (
        <ErrorState
          message={state.message}
          onRetry={() => void load()}
          retryLabel="Retry"
        />
      ) : null}

      {state.kind === 'unavailable' ? (
        <div className="space-y-4" role="alert">
          <p className="text-sm text-gray-600 leading-relaxed">
            {dependentCardUnavailableMessage()}
          </p>
          <Link
            to="/family"
            className="inline-flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-burgundy text-white text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          >
            Back to My Family
          </Link>
        </div>
      ) : null}

      {state.kind === 'ready' ? <DependentDigitalCard card={state.card} /> : null}
    </main>
  );
};

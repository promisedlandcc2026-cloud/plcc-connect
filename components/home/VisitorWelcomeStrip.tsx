/**
 * Compact visitor invite on Public Home — service time + Plan a Visit / account CTAs.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin } from 'lucide-react';
import { CHURCH_INFO } from '../../data';
import { PlanVisitModule } from '../PlanVisitModule';

const sunday = CHURCH_INFO.schedule.find((s) => s.day === 'Sunday');

export const VisitorWelcomeStrip: React.FC = () => {
  const [visitOpen, setVisitOpen] = useState(false);

  return (
    <>
      <section
        aria-labelledby="visitor-welcome-heading"
        className="rounded-2xl border border-burgundy/15 bg-white px-4 py-4 shadow-sm space-y-3"
      >
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-gold-ink">Welcome</p>
          <h2 id="visitor-welcome-heading" className="text-base font-bold text-[#1A1A1A] leading-snug">
            Glad you’re here
          </h2>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            Join us for worship — everybody is somebody at PLCC.
          </p>
        </div>

        {sunday ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-burgundy/[0.04] border border-burgundy/10 px-3 py-2.5">
            <CalendarDays size={16} className="text-burgundy shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1A1A1A]">{sunday.event}</p>
              <p className="text-xs text-gray-600">Sundays · {sunday.time}</p>
              <p className="mt-1 flex items-start gap-1 text-xs text-gray-500 leading-snug">
                <MapPin size={12} className="shrink-0 mt-0.5" aria-hidden />
                <span>{CHURCH_INFO.address}</span>
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setVisitOpen(true)}
            className="inline-flex w-full items-center justify-center min-h-[48px] px-4 rounded-full bg-burgundy text-white text-[13px] font-bold active:scale-[0.98] transition-transform"
          >
            Plan a Visit
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/sign-in"
              state={{ intent: 'join' }}
              className="inline-flex items-center justify-center min-h-[48px] px-3 rounded-full border border-burgundy/25 bg-white text-burgundy text-xs font-bold active:scale-[0.98] transition-transform text-center"
            >
              Create account
            </Link>
            <Link
              to="/sign-in"
              state={{ intent: 'signin' }}
              className="inline-flex items-center justify-center min-h-[48px] px-3 rounded-full border border-gray-200 bg-gray-50 text-[#1A1A1A] text-xs font-bold active:scale-[0.98] transition-transform text-center"
            >
              Sign in
            </Link>
          </div>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          New to PLCC Connect? Create an account with your email — we’ll send a one-time code. Already
          have one? Sign in. Members unlock Sunday Mode, notes, and community after church approval.
        </p>
      </section>

      <PlanVisitModule isOpen={visitOpen} onClose={() => setVisitOpen(false)} />
    </>
  );
};

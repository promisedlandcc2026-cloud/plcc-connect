import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { memberHomeGreeting } from '../../lib/memberGreeting';
import { AWCLogo } from '../ui/AWCLogo';

export const MemberHomeGreeting: React.FC = () => {
  const { identity } = useAuth();
  const greeting = memberHomeGreeting(identity?.name ?? null);

  return (
    <header className="pt-2 pb-1">
      <div className="flex items-center gap-3 mb-4">
        <AWCLogo size={40} />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gold">My PLCC</p>
      </div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] leading-tight">{greeting}</h1>
      <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
        Here&apos;s what matters at Promised Land Christian Center today.
      </p>
    </header>
  );
};
